// MarketDataService — IMarketDataService implementation: caching, subscription dedup,
// closed-candle persistence, event publication, gateway relay.
// Owner: Hoang
// See: kb/modules/market-data.md, kb/contracts/market-data.yaml, ADR-0007
//
// BR-1: one stream per symbol:timeframe (subscriberCount dedup).
// BR-2: only closed candles are persisted.
// BR-3: frontend never talks to Binance directly — all data flows through this service.

import {
  Inject,
  Injectable,
  Logger,
  Optional,
  forwardRef,
} from '@nestjs/common';
import {
  Candle,
  EventType,
  IMarketDataService,
  Subscription,
  TradingPair,
} from '@crypto-strategy-lab/shared';
import type {
  IEventBus,
  IMarketDataAdapter,
  MarketDataUpdatedPayload,
} from '@crypto-strategy-lab/shared';

import { PrismaService } from '../../database/prisma.service';
import {
  IMARKET_DATA_ADAPTER,
  IMARKET_DATA_GATEWAY,
  IEVENT_BUS,
} from '../../shared/tokens';
import type { IMarketDataGateway } from '../websocket/market-data.gateway.interface';
import {
  CANDLE_CACHE_TTL_MS,
  CANDLE_DEFAULT_LIMIT,
  CANDLE_MAX_LIMIT,
  TIMEFRAME_MS,
} from '../../shared/constants';

/**
 * Service surface exposed to the REST controller. The cross-module export
 * (IMARKET_DATA_SERVICE) stays the narrower IMarketDataService contract.
 */
export interface IMarketDataApiService extends IMarketDataService {
  getTradingPairs(): Promise<TradingPair[]>;
  listSubscriptions(): Subscription[];
  isValidSubscription(symbol: string, timeframe: string): Promise<boolean>;
}

interface CacheEntry {
  candles: Candle[];
  expiresAt: number;
}

@Injectable()
export class MarketDataService implements IMarketDataApiService {
  private readonly logger = new Logger(MarketDataService.name);

  /** Historical-candle cache keyed `symbol:timeframe`, TTL 60s (data-model.md §2). */
  private readonly cache = new Map<string, CacheEntry>();
  /** Active subscriptions keyed `symbol:timeframe` with subscriberCount (BR-1). */
  private readonly subscriptions = new Map<string, Subscription>();

  constructor(
    @Inject(IMARKET_DATA_ADAPTER) private readonly adapter: IMarketDataAdapter,
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => IMARKET_DATA_GATEWAY))
    private readonly gateway: IMarketDataGateway,
    @Optional() @Inject(IEVENT_BUS) private readonly eventBus: IEventBus | null,
  ) {
    // Wire adapter callbacks once — the adapter invokes these for every stream.
    this.adapter.onCandle((candle) => void this.handleCandle(candle));
    this.adapter.onDisconnect(() => this.gateway.emitStatus('disconnected'));
    this.adapter.onReconnect(() => this.gateway.emitStatus('reconnected'));

    if (!this.eventBus) {
      // Temporary stub until Phuong's EventsModule provides the IEVENT_BUS token (spec.md §9).
      this.logger.warn(
        'IEventBus not available — MarketDataUpdated publication disabled (optional injection; startup unaffected).',
      );
    }
  }

  // ──────────────────────────────────────────────
  // Historical candles (FR-1)
  // ──────────────────────────────────────────────

  async getCandles(
    symbol: string,
    timeframe: string,
    limit: number = CANDLE_DEFAULT_LIMIT,
  ): Promise<Candle[]> {
    const clampedLimit = Math.min(
      Math.max(1, Math.trunc(limit)),
      CANDLE_MAX_LIMIT,
    );
    const key = `${symbol}:${timeframe}`;

    const entry = this.cache.get(key);
    if (entry && entry.expiresAt > Date.now()) {
      return entry.candles.slice(0, clampedLimit);
    }

    const candles = await this.adapter.fetchKlines(symbol, timeframe, {
      limit: clampedLimit,
    });
    this.cache.set(key, {
      candles,
      expiresAt: Date.now() + CANDLE_CACHE_TTL_MS,
    });
    return candles.slice(0, clampedLimit);
  }

  /**
   * DB-first range query (persisted closed candles, BR-2) with adapter backfill for gaps.
   * Consumed by Huy's Backtester and Phuong's Job Queue Worker via IMarketDataService.
   */
  async getCandlesRange(
    symbol: string,
    timeframe: string,
    startTime: Date,
    endTime: Date,
  ): Promise<Candle[]> {
    const dbRows = await this.prisma.candle.findMany({
      where: { symbol, timeframe, openTime: { gte: startTime, lte: endTime } },
      orderBy: { openTime: 'asc' },
    });

    const merged = new Map<number, Candle>();
    for (const row of dbRows) {
      merged.set(row.openTime.getTime(), {
        symbol: row.symbol,
        timeframe: row.timeframe,
        openTime: row.openTime,
        closeTime: row.closeTime,
        open: row.open,
        high: row.high,
        low: row.low,
        close: row.close,
        volume: row.volume,
        isClosed: row.isClosed,
      });
    }

    const stepMs = TIMEFRAME_MS[timeframe];
    if (stepMs) {
      for (const gap of this.findGaps(merged, startTime, endTime, stepMs)) {
        const fetched = await this.adapter.fetchKlines(symbol, timeframe, {
          startTime: gap.from,
          endTime: gap.to,
          limit: CANDLE_MAX_LIMIT,
        });
        for (const candle of fetched) {
          const t = candle.openTime.getTime();
          if (
            t >= startTime.getTime() &&
            t <= endTime.getTime() &&
            !merged.has(t)
          ) {
            merged.set(t, candle);
          }
        }
      }
    }

    return [...merged.values()].sort(
      (a, b) => a.openTime.getTime() - b.openTime.getTime(),
    );
  }

  /** Finds contiguous candle slots in [start, end] missing from the DB result. */
  private findGaps(
    existing: Map<number, Candle>,
    startTime: Date,
    endTime: Date,
    stepMs: number,
  ): Array<{ from: Date; to: Date }> {
    const gaps: Array<{ from: Date; to: Date }> = [];
    let gapStart: number | null = null;
    const first = Math.ceil(startTime.getTime() / stepMs) * stepMs;
    for (let t = first; t <= endTime.getTime(); t += stepMs) {
      if (existing.has(t)) {
        if (gapStart !== null) {
          gaps.push({ from: new Date(gapStart), to: new Date(t) });
          gapStart = null;
        }
      } else if (gapStart === null) {
        gapStart = t;
      }
    }
    if (gapStart !== null) {
      gaps.push({ from: new Date(gapStart), to: endTime });
    }
    return gaps;
  }

  // ──────────────────────────────────────────────
  // Subscriptions (FR-4)
  // ──────────────────────────────────────────────

  subscribe(symbol: string, timeframe: string): void {
    const key = `${symbol}:${timeframe}`;
    const existing = this.subscriptions.get(key);
    if (existing) {
      existing.subscriberCount += 1; // dedup: no second Binance stream (BR-1)
      return;
    }
    this.subscriptions.set(key, {
      symbol,
      timeframe,
      subscribedAt: new Date(),
      subscriberCount: 1,
    });
    this.adapter.connectStream(symbol, timeframe); // 0→1 opens the stream
    this.gateway.emitStatus('connected');
  }

  unsubscribe(symbol: string, timeframe: string): void {
    const key = `${symbol}:${timeframe}`;
    const existing = this.subscriptions.get(key);
    if (!existing) return;
    existing.subscriberCount -= 1;
    if (existing.subscriberCount <= 0) {
      this.subscriptions.delete(key);
      this.adapter.disconnectStream(symbol, timeframe); // 1→0 closes the stream
    }
  }

  listSubscriptions(): Subscription[] {
    return [...this.subscriptions.values()];
  }

  // ──────────────────────────────────────────────
  // Reference data (FR-8)
  // ──────────────────────────────────────────────

  async getTradingPairs(): Promise<TradingPair[]> {
    return this.prisma.tradingPair.findMany({ where: { isActive: true } });
  }

  /** Flow 6d validation — unknown/inactive pair or unknown timeframe → 400 at the controller. */
  async isValidSubscription(
    symbol: string,
    timeframe: string,
  ): Promise<boolean> {
    if (!TIMEFRAME_MS[timeframe]) return false;
    const pair = await this.prisma.tradingPair.findUnique({
      where: { symbol },
    });
    return Boolean(pair?.isActive);
  }

  // ──────────────────────────────────────────────
  // Candle pipeline (FR-5, FR-6, FR-7)
  // ──────────────────────────────────────────────

  /** Invoked by the adapter for every normalized candle (live stream + gap recovery). */
  private async handleCandle(candle: Candle): Promise<void> {
    if (candle.isClosed) {
      await this.persistClosedCandle(candle); // BR-2: persist before relay
      this.cache.delete(`${candle.symbol}:${candle.timeframe}`); // invalidate on candle:close
    }
    this.publishMarketDataUpdated(candle);
    this.gateway.emitCandle(candle.symbol, candle.timeframe, candle);
  }

  /** Idempotent upsert — dedup on @@unique([symbol, timeframe, openTime]) (ADR-0007 clock skew). */
  private async persistClosedCandle(candle: Candle): Promise<void> {
    const data = {
      closeTime: candle.closeTime,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume,
      isClosed: true,
    };
    try {
      await this.prisma.candle.upsert({
        where: {
          symbol_timeframe_openTime: {
            symbol: candle.symbol,
            timeframe: candle.timeframe,
            openTime: candle.openTime,
          },
        },
        create: {
          symbol: candle.symbol,
          timeframe: candle.timeframe,
          openTime: candle.openTime,
          ...data,
        },
        update: data,
      });
    } catch (error) {
      this.logger.error(
        `Failed to persist closed candle ${candle.symbol}:${candle.timeframe}@${candle.openTime.toISOString()}: ${String(error)}`,
      );
    }
  }

  /** Fire-and-forget publication — no bus subscribers in MVP (events.yaml). */
  private publishMarketDataUpdated(candle: Candle): void {
    if (!this.eventBus) return; // absence already warned at init
    const payload: MarketDataUpdatedPayload = {
      symbol: candle.symbol,
      timeframe: candle.timeframe,
      candle,
    };
    this.eventBus.publish(EventType.MarketDataUpdated, payload);
  }
}

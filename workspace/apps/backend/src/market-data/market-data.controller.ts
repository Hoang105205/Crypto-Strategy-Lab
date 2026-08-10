// MarketDataController — REST endpoints for the Market Data module
// Owner: Hoang
// See: kb/contracts/market-data.yaml §endpoints, kb/flows/realtime-market-data.md (steps 6, 6d)

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Query,
} from '@nestjs/common';
import { Candle, Subscription, TradingPair } from '@crypto-strategy-lab/shared';

import { IMARKET_DATA_SERVICE } from '../shared/tokens';
import type { IMarketDataApiService } from './services/market-data.service';
import { CANDLE_DEFAULT_LIMIT } from '../shared/constants';

interface SubscribeRequest {
  symbol: string;
  timeframe: string;
}

const INVALID_PAIR_ERROR = { error: 'Invalid symbol or timeframe' };

@Controller('api/market-data')
export class MarketDataController {
  constructor(
    @Inject(IMARKET_DATA_SERVICE)
    private readonly service: IMarketDataApiService,
  ) {}

  /** GET /api/market-data/candles?symbol&timeframe&limit (default 500, max 1000). */
  @Get('candles')
  async getCandles(
    @Query('symbol') symbol: string | undefined,
    @Query('timeframe') timeframe: string | undefined,
    @Query('limit') limit?: string,
  ): Promise<Candle[]> {
    await this.assertValidPair(symbol, timeframe);
    const parsedLimit =
      limit !== undefined ? parseInt(limit, 10) : CANDLE_DEFAULT_LIMIT;
    if (!Number.isFinite(parsedLimit) || parsedLimit < 1) {
      throw new BadRequestException(INVALID_PAIR_ERROR);
    }
    return this.service.getCandles(symbol!, timeframe!, parsedLimit);
  }

  /** GET /api/market-data/pairs — active TradingPair[] (FR-8). */
  @Get('pairs')
  async getPairs(): Promise<TradingPair[]> {
    return this.service.getTradingPairs();
  }

  /** GET /api/market-data/subscriptions — runtime Subscription[] for the status panel (FR-8). */
  @Get('subscriptions')
  getSubscriptions(): Subscription[] {
    return this.service.listSubscriptions();
  }

  /** POST /api/market-data/subscribe — opens a stream on 0→1 only (BR-1, flow 6d). */
  @Post('subscribe')
  async subscribe(
    @Body() body: SubscribeRequest,
  ): Promise<{ status: string; symbol: string; timeframe: string }> {
    await this.assertValidPair(body?.symbol, body?.timeframe);
    this.service.subscribe(body.symbol, body.timeframe);
    return {
      status: 'subscribed',
      symbol: body.symbol,
      timeframe: body.timeframe,
    };
  }

  /** POST /api/market-data/unsubscribe — closes the stream on 1→0 only. */
  @Post('unsubscribe')
  async unsubscribe(
    @Body() body: SubscribeRequest,
  ): Promise<{ status: string }> {
    await this.assertValidPair(body?.symbol, body?.timeframe);
    this.service.unsubscribe(body.symbol, body.timeframe);
    return { status: 'unsubscribed' };
  }

  private async assertValidPair(
    symbol: string | undefined,
    timeframe: string | undefined,
  ): Promise<void> {
    if (
      !symbol ||
      !timeframe ||
      !(await this.service.isValidSubscription(symbol, timeframe))
    ) {
      throw new BadRequestException(INVALID_PAIR_ERROR);
    }
  }
}

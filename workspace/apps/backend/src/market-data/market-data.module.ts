// MarketDataModule — Binance adapter, caching, WebSocket gateway
// Owner: Hoang
// See: kb/modules/market-data.md, kb/contracts/market-data.yaml, ADR-0004, ADR-0007
//
// DI: concrete BinanceAdapter bound behind the IMARKET_DATA_ADAPTER token (ADR-0004 seam).
// IMARKET_DATA_SERVICE is exported so Huy (Strategy Engine) and Phuong (Job Queue Worker)
// inject IMarketDataService without ever depending on BinanceAdapter (Constitution II).
// IEVENT_BUS is provided by EventsModule as the required event-publication seam.

import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';
import { EventsModule } from '../events/events.module';
import { BinanceAdapter } from './adapters/binance.adapter';
import { MarketDataService } from './services/market-data.service';
import { MarketDataGateway } from './websocket/market-data.gateway';
import { MarketDataController } from './market-data.controller';
import {
  IMARKET_DATA_ADAPTER,
  IMARKET_DATA_SERVICE,
  IMARKET_DATA_GATEWAY,
} from '../shared/tokens';

@Module({
  imports: [DatabaseModule, EventsModule],
  controllers: [MarketDataController],
  providers: [
    { provide: IMARKET_DATA_ADAPTER, useClass: BinanceAdapter },
    MarketDataService,
    { provide: IMARKET_DATA_SERVICE, useExisting: MarketDataService },
    MarketDataGateway,
    { provide: IMARKET_DATA_GATEWAY, useExisting: MarketDataGateway },
  ],
  exports: [IMARKET_DATA_SERVICE],
})
export class MarketDataModule {}

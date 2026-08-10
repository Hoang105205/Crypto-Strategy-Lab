// MarketDataModule DI wiring test (T1.8 acceptance) — boots the module with a stubbed
// PrismaService (no DB) and verifies the exported IMARKET_DATA_SERVICE token resolves.

import { Test } from '@nestjs/testing';

import { MarketDataModule } from './market-data.module';
import { PrismaService } from '../database/prisma.service';
import { IMARKET_DATA_SERVICE } from '../shared/tokens';
import { IMarketDataService } from '@crypto-strategy-lab/shared';

describe('MarketDataModule wiring (T1.8)', () => {
  it('boots without DI errors and exports IMarketDataService', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [MarketDataModule],
    })
      .overrideProvider(PrismaService)
      .useValue({ candle: {}, tradingPair: {} })
      .compile();

    await moduleRef.init();

    const service = moduleRef.get<IMarketDataService>(IMARKET_DATA_SERVICE);
    expect(service).toBeDefined();
    expect(typeof service.getCandles).toBe('function');
    expect(typeof service.getCandlesRange).toBe('function');
    expect(typeof service.subscribe).toBe('function');

    await moduleRef.close();
  });
});

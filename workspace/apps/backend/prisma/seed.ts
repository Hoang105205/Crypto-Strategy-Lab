// Prisma seed — static TradingPair reference data
// Owner: Hoang | See: sdd_artifacts/market-data-backend/data-model.md §1 (TradingPair)
// Run: npx prisma db seed

import { PrismaClient } from '@prisma/client';
import { DEFAULT_CRAWLER_RULES } from '@crypto-strategy-lab/shared';

const prisma = new PrismaClient();

// Seed pairs per data-model.md: BTCUSDT, ETHUSDT, BNBUSDT, SOLUSDT, XRPUSDT
const SEED_TRADING_PAIRS = [
  { symbol: 'BTCUSDT', baseAsset: 'BTC', quoteAsset: 'USDT', isActive: true },
  { symbol: 'ETHUSDT', baseAsset: 'ETH', quoteAsset: 'USDT', isActive: true },
  { symbol: 'BNBUSDT', baseAsset: 'BNB', quoteAsset: 'USDT', isActive: true },
  { symbol: 'SOLUSDT', baseAsset: 'SOL', quoteAsset: 'USDT', isActive: true },
  { symbol: 'XRPUSDT', baseAsset: 'XRP', quoteAsset: 'USDT', isActive: true },
];

async function main() {
  for (const pair of SEED_TRADING_PAIRS) {
    await prisma.tradingPair.upsert({
      where: { symbol: pair.symbol },
      create: pair,
      update: pair,
    });
  }
  const pairCount = await prisma.tradingPair.count();
  console.log(`Seeded TradingPair table — ${pairCount} rows present.`);

  for (const rule of DEFAULT_CRAWLER_RULES) {
    await prisma.crawlerRule.upsert({
      where: { domain: rule.domain },
      create: rule,
      update: rule,
    });
  }
  const ruleCount = await prisma.crawlerRule.count();
  console.log(`Seeded CrawlerRule table — ${ruleCount} rows present.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

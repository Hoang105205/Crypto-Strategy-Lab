// Prisma seed — static TradingPair reference data
// Owner: Hoang | See: sdd_artifacts/market-data-backend/data-model.md §1 (TradingPair)
// Run: npx prisma db seed

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Seed pairs per data-model.md: BTCUSDT, ETHUSDT, BNBUSDT, SOLUSDT, XRPUSDT
const SEED_TRADING_PAIRS = [
  { symbol: 'BTCUSDT', baseAsset: 'BTC', quoteAsset: 'USDT', isActive: true },
  { symbol: 'ETHUSDT', baseAsset: 'ETH', quoteAsset: 'USDT', isActive: true },
  { symbol: 'BNBUSDT', baseAsset: 'BNB', quoteAsset: 'USDT', isActive: true },
  { symbol: 'SOLUSDT', baseAsset: 'SOL', quoteAsset: 'USDT', isActive: true },
  { symbol: 'XRPUSDT', baseAsset: 'XRP', quoteAsset: 'USDT', isActive: true },
];

// Seed distinct web crawler rules per ADR-0014 (100% separate from RSS sources: CoinDesk, CoinTelegraph, Decrypt)
const SEED_CRAWLER_RULES = [
  {
    domain: 'cryptoslate.com',
    targetUrl: 'https://cryptoslate.com/news/',
    containerSelector: 'article, div.news-feed article, div.article-card, div.list-post',
    titleSelector: 'h2, h3, a.post-title',
    contentSelector: 'p, div.post-excerpt, div.excerpt',
    linkSelector: 'a[href]',
    dateSelector: 'time, span.post-date',
    isActive: true,
  },
  {
    domain: 'bitcoinmagazine.com',
    targetUrl: 'https://bitcoinmagazine.com/articles',
    containerSelector: 'div.td_module_wrap, div.td-module-meta-info, div.td-block-span12',
    titleSelector: 'h3.entry-title a, h2 a, a',
    contentSelector: 'div.td-excerpt, p',
    linkSelector: 'h3.entry-title a, a[href]',
    dateSelector: 'time, span.td-post-date',
    isActive: true,
  },
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

  for (const rule of SEED_CRAWLER_RULES) {
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

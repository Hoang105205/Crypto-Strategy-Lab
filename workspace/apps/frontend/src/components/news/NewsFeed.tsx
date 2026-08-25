'use client';

// NewsFeed Component — Renders crypto news articles with sentiment badges, coin filters & pagination
// Owner: Thuan | See: contracts/news-api.md, kb/DESIGN.md & Binance Dark Theme Spec

import React, { useEffect, useState, useRef } from 'react';

export interface NewsArticle {
  id: string;
  source: string;
  title: string;
  content: string;
  url: string;
  publishedAt: string;
  crawledAt: string;
  relatedCoins: string[];
  sentimentScore: number | null;
  sentimentLabel: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | null;
}

export interface AggregateSentiment {
  score: number;
  label: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  articleCount: number;
  positiveCount?: number;
  neutralCount?: number;
  negativeCount?: number;
  positiveRatio?: number; // 0-100%
  neutralRatio?: number;  // 0-100%
  negativeRatio?: number; // 0-100%
  updatedAt: string;
}

export type TimeframeOption = '1h' | '24h' | '7d';

export interface NewsFeedProps {
  selectedCoin?: string;
  onCoinChange?: (coin: string) => void;
}

const DEFAULT_AVAILABLE_COINS = ['ALL', 'BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'GENERAL'];
const DEFAULT_PAGE_SIZE = 10;
const COOLDOWN_DURATION_SEC = 120;
const CRAWL_STORAGE_KEY = 'news_last_crawl_timestamp';

export const NewsFeed: React.FC<NewsFeedProps> = ({
  selectedCoin = 'ALL',
  onCoinChange,
}) => {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [aggregate, setAggregate] = useState<AggregateSentiment | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState<number>(0);

  // Manual Ingestion & Cooldown States (OP.GG style)
  const [isCrawling, setIsCrawling] = useState<boolean>(false);
  const [crawlCooldown, setCrawlCooldown] = useState<number>(0);
  const [crawlMessage, setCrawlMessage] = useState<string | null>(null);

  // Dynamic Available Coins from TradingPair DB
  const [availableCoins, setAvailableCoins] = useState<string[]>(DEFAULT_AVAILABLE_COINS);

  // Coin Filter States (Single & Multi-coin)
  const [activeTab, setActiveTab] = useState<string>(selectedCoin);
  const [isMultiCoinMode, setIsMultiCoinMode] = useState<boolean>(false);
  const [selectedCoins, setSelectedCoins] = useState<string[]>([]);

  // Timeframe Selector State
  const [selectedTimeframe, setSelectedTimeframe] = useState<TimeframeOption>('24h');

  // Offset Pagination States
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = DEFAULT_PAGE_SIZE;
  const [totalArticles, setTotalArticles] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [paginationMode, setPaginationMode] = useState<'pages' | 'loadMore'>('pages');

  // Mouse Drag-to-Scroll refs & state
  const tabsRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  // Fetch dynamic trading pairs on mount to populate coin tabs
  useEffect(() => {
    let ignore = false;
    const fetchTradingPairs = async () => {
      try {
        const res = await fetch('http://localhost:3001/api/market-data/pairs');
        if (res.ok) {
          const pairs = await res.json();
          if (Array.isArray(pairs) && pairs.length > 0 && !ignore) {
            const baseCoins = Array.from(
              new Set(
                pairs
                  .filter((p: { isActive?: boolean; baseAsset?: string }) => p.isActive !== false && p.baseAsset)
                  .map((p: { baseAsset: string }) => p.baseAsset.toUpperCase())
              )
            ) as string[];
            setAvailableCoins(['ALL', ...baseCoins, 'GENERAL']);
          }
        }
      } catch {
        // Fallback to default available coins
      }
    };
    void fetchTradingPairs();
    return () => {
      ignore = true;
    };
  }, []);

  // Hydrate last crawl timestamp from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CRAWL_STORAGE_KEY);
      if (stored) {
        const lastTime = parseInt(stored, 10);
        const elapsedSec = Math.floor((Date.now() - lastTime) / 1000);
        if (elapsedSec < COOLDOWN_DURATION_SEC) {
          setCrawlCooldown(COOLDOWN_DURATION_SEC - elapsedSec);
        }
      }
    } catch {
      // Ignore localStorage read errors in SSR/strict sandbox
    }
  }, []);

  // Countdown timer ticker (1s interval)
  useEffect(() => {
    if (crawlCooldown <= 0) return;
    const interval = setInterval(() => {
      setCrawlCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [crawlCooldown]);

  // Format seconds to mm:ss
  const formatCountdown = (sec: number): string => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Manual Crawl Trigger (OP.GG style)
  const handleManualCrawl = async () => {
    if (isCrawling || crawlCooldown > 0) return;
    setIsCrawling(true);
    setCrawlMessage(null);
    try {
      const res = await fetch('http://localhost:3001/api/news/crawl', {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const now = Date.now();
        try {
          localStorage.setItem(CRAWL_STORAGE_KEY, now.toString());
        } catch {
          // Ignore localStorage write error
        }
        setCrawlCooldown(COOLDOWN_DURATION_SEC);
        setCrawlMessage(`✅ ${data.message || (data.count > 0 ? `Ingestion successful! Added ${data.count} new articles.` : 'Feeds are up to date. No new articles found.')}`);
        // Trigger re-fetch for articles and aggregate mood
        setRetryCount((prev) => prev + 1);
      } else if (res.status === 429) {
        const retrySec = data.retryAfterSeconds || COOLDOWN_DURATION_SEC;
        setCrawlCooldown(retrySec);
        setCrawlMessage(`⏳ Cooldown active. Available in ${retrySec}s.`);
      } else {
        setCrawlMessage(`⚠️ ${data.error || 'News ingestion failed'}`);
      }
    } catch {
      setCrawlMessage('❌ Connection error to news ingestion service.');
    } finally {
      setIsCrawling(false);
    }
  };

  // Effect A: Synchronize News Articles when filter, page or retry trigger changes
  useEffect(() => {
    let ignore = false;

    const loadArticles = async () => {
      try {
        const offset = (currentPage - 1) * pageSize;
        const limitParam = `limit=${pageSize}`;
        const offsetParam = `offset=${offset}`;

        let coinParams = '';
        if (isMultiCoinMode && selectedCoins.length > 0) {
          coinParams = `coins=${selectedCoins.join(',')}`;
        } else if (activeTab && activeTab !== 'ALL') {
          coinParams = `coin=${activeTab}`;
        }

        const queryStr = [limitParam, offsetParam, coinParams].filter(Boolean).join('&');
        const newsRes = await fetch(`http://localhost:3001/api/news?${queryStr}`);

        if (newsRes.ok) {
          const newsJson = await newsRes.json();
          const fetchedData: NewsArticle[] = newsJson.data || [];
          const pagMeta = newsJson.pagination || { total: fetchedData.length, limit: pageSize, offset, hasMore: false };

          if (!ignore) {
            setArticles(fetchedData);
            setTotalArticles(pagMeta.total);
            setHasMore(pagMeta.hasMore);
            setFetchError(null);
          }
        } else {
          if (!ignore) {
            setArticles([]);
            setTotalArticles(0);
            setHasMore(false);
            setFetchError('Backend server returned an error response.');
          }
        }
      } catch {
        if (!ignore) {
          setArticles([]);
          setTotalArticles(0);
          setHasMore(false);
          setFetchError('Unable to connect to live news service. Please verify backend server and internet connection.');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    };

    void loadArticles();

    return () => {
      ignore = true;
    };
  }, [currentPage, pageSize, activeTab, selectedCoins, isMultiCoinMode, retryCount]);

  // Effect B: Synchronize Aggregate Sentiment when timeframe, coin selection or retry changes
  useEffect(() => {
    let ignore = false;

    const loadAggregate = async () => {
      try {
        let coinParams = '';
        if (isMultiCoinMode && selectedCoins.length > 0) {
          coinParams = `coins=${selectedCoins.join(',')}`;
        } else if (activeTab && activeTab !== 'ALL') {
          coinParams = `coin=${activeTab}`;
        }
        const aggParams = [coinParams, `timeframe=${selectedTimeframe}`].filter(Boolean).join('&');
        const aggQueryStr = aggParams ? `?${aggParams}` : '';
        const aggRes = await fetch(`http://localhost:3001/api/sentiment/aggregate${aggQueryStr}`);
        if (aggRes.ok) {
          const aggJson = await aggRes.json();
          if (!ignore) {
            setAggregate(aggJson);
          }
        }
      } catch {
        // Keep previous aggregate state on network error
      }
    };

    void loadAggregate();

    return () => {
      ignore = true;
    };
  }, [activeTab, selectedCoins, isMultiCoinMode, selectedTimeframe, retryCount]);

  // User Interaction Handlers
  const handleTabClick = (coin: string) => {
    if (!isMultiCoinMode && activeTab === coin) {
      return; // Already selected, avoid unnecessary loading state
    }
    setLoading(true);
    setCurrentPage(1);
    if (isMultiCoinMode) {
      if (coin === 'ALL') {
        setSelectedCoins([]);
      } else {
        setSelectedCoins((prev) =>
          prev.includes(coin) ? prev.filter((c) => c !== coin) : [...prev, coin]
        );
      }
    } else {
      setActiveTab(coin);
      onCoinChange?.(coin);
    }
  };

  const handleToggleMultiCoin = () => {
    setLoading(true);
    setCurrentPage(1);
    setIsMultiCoinMode((prev) => !prev);
  };

  const handleTimeframeClick = (tf: TimeframeOption) => {
    if (selectedTimeframe === tf) return;
    setSelectedTimeframe(tf);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage === currentPage || newPage < 1) return;
    setLoading(true);
    setCurrentPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getPaginationItems = (current: number, total: number): (number | string)[] => {
    if (total <= 12) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }

    const leftEnd = [1, 2, 3];
    const rightEnd = [total - 2, total - 1, total];

    // Case 1: Close to start (current <= 4)
    if (current <= 4) {
      const leftBlock = Array.from({ length: Math.max(current + 1, 4) }, (_, i) => i + 1);
      return [...leftBlock, 'ellipsis-right', ...rightEnd];
    }

    // Case 2: Close to end (current >= total - 3)
    if (current >= total - 3) {
      const rightBlockStart = Math.min(current - 1, total - 3);
      const rightBlock = Array.from({ length: total - rightBlockStart + 1 }, (_, i) => rightBlockStart + i);
      return [...leftEnd, 'ellipsis-left', ...rightBlock];
    }

    // Case 3: In the middle (e.g. current = 8 in 15 pages -> 1, 2, 3 ... 7, 8, 9 ... 13, 14, 15)
    const middle = [current - 1, current, current + 1];
    const hasLeftEllipsis = middle[0] > 4;
    const hasRightEllipsis = middle[middle.length - 1] < total - 3;

    const items: (number | string)[] = [];

    if (hasLeftEllipsis) {
      items.push(...leftEnd, 'ellipsis-left');
    } else {
      for (let p = 1; p < middle[0]; p++) items.push(p);
    }

    items.push(...middle);

    if (hasRightEllipsis) {
      items.push('ellipsis-right', ...rightEnd);
    } else {
      for (let p = middle[middle.length - 1] + 1; p <= total; p++) items.push(p);
    }

    // Deduplicate
    const uniqueItems: (number | string)[] = [];
    for (const item of items) {
      if (typeof item === 'number') {
        if (!uniqueItems.includes(item)) uniqueItems.push(item);
      } else {
        uniqueItems.push(item);
      }
    }

    return uniqueItems;
  };

  const handleRetry = () => {
    setLoading(true);
    setFetchError(null);
    setRetryCount((prev) => prev + 1);
  };

  const handleLoadMore = async () => {
    setLoadingMore(true);
    try {
      const nextPage = currentPage + 1;
      const offset = (nextPage - 1) * pageSize;
      const limitParam = `limit=${pageSize}`;
      const offsetParam = `offset=${offset}`;

      let coinParams = '';
      if (isMultiCoinMode && selectedCoins.length > 0) {
        coinParams = `coins=${selectedCoins.join(',')}`;
      } else if (activeTab && activeTab !== 'ALL') {
        coinParams = `coin=${activeTab}`;
      }

      const queryStr = [limitParam, offsetParam, coinParams].filter(Boolean).join('&');
      const newsRes = await fetch(`http://localhost:3001/api/news?${queryStr}`);

      if (newsRes.ok) {
        const newsJson = await newsRes.json();
        const fetchedData: NewsArticle[] = newsJson.data || [];
        const pagMeta = newsJson.pagination || { total: fetchedData.length, limit: pageSize, offset, hasMore: false };

        setArticles((prev) => [...prev, ...fetchedData]);
        setTotalArticles(pagMeta.total);
        setHasMore(pagMeta.hasMore);
        setCurrentPage(nextPage);
      }
    } catch {
      // Keep existing list on error
    } finally {
      setLoadingMore(false);
    }
  };

  // Mouse Drag-to-Scroll Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!tabsRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - tabsRef.current.offsetLeft);
    setScrollLeft(tabsRef.current.scrollLeft);
  };

  const handleMouseLeaveOrUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !tabsRef.current) return;
    e.preventDefault();
    const x = e.pageX - tabsRef.current.offsetLeft;
    const walk = (x - startX) * 2;
    tabsRef.current.scrollLeft = scrollLeft - walk;
  };

  // Date Formatting Helpers
  const getRelativeTimeString = (dateStr: string): string => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

      if (diffInSeconds < 60) return 'Just now';
      const diffInMinutes = Math.floor(diffInSeconds / 60);
      if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
      const diffInHours = Math.floor(diffInMinutes / 60);
      if (diffInHours < 24) return `${diffInHours}h ago`;
      const diffInDays = Math.floor(diffInHours / 24);
      return `${diffInDays}d ago`;
    } catch {
      return 'Recently';
    }
  };

  const getFullDateTimeString = (dateStr: string): string => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return dateStr;
    }
  };

  const getSentimentBadge = (label?: string | null, score?: number | null) => {
    switch (label) {
      case 'POSITIVE':
        return (
          <span
            className="text-xs font-bold rounded-lg bg-[#0ecb81]/15 text-[#0ecb81] border border-[#0ecb81]/30 shrink-0 inline-flex items-center gap-1.5"
            style={{ padding: '6px 14px' }}
          >
            <span>🟢</span>
            <span>POSITIVE {score !== null && score !== undefined ? `(+${score})` : ''}</span>
          </span>
        );
      case 'NEGATIVE':
        return (
          <span
            className="text-xs font-bold rounded-lg bg-[#f6465d]/15 text-[#f6465d] border border-[#f6465d]/30 shrink-0 inline-flex items-center gap-1.5"
            style={{ padding: '6px 14px' }}
          >
            <span>🔴</span>
            <span>NEGATIVE {score !== null && score !== undefined ? `(${score})` : ''}</span>
          </span>
        );
      default:
        return (
          <span
            className="text-xs font-bold rounded-lg bg-[#fcd535]/15 text-[#fcd535] border border-[#fcd535]/30 shrink-0 inline-flex items-center gap-1.5"
            style={{ padding: '6px 14px' }}
          >
            <span>🟡</span>
            <span>NEUTRAL {score !== null && score !== undefined ? `(${score})` : ''}</span>
          </span>
        );
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalArticles / pageSize));

  return (
    <div
      className="w-full max-w-6xl mx-auto flex flex-col items-center text-[#eaecef] font-sans"
      style={{ paddingBottom: '100px' }}
    >
      {/* 1. Header Bar — Binance Dark & Gold Card */}
      <div
        className="w-full rounded-2xl bg-[#1e2329] border border-[#2b313a] shadow-xl flex flex-col md:flex-row items-center justify-between gap-8 overflow-hidden"
        style={{ padding: '32px 40px' }}
      >
        <div className="space-y-3 text-center md:text-left max-w-2xl">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white leading-tight">
            Crypto News & <span className="text-[#fcd535]">Sentiment Analytics</span>
          </h1>
          <p className="text-sm sm:text-base text-[#929aa5] leading-relaxed font-normal">
            Real-time multi-source crypto RSS/Crawler ingestion powered by VADER ML NLP Analysis
          </p>

          {/* On-Demand Crawl Action with OP.GG-style Cooldown Timer */}
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 pt-2">
            <button
              onClick={handleManualCrawl}
              disabled={isCrawling || crawlCooldown > 0}
              className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-200 flex items-center gap-2 shadow-md cursor-pointer ${
                isCrawling
                  ? 'bg-[#2b313a] text-[#929aa5] cursor-not-allowed border border-[#474d57]'
                  : crawlCooldown > 0
                  ? 'bg-[#2b313a]/80 text-[#707a8a] cursor-not-allowed border border-[#363c45]'
                  : 'bg-[#fcd535] hover:bg-[#fcd535]/90 text-[#181a20] font-bold border border-[#fcd535] hover:shadow-[0_0_15px_rgba(252,213,53,0.3)]'
              }`}
            >
              {isCrawling ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-[#929aa5] border-t-transparent rounded-full animate-spin"></span>
                  <span>Crawling & Analyzing VADER...</span>
                </>
              ) : crawlCooldown > 0 ? (
                <>
                  <span>⏱️</span>
                  <span>
                    Available in:{' '}
                    <span className="font-mono text-[#fcd535] font-bold">
                      {formatCountdown(crawlCooldown)}
                    </span>
                  </span>
                </>
              ) : (
                <>
                  <span>⚡</span>
                  <span>Fetch Latest News</span>
                </>
              )}
            </button>

            {crawlMessage && (
              <span className="text-xs font-medium text-[#eaecef] bg-[#181a20] px-3 py-1.5 rounded-md border border-[#2b313a] animate-fade-in">
                {crawlMessage}
              </span>
            )}
          </div>
        </div>

        {aggregate && (
          <div
            className="flex flex-col items-center sm:items-end gap-3 rounded-xl bg-[#181a20] border border-[#2b313a] shadow-lg shrink-0 w-full md:w-auto"
            style={{ padding: '20px 26px' }}
          >
            <div className="text-center sm:text-right w-full">
              <div className="text-xs text-[#707a8a] uppercase tracking-wider font-semibold">
                Aggregate Mood ({isMultiCoinMode && selectedCoins.length > 0 ? selectedCoins.join(', ') : activeTab} · {selectedTimeframe})
              </div>
              <div className="text-2xl font-bold text-[#fcd535] mt-1 flex items-center justify-center sm:justify-end gap-3">
                <span>Score: {aggregate.score > 0 ? `+${aggregate.score}` : aggregate.score}</span>
                {getSentimentBadge(aggregate.label)}
              </div>

              {/* 3-Color Sentiment Distribution Breakdown Bar */}
              {aggregate.articleCount > 0 && (
                <div className="mt-3 w-full min-w-[260px] max-w-[340px] mx-auto sm:ml-auto sm:mr-0 bg-[#1e2329]/80 p-2.5 rounded-lg border border-[#2b313a]">
                  <div className="flex justify-between items-center text-[11px] font-semibold mb-1.5">
                    <span className="text-[#0ecb81]">
                      🟢 {aggregate.positiveRatio ?? 0}%
                    </span>
                    <span className="text-[#fcd535]">
                      🟡 {aggregate.neutralRatio ?? 0}%
                    </span>
                    <span className="text-[#f6465d]">
                      🔴 {aggregate.negativeRatio ?? 0}%
                    </span>
                  </div>
                  {/* Visual 3-Segment Bar */}
                  <div className="w-full h-2.5 rounded-full overflow-hidden flex bg-[#2b313a]">
                    <div
                      style={{ width: `${aggregate.positiveRatio ?? 0}%` }}
                      className="h-full bg-[#0ecb81] transition-all duration-500"
                      title={`Positive: ${aggregate.positiveCount ?? 0} articles (${aggregate.positiveRatio ?? 0}%)`}
                    />
                    <div
                      style={{ width: `${aggregate.neutralRatio ?? 0}%` }}
                      className="h-full bg-[#fcd535] transition-all duration-500"
                      title={`Neutral: ${aggregate.neutralCount ?? 0} articles (${aggregate.neutralRatio ?? 0}%)`}
                    />
                    <div
                      style={{ width: `${aggregate.negativeRatio ?? 0}%` }}
                      className="h-full bg-[#f6465d] transition-all duration-500"
                      title={`Negative: ${aggregate.negativeCount ?? 0} articles (${aggregate.negativeRatio ?? 0}%)`}
                    />
                  </div>
                  <div className="text-[10px] text-[#707a8a] mt-1.5 flex justify-between">
                    <span>{aggregate.positiveCount ?? 0} Positive · {aggregate.negativeCount ?? 0} Negative</span>
                    <span>{aggregate.articleCount} articles</span>
                  </div>
                </div>
              )}

              {/* Timeframe Selector Pills */}
              <div className="flex items-center gap-2 mt-3 justify-center sm:justify-end flex-wrap">
                {(['1h', '24h', '7d'] as TimeframeOption[]).map((tf) => {
                  const isActive = selectedTimeframe === tf;
                  return (
                    <button
                      key={tf}
                      onClick={() => handleTimeframeClick(tf)}
                      className={`text-xs font-semibold rounded-md transition-colors duration-150 cursor-pointer flex items-center gap-1 border ${
                        isActive
                          ? 'bg-[#fcd535] text-[#181a20] font-bold border-[#fcd535] shadow-sm'
                          : 'bg-[#1e2329] text-[#929aa5] hover:text-[#eaecef] hover:bg-[#2b313a] border-[#2b313a]'
                      }`}
                      style={{ padding: '4px 12px' }}
                    >
                      <span>⏱️</span>
                      <span>{tf}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. Coin Filter Tabs & Multi-Coin / Pagination Mode Controls */}
      <div className="w-full flex flex-col gap-4" style={{ marginTop: '40px', marginBottom: '40px' }}>
        <div className="w-full flex items-center justify-between gap-4 flex-wrap px-2">
          <div className="text-sm font-semibold text-[#eaecef] flex items-center gap-2">
            <span>🪙 Filter Asset Markets:</span>
            {isMultiCoinMode && selectedCoins.length > 0 && (
              <span className="text-xs font-semibold text-[#fcd535] bg-[#fcd535]/10 border border-[#fcd535]/30 px-3 py-0.5 rounded-full">
                Selected ({selectedCoins.join(', ')})
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleToggleMultiCoin}
              className={`text-sm font-semibold whitespace-nowrap rounded-lg border transition-colors cursor-pointer ${
                isMultiCoinMode
                  ? 'bg-[#fcd535]/15 text-[#fcd535] border-[#fcd535]'
                  : 'bg-[#1e2329] text-[#929aa5] border-[#2b313a] hover:text-[#eaecef] hover:bg-[#2b313a]'
              }`}
              style={{ padding: '10px 22px' }}
            >
              {isMultiCoinMode ? '✓ Multi-Select Active' : '⚡ Enable Multi-Select'}
            </button>

            <div className="flex items-center gap-1 bg-[#181a20] border border-[#2b313a] rounded-lg p-1">
              <button
                onClick={() => setPaginationMode('pages')}
                className={`text-sm font-semibold whitespace-nowrap rounded-md transition-colors cursor-pointer shrink-0 ${
                  paginationMode === 'pages'
                    ? 'bg-[#fcd535] text-[#181a20] font-bold shadow-sm'
                    : 'text-[#929aa5] hover:text-[#eaecef]'
                }`}
                style={{ paddingLeft: '18px', paddingRight: '18px', paddingTop: '8px', paddingBottom: '8px' }}
              >
                Page Bar
              </button>
              <button
                onClick={() => setPaginationMode('loadMore')}
                className={`text-sm font-semibold whitespace-nowrap rounded-md transition-colors cursor-pointer shrink-0 ${
                  paginationMode === 'loadMore'
                    ? 'bg-[#fcd535] text-[#181a20] font-bold shadow-sm'
                    : 'text-[#929aa5] hover:text-[#eaecef]'
                }`}
                style={{ paddingLeft: '18px', paddingRight: '18px', paddingTop: '8px', paddingBottom: '8px' }}
              >
                Load More
              </button>
            </div>
          </div>
        </div>

        {/* Drag-to-Scroll Dynamic Coin Tabs */}
        <div
          ref={tabsRef}
          onMouseDown={handleMouseDown}
          onMouseLeave={handleMouseLeaveOrUp}
          onMouseUp={handleMouseLeaveOrUp}
          onMouseMove={handleMouseMove}
          className="w-full flex items-center justify-center gap-3 overflow-x-auto overflow-y-hidden select-none cursor-grab active:cursor-grabbing [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          style={{ paddingTop: '8px', paddingBottom: '8px' }}
        >
          {availableCoins.map((coin) => {
            const isSelected = isMultiCoinMode
              ? selectedCoins.includes(coin)
              : activeTab === coin;

            let label = `🪙 ${coin}`;
            if (coin === 'ALL') label = '🌐 All Markets';
            if (coin === 'GENERAL') label = '🌐 General';

            return (
              <button
                key={coin}
                onClick={() => handleTabClick(coin)}
                className={`rounded-xl text-sm font-semibold transition-all duration-150 shrink-0 cursor-pointer ${
                  isSelected
                    ? 'bg-[#fcd535] text-[#181a20] font-bold border border-[#fcd535] shadow-sm shadow-[#fcd535]/15'
                    : 'bg-[#1e2329] text-[#929aa5] hover:text-[#eaecef] hover:bg-[#2b313a] border border-[#2b313a]'
                }`}
                style={{ padding: '12px 24px' }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Articles Feed Grid / Error State / Empty State */}
      {loading ? (
        <div className="flex flex-col justify-center items-center py-28 text-[#929aa5] space-y-4 w-full">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#fcd535]"></div>
          <span className="text-base font-semibold">Analyzing live market feeds...</span>
        </div>
      ) : fetchError ? (
        <div className="w-full flex flex-col items-center justify-center py-20 px-8 rounded-2xl bg-[#1e2329] border border-rose-500/30 text-center space-y-5 shadow-xl">
          <div className="w-16 h-16 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-3xl">
            📡
          </div>
          <div className="space-y-2 max-w-md">
            <h3 className="text-xl font-bold text-white">Live News Service Disconnected</h3>
            <p className="text-sm text-[#929aa5] font-normal leading-relaxed">
              {fetchError}
            </p>
          </div>
          <button
            onClick={handleRetry}
            className="inline-flex items-center gap-2 text-sm font-bold text-[#181a20] bg-[#fcd535] hover:bg-[#f0b90b] rounded-lg shadow-md transition-all duration-150 cursor-pointer"
            style={{ padding: '10px 28px' }}
          >
            <span>🔄</span>
            <span>Retry Connection</span>
          </button>
        </div>
      ) : articles.length === 0 ? (
        <div className="text-center py-24 bg-[#1e2329] rounded-2xl border border-[#2b313a] text-[#929aa5] text-base w-full">
          No news articles found for selected market filter.
        </div>
      ) : (
        <div className="w-full flex flex-col items-center">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
            {articles.map((article) => (
              <div
                key={article.id}
                className="flex flex-col justify-between rounded-xl bg-[#1e2329] border border-[#2b313a] hover:border-[#fcd535]/50 transition-all duration-200 group min-h-[260px] w-full box-border shadow-sm"
                style={{ padding: '28px 32px' }}
              >
                <div className="space-y-3">
                  {/* Top Card Header: Source on Left, Relative Time on Right */}
                  <div className="flex items-center justify-between text-xs font-semibold" style={{ marginBottom: '10px' }}>
                    <span className="font-bold text-[#fcd535] text-sm">{article.source}</span>
                    <span className="bg-[#181a20] text-[#929aa5] font-medium border border-[#2b313a] rounded-full" style={{ padding: '3px 12px' }}>
                      ⏱️ {getRelativeTimeString(article.publishedAt)}
                    </span>
                  </div>

                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-lg font-bold text-[#eaecef] group-hover:text-[#fcd535] transition-colors line-clamp-2 min-h-[3.2rem] leading-snug"
                    style={{ marginBottom: '8px' }}
                  >
                    {article.title}
                  </a>

                  <p className="text-sm text-[#929aa5] line-clamp-2 min-h-[2.8rem] leading-relaxed">
                    {article.content}
                  </p>

                  {/* Full Date & Time */}
                  <div
                    className="text-xs text-[#707a8a] font-medium flex items-center gap-1.5"
                    style={{ marginTop: '14px' }}
                  >
                    <span>📅</span>
                    <span className="text-[#929aa5]">{getFullDateTimeString(article.publishedAt)}</span>
                  </div>
                </div>

                {/* Divider Line & Footer */}
                <div
                  className="border-t border-[#2b313a] flex items-center justify-between gap-4"
                  style={{ marginTop: '18px', paddingTop: '16px' }}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    {article.relatedCoins?.map((coin) => (
                      <span
                        key={coin}
                        className="text-xs font-semibold rounded bg-[#181a20] text-[#eaecef] border border-[#2b313a]"
                        style={{ padding: '4px 10px' }}
                      >
                        {coin}
                      </span>
                    ))}
                  </div>

                  <div className="shrink-0">
                    {getSentimentBadge(article.sentimentLabel, article.sentimentScore)}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 4. News Pagination / Load More Selector Bar */}
          {paginationMode === 'pages' ? (
            <div className="flex items-center justify-center gap-1.5 w-full flex-wrap" style={{ marginTop: '40px', marginBottom: '60px' }}>
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage <= 1}
                className="flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-semibold bg-[#1e2329] border border-[#2b313a] text-[#eaecef] hover:bg-[#2b313a] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shrink-0"
                style={{ height: '40px', minWidth: '80px', paddingLeft: '14px', paddingRight: '14px' }}
              >
                ‹ Prev
              </button>

              {getPaginationItems(currentPage, totalPages).map((item, idx) => {
                if (typeof item === 'string') {
                  return (
                    <span
                      key={`ellipsis-${idx}`}
                      className="flex items-center justify-center w-8 h-10 text-sm font-bold text-[#929aa5] select-none"
                    >
                      ...
                    </span>
                  );
                }

                return (
                  <button
                    key={item}
                    onClick={() => handlePageChange(item)}
                    className={`w-10 h-10 rounded-lg text-sm font-bold transition-all cursor-pointer ${
                      item === currentPage
                        ? 'bg-[#fcd535] text-[#181a20] border border-[#fcd535] shadow-sm'
                        : 'bg-[#1e2329] border border-[#2b313a] text-[#929aa5] hover:text-[#eaecef] hover:bg-[#2b313a]'
                    }`}
                  >
                    {item}
                  </button>
                );
              })}

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= totalPages}
                className="flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-semibold bg-[#1e2329] border border-[#2b313a] text-[#eaecef] hover:bg-[#2b313a] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shrink-0"
                style={{ height: '40px', minWidth: '80px', paddingLeft: '14px', paddingRight: '14px' }}
              >
                Next ›
              </button>
            </div>
          ) : (
            (hasMore || articles.length === pageSize) && (
              <div
                className="flex justify-center w-full"
                style={{ marginTop: '40px', marginBottom: '60px' }}
              >
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="w-full max-w-sm text-sm font-bold text-[#181a20] bg-[#fcd535] hover:bg-[#f0b90b] rounded-lg shadow-md transition-all duration-150 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                  style={{ padding: '14px 32px' }}
                >
                  <span className="text-lg">📰</span>
                  <span>{loadingMore ? 'Loading more stories...' : 'More stories'}</span>
                </button>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
};

export default NewsFeed;

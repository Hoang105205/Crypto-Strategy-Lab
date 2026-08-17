'use client';

// NewsFeed Component — Renders crypto news articles with sentiment badges, coin filters & pagination
// Owner: Thuan | See: contracts/news-api.md & kb/DESIGN.md

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
  updatedAt: string;
}

export type TimeframeOption = '1h' | '24h' | '7d';

export interface NewsFeedProps {
  selectedCoin?: string;
  onCoinChange?: (coin: string) => void;
}

const DEFAULT_AVAILABLE_COINS = ['ALL', 'BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'GENERAL'];
const DEFAULT_PAGE_SIZE = 10;

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
    setSelectedTimeframe(tf);
  };

  const handlePageChange = (newPage: number) => {
    setLoading(true);
    setCurrentPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
            className="text-xs font-extrabold rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm shadow-emerald-500/20 shrink-0 inline-block"
            style={{ padding: '8px 18px' }}
          >
            🟢 POSITIVE {score !== null && score !== undefined ? `(+${score})` : ''}
          </span>
        );
      case 'NEGATIVE':
        return (
          <span
            className="text-xs font-extrabold rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/40 shadow-sm shadow-rose-500/20 shrink-0 inline-block"
            style={{ padding: '8px 18px' }}
          >
            🔴 NEGATIVE {score !== null && score !== undefined ? `(${score})` : ''}
          </span>
        );
      default:
        return (
          <span
            className="text-xs font-extrabold rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-sm shadow-amber-500/20 shrink-0 inline-block"
            style={{ padding: '8px 18px' }}
          >
            🟡 NEUTRAL {score !== null && score !== undefined ? `(${score})` : ''}
          </span>
        );
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalArticles / pageSize));

  return (
    <div
      className="w-full max-w-6xl mx-auto flex flex-col items-center text-slate-100 font-sans"
      style={{ paddingBottom: '100px' }}
    >
      {/* 1. Header Bar */}
      <div
        className="w-full rounded-3xl bg-slate-900/90 border border-slate-800/90 backdrop-blur-2xl shadow-2xl flex flex-col md:flex-row items-center justify-between gap-8 overflow-hidden"
        style={{ padding: '40px 48px' }}
      >
        <div className="space-y-4 text-center md:text-left max-w-3xl">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight bg-gradient-to-r from-cyan-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent leading-tight">
            Crypto News & Sentiment Analytics
          </h1>
          <p className="text-sm sm:text-base text-slate-400 leading-relaxed font-medium">
            Real-time multi-source crypto RSS/Crawler ingestion powered by VADER ML NLP Analysis
          </p>
        </div>

        {aggregate && (
          <div
            className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 rounded-2xl bg-slate-800/90 border border-slate-700/80 shadow-2xl shrink-0"
            style={{ padding: '20px 32px' }}
          >
            <div className="text-center sm:text-right">
              <div className="text-xs text-slate-400 uppercase tracking-widest font-bold">
                Aggregate Mood ({isMultiCoinMode && selectedCoins.length > 0 ? selectedCoins.join(', ') : activeTab} · {selectedTimeframe})
              </div>
              <div className="text-2xl font-black text-slate-100 mt-1">
                Score: {aggregate.score > 0 ? `+${aggregate.score}` : aggregate.score}
              </div>
              {/* Timeframe Selector Pills */}
              <div className="flex items-center gap-3 mt-3 justify-center sm:justify-end flex-wrap">
                {(['1h', '24h', '7d'] as TimeframeOption[]).map((tf) => {
                  const isActive = selectedTimeframe === tf;
                  return (
                    <button
                      key={tf}
                      onClick={() => handleTimeframeClick(tf)}
                      className={`text-xs font-extrabold rounded-full transition-all duration-200 cursor-pointer flex items-center gap-1.5 border shadow-sm ${
                        isActive
                          ? 'bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-500 text-white border-cyan-400/50 shadow-cyan-500/20 scale-105'
                          : 'bg-slate-900/90 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border-slate-700/60'
                      }`}
                      style={{ padding: '6px 16px' }}
                    >
                      <span>⏱️</span>
                      <span>{tf}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            {getSentimentBadge(aggregate.label)}
          </div>
        )}
      </div>

      {/* 2. Coin Filter Tabs & Multi-Coin / Pagination Mode Controls */}
      <div className="w-full flex flex-col gap-4" style={{ marginTop: '50px', marginBottom: '50px' }}>
        <div className="w-full flex items-center justify-between gap-4 flex-wrap px-2">
          <div className="text-sm font-bold text-slate-300 flex items-center gap-2">
            <span>🪙 Filter Asset Markets:</span>
            {isMultiCoinMode && selectedCoins.length > 0 && (
              <span className="text-xs font-semibold text-cyan-400 bg-cyan-950 border border-cyan-800 px-3 py-0.5 rounded-full">
                Selected ({selectedCoins.join(', ')})
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleToggleMultiCoin}
              className={`text-sm font-bold whitespace-nowrap rounded-full border transition-all cursor-pointer ${
                isMultiCoinMode
                  ? 'bg-cyan-950 text-cyan-300 border-cyan-500 shadow-md shadow-cyan-950'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
              style={{ padding: '12px 28px' }}
            >
              {isMultiCoinMode ? '✓ Multi-Select Active' : '⚡ Enable Multi-Select'}
            </button>

            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-full p-1">
              <button
                onClick={() => setPaginationMode('pages')}
                className={`text-sm font-extrabold whitespace-nowrap rounded-full transition-colors cursor-pointer shrink-0 ${
                  paginationMode === 'pages' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
                style={{ paddingLeft: '24px', paddingRight: '24px', paddingTop: '10px', paddingBottom: '10px' }}
              >
                Page Bar
              </button>
              <button
                onClick={() => setPaginationMode('loadMore')}
                className={`text-sm font-extrabold whitespace-nowrap rounded-full transition-colors cursor-pointer shrink-0 ${
                  paginationMode === 'loadMore' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
                style={{ paddingLeft: '24px', paddingRight: '24px', paddingTop: '10px', paddingBottom: '10px' }}
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
          className="w-full flex items-center justify-center gap-4 overflow-x-auto overflow-y-hidden select-none cursor-grab active:cursor-grabbing [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          style={{ paddingTop: '10px', paddingBottom: '10px' }}
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
                className={`rounded-2xl text-sm font-bold transition-all duration-300 shrink-0 cursor-pointer ${
                  isSelected
                    ? 'bg-gradient-to-r from-indigo-600 via-purple-600 to-cyan-600 text-white shadow-xl shadow-indigo-500/25 border border-indigo-400/40 scale-105'
                    : 'bg-slate-900/70 text-slate-400 hover:text-slate-200 hover:bg-slate-800/70 border border-slate-800/60'
                }`}
                style={{ padding: '14px 28px' }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Articles Feed Grid / Error State / Empty State */}
      {loading ? (
        <div className="flex flex-col justify-center items-center py-28 text-slate-400 space-y-4 w-full">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400"></div>
          <span className="text-base font-semibold">Analyzing live market feeds...</span>
        </div>
      ) : fetchError ? (
        <div className="w-full flex flex-col items-center justify-center py-20 px-8 rounded-3xl bg-slate-900/80 border border-rose-500/40 text-center space-y-5 shadow-2xl backdrop-blur-xl">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-3xl">
            📡
          </div>
          <div className="space-y-2 max-w-md">
            <h3 className="text-xl font-black text-slate-100">Live News Service Disconnected</h3>
            <p className="text-sm text-slate-400 font-medium leading-relaxed">
              {fetchError}
            </p>
          </div>
          <button
            onClick={handleRetry}
            className="inline-flex items-center gap-2.5 text-sm font-extrabold text-white bg-gradient-to-r from-indigo-600 via-purple-600 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 rounded-full shadow-xl shadow-cyan-500/20 border border-cyan-400/40 transition-all duration-200 cursor-pointer transform hover:scale-105 active:scale-95"
            style={{ padding: '12px 32px' }}
          >
            <span>🔄</span>
            <span>Retry Connection</span>
          </button>
        </div>
      ) : articles.length === 0 ? (
        <div className="text-center py-24 bg-slate-900/40 rounded-3xl border border-slate-800/80 text-slate-400 text-lg w-full">
          No news articles found for selected market filter.
        </div>
      ) : (
        <div className="w-full flex flex-col items-center">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
            {articles.map((article) => (
              <div
                key={article.id}
                className="flex flex-col justify-between rounded-3xl bg-slate-900/80 border border-slate-800/90 hover:border-indigo-500/60 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-cyan-500/10 group min-h-[270px] w-full box-border"
                style={{ padding: '32px 36px' }}
              >
                <div className="space-y-4">
                  {/* Top Card Header: Source on Left, Relative Time on Right */}
                  <div className="flex items-center justify-between text-xs font-semibold" style={{ marginBottom: '12px' }}>
                    <span className="font-bold text-indigo-400 text-sm">{article.source}</span>
                    <span className="bg-indigo-950/80 text-cyan-300 font-extrabold border border-indigo-700/50" style={{ padding: '4px 14px', borderRadius: '9999px' }}>
                      ⏱️ {getRelativeTimeString(article.publishedAt)}
                    </span>
                  </div>

                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-lg font-extrabold text-slate-100 group-hover:text-cyan-400 transition-colors line-clamp-2 min-h-[3.5rem] leading-relaxed"
                    style={{ marginBottom: '10px' }}
                  >
                    {article.title}
                  </a>

                  <p className="text-sm text-slate-400 line-clamp-2 min-h-[3rem] leading-relaxed">
                    {article.content}
                  </p>

                  {/* Full Date & Time */}
                  <div
                    className="text-xs text-slate-400 font-semibold flex items-center gap-2"
                    style={{ marginTop: '16px' }}
                  >
                    <span className="text-slate-400 text-sm">📅</span>
                    <span className="text-slate-300">{getFullDateTimeString(article.publishedAt)}</span>
                  </div>
                </div>

                {/* Divider Line & Footer */}
                <div
                  className="border-t border-slate-800/80 flex items-center justify-between gap-4"
                  style={{ marginTop: '20px', paddingTop: '20px' }}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    {article.relatedCoins?.map((coin) => (
                      <span
                        key={coin}
                        className="text-xs font-extrabold rounded-lg bg-slate-800 text-slate-200 border border-slate-700/80"
                        style={{ padding: '6px 14px' }}
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
            <div className="flex items-center justify-center gap-2 w-full flex-wrap" style={{ marginTop: '50px', marginBottom: '80px' }}>
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage <= 1}
                className="flex items-center justify-center whitespace-nowrap rounded-full text-sm font-extrabold bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shrink-0"
                style={{ height: '48px', minWidth: '100px', paddingLeft: '24px', paddingRight: '24px' }}
              >
                ‹ Prev
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                <button
                  key={pageNum}
                  onClick={() => handlePageChange(pageNum)}
                  className={`w-12 h-12 rounded-2xl text-base font-black transition-all cursor-pointer ${
                    pageNum === currentPage
                      ? 'bg-gradient-to-r from-indigo-600 via-purple-600 to-cyan-600 text-white shadow-lg shadow-indigo-500/30 border border-indigo-400/50 scale-105'
                      : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  {pageNum}
                </button>
              ))}

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= totalPages}
                className="flex items-center justify-center whitespace-nowrap rounded-full text-sm font-extrabold bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shrink-0"
                style={{ height: '48px', minWidth: '100px', paddingLeft: '24px', paddingRight: '24px' }}
              >
                Next ›
              </button>
            </div>
          ) : (
            (hasMore || articles.length === pageSize) && (
              <div
                className="flex justify-center w-full"
                style={{ marginTop: '50px', marginBottom: '80px' }}
              >
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="w-full max-w-md text-base font-extrabold text-white bg-gradient-to-r from-indigo-600 via-purple-600 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 rounded-full shadow-2xl shadow-indigo-500/30 border border-indigo-400/40 transition-all duration-300 transform hover:scale-[1.02] active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3 cursor-pointer"
                  style={{ padding: '18px 40px' }}
                >
                  <span className="text-xl">📰</span>
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

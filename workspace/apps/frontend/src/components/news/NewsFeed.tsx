'use client';

// NewsFeed Component — Renders crypto news articles with sentiment badges & coin filters
// Owner: Thuan | See: contracts/news-api.md & kb/DESIGN.md

import React, { useEffect, useState } from 'react';

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

interface NewsFeedProps {
  selectedCoin?: string;
  onCoinChange?: (coin: string) => void;
}

const AVAILABLE_COINS = ['ALL', 'BTC', 'ETH', 'SOL'];

export const NewsFeed: React.FC<NewsFeedProps> = ({
  selectedCoin = 'ALL',
  onCoinChange,
}) => {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [aggregate, setAggregate] = useState<AggregateSentiment | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<string>(selectedCoin);

  useEffect(() => {
    fetchNewsData(activeTab);
  }, [activeTab]);

  const fetchNewsData = async (coinFilter: string) => {
    setLoading(true);
    try {
      const coinParam = coinFilter === 'ALL' ? '' : `?coin=${coinFilter}`;
      const newsRes = await fetch(`http://localhost:3001/api/news${coinParam}`);
      if (newsRes.ok) {
        const newsJson = await newsRes.json();
        setArticles(newsJson.data || []);
      }

      const aggParam = coinFilter === 'ALL' ? '' : `?coin=${coinFilter}`;
      const aggRes = await fetch(`http://localhost:3001/api/sentiment/aggregate${aggParam}`);
      if (aggRes.ok) {
        const aggJson = await aggRes.json();
        setAggregate(aggJson);
      }
    } catch (error) {
      console.warn('Backend API unavailable, displaying mock news feed.');
      // Robust mock fallback
      setArticles([
        {
          id: 'mock-1',
          source: 'CoinDesk RSS',
          title: 'Bitcoin Surges Above $90,000 Following Institutional ETF Inflows',
          content: 'Institutional adoption accelerates as spot Bitcoin ETFs record unprecedented daily net inflows across major exchanges.',
          url: 'https://coindesk.com',
          publishedAt: new Date().toISOString(),
          crawledAt: new Date().toISOString(),
          relatedCoins: ['BTC'],
          sentimentScore: 0.82,
          sentimentLabel: 'POSITIVE',
        },
        {
          id: 'mock-2',
          source: 'CoinTelegraph RSS',
          title: 'Ethereum Layer-2 Network Activity Hits New All-Time High',
          content: 'Transaction volume across Layer-2 scaling solutions quadrupled over the past quarter driven by lower gas fees.',
          url: 'https://cointelegraph.com',
          publishedAt: new Date(Date.now() - 3600000).toISOString(),
          crawledAt: new Date().toISOString(),
          relatedCoins: ['ETH'],
          sentimentScore: 0.65,
          sentimentLabel: 'POSITIVE',
        },
        {
          id: 'mock-3',
          source: 'Decrypt RSS',
          title: 'Federal Reserve Monetary Policy Outlook Drives Crypto Volatility',
          content: 'Traders closely analyze central bank interest rate projections as digital asset markets adjust risk exposure.',
          url: 'https://decrypt.co',
          publishedAt: new Date(Date.now() - 7200000).toISOString(),
          crawledAt: new Date().toISOString(),
          relatedCoins: ['BTC', 'ETH'],
          sentimentScore: -0.15,
          sentimentLabel: 'NEGATIVE',
        },
      ]);
      setAggregate({
        score: 0.44,
        label: 'POSITIVE',
        articleCount: 3,
        updatedAt: new Date().toISOString(),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTabClick = (coin: string) => {
    setActiveTab(coin);
    onCoinChange?.(coin);
  };

  const getSentimentBadge = (label?: string | null, score?: number | null) => {
    switch (label) {
      case 'POSITIVE':
        return (
          <span className="px-3 py-1 text-xs font-semibold rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            🟢 POSITIVE {score !== null && score !== undefined ? `(+${score})` : ''}
          </span>
        );
      case 'NEGATIVE':
        return (
          <span className="px-3 py-1 text-xs font-semibold rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">
            🔴 NEGATIVE {score !== null && score !== undefined ? `(${score})` : ''}
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 text-xs font-semibold rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
            🟡 NEUTRAL {score !== null && score !== undefined ? `(${score})` : ''}
          </span>
        );
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-6 space-y-6 text-slate-100 font-sans">
      {/* Header & Sentiment Gauge */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-6 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-xl shadow-2xl">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent">
            Crypto News & Sentiment Analytics
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time multi-source crypto RSS/Crawler ingestion powered by VADER ML NLP Analysis
          </p>
        </div>

        {aggregate && (
          <div className="flex items-center gap-4 px-5 py-3 rounded-xl bg-slate-800/60 border border-slate-700/50">
            <div className="text-right">
              <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
                Aggregate Mood ({activeTab})
              </div>
              <div className="text-lg font-extrabold text-slate-100">
                Score: {aggregate.score > 0 ? `+${aggregate.score}` : aggregate.score}
              </div>
            </div>
            {getSentimentBadge(aggregate.label)}
          </div>
        )}
      </div>

      {/* Coin Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        {AVAILABLE_COINS.map((coin) => (
          <button
            key={coin}
            onClick={() => handleTabClick(coin)}
            className={`px-5 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${activeTab === coin
                ? 'bg-gradient-to-r from-indigo-600 to-cyan-600 text-white shadow-lg shadow-indigo-500/20'
                : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
          >
            {coin === 'ALL' ? '🌐 All Markets' : `🪙 ${coin}`}
          </button>
        ))}
      </div>

      {/* Articles Feed List */}
      {loading ? (
        <div className="flex justify-center items-center py-20 text-slate-400">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400"></div>
          <span className="ml-3 text-sm">Analyzing live market feeds...</span>
        </div>
      ) : articles.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/40 rounded-2xl border border-slate-800 text-slate-400">
          No news articles found for {activeTab}.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {articles.map((article) => (
            <div
              key={article.id}
              className="flex flex-col justify-between p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-cyan-500/5 group"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-semibold text-indigo-400">{article.source}</span>
                  <span>{new Date(article.publishedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>

                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-base font-semibold text-slate-100 group-hover:text-cyan-400 transition-colors line-clamp-2"
                >
                  {article.title}
                </a>

                <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">
                  {article.content}
                </p>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-800/60 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {article.relatedCoins?.map((coin) => (
                    <span
                      key={coin}
                      className="px-2 py-0.5 text-[10px] font-bold rounded bg-slate-800 text-slate-300 border border-slate-700"
                    >
                      {coin}
                    </span>
                  ))}
                </div>

                <div>
                  {getSentimentBadge(article.sentimentLabel, article.sentimentScore)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default NewsFeed;

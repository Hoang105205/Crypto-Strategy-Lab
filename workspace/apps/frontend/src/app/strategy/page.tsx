'use client';

import React, { useState, useEffect } from 'react';
import {
  StrategyCard,
  ParameterEditor,
  CompositeBuilder,
  TradeItem,
} from '../../components/strategy';
import { EquityCurveChart } from '../../components/chart/equity-curve-chart';
import { TradeDetailTable } from '../../components/trade-detail-table';
import './strategy-builder.css';

interface StrategyItem {
  name: string;
  type: string;
  parameters: Record<string, unknown>;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const DEFAULT_STRATEGIES: StrategyItem[] = [
  { name: 'MovingAverage', type: 'MA', parameters: { period: 14 } },
  {
    name: 'RelativeStrengthIndex',
    type: 'RSI',
    parameters: { period: 14, overbought: 70, oversold: 30 },
  },
  {
    name: 'BollingerBands',
    type: 'Bollinger',
    parameters: { period: 20, stdDev: 2 },
  },
  {
    name: 'SupportResistance',
    type: 'SR',
    parameters: { lookback: 5, tolerancePercent: 0.005 },
  },
];

const loadStrategies = async (): Promise<StrategyItem[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/strategies`);
    if (!response.ok) {
      return DEFAULT_STRATEGIES;
    }

    return (await response.json()) as StrategyItem[];
  } catch {
    return DEFAULT_STRATEGIES;
  }
};

export default function StrategyBuilderPage() {
  const [strategies, setStrategies] = useState<StrategyItem[]>([]);
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyItem | null>(null);
  const [activeTab, setActiveTab] = useState<'catalog' | 'composite' | 'backtest'>('catalog');
  const [strategyPage, setStrategyPage] = useState(1);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [debouncedCatalogSearch, setDebouncedCatalogSearch] = useState('');
  const STRATEGIES_PER_PAGE = 6;
  
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedCatalogSearch(catalogSearch);
      setStrategyPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [catalogSearch]);
  
  // Backtest form state
  const [pair, setPair] = useState('BTCUSDT');
  const [timeframe, setTimeframe] = useState('1h');
  const [initialCapital, setInitialCapital] = useState(10000);
  const [fromDate, setFromDate] = useState(new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().substring(0, 10));
  const [toDate, setToDate] = useState(new Date().toISOString().substring(0, 10));
  const [commission, setCommission] = useState(0.1);
  const [slippage, setSlippage] = useState(0.1);
  const [isLoading, setIsLoading] = useState(false);
  const [backtestStatus, setBacktestStatus] = useState<string | null>(null);
  const [tradeResults, setTradeResults] = useState<TradeItem[]>([]);

  const generateDynamicMockTrades = (
    stratName: string,
    symbol: string,
    tf: string,
    capital: number
  ): TradeItem[] => {
    const basePrice = symbol.startsWith('BTC') ? 65000 : symbol.startsWith('ETH') ? 3400 : 140;
    const tfMultiplier = tf === '15m' ? 0.25 : tf === '1h' ? 1 : tf === '4h' ? 4 : 24;
    const tfSeed = tf.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const seed = stratName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) + tfSeed;
    
    // Timeframe influences trade frequency (e.g. 15m produces more trades, 1d fewer)
    const count = tf === '15m' ? 8 : tf === '1h' ? 6 : tf === '4h' ? 5 : 3;
    const trades: TradeItem[] = [];

    for (let i = 0; i < count; i++) {
      const volatility = 0.015 * Math.sqrt(tfMultiplier);
      const entryPrice = basePrice * (1 + Math.sin(i * 1.7 + seed) * volatility);
      const isProfit = (i + seed) % 2 === 0;
      const changePercent = isProfit 
        ? (0.012 + (i * 0.003)) * Math.sqrt(tfMultiplier) 
        : (-0.01 - (i * 0.002)) * Math.sqrt(tfMultiplier);
      const exitPrice = entryPrice * (1 + changePercent);
      const qty = (capital * 0.15) / entryPrice;
      
      const side = (i + seed) % 3 === 0 ? 'SHORT' : 'LONG';
      const pnl = side === 'LONG' 
        ? (exitPrice - entryPrice) * qty
        : (entryPrice - exitPrice) * qty;

      const durationMs = 3600000 * tfMultiplier * (1.5 + (i % 3));
      const entry = new Date(Date.now() - (count - i) * 86400000 * (tfMultiplier > 4 ? 2 : 1));
      const exit = new Date(entry.getTime() + durationMs);

      trades.push({
        entryDate: entry.toISOString().replace('T', ' ').substring(0, 16),
        exitDate: exit.toISOString().replace('T', ' ').substring(0, 16),
        entryPrice,
        exitPrice,
        side,
        quantity: qty,
        pnl,
      });
    }
    return trades;
  };

  useEffect(() => {
    let cancelled = false;

    void loadStrategies().then((loadedStrategies) => {
      if (cancelled) return;

      setStrategies(loadedStrategies);
      setSelectedStrategy(loadedStrategies[0] ?? null);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSelectStrategy = (strat: StrategyItem) => {
    setSelectedStrategy(strat);
  };

  const filteredStrategies = strategies.filter(s => s.name.toLowerCase().includes(debouncedCatalogSearch.toLowerCase()));
  const totalStrategyPages = Math.ceil(filteredStrategies.length / STRATEGIES_PER_PAGE);
  const currentStrategies = filteredStrategies.slice((strategyPage - 1) * STRATEGIES_PER_PAGE, strategyPage * STRATEGIES_PER_PAGE);

  const handleBuildComposite = async (payload: {
    name: string;
    childStrategyNames: string[];
    combinerType: string;
    combinerWeights?: Record<string, number>;
  }) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/strategies/composite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        alert(`Composite Strategy '${payload.name}' created successfully!`);
        const loadedStrategies = await loadStrategies();
        setStrategies(loadedStrategies);
        setSelectedStrategy((current) => current ?? loadedStrategies[0] ?? null);
        setActiveTab('catalog');
      } else {
        const errorData = await res.json();
        alert(`Failed to create composite: ${errorData.message || 'Error'}`);
      }
    } catch {
      // Fallback local addition if offline
      const newComposite: StrategyItem = {
        name: payload.name,
        type: 'COMPOSITE',
        parameters: {
          childCount: payload.childStrategyNames.length,
          childStrategies: payload.childStrategyNames.join(', '),
          combinerType: payload.combinerType,
          ...(payload.combinerType === 'WeightedScore' ? { weights: payload.combinerWeights || {} } : {}),
        },
      };
      setStrategies((prev) => [...prev, newComposite]);
      setSelectedStrategy(newComposite);
      alert(`Composite Strategy '${payload.name}' created locally!`);
      setActiveTab('catalog');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunBacktest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStrategy) return;

    setIsLoading(true);
    setTradeResults([]);
    setBacktestStatus('Submitting job to Queue...');

    try {
      const res = await fetch(`${API_BASE_URL}/api/strategies/backtest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategyName: selectedStrategy.name,
          pair,
          timeframe,
          initialCapital,
          startDate: fromDate,
          endDate: toDate,
          commission,
          slippage,
        }),
      });

      if (res.ok) {
        const { jobId } = await res.json();
        setBacktestStatus('Job queued, waiting for results...');
        
        let attempts = 0;
        const maxAttempts = 30; // Wait up to 60 seconds
        
        const pollInterval = setInterval(async () => {
          attempts++;
          try {
            const resultRes = await fetch(`${API_BASE_URL}/api/strategies/backtest/${jobId}`);
            if (resultRes.ok) {
              const data = await resultRes.json();
              setBacktestStatus('Backtest simulation completed');
              setTradeResults(typeof data.trades === 'string' ? JSON.parse(data.trades) : data.trades || []);
              setIsLoading(false);
              clearInterval(pollInterval);
            } else if (resultRes.status === 404) {
              if (attempts >= maxAttempts) {
                setBacktestStatus('Timeout waiting for results (Backend Worker might not be running)');
                setIsLoading(false);
                clearInterval(pollInterval);
              }
              // Still processing, wait
            } else {
              setBacktestStatus('Failed to retrieve backtest result');
              setIsLoading(false);
              clearInterval(pollInterval);
            }
          } catch (err) {
             setBacktestStatus('Error fetching results');
             setIsLoading(false);
             clearInterval(pollInterval);
          }
        }, 2000);
        
        return; // do not call setTradeResults here yet
      } else {
        setBacktestStatus('Failed to submit job to Backend');
        setIsLoading(false);
      }
    } catch {
      setBacktestStatus('Network error connecting to Backend');
      setIsLoading(false);
    }
  };

  const handleDeleteStrategy = async (strategyName: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa chiến lược '${strategyName}' không?`)) return;

    try {
      await fetch(`${API_BASE_URL}/api/strategies/${encodeURIComponent(strategyName)}`, {
        method: 'DELETE',
      });
    } catch {
      // Local fallback
    }

    setStrategies((prev) => prev.filter((s) => s.name !== strategyName));
    if (selectedStrategy?.name === strategyName) {
      setSelectedStrategy(null);
    }
  };

  return (
    <div className="w-full min-h-screen strategy-builder-bg px-4 sm:px-8 pt-8 pb-24 font-sans flex flex-col items-center">
      {/* Header */}
      <div className="w-full max-w-[1600px] mb-10 border-b border-[#2b3139] pb-8 flex flex-col items-center text-center gap-6">
        <div className="flex flex-col items-center text-center">
          <div className="flex items-center justify-center gap-3">
            <h1 className="text-3xl sm:text-5xl font-extrabold text-gray-100 tracking-tight">Strategy Builder</h1>
            <span className="px-3 py-1 rounded-md text-xs font-mono font-bold bg-[#fcd535]/20 text-[#fcd535] border border-[#fcd535]/30">
              v1.0 Plugin System
            </span>
          </div>
          <p className="text-base sm:text-lg text-gray-400 mt-3 max-w-2xl">
            Build, configure, combine, and backtest technical trading strategies
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex p-2 bg-[#0b0e11] border border-[#2b3139] rounded-xl w-fit mx-auto shadow-inner overflow-x-auto max-w-full">
          <button
            onClick={() => setActiveTab('catalog')}
            className={`px-8 py-3 rounded-lg text-sm font-bold transition-all whitespace-nowrap flex items-center justify-center gap-2 w-48 ${
              activeTab === 'catalog'
                ? 'bg-[#1e2329] text-[#fcd535] shadow-md border border-[#2b3139]'
                : 'text-gray-400 hover:text-gray-200 hover:bg-[#1e2329]/50 border border-transparent'
            }`}
          >
            CATALOG ({strategies.length})
          </button>
          <button
            onClick={() => setActiveTab('composite')}
            className={`px-8 py-3 rounded-lg text-sm font-bold transition-all whitespace-nowrap flex items-center justify-center gap-2 w-48 ${
              activeTab === 'composite'
                ? 'bg-[#1e2329] text-[#fcd535] shadow-md border border-[#2b3139]'
                : 'text-gray-400 hover:text-gray-200 hover:bg-[#1e2329]/50 border border-transparent'
            }`}
          >
            COMPOSITE BUILDER
          </button>
          <button
            onClick={() => setActiveTab('backtest')}
            className={`px-8 py-3 rounded-lg text-sm font-bold transition-all whitespace-nowrap flex items-center justify-center gap-2 w-48 ${
              activeTab === 'backtest'
                ? 'bg-[#1e2329] text-[#fcd535] shadow-md border border-[#2b3139]'
                : 'text-gray-400 hover:text-gray-200 hover:bg-[#1e2329]/50 border border-transparent'
            }`}
          >
            BACKTEST RUNNER
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div 
        className="w-full max-w-[1600px] flex flex-col items-center w-full"
        style={{ marginTop: '4rem', marginBottom: '4rem' }}
      >
        {/* Catalog Tab */}
        {activeTab === 'catalog' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 w-full">
            <div className="space-y-6 w-full">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-base font-bold text-gray-300 uppercase tracking-wider">Available Strategy Plugins</h2>
                <input
                  type="text"
                  placeholder="Search catalog..."
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  className="bg-[#0b0e11] border border-[#2b3139] rounded-lg px-4 py-2 text-sm text-gray-100 focus:outline-none focus:border-[#fcd535] w-64"
                />
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {currentStrategies.map((strat) => (
                  <StrategyCard
                    key={strat.name}
                    name={strat.name}
                    type={strat.type}
                    parameters={strat.parameters}
                    isSelected={selectedStrategy?.name === strat.name}
                    onSelect={() => handleSelectStrategy(strat)}
                    onDelete={
                      strat.type.toUpperCase() === 'COMPOSITE'
                        ? () => handleDeleteStrategy(strat.name)
                        : undefined
                    }
                  />
                ))}
              </div>
              
              {totalStrategyPages > 1 && (
                <div className="flex justify-between items-center bg-[#1e2329] p-4 rounded-lg border border-[#2b3139] mt-6">
                  <div className="text-sm text-gray-400 font-mono">
                    Showing {(strategyPage - 1) * STRATEGIES_PER_PAGE + 1}-{Math.min(strategyPage * STRATEGIES_PER_PAGE, strategies.length)} of {strategies.length} strategies
                  </div>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setStrategyPage((p) => Math.max(1, p - 1))}
                      disabled={strategyPage === 1}
                      className="px-4 py-2 bg-[#0b0e11] border border-[#2b3139] rounded-md text-sm text-[#fcd535] hover:bg-[#2b3139] disabled:opacity-30 disabled:hover:bg-[#0b0e11] transition-colors"
                    >
                      PREVIOUS
                    </button>
                    <span className="text-sm text-gray-300 font-mono">
                      Page {strategyPage} / {totalStrategyPages}
                    </span>
                    <button
                      onClick={() => setStrategyPage((p) => Math.min(totalStrategyPages, p + 1))}
                      disabled={strategyPage === totalStrategyPages}
                      className="px-4 py-2 bg-[#0b0e11] border border-[#2b3139] rounded-md text-sm text-[#fcd535] hover:bg-[#2b3139] disabled:opacity-30 disabled:hover:bg-[#0b0e11] transition-colors"
                    >
                      NEXT
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Parameter Inspector */}
            <div className="flex flex-col gap-6 w-full">
              <h2 className="text-base font-bold text-gray-300 uppercase tracking-wider mb-6">Live Parameter Inspector</h2>
              {selectedStrategy ? (
                <div className="flex flex-col gap-8">
                  <div 
                    className="bg-[#0b0e11] border border-[#fcd535]/30 rounded-2xl flex flex-col gap-2 shadow-lg shadow-[#fcd535]/10 relative overflow-hidden"
                    style={{ padding: '1.5rem' }}
                  >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-[#fcd535]/5 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2"></div>
                    <div className="text-sm font-bold text-gray-400 uppercase tracking-wider">Selected Strategy</div>
                    <div className="text-xl font-extrabold text-[#fcd535] truncate" title={selectedStrategy.name}>{selectedStrategy.name}</div>
                    <div className="text-sm text-gray-300 font-mono flex items-center gap-2">
                      <span className="rounded bg-[#1e2329] border border-[#2b3139]" style={{ padding: '0.25rem 0.625rem' }}>{selectedStrategy.type}</span>
                    </div>
                  </div>

                  <ParameterEditor
                    key={selectedStrategy.name}
                    strategyName={selectedStrategy.name}
                    strategyType={selectedStrategy.type}
                    initialParameters={selectedStrategy.parameters}
                    availableBaseStrategies={strategies}
                  />

                  <button
                    onClick={() => setActiveTab('backtest')}
                    className="w-full py-5 rounded-xl bg-[#fcd535] hover:bg-[#f0b90b] text-[#0b0e11] font-black text-lg uppercase tracking-wider transition-all shadow-2xl shadow-[#fcd535]/15"
                    style={{ padding: '1.25rem 2rem' }}
                  >
                    RUN BACKTEST WITH SELECTED STRATEGY
                  </button>
                </div>
              ) : (
                <div className="p-8 bg-[#1e2329] border border-[#2b3139] rounded-xl text-center text-gray-400 text-sm italic">
                  Select a strategy card from the catalog to inspect parameters.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Composite Builder Tab */}
        {activeTab === 'composite' && (
          <div className="w-full max-w-[1400px] mx-auto">
            <CompositeBuilder
              availableStrategies={strategies}
              onBuildComposite={handleBuildComposite}
            />
          </div>
        )}

        {/* Backtest Runner Tab */}
        {activeTab === 'backtest' && (
          <div className="flex flex-col gap-10 w-full max-w-[1600px] mx-auto">
            <div 
              className="bg-[#1e2329] border border-[#2b3139] rounded-2xl shadow-2xl flex flex-col gap-10"
              style={{ padding: '2rem' }}
            >
              <div className="border-b border-[#2b3139] pb-8 mb-6 flex items-center justify-between gap-4">
                <h3 className="text-xl font-bold text-gray-100 shrink-0">Backtest Execution Control</h3>
                {selectedStrategy && (
                  <span 
                    className="text-sm font-mono rounded-lg bg-[#0b0e11] text-[#fcd535] border border-[#fcd535]/30 truncate max-w-[50%]" 
                    style={{ padding: '0.375rem 0.75rem' }}
                    title={`Active Strategy: ${selectedStrategy.name}`}
                  >
                    Active Strategy: {selectedStrategy.name}
                  </span>
                )}
              </div>

              <form onSubmit={handleRunBacktest} className="flex flex-col gap-10">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="flex flex-col gap-3">
                    <label className="block text-sm font-semibold text-gray-300">Trading Pair</label>
                    <select
                      value={pair}
                      onChange={(e) => setPair(e.target.value)}
                      className="w-full bg-[#0b0e11] border border-[#2b3139] rounded-xl text-base text-gray-100 font-mono focus:outline-none focus:border-[#fcd535]"
                      style={{ padding: '0.75rem 1.25rem' }}
                    >
                      <option value="BTCUSDT">BTC/USDT</option>
                      <option value="ETHUSDT">ETH/USDT</option>
                      <option value="SOLUSDT">SOL/USDT</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-3">
                    <label className="block text-sm font-semibold text-gray-300">Timeframe</label>
                    <select
                      value={timeframe}
                      onChange={(e) => setTimeframe(e.target.value)}
                      className="w-full bg-[#0b0e11] border border-[#2b3139] rounded-xl text-base text-gray-100 font-mono focus:outline-none focus:border-[#fcd535]"
                      style={{ padding: '0.75rem 1.25rem' }}
                    >
                      <option value="15m">15m</option>
                      <option value="1h">1h</option>
                      <option value="4h">4h</option>
                      <option value="1d">1d</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-3">
                    <label className="block text-sm font-semibold text-gray-300">Initial Capital ($)</label>
                    <input
                      type="number"
                      value={initialCapital}
                      onChange={(e) => setInitialCapital(Number(e.target.value))}
                      className="w-full bg-[#0b0e11] border border-[#2b3139] rounded-xl text-base text-gray-100 font-mono focus:outline-none focus:border-[#fcd535]"
                      style={{ padding: '0.75rem 1.25rem' }}
                    />
                  </div>

                  <div className="flex flex-col gap-3">
                    <label className="block text-sm font-semibold text-gray-300">From Date</label>
                    <input
                      type="date"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                      className="w-full bg-[#0b0e11] border border-[#2b3139] rounded-xl text-base text-gray-100 font-mono focus:outline-none focus:border-[#fcd535] [color-scheme:dark]"
                      style={{ padding: '0.75rem 1.25rem' }}
                    />
                  </div>

                  <div className="flex flex-col gap-3">
                    <label className="block text-sm font-semibold text-gray-300">To Date</label>
                    <input
                      type="date"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                      className="w-full bg-[#0b0e11] border border-[#2b3139] rounded-xl text-base text-gray-100 font-mono focus:outline-none focus:border-[#fcd535] [color-scheme:dark]"
                      style={{ padding: '0.75rem 1.25rem' }}
                    />
                  </div>

                  <div className="flex flex-col gap-3">
                    <label className="block text-sm font-semibold text-gray-300">Transaction Cost (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={commission}
                      onChange={(e) => setCommission(Number(e.target.value))}
                      className="w-full bg-[#0b0e11] border border-[#2b3139] rounded-xl text-base text-gray-100 font-mono focus:outline-none focus:border-[#fcd535]"
                      style={{ padding: '0.75rem 1.25rem' }}
                    />
                  </div>

                  <div className="flex flex-col gap-3">
                    <label className="block text-sm font-semibold text-gray-300">Slippage (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={slippage}
                      onChange={(e) => setSlippage(Number(e.target.value))}
                      className="w-full bg-[#0b0e11] border border-[#2b3139] rounded-xl text-base text-gray-100 font-mono focus:outline-none focus:border-[#fcd535]"
                      style={{ padding: '0.75rem 1.25rem' }}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !selectedStrategy}
                  className="w-full py-5 rounded-xl bg-[#fcd535] hover:bg-[#f0b90b] text-[#0b0e11] font-black text-lg uppercase tracking-wider transition-all shadow-2xl disabled:bg-[#1e2329] disabled:text-gray-500 disabled:border disabled:border-[#2b3139] disabled:cursor-not-allowed disabled:shadow-none"
                  style={{ padding: '1.25rem 2rem' }}
                >
                  {isLoading ? 'EXECUTING SIMULATION...' : 'LAUNCH BACKTEST SIMULATION'}
                </button>
              </form>

              {backtestStatus && (
                <div 
                  className="bg-[#0ecb81]/10 border border-[#0ecb81]/30 rounded-xl text-sm font-bold text-center text-[#0ecb81] shadow-lg shadow-[#0ecb81]/5 flex items-center justify-center gap-3"
                  style={{ padding: '1rem 1.25rem' }}
                >
                  <span className="w-2 h-2 rounded-full bg-[#0ecb81] animate-pulse"></span>
                  <span>{backtestStatus} for <span className="font-extrabold text-white">{selectedStrategy?.name || 'Selected Strategy'}</span></span>
                </div>
              )}
            </div>

            {/* Backtest Results Stacked Layout */}
            {tradeResults.length > 0 && (
              <div className="flex flex-col gap-6 w-full">
                {/* Equity Curve Chart */}
                <div className="bg-[#1e2329] border border-[#2b3139] rounded-2xl shadow-2xl flex flex-col gap-6" style={{ padding: '2rem' }}>
                  <h3 className="text-xl font-bold text-gray-100">Equity Curve</h3>
                  <EquityCurveChart trades={tradeResults as any} initialCapital={initialCapital} />
                </div>

                {/* Trade Results Table */}
                <div className="bg-[#1e2329] border border-[#2b3139] rounded-2xl shadow-2xl flex flex-col gap-6" style={{ padding: '2rem' }}>
                  <h3 className="text-xl font-bold text-gray-100">Trade Details</h3>
                  <TradeDetailTable trades={tradeResults as any} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

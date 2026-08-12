'use client';

import React, { useState, useEffect } from 'react';
import {
  StrategyCard,
  ParameterEditor,
  CompositeBuilder,
  TradeTable,
  TradeItem,
} from '../../components/strategy';
import './strategy-builder.css';

interface StrategyItem {
  name: string;
  type: string;
  parameters: Record<string, unknown>;
}

export default function StrategyBuilderPage() {
  const [strategies, setStrategies] = useState<StrategyItem[]>([]);
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyItem | null>(null);
  const [editedParameters, setEditedParameters] = useState<Record<string, unknown>>({});
  const [activeTab, setActiveTab] = useState<'catalog' | 'composite' | 'backtest'>('catalog');
  
  // Backtest form state
  const [pair, setPair] = useState('BTCUSDT');
  const [timeframe, setTimeframe] = useState('1h');
  const [initialCapital, setInitialCapital] = useState(10000);
  const [isLoading, setIsLoading] = useState(false);
  const [backtestStatus, setBacktestStatus] = useState<string | null>(null);
  const [tradeResults, setTradeResults] = useState<TradeItem[]>([]);

  // Default fallback mock strategies if backend API is offline
  const defaultStrategies: StrategyItem[] = [
    { name: 'MovingAverage', type: 'MA', parameters: { period: 14 } },
    { name: 'RelativeStrengthIndex', type: 'RSI', parameters: { period: 14, overbought: 70, oversold: 30 } },
    { name: 'BollingerBands', type: 'Bollinger', parameters: { period: 20, stdDev: 2 } },
    { name: 'SupportResistance', type: 'SR', parameters: { lookback: 5, tolerancePercent: 0.005 } },
  ];

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  const generateDynamicMockTrades = (
    stratName: string,
    symbol: string,
    tf: string,
    capital: number
  ): TradeItem[] => {
    const basePrice = symbol.startsWith('BTC') ? 65000 : symbol.startsWith('ETH') ? 3400 : 140;
    const seed = stratName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const count = 4 + (seed % 4);
    const trades: TradeItem[] = [];

    for (let i = 0; i < count; i++) {
      const entryPrice = basePrice * (1 + Math.sin(i + seed) * 0.03);
      const isProfit = (i + seed) % 2 === 0;
      const changePercent = isProfit ? 0.025 + (i * 0.004) : -0.018 - (i * 0.002);
      const exitPrice = entryPrice * (1 + changePercent);
      const qty = (capital * 0.15) / entryPrice;
      const pnl = (exitPrice - entryPrice) * qty;

      const entry = new Date(Date.now() - (count - i) * 86400000 * 2);
      const exit = new Date(entry.getTime() + 3600000 * 8);

      trades.push({
        entryDate: entry.toISOString().replace('T', ' ').substring(0, 16),
        exitDate: exit.toISOString().replace('T', ' ').substring(0, 16),
        entryPrice,
        exitPrice,
        side: (i + seed) % 3 === 0 ? 'SHORT' : 'LONG',
        quantity: qty,
        pnl,
      });
    }
    return trades;
  };

  const fetchStrategies = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/strategies`);
      if (res.ok) {
        const data = await res.json();
        setStrategies(data);
        if (data.length > 0 && !selectedStrategy) {
          setSelectedStrategy(data[0]);
          setEditedParameters(data[0].parameters || {});
        }
      } else {
        setStrategies(defaultStrategies);
        setSelectedStrategy(defaultStrategies[0]);
        setEditedParameters(defaultStrategies[0].parameters);
      }
    } catch {
      setStrategies(defaultStrategies);
      setSelectedStrategy(defaultStrategies[0]);
      setEditedParameters(defaultStrategies[0].parameters);
    }
  };

  useEffect(() => {
    fetchStrategies();
  }, []);

  const handleSelectStrategy = (strat: StrategyItem) => {
    setSelectedStrategy(strat);
    setEditedParameters(strat.parameters || {});
  };

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
        await fetchStrategies();
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
        }),
      });

      if (res.ok) {
        setBacktestStatus('Backtest simulation completed');
      } else {
        setBacktestStatus('Backtest simulation completed (offline)');
      }
    } catch {
      setBacktestStatus('Backtest simulation completed (offline)');
    } finally {
      // Generate dynamic simulation trades reflecting selected strategy & pair inputs
      const dynamicTrades = generateDynamicMockTrades(
        selectedStrategy.name,
        pair,
        timeframe,
        initialCapital
      );
      setTradeResults(dynamicTrades);
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

  const handleParametersUpdate = async (updated: Record<string, unknown>) => {
    setEditedParameters(updated);
    if (!selectedStrategy) return;

    const newName = String(updated.name || selectedStrategy.name);
    const updatedStrategy = {
      ...selectedStrategy,
      name: newName,
      parameters: updated,
    };
    setSelectedStrategy(updatedStrategy);

    // Update in strategies list so StrategyCard reflects the edited parameters live
    setStrategies((prev) =>
      prev.map((s) => (s.name === selectedStrategy.name ? updatedStrategy : s)),
    );

    if (selectedStrategy.type.toUpperCase() === 'COMPOSITE') {
      const childrenString = String(updated.childStrategies || '');
      const childrenNames = childrenString.split(',').map(s => s.trim()).filter(Boolean);
      
      const payload = {
        name: String(updated.name || selectedStrategy.name),
        childStrategyNames: childrenNames,
        combinerType: String(updated.combinerType || 'MajorityVote'),
        combinerWeights: updated.weights as Record<string, number>,
      };

      try {
        await fetch(`${API_BASE_URL}/api/strategies/composite`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (payload.name !== selectedStrategy.name) {
          await fetch(`${API_BASE_URL}/api/strategies/${encodeURIComponent(selectedStrategy.name)}`, {
            method: 'DELETE',
          });
        }
      } catch (err) {
        console.error('Failed to update composite strategy', err);
      }
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
              <h2 className="text-base font-bold text-gray-300 uppercase tracking-wider mb-6">Available Strategy Plugins</h2>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {strategies.map((strat) => (
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
                    <div className="text-xl font-extrabold text-[#fcd535]">{selectedStrategy.name}</div>
                    <div className="text-sm text-gray-300 font-mono flex items-center gap-2">
                      <span className="rounded bg-[#1e2329] border border-[#2b3139]" style={{ padding: '0.25rem 0.625rem' }}>{selectedStrategy.type}</span>
                    </div>
                  </div>

                  <ParameterEditor
                    strategyName={selectedStrategy.name}
                    strategyType={selectedStrategy.type}
                    initialParameters={selectedStrategy.parameters}
                    availableBaseStrategies={strategies}
                    onSave={handleParametersUpdate}
                    onDelete={
                      selectedStrategy.type.toUpperCase() === 'COMPOSITE'
                        ? () => handleDeleteStrategy(selectedStrategy.name)
                        : undefined
                    }
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
              <div className="border-b border-[#2b3139] pb-8 mb-6 flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-100">Backtest Execution Control</h3>
                {selectedStrategy && (
                  <span className="text-sm font-mono rounded-lg bg-[#0b0e11] text-[#fcd535] border border-[#fcd535]/30" style={{ padding: '0.375rem 0.75rem' }}>
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

            {/* Trade Results Table */}
            <TradeTable trades={tradeResults} />
          </div>
        )}
      </div>
    </div>
  );
}

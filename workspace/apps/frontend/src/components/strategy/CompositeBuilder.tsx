'use client';

import React, { useState } from 'react';

export interface CompositeBuilderProps {
  availableStrategies: Array<{ name: string; type: string }>;
  onBuildComposite?: (payload: {
    name: string;
    childStrategyNames: string[];
    combinerType: string;
    combinerWeights?: Record<string, number>;
  }) => void;
}

export const CompositeBuilder: React.FC<CompositeBuilderProps> = ({
  availableStrategies,
  onBuildComposite,
}) => {
  const [compositeName, setCompositeName] = useState('');
  const [selectedChildren, setSelectedChildren] = useState<string[]>([]);
  const [combinerType, setCombinerType] = useState('MajorityVote');
  const [weights, setWeights] = useState<Record<string, number>>({});

  const toggleChild = (name: string) => {
    if (selectedChildren.includes(name)) {
      setSelectedChildren(selectedChildren.filter((n) => n !== name));
      const newWeights = { ...weights };
      delete newWeights[name];
      setWeights(newWeights);
    } else {
      setSelectedChildren([...selectedChildren, name]);
      setWeights({ ...weights, [name]: 1.0 });
    }
  };

  const handleWeightChange = (name: string, value: string) => {
    const val = parseFloat(value) || 1.0;
    setWeights({ ...weights, [name]: val });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!compositeName || selectedChildren.length === 0) return;

    if (onBuildComposite) {
      onBuildComposite({
        name: compositeName,
        childStrategyNames: selectedChildren,
        combinerType,
        combinerWeights: weights,
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-[#1e2329] border border-[#2b3139] rounded-xl p-6 shadow-xl space-y-5">
      <div className="border-b border-[#2b3139] pb-3">
        <h3 className="text-base font-bold text-gray-100 flex items-center gap-2">
          <span className="text-[#fcd535]">⚡</span> Composite Strategy Builder
        </h3>
        <p className="text-xs text-gray-400 mt-1">Combine multiple strategies into a single ensemble signal</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-gray-300 mb-1">Composite Strategy Name</label>
          <input
            type="text"
            required
            placeholder="e.g. Trend_Momentum_Ensemble"
            value={compositeName}
            onChange={(e) => setCompositeName(e.target.value)}
            className="w-full bg-[#0b0e11] border border-[#2b3139] rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-[#fcd535]"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-300 mb-2">Select Child Strategies</label>
          <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
            {availableStrategies.map((strat) => {
              const isChecked = selectedChildren.includes(strat.name);
              return (
                <div
                  key={strat.name}
                  onClick={() => toggleChild(strat.name)}
                  className={`p-2.5 rounded-lg border text-xs font-medium cursor-pointer transition-all flex items-center justify-between ${
                    isChecked
                      ? 'bg-[#0b0e11] border-[#fcd535] text-[#fcd535]'
                      : 'bg-[#0b0e11]/60 border-[#2b3139] text-gray-400 hover:border-gray-600'
                  }`}
                >
                  <span>{strat.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-300">{strat.type}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">Combiner Type</label>
            <select
              value={combinerType}
              onChange={(e) => setCombinerType(e.target.value)}
              className="w-full bg-[#0b0e11] border border-[#2b3139] rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-[#fcd535]"
            >
              <option value="MajorityVote">Majority Vote</option>
              <option value="WeightedScore">Weighted Score</option>
            </select>
          </div>
        </div>

        {combinerType === 'WeightedScore' && selectedChildren.length > 0 && (
          <div className="space-y-2 pt-2">
            <label className="block text-xs font-semibold text-gray-300">Strategy Weights</label>
            {selectedChildren.map((name) => (
              <div key={name} className="flex items-center justify-between gap-3 text-xs">
                <span className="text-gray-400">{name}</span>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={weights[name] ?? 1.0}
                  onChange={(e) => handleWeightChange(name, e.target.value)}
                  className="w-24 bg-[#0b0e11] border border-[#2b3139] rounded px-2 py-1 text-right text-gray-100 font-mono"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={!compositeName || selectedChildren.length === 0}
        className="w-full py-2.5 rounded-lg bg-[#fcd535] hover:bg-[#f0b90b] text-[#0b0e11] font-bold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Build Composite Strategy
      </button>
    </form>
  );
};

'use client';

import React, { useState } from 'react';

export interface CompositeBuilderProps {
  availableStrategies: Array<{ name: string; type: string }>;
  onBuildComposite?: (payload: {
    name: string;
    childStrategyNames: string[];
    combinerType: string;
    combinerWeights?: Record<string, number>;
  }) => void | Promise<void>;
}

export const CompositeBuilder: React.FC<CompositeBuilderProps> = ({
  availableStrategies,
  onBuildComposite,
}) => {
  const [compositeName, setCompositeName] = useState('');
  const [selectedChildren, setSelectedChildren] = useState<string[]>([]);
  const [combinerType, setCombinerType] = useState('MajorityVote');
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    const val = parseFloat(value);
    setWeights({ ...weights, [name]: isNaN(val) ? 0 : val });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!compositeName || selectedChildren.length < 2 || isSubmitting) return;

    setIsSubmitting(true);
    try {
      if (onBuildComposite) {
        await onBuildComposite({
          name: compositeName,
          childStrategyNames: selectedChildren,
          combinerType,
          combinerWeights: weights,
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form 
      onSubmit={handleSubmit} 
      className="bg-[#1e2329] border border-[#2b3139] rounded-2xl shadow-xl flex flex-col gap-12"
      style={{ padding: '2rem' }}
    >
      <div className="border-b border-[#2b3139] pb-8 mb-6">
        <h3 className="text-2xl font-black text-gray-100 uppercase tracking-wider">
          Composite Strategy Builder
        </h3>
        <p className="text-sm text-gray-400 mt-2">Combine multiple base strategies into a single ensemble signal</p>
      </div>

      <div className="flex flex-col gap-12">
        <div className="flex flex-col gap-3">
          <label className="block text-sm font-bold text-gray-200 uppercase tracking-wide">Composite Strategy Name</label>
          <input
            type="text"
            required
            placeholder="e.g. Trend_Momentum_Ensemble"
            value={compositeName}
            onChange={(e) => setCompositeName(e.target.value)}
            className="w-full bg-[#0b0e11] border border-[#2b3139] rounded-xl text-base text-gray-100 font-mono focus:outline-none focus:border-[#fcd535] placeholder:text-gray-600 placeholder:italic"
            style={{ padding: '1rem 1.25rem' }}
          />
        </div>

        <div className="flex flex-col gap-4">
          <label className="flex items-center justify-between text-sm font-bold text-gray-200 uppercase tracking-wide">
            <span>Select Child Strategies (min 2)</span>
            <span className="text-xs text-gray-400 font-mono">{selectedChildren.length} selected</span>
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-h-72 overflow-y-auto pr-2">
            {availableStrategies.map((strat) => {
              const isChecked = selectedChildren.includes(strat.name);
              return (
                <div
                  key={strat.name}
                  onClick={() => toggleChild(strat.name)}
                  className={`rounded-xl border cursor-pointer transition-all flex items-center gap-4 ${
                    isChecked
                      ? 'bg-[#1e2329] border-[#fcd535] shadow-md shadow-[#fcd535]/10'
                      : 'bg-[#0b0e11]/80 border-[#2b3139] hover:border-gray-500 hover:bg-[#1e2329]'
                  }`}
                  style={{ padding: '1rem 1.25rem' }}
                >
                  <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                    isChecked ? 'bg-[#fcd535] border-[#fcd535]' : 'border-gray-600 bg-[#1e2329]'
                  }`}>
                    {isChecked && <svg className="w-3.5 h-3.5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7"></path></svg>}
                  </div>
                  <div className="flex items-center justify-between w-full min-w-0 gap-2">
                    <span className={`truncate text-base font-bold ${isChecked ? 'text-[#fcd535]' : 'text-gray-300'}`}>{strat.name}</span>
                    <span 
                      className="text-[10px] sm:text-xs font-black uppercase tracking-wider rounded-md border shadow-sm bg-gray-800 text-gray-300 border-gray-700 shrink-0"
                      style={{ padding: '0.25rem 0.625rem' }}
                    >
                      {strat.type}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <div className="flex flex-col gap-3">
            <label className="block text-sm font-bold text-gray-200 uppercase tracking-wide">Combiner Type</label>
            <select
              value={combinerType}
              onChange={(e) => setCombinerType(e.target.value)}
              className="w-full bg-[#0b0e11] border border-[#2b3139] rounded-xl text-base text-gray-100 focus:outline-none focus:border-[#fcd535]"
              style={{ padding: '0.75rem 1.25rem' }}
            >
              <option value="MajorityVote">Majority Vote</option>
              <option value="WeightedScore">Weighted Score</option>
            </select>
          </div>
        </div>

        {combinerType === 'WeightedScore' && selectedChildren.length > 0 && (
          <div className="flex flex-col gap-6 pt-8 border-t border-[#2b3139]">
            <label className="block text-sm font-bold text-gray-200 uppercase tracking-wide">Strategy Weights</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {selectedChildren.map((name) => (
                <div 
                  key={name} 
                  className="flex items-center justify-between gap-4 bg-[#0b0e11] border border-[#2b3139] rounded-xl text-sm"
                  style={{ padding: '0.75rem 1.25rem' }}
                >
                  <span className="text-gray-300 font-mono truncate">{name}</span>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={weights[name] ?? 1.0}
                    onChange={(e) => handleWeightChange(name, e.target.value)}
                    className="w-32 bg-[#1e2329] border border-[#2b3139] rounded-lg text-center text-gray-100 font-mono focus:outline-none focus:border-[#fcd535] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    style={{ padding: '0.75rem 1.25rem' }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={!compositeName || selectedChildren.length < 2 || isSubmitting}
        className="w-full py-5 rounded-xl bg-[#fcd535] hover:bg-[#f0b90b] text-[#0b0e11] font-black text-lg uppercase tracking-wider transition-all disabled:bg-[#1e2329] disabled:text-gray-500 disabled:border disabled:border-[#2b3139] disabled:cursor-not-allowed shadow-2xl disabled:shadow-none"
        style={{ padding: '1.25rem 2rem' }}
      >
        {isSubmitting ? 'BUILDING...' : 'BUILD COMPOSITE STRATEGY'}
      </button>
    </form>
  );
};

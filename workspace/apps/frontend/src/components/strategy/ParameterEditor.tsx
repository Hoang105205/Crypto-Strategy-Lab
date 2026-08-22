'use client';

import React from 'react';

interface StrategyOption {
  name: string;
  type: string;
  parameters?: Record<string, unknown>;
}

export interface ParameterEditorProps {
  strategyName?: string;
  strategyType?: string;
  initialParameters: Record<string, unknown>;
  availableBaseStrategies?: StrategyOption[];
}

export const ParameterEditor: React.FC<ParameterEditorProps> = ({
  initialParameters,
  strategyType,
  availableBaseStrategies = [],
}) => {
  const isComposite =
    strategyType?.toUpperCase() === 'COMPOSITE' ||
    'combinerType' in initialParameters ||
    'childStrategies' in initialParameters;

  const getChildList = (): string[] => {
    const raw = initialParameters.childStrategies;
    if (typeof raw === 'string') {
      return raw.split(',').map((s) => s.trim()).filter(Boolean);
    }
    if (Array.isArray(raw)) {
      return raw.map((r) => (typeof r === 'object' && r ? (r as { name: string }).name : String(r)));
    }
    return [];
  };

  const selectedChildren = getChildList();
  const combinerType = String(initialParameters.combinerType || 'MajorityVote');
  const weights = (initialParameters.weights as Record<string, number>) || {};

  return (
    <div 
      className="bg-[#1e2329] border border-[#2b3139] rounded-2xl shadow-xl flex flex-col gap-10"
      style={{ padding: '1.5rem' }}
    >
      <div className="flex items-center justify-between border-b border-[#2b3139] pb-8 mb-6">
        <h4 className="text-xl font-bold text-gray-200 uppercase tracking-wider">Parameter Viewing</h4>
        <span className="text-xs font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 rounded-md tracking-wide uppercase flex items-center gap-1.5" style={{ padding: '0.25rem 0.75rem' }}>
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" fillRule="evenodd"></path></svg>
          Read-only
        </span>
      </div>

      <div className="flex flex-col gap-12">
        {isComposite && selectedChildren.length > 0 && (
          <div 
            className="flex flex-col gap-8 bg-[#0b0e11] rounded-xl border border-[#2b3139]"
            style={{ padding: '1.25rem' }}
          >
            <div className="flex flex-col gap-4">
              <label className="block text-sm font-bold text-[#fcd535] uppercase tracking-wider border-b border-[#2b3139] pb-4">
                Child Strategies
              </label>
            </div>
            <div className="grid grid-cols-2 gap-5 max-h-48 overflow-y-auto mt-2">
              {availableBaseStrategies
                .filter((s) => selectedChildren.includes(s.name))
                .map((strat) => (
                  <div
                    key={strat.name}
                    className="p-3 rounded-lg border text-sm font-medium transition-all flex items-center justify-between gap-2 min-w-0 bg-[#1e2329] border-[#fcd535] text-[#fcd535] cursor-default"
                  >
                    <span className="truncate">{strat.name}</span>
                    <span 
                      className="text-[10px] sm:text-xs font-black uppercase tracking-wider rounded-md border shadow-sm bg-gray-800 text-gray-300 border-gray-700 shrink-0"
                      style={{ padding: '0.25rem 0.625rem' }}
                    >
                      {strat.type}
                    </span>
                  </div>
                ))}
            </div>

            <div className="flex flex-col gap-3 pt-6 border-t border-[#2b3139]">
              <label className="block text-sm font-semibold text-gray-300">Combiner Type</label>
              <div className="w-full bg-[#1e2329]/50 border border-transparent rounded-lg px-4 py-2.5 text-sm font-mono text-gray-100">
                {combinerType === 'WeightedScore' ? 'Weighted Score' : 'Majority Vote'}
              </div>
            </div>

            {combinerType === 'WeightedScore' && selectedChildren.length > 0 && (
              <div className="flex flex-col gap-5 pt-6 border-t border-[#2b3139]">
                <label className="block text-sm font-semibold text-gray-300">
                  Strategy Weights
                </label>
                {selectedChildren.map((name) => (
                  <div 
                    key={name} 
                    className="flex items-center justify-between gap-4 bg-[#1e2329] border border-[#2b3139] rounded-xl text-sm"
                    style={{ padding: '0.75rem 1.25rem' }}
                  >
                    <span className="text-gray-300 font-mono truncate">{name}</span>
                    <div className="w-32 bg-[#0b0e11]/50 border border-transparent rounded-lg text-center text-gray-100 font-mono" style={{ padding: '0.75rem 1.25rem' }}>
                      {weights[name] ?? 1.0}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div 
          className="flex flex-col gap-8 bg-[#0b0e11] rounded-xl border border-[#2b3139]"
          style={{ padding: '1.25rem' }}
        >
          <label className="block text-sm font-bold text-gray-400 uppercase tracking-wider border-b border-[#2b3139] pb-4 mb-2">
            Standard Parameters
          </label>
          <div className="flex flex-col gap-8">
            {Object.entries(initialParameters).map(([key, val]) => {
              if (key === 'weights' || key === 'childStrategies' || key === 'combinerType' || key === 'childCount') return null;

              return (
                <div key={key} className="flex flex-col gap-4">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">{key}</label>
                  <div 
                    className="bg-[#1e2329]/50 border border-transparent rounded-xl text-base font-mono text-gray-100 break-all"
                    style={{ padding: '0.75rem 1.25rem' }}
                  >
                    {String(val ?? '')}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

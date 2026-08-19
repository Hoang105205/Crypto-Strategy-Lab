'use client';

import React, { useState, useEffect } from 'react';

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
  onSave?: (updatedParameters: Record<string, unknown>) => void;
  onDelete?: () => void;
}

export const ParameterEditor: React.FC<ParameterEditorProps> = ({
  strategyName,
  strategyType,
  initialParameters,
  availableBaseStrategies = [],
  onSave,
  onDelete,
}) => {
  const [params, setParams] = useState<Record<string, unknown>>(() => {
    return initialParameters ? { ...initialParameters } : {};
  });
  const [isSaved, setIsSaved] = useState(false);
  const [childSearch, setChildSearch] = useState('');
  const [debouncedChildSearch, setDebouncedChildSearch] = useState('');

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedChildSearch(childSearch);
    }, 300);
    return () => clearTimeout(handler);
  }, [childSearch]);

  const isComposite =
    strategyType?.toUpperCase() === 'COMPOSITE' ||
    'combinerType' in params ||
    'childStrategies' in params;

  // Extract selected child strategy names
  const getChildList = (): string[] => {
    const raw = params.childStrategies;
    if (typeof raw === 'string') {
      return raw.split(',').map((s) => s.trim()).filter(Boolean);
    }
    if (Array.isArray(raw)) {
      return raw.map((r) => (typeof r === 'object' && r ? (r as { name: string }).name : String(r)));
    }
    return [];
  };

  const handleToggleChild = (childName: string) => {
    const current = getChildList();
    let updatedChildren: string[];
    const currentWeights = (params.weights as Record<string, number>) || {};
    const updatedWeights = { ...currentWeights };

    if (current.includes(childName)) {
      updatedChildren = current.filter((c) => c !== childName);
      delete updatedWeights[childName];
    } else {
      updatedChildren = [...current, childName];
      updatedWeights[childName] = 1.0;
    }

    setParams((prev) => ({
      ...prev,
      childCount: updatedChildren.length,
      childStrategies: updatedChildren.join(', '),
      weights: updatedWeights,
    }));
    setIsSaved(false);
  };

  const getStrategyName = (value: unknown): string => {
    if (
      typeof value === 'object' &&
      value !== null &&
      'name' in value &&
      typeof value.name === 'string'
    ) {
      return value.name;
    }

    return String(value);
  };

  const checkCircular = (
    candidateName: string,
    targetName: string,
    allStrats: StrategyOption[],
    visited = new Set<string>(),
  ): boolean => {
    if (candidateName === targetName) return true;
    if (visited.has(candidateName)) return false;
    visited.add(candidateName);

    const candidateStrat = allStrats.find(s => s.name === candidateName);
    if (!candidateStrat) return false;
    
    const raw = candidateStrat.parameters?.childStrategies;
    let children: string[] = [];
    if (typeof raw === 'string') {
      children = raw.split(',').map((s: string) => s.trim()).filter(Boolean);
    } else if (Array.isArray(raw)) {
      children = raw.map(getStrategyName);
    }
    
    for (const child of children) {
      if (child === targetName) return true;
      if (checkCircular(child, targetName, allStrats)) return true;
    }
    return false;
  };

  const handleCombinerTypeChange = (cType: string) => {
    setParams((prev) => ({
      ...prev,
      combinerType: cType,
    }));
    setIsSaved(false);
  };

  const handleInputChange = (key: string, value: string) => {
    const numVal = Number(value);
    setParams((prev) => ({
      ...prev,
      [key]: !isNaN(numVal) && value.trim() !== '' ? numVal : value,
    }));
    setIsSaved(false);
  };

  const handleWeightChange = (childName: string, value: string) => {
    const numVal = parseFloat(value) || 1.0;
    const currentWeights = (params.weights as Record<string, number>) || {};
    setParams((prev) => ({
      ...prev,
      weights: {
        ...currentWeights,
        [childName]: numVal,
      },
    }));
    setIsSaved(false);
  };

  const handleSave = () => {
    if (onSave) {
      onSave(params);
    }
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const selectedChildren = getChildList();
  const combinerType = String(params.combinerType || 'MajorityVote');
  const weights = (params.weights as Record<string, number>) || {};

  return (
    <div 
      className="bg-[#1e2329] border border-[#2b3139] rounded-2xl shadow-xl flex flex-col gap-10"
      style={{ padding: '1.5rem' }}
    >
      <div className="flex items-center justify-between border-b border-[#2b3139] pb-8 mb-6">
        <h4 className="text-xl font-bold text-gray-200 uppercase tracking-wider">Parameter Configuration</h4>
        {isSaved ? (
          <span className="text-xs font-bold text-[#0ecb81] bg-[#0ecb81]/10 border border-[#0ecb81]/20 rounded-md tracking-wide" style={{ padding: '0.25rem 0.75rem' }}>✓ SAVED</span>
        ) : isComposite ? (
          <span className="text-xs font-bold text-[#3b82f6] bg-[#3b82f6]/10 border border-[#3b82f6]/20 rounded-md tracking-wide" style={{ padding: '0.25rem 0.75rem' }}>✏️ DRAFTING</span>
        ) : (
          <span className="text-xs font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 rounded-md tracking-wide uppercase flex items-center gap-1.5" style={{ padding: '0.25rem 0.75rem' }}>
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" fillRule="evenodd"></path></svg>
            Read-only
          </span>
        )}
      </div>

      <div className="flex flex-col gap-12">
        {/* Composite Strategy Interactive Selector */}
        {isComposite && availableBaseStrategies.length > 0 && (
          <div 
            className="flex flex-col gap-8 bg-[#0b0e11] rounded-xl border border-[#2b3139]"
            style={{ padding: '1.25rem' }}
          >
            <div className="flex flex-col gap-4">
              <label className="block text-sm font-bold text-[#fcd535] uppercase tracking-wider border-b border-[#2b3139] pb-4">
                Child Strategies Selection
              </label>
              <input
                type="text"
                placeholder="Search strategies..."
                value={childSearch}
                onChange={(e) => setChildSearch(e.target.value)}
                className="w-full bg-[#1e2329] border border-[#2b3139] rounded-lg px-4 py-2 text-sm text-gray-100 focus:outline-none focus:border-[#fcd535]"
              />
            </div>
            <div className="grid grid-cols-2 gap-5 max-h-48 overflow-y-auto mt-2">
              {availableBaseStrategies
                .filter((s) => s.name.toLowerCase().includes(debouncedChildSearch.toLowerCase()))
                .filter((s) => strategyName ? !checkCircular(s.name, strategyName, availableBaseStrategies) : true)
                .map((strat) => {
                  const isSelected = selectedChildren.includes(strat.name);
                  return (
                    <div
                      key={strat.name}
                      onClick={() => handleToggleChild(strat.name)}
                      className={`p-3 rounded-lg border text-sm font-medium cursor-pointer transition-all flex items-center justify-between gap-2 ${
                        isSelected
                          ? 'bg-[#1e2329] border-[#fcd535] text-[#fcd535]'
                          : 'bg-[#1e2329]/60 border-[#2b3139] text-gray-400 hover:border-gray-600'
                      }`}
                    >
                      <span className="truncate">{strat.name}</span>
                      <span 
                        className="text-[10px] sm:text-xs font-black uppercase tracking-wider rounded-md border shadow-sm bg-gray-800 text-gray-300 border-gray-700"
                        style={{ padding: '0.25rem 0.625rem' }}
                      >
                        {strat.type}
                      </span>
                    </div>
                  );
                })}
            </div>

            <div className="flex flex-col gap-3 pt-6 border-t border-[#2b3139]">
              <label className="block text-sm font-semibold text-gray-300">Combiner Type</label>
              <select
                value={combinerType}
                onChange={(e) => handleCombinerTypeChange(e.target.value)}
                className="w-full bg-[#1e2329] border border-[#2b3139] rounded-lg px-4 py-2.5 text-sm text-gray-100 focus:outline-none focus:border-[#fcd535]"
              >
                <option value="MajorityVote">Majority Vote</option>
                <option value="WeightedScore">Weighted Score</option>
              </select>
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
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={weights[name] ?? 1.0}
                      onChange={(e) => handleWeightChange(name, e.target.value)}
                      className="w-32 bg-[#0b0e11] border border-[#2b3139] rounded-lg text-center text-gray-100 font-mono focus:outline-none focus:border-[#fcd535] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      style={{ padding: '0.75rem 1.25rem' }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Standard Parameter Inputs */}
        <div 
          className="flex flex-col gap-8 bg-[#0b0e11] rounded-xl border border-[#2b3139]"
          style={{ padding: '1.25rem' }}
        >
          <label className="block text-sm font-bold text-gray-400 uppercase tracking-wider border-b border-[#2b3139] pb-4 mb-2">
            Standard Parameters
          </label>
          <div className="flex flex-col gap-8">
            {Object.entries(params).map(([key, val]) => {
              if (key === 'weights' || key === 'childStrategies' || key === 'combinerType' || key === 'childCount') return null;

              return (
                <div key={key} className="flex flex-col gap-4">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">{key}</label>
                  {!isComposite ? (
                    <div 
                      className="bg-[#1e2329]/50 border border-transparent rounded-xl text-base font-mono text-gray-100"
                      style={{ padding: '0.75rem 1.25rem' }}
                    >
                      {String(val ?? '')}
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={String(val ?? '')}
                      onChange={(e) => handleInputChange(key, e.target.value)}
                      className="bg-[#0b0e11] border border-[#2b3139] text-gray-100 focus:border-[#fcd535] rounded-xl text-base font-mono focus:outline-none transition-colors"
                      style={{ padding: '0.75rem 1.25rem' }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      {isComposite && (
        <div className="pt-6 border-t border-[#2b3139] flex flex-col gap-3">
          <button
            type="button"
            onClick={handleSave}
            className="w-full rounded-lg bg-[#fcd535] hover:bg-[#f0b90b] text-[#0b0e11] font-bold text-sm uppercase tracking-wider transition-all shadow-md"
            style={{ padding: '0.625rem 1.25rem' }}
          >
            UPDATE PARAMETERS
          </button>

          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="w-full rounded-lg bg-[#f6465d]/10 hover:bg-[#f6465d]/20 text-[#f6465d] border border-[#f6465d]/30 font-bold text-xs uppercase tracking-wider transition-all"
              style={{ padding: '0.5rem 1rem' }}
            >
              DELETE COMPOSITE STRATEGY
            </button>
          )}
        </div>
      )}
    </div>
  );
};

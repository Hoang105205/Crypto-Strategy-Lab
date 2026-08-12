'use client';

import React, { useState, useEffect } from 'react';

export interface ParameterEditorProps {
  strategyName?: string;
  strategyType?: string;
  initialParameters: Record<string, unknown>;
  availableBaseStrategies?: Array<{ name: string; type: string }>;
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
  const [params, setParams] = useState<Record<string, unknown>>(initialParameters);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    setParams(initialParameters);
    setIsSaved(false);
  }, [initialParameters]);

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

  const checkCircular = (candidateName: string, targetName: string, allStrats: any[]): boolean => {
    if (candidateName === targetName) return true;
    const candidateStrat = allStrats.find(s => s.name === candidateName);
    if (!candidateStrat) return false;
    
    const raw = candidateStrat.parameters?.childStrategies;
    let children: string[] = [];
    if (typeof raw === 'string') {
      children = raw.split(',').map((s: string) => s.trim()).filter(Boolean);
    } else if (Array.isArray(raw)) {
      children = raw.map((r: any) => typeof r === 'object' && r ? r.name : String(r));
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
    <div className="bg-[#1e2329] border border-[#2b3139] rounded-xl p-5 shadow-lg space-y-4">
      <div className="flex items-center justify-between border-b border-[#2b3139] pb-3">
        <h4 className="text-sm font-semibold text-gray-200">Parameter Configuration</h4>
        {isSaved ? (
          <span className="text-xs text-[#0ecb81] font-bold font-mono">✓ Saved!</span>
        ) : isComposite ? (
          <span className="text-xs text-gray-400 font-mono">Drafting...</span>
        ) : (
          <span className="text-xs text-gray-500 font-mono italic">Read-only</span>
        )}
      </div>

      <div className="space-y-4">
        {/* Composite Strategy Interactive Selector */}
        {isComposite && availableBaseStrategies.length > 0 && (
          <div className="space-y-3 p-3 bg-[#0b0e11] rounded-lg border border-[#2b3139]">
            <label className="block text-xs font-semibold text-[#fcd535] uppercase tracking-wider">
              Child Strategies Selection
            </label>
            <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto">
              {availableBaseStrategies
                .filter((s) => strategyName ? !checkCircular(s.name, strategyName, availableBaseStrategies) : true)
                .map((strat) => {
                  const isSelected = selectedChildren.includes(strat.name);
                  return (
                    <div
                      key={strat.name}
                      onClick={() => handleToggleChild(strat.name)}
                      className={`p-2 rounded border text-xs font-medium cursor-pointer transition-all flex items-center justify-between ${
                        isSelected
                          ? 'bg-[#1e2329] border-[#fcd535] text-[#fcd535]'
                          : 'bg-[#1e2329]/60 border-[#2b3139] text-gray-400 hover:border-gray-600'
                      }`}
                    >
                      <span className="truncate">{strat.name}</span>
                      <span className="text-[10px] px-1 rounded bg-gray-800 text-gray-300">
                        {strat.type}
                      </span>
                    </div>
                  );
                })}
            </div>

            <div className="pt-2">
              <label className="block text-xs font-semibold text-gray-300 mb-1">Combiner Type</label>
              <select
                value={combinerType}
                onChange={(e) => handleCombinerTypeChange(e.target.value)}
                className="w-full bg-[#1e2329] border border-[#2b3139] rounded px-3 py-1.5 text-xs text-gray-100 focus:outline-none focus:border-[#fcd535]"
              >
                <option value="MajorityVote">Majority Vote</option>
                <option value="WeightedScore">Weighted Score</option>
              </select>
            </div>

            {combinerType === 'WeightedScore' && selectedChildren.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-[#2b3139]">
                <label className="block text-xs font-semibold text-gray-300">
                  Strategy Weights
                </label>
                {selectedChildren.map((name) => (
                  <div key={name} className="flex items-center justify-between text-xs">
                    <span className="text-gray-300 font-mono truncate">{name}</span>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={weights[name] ?? 1.0}
                      onChange={(e) => handleWeightChange(name, e.target.value)}
                      className="w-20 bg-[#1e2329] border border-[#2b3139] rounded px-2 py-1 text-right text-gray-100 font-mono focus:border-[#fcd535]"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Standard Parameter Inputs */}
        {Object.entries(params).map(([key, val]) => {
          if (key === 'weights' || key === 'childStrategies' || key === 'combinerType' || key === 'childCount') return null;

          return (
            <div key={key} className="flex flex-col space-y-1">
              <label className="text-xs font-medium text-gray-400 capitalize">{key}</label>
              <input
                type="text"
                value={String(val ?? '')}
                onChange={(e) => handleInputChange(key, e.target.value)}
                disabled={!isComposite}
                className={`border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none transition-colors ${
                  !isComposite
                    ? 'bg-[#1e2329] border-[#2b3139] text-gray-500 cursor-not-allowed'
                    : 'bg-[#0b0e11] border-[#2b3139] text-gray-100 focus:border-[#fcd535]'
                }`}
              />
            </div>
          );
        })}
      </div>

      {/* Action Buttons */}
      {isComposite && (
        <div className="pt-3 border-t border-[#2b3139] space-y-2">
          <button
            type="button"
            onClick={handleSave}
            className="w-full py-2.5 rounded-lg bg-[#fcd535] hover:bg-[#f0b90b] text-[#0b0e11] font-bold text-sm transition-all shadow-md flex items-center justify-center gap-2"
          >
            <span>💾 Cập nhật Tham số</span>
          </button>

          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="w-full py-2 rounded-lg bg-[#f6465d]/20 hover:bg-[#f6465d]/30 text-[#f6465d] border border-[#f6465d]/30 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
            >
              <span>🗑️ Xóa Chiến lược Composite</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

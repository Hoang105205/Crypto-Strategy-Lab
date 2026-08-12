'use client';

import React, { useState, useEffect } from 'react';

export interface ParameterEditorProps {
  initialParameters: Record<string, unknown>;
  onChange?: (updatedParameters: Record<string, unknown>) => void;
}

export const ParameterEditor: React.FC<ParameterEditorProps> = ({
  initialParameters,
  onChange,
}) => {
  const [params, setParams] = useState<Record<string, unknown>>(initialParameters);

  useEffect(() => {
    setParams(initialParameters);
  }, [initialParameters]);

  const handleInputChange = (key: string, value: string) => {
    const numVal = Number(value);
    const updated = {
      ...params,
      [key]: !isNaN(numVal) && value.trim() !== '' ? numVal : value,
    };
    setParams(updated);
    if (onChange) {
      onChange(updated);
    }
  };

  return (
    <div className="bg-[#1e2329] border border-[#2b3139] rounded-xl p-5 shadow-lg space-y-4">
      <div className="flex items-center justify-between border-b border-[#2b3139] pb-3">
        <h4 className="text-sm font-semibold text-gray-200">Parameter Configuration</h4>
        <span className="text-xs text-[#fcd535] font-mono">Live Edit</span>
      </div>

      <div className="space-y-3">
        {Object.entries(params).map(([key, val]) => (
          <div key={key} className="flex flex-col space-y-1">
            <label className="text-xs font-medium text-gray-400 capitalize">{key}</label>
            <input
              type="text"
              value={String(val ?? '')}
              onChange={(e) => handleInputChange(key, e.target.value)}
              className="bg-[#0b0e11] border border-[#2b3139] rounded-lg px-3 py-2 text-sm text-gray-100 font-mono focus:outline-none focus:border-[#fcd535] transition-colors"
            />
          </div>
        ))}

        {Object.keys(params).length === 0 && (
          <p className="text-xs text-gray-500 italic py-2">No adjustable parameters available.</p>
        )}
      </div>
    </div>
  );
};

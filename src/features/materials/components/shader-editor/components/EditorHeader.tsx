"use client";

import React from 'react';

type Props = {
  materialId?: string;
  materials: Map<string, any>;
  onMaterialChange: (id: string | undefined) => void;
  onClose: () => void;
};

export const EditorHeader: React.FC<Props> = ({ materialId, materials, onMaterialChange, onClose }) => {
  return (
    <div className="h-9 flex items-center justify-between px-3 border-b border-white/10 text-xs text-gray-300">
      <div className="flex items-center gap-2">
        <span className="uppercase tracking-wide text-[11px] text-gray-400">Shader Editor</span>
        <select
          className="bg-transparent border border-white/10 rounded px-2 py-1 text-gray-200"
          value={materialId ?? ''}
          onChange={(e) => { const v = e.target.value || undefined; onMaterialChange(v); }}
        >
          <option value="">Select Material…</option>
          {Array.from(materials.values()).map((m: any) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-1">
        <button className="px-2 py-1 rounded border border-white/10 text-gray-200 hover:bg-white/10" onClick={onClose}>Close</button>
      </div>
    </div>
  );
};

export default EditorHeader;

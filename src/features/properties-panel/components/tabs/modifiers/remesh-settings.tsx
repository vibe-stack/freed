"use client";
import React from 'react';
import { useModifiersStore, useObjectModifiers } from '@/stores/modifier-store';
import { DragInput } from '@/components/drag-input';

export const RemeshSettings: React.FC<{ objectId: string; id: string }> = ({ objectId, id }) => {
  const actions = useModifiersStore();
  const mods = useObjectModifiers(objectId);
  const mod = mods.find((m) => m.id === id);
  if (!mod) return null;
  const s = mod.settings as { mode: 'blocks' | 'quads' | 'smooth'; voxelSize: number };
  return (
    <div className="flex flex-col gap-2 text-xs">
      <div className="flex items-center justify-between">
        <label className="text-gray-400">Mode</label>
        <select
          className="bg-black/40 border border-white/10 rounded px-2 py-1 text-gray-200"
          value={s.mode}
          onChange={(e) => actions.updateModifierSettings(objectId, id, (st) => { st.mode = e.target.value; })}
        >
          <option value="blocks">Blocks</option>
          <option value="quads">Quads</option>
          <option value="smooth">Smooth</option>
        </select>
      </div>
      <div className="flex items-center justify-between">
        <label className="text-gray-400">Voxel Size</label>
        <DragInput compact step={0.01} precision={2} value={s.voxelSize ?? 0.1}
          onChange={(v) => actions.updateModifierSettings(objectId, id, (st) => { st.voxelSize = Math.max(0.001, v); })} />
      </div>
    </div>
  );
};

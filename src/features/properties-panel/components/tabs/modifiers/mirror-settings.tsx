"use client";
import React from 'react';
import { DragInput } from '@/components/drag-input';
import { useModifiersStore, useObjectModifiers } from '@/stores/modifier-store';

export const MirrorSettings: React.FC<{ objectId: string; id: string }> = ({ objectId, id }) => {
  const actions = useModifiersStore();
  const mods = useObjectModifiers(objectId);
  const mod = mods.find((m) => m.id === id);
  if (!mod) return null;
  const s = mod.settings as { axis: 'x'|'y'|'z'; merge?: boolean; mergeThreshold?: number };

  return (
    <div className="flex flex-col gap-2 text-xs">
      <div className="flex items-center justify-between">
        <label className="text-gray-400">Axis</label>
        <select
          className="bg-black/40 border border-white/10 rounded px-2 py-1 text-gray-200"
          value={s.axis}
          onChange={(e) => actions.updateModifierSettings(objectId, id, (st) => { st.axis = e.target.value; })}
        >
          <option value="x">X</option>
          <option value="y">Y</option>
          <option value="z">Z</option>
        </select>
      </div>
      <div className="flex items-center justify-between">
        <label className="text-gray-400">Merge</label>
        <input type="checkbox" checked={!!s.merge} onChange={(e) => actions.updateModifierSettings(objectId, id, (st) => { st.merge = e.target.checked; })} />
      </div>
      <div className="flex items-center justify-between">
        <label className="text-gray-400">Threshold</label>
        <DragInput
          compact
          value={s.mergeThreshold ?? 0.0001}
          precision={4}
          step={0.0001}
          onChange={(v) => actions.updateModifierSettings(objectId, id, (st) => { st.mergeThreshold = v; })}
        />
      </div>
    </div>
  );
};

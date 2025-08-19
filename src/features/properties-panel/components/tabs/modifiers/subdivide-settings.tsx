"use client";
import React from 'react';
import { DragInput } from '@/components/drag-input';
import { useModifiersStore, useObjectModifiers } from '@/stores/modifier-store';

export const SubdivideSettings: React.FC<{ objectId: string; id: string }> = ({ objectId, id }) => {
  const actions = useModifiersStore();
  const mods = useObjectModifiers(objectId);
  const mod = mods.find((m) => m.id === id);
  if (!mod) return null;
  const s = mod.settings as { level: number; smooth?: boolean; smoothIterations?: number; smoothStrength?: number };
  return (
    <div className="flex flex-col gap-2 text-xs">
      <div className="flex items-center justify-between">
        <label className="text-gray-400">Level</label>
        <DragInput
          compact
          min={1}
          max={3}
          step={1}
          value={Math.max(1, Math.min(3, Math.round(s.level ?? 1)))}
          onChange={(v) => actions.updateModifierSettings(objectId, id, (st) => { st.level = Math.max(1, Math.min(3, Math.round(v))); })}
        />
      </div>
      <div className="flex items-center justify-between">
        <label className="text-gray-400">Smooth</label>
        <input type="checkbox" checked={!!s.smooth} onChange={(e) => actions.updateModifierSettings(objectId, id, (st) => { st.smooth = e.target.checked; })} />
      </div>
      <div className="flex items-center justify-between">
        <label className="text-gray-400">Smooth Iterations</label>
        <DragInput
          compact
          min={0}
          max={5}
          step={1}
          value={Math.max(0, Math.min(5, Math.round(s.smoothIterations ?? 1)))}
          onChange={(v) => actions.updateModifierSettings(objectId, id, (st) => { st.smoothIterations = Math.max(0, Math.min(5, Math.round(v))); })}
        />
      </div>
      <div className="flex items-center justify-between">
        <label className="text-gray-400">Smooth Strength</label>
        <DragInput
          compact
          min={0}
          max={1}
          step={0.01}
          precision={2}
          value={Math.max(0, Math.min(1, s.smoothStrength ?? 0.2))}
          onChange={(v) => actions.updateModifierSettings(objectId, id, (st) => { st.smoothStrength = Math.max(0, Math.min(1, v)); })}
        />
      </div>
    </div>
  );
};

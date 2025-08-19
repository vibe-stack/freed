"use client";
import React from 'react';
import { DragInput } from '@/components/drag-input';
import { useModifiersStore, useObjectModifiers } from '@/stores/modifier-store';

export const ArraySettings: React.FC<{ objectId: string; id: string }> = ({ objectId, id }) => {
  const actions = useModifiersStore();
  const mods = useObjectModifiers(objectId);
  const mod = mods.find((m) => m.id === id);
  if (!mod) return null;
  const s = mod.settings as { count: number; offset: { x: number; y: number; z: number } };

  return (
    <div className="flex flex-col gap-2 text-xs">
      <div className="flex items-center justify-between">
        <label className="text-gray-400">Count</label>
        <DragInput compact min={2} max={200} step={1} value={Math.max(2, Math.round(s.count ?? 2))}
          onChange={(v) => actions.updateModifierSettings(objectId, id, (st) => { st.count = Math.max(2, Math.round(v)); })} />
      </div>
      {(['x','y','z'] as const).map((axis) => (
        <div key={axis} className="flex items-center justify-between">
          <label className="text-gray-400">Offset {axis.toUpperCase()}</label>
          <DragInput compact step={0.01} precision={2} value={(s.offset?.[axis] ?? 0)}
            onChange={(v) => actions.updateModifierSettings(objectId, id, (st) => { st.offset = { ...(st.offset ?? { x:0,y:0,z:0 }), [axis]: v }; })} />
        </div>
      ))}
    </div>
  );
};

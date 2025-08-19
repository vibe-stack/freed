"use client";
import React from 'react';
import { DragInput } from '@/components/drag-input';
import { useModifiersStore, useObjectModifiers } from '@/stores/modifier-store';

export const BevelSettings: React.FC<{ objectId: string; id: string }> = ({ objectId, id }) => {
  const actions = useModifiersStore();
  const mods = useObjectModifiers(objectId);
  const mod = mods.find((m) => m.id === id);
  if (!mod) return null;
  const s = mod.settings as { width: number; segments: number };
  return (
    <div className="flex flex-col gap-2 text-xs">
      <div className="flex items-center justify-between">
        <label className="text-gray-400">Width</label>
        <DragInput compact step={0.001} precision={3} value={s.width ?? 0.02}
          onChange={(v) => actions.updateModifierSettings(objectId, id, (st) => { st.width = v; })} />
      </div>
      <div className="flex items-center justify-between">
        <label className="text-gray-400">Segments</label>
        <DragInput compact min={1} max={5} step={1} value={Math.max(1, Math.min(5, Math.round(s.segments ?? 1)))}
          onChange={(v) => actions.updateModifierSettings(objectId, id, (st) => { st.segments = Math.max(1, Math.min(5, Math.round(v))); })} />
      </div>
    </div>
  );
};

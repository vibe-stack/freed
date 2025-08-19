"use client";
import React from 'react';
import { DragInput } from '@/components/drag-input';
import { useModifiersStore, useObjectModifiers } from '@/stores/modifier-store';

export const EdgeSplitSettings: React.FC<{ objectId: string; id: string }> = ({ objectId, id }) => {
  const actions = useModifiersStore();
  const mods = useObjectModifiers(objectId);
  const mod = mods.find((m) => m.id === id);
  if (!mod) return null;
  const s = mod.settings as { angle: number };
  return (
    <div className="flex items-center justify-between text-xs">
      <label className="text-gray-400">Angle</label>
      <DragInput compact min={0} max={180} step={1} value={Math.max(0, Math.min(180, Math.round(s.angle ?? 30)))}
        onChange={(v) => actions.updateModifierSettings(objectId, id, (st) => { st.angle = Math.max(0, Math.min(180, Math.round(v))); })} />
    </div>
  );
};

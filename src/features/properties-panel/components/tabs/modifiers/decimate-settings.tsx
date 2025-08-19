"use client";
import React from 'react';
import { DragInput } from '@/components/drag-input';
import { useModifiersStore, useObjectModifiers } from '@/stores/modifier-store';

export const DecimateSettings: React.FC<{ objectId: string; id: string }> = ({ objectId, id }) => {
  const actions = useModifiersStore();
  const mods = useObjectModifiers(objectId);
  const mod = mods.find((m) => m.id === id);
  if (!mod) return null;
  const s = mod.settings as { ratio: number };
  return (
    <div className="flex items-center justify-between text-xs">
      <label className="text-gray-400">Ratio</label>
      <DragInput compact min={0.01} max={1} step={0.01} precision={2} value={Math.max(0.01, Math.min(1, s.ratio ?? 0.5))}
        onChange={(v) => actions.updateModifierSettings(objectId, id, (st) => { st.ratio = Math.max(0.01, Math.min(1, v)); })} />
    </div>
  );
};

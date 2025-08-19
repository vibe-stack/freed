"use client";
import React from 'react';
import { DragInput } from '@/components/drag-input';
import { useModifiersStore, useObjectModifiers } from '@/stores/modifier-store';

export const WeldSettings: React.FC<{ objectId: string; id: string }> = ({ objectId, id }) => {
  const actions = useModifiersStore();
  const mods = useObjectModifiers(objectId);
  const mod = mods.find((m) => m.id === id);
  if (!mod) return null;
  const s = mod.settings as { distance: number };
  return (
    <div className="flex items-center justify-between text-xs">
      <label className="text-gray-400">Distance</label>
      <DragInput compact step={0.0001} precision={4} value={s.distance ?? 0.0001}
        onChange={(v) => actions.updateModifierSettings(objectId, id, (st) => { st.distance = Math.max(0, v); })} />
    </div>
  );
};

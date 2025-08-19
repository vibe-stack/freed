"use client";
import React from 'react';
import { DragInput } from '@/components/drag-input';
import { useModifiersStore, useObjectModifiers } from '@/stores/modifier-store';

export const SolidifySettings: React.FC<{ objectId: string; id: string }> = ({ objectId, id }) => {
  const actions = useModifiersStore();
  const mods = useObjectModifiers(objectId);
  const mod = mods.find((m) => m.id === id);
  if (!mod) return null;
  const s = mod.settings as { thickness: number };
  return (
    <div className="flex items-center justify-between text-xs">
      <label className="text-gray-400">Thickness</label>
      <DragInput compact step={0.001} precision={3} value={s.thickness ?? 0.02}
        onChange={(v) => actions.updateModifierSettings(objectId, id, (st) => { st.thickness = v; })} />
    </div>
  );
};

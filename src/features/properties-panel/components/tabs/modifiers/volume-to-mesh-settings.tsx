"use client";
import React from 'react';
import { DragInput } from '@/components/drag-input';
import { useModifiersStore, useObjectModifiers } from '@/stores/modifier-store';

export const VolumeToMeshSettings: React.FC<{ objectId: string; id: string }> = ({ objectId, id }) => {
  const actions = useModifiersStore();
  const mods = useObjectModifiers(objectId);
  const mod = mods.find((m) => m.id === id);
  if (!mod) return null;
  const s = mod.settings as { threshold: number };
  return (
    <div className="flex items-center justify-between text-xs">
      <label className="text-gray-400">Threshold</label>
      <DragInput compact min={0} max={1} step={0.01} precision={2} value={Math.max(0, Math.min(1, s.threshold ?? 0.5))}
        onChange={(v) => actions.updateModifierSettings(objectId, id, (st) => { st.threshold = Math.max(0, Math.min(1, v)); })} />
    </div>
  );
};

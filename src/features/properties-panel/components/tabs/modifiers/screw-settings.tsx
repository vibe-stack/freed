"use client";
import React from 'react';
import { DragInput } from '@/components/drag-input';
import { useModifiersStore, useObjectModifiers } from '@/stores/modifier-store';

export const ScrewSettings: React.FC<{ objectId: string; id: string }> = ({ objectId, id }) => {
  const actions = useModifiersStore();
  const mods = useObjectModifiers(objectId);
  const mod = mods.find((m) => m.id === id);
  if (!mod) return null;
  const s = mod.settings as { steps: number; angle: number; height: number };
  return (
    <div className="flex flex-col gap-2 text-xs">
      <div className="flex items-center justify-between">
        <label className="text-gray-400">Steps</label>
        <DragInput compact min={2} max={128} step={1} value={Math.max(2, Math.round(s.steps ?? 8))}
          onChange={(v) => actions.updateModifierSettings(objectId, id, (st) => { st.steps = Math.max(2, Math.round(v)); })} />
      </div>
      <div className="flex items-center justify-between">
        <label className="text-gray-400">Angle</label>
        <DragInput compact min={0} max={1440} step={1} value={Math.max(0, Math.round(s.angle ?? 360))}
          onChange={(v) => actions.updateModifierSettings(objectId, id, (st) => { st.angle = Math.max(0, Math.round(v)); })} />
      </div>
      <div className="flex items-center justify-between">
        <label className="text-gray-400">Height</label>
        <DragInput compact step={0.01} precision={2} value={s.height ?? 1}
          onChange={(v) => actions.updateModifierSettings(objectId, id, (st) => { st.height = v; })} />
      </div>
    </div>
  );
};

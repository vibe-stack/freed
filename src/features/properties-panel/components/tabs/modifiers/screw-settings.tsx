"use client";
import React from 'react';
import { DragInput } from '@/components/drag-input';
import { useModifiersStore, useObjectModifiers } from '@/stores/modifier-store';
import { useAnimationStore } from '@/stores/animation-store';
import { Diamond as DiamondIcon } from 'lucide-react';

export const ScrewSettings: React.FC<{ objectId: string; id: string }> = ({ objectId, id }) => {
  const clipId = useAnimationStore((st) => st.activeClipId);
  const actions = useModifiersStore();
  const mods = useObjectModifiers(objectId);
  const mod = mods.find((m) => m.id === id);
  if (!mod) return null;
  const s = mod.settings as { steps: number; angle: number; height: number };
  const KeyBtn: React.FC<{ path: string; value: number; title?: string }> = ({ path, value, title }) => {
    const property = `mod.${id}.${path}`;
    const has = useAnimationStore((st) => {
      const f = Math.round(st.playhead * (st.fps || 30));
      const T = f / (st.fps || 30);
      const tid = Object.values(st.tracks).find((tr) => tr.targetId === objectId && tr.property === property)?.id;
      if (!tid) return false;
      const tr = st.tracks[tid];
      return tr.channel.keys.some((k) => Math.abs(k.t - T) < 1e-6);
    });
    return (
      <button className="-ml-0.5 mr-1 p-0.5 rounded hover:bg-white/10" title={title || 'Toggle keyframe'} onClick={(e) => {
        e.stopPropagation();
        if (!clipId) return;
        const st = useAnimationStore.getState();
        const f = Math.round(st.playhead * (st.fps || 30));
        const T = f / (st.fps || 30);
        st.toggleKeyAt(objectId, property, T, value, 'linear');
      }}>
        <DiamondIcon className={`w-3 h-3 ${has ? 'text-amber-400' : 'text-gray-400/70 hover:text-white'}`} strokeWidth={2} />
      </button>
    );
  };
  return (
    <div className="flex flex-col gap-2 text-xs">
      <div className="flex items-center justify-between">
        <label className="text-gray-400">Steps</label>
        <div className="flex items-center">
          <KeyBtn path="steps" value={Math.max(2, Math.round(s.steps ?? 8))} title="Key Steps" />
          <DragInput compact min={2} max={128} step={1} value={Math.max(2, Math.round(s.steps ?? 8))}
            onChange={(v) => actions.updateModifierSettings(objectId, id, (st) => { st.steps = Math.max(2, Math.round(v)); })} />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <label className="text-gray-400">Angle</label>
        <div className="flex items-center">
          <KeyBtn path="angle" value={Math.max(0, Math.round(s.angle ?? 360))} title="Key Angle" />
          <DragInput compact min={0} max={1440} step={1} value={Math.max(0, Math.round(s.angle ?? 360))}
            onChange={(v) => actions.updateModifierSettings(objectId, id, (st) => { st.angle = Math.max(0, Math.round(v)); })} />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <label className="text-gray-400">Height</label>
        <div className="flex items-center">
          <KeyBtn path="height" value={s.height ?? 1} title="Key Height" />
          <DragInput compact step={0.01} precision={2} value={s.height ?? 1}
            onChange={(v) => actions.updateModifierSettings(objectId, id, (st) => { st.height = v; })} />
        </div>
      </div>
    </div>
  );
};

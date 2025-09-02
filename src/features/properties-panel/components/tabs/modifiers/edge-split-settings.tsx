"use client";
import React from 'react';
import { DragInput } from '@/components/drag-input';
import { useModifiersStore, useObjectModifiers } from '@/stores/modifier-store';
import { useAnimationStore } from '@/stores/animation-store';
import { Diamond as DiamondIcon } from 'lucide-react';

export const EdgeSplitSettings: React.FC<{ objectId: string; id: string }> = ({ objectId, id }) => {
  const actions = useModifiersStore();
  const mods = useObjectModifiers(objectId);
  const mod = mods.find((m) => m.id === id);
  if (!mod) return null;
  const s = mod.settings as { angle: number };
  const clipId = useAnimationStore((st) => st.activeClipId);
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
    <div className="flex items-center justify-between text-xs">
      <label className="text-gray-400">Angle</label>
      <div className="flex items-center">
        <KeyBtn path="angle" value={Math.max(0, Math.min(180, Math.round(s.angle ?? 30)))} title="Key Angle" />
        <DragInput compact min={0} max={180} step={1} value={Math.max(0, Math.min(180, Math.round(s.angle ?? 30)))}
          onChange={(v) => actions.updateModifierSettings(objectId, id, (st) => { st.angle = Math.max(0, Math.min(180, Math.round(v))); })} />
      </div>
    </div>
  );
};

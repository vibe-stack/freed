"use client";
import React from 'react';
import { DragInput } from '@/components/drag-input';
import { useModifiersStore, useObjectModifiers } from '@/stores/modifier-store';
import { useAnimationStore } from '@/stores/animation-store';
import { Diamond as DiamondIcon } from 'lucide-react';

export const SubdivideSettings: React.FC<{ objectId: string; id: string }> = ({ objectId, id }) => {
  const clipId = useAnimationStore((st) => st.activeClipId);
  const actions = useModifiersStore();
  const mods = useObjectModifiers(objectId);
  const mod = mods.find((m) => m.id === id);
  if (!mod) return null;
  const s = mod.settings as { level: number; smooth?: boolean; smoothIterations?: number; smoothStrength?: number };
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
        <label className="text-gray-400">Level</label>
        <div className="flex items-center">
          <KeyBtn path="level" value={Math.max(1, Math.min(3, Math.round(s.level ?? 1)))} title="Key Level" />
          <DragInput
            compact
            min={1}
            max={3}
            step={1}
            value={Math.max(1, Math.min(3, Math.round(s.level ?? 1)))}
            onChange={(v) => actions.updateModifierSettings(objectId, id, (st) => { st.level = Math.max(1, Math.min(3, Math.round(v))); })}
          />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <label className="text-gray-400">Smooth</label>
        <input type="checkbox" checked={!!s.smooth} onChange={(e) => actions.updateModifierSettings(objectId, id, (st) => { st.smooth = e.target.checked; })} />
      </div>
      <div className="flex items-center justify-between">
        <label className="text-gray-400">Smooth Iterations</label>
        <div className="flex items-center">
          <KeyBtn path="smoothIterations" value={Math.max(0, Math.min(5, Math.round(s.smoothIterations ?? 1)))} title="Key Iterations" />
          <DragInput
            compact
            min={0}
            max={5}
            step={1}
            value={Math.max(0, Math.min(5, Math.round(s.smoothIterations ?? 1)))}
            onChange={(v) => actions.updateModifierSettings(objectId, id, (st) => { st.smoothIterations = Math.max(0, Math.min(5, Math.round(v))); })}
          />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <label className="text-gray-400">Smooth Strength</label>
        <div className="flex items-center">
          <KeyBtn path="smoothStrength" value={Math.max(0, Math.min(1, s.smoothStrength ?? 0.2))} title="Key Strength" />
          <DragInput
            compact
            min={0}
            max={1}
            step={0.01}
            precision={2}
            value={Math.max(0, Math.min(1, s.smoothStrength ?? 0.2))}
            onChange={(v) => actions.updateModifierSettings(objectId, id, (st) => { st.smoothStrength = Math.max(0, Math.min(1, v)); })}
          />
        </div>
      </div>
    </div>
  );
};

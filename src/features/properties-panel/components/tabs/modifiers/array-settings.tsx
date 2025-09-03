"use client";
import React from 'react';
import { DragInput } from '@/components/drag-input';
import { useAnimationStore } from '@/stores/animation-store';
import { Diamond as DiamondIcon } from 'lucide-react';
import { useModifiersStore, useObjectModifiers } from '@/stores/modifier-store';

export const ArraySettings: React.FC<{ objectId: string; id: string }> = ({ objectId, id }) => {
  const actions = useModifiersStore();
  const clipId = useAnimationStore((st) => st.activeClipId);

  const mods = useObjectModifiers(objectId);
  const mod = mods.find((m) => m.id === id);
  if (!mod) return null;
  const s = mod.settings as { count: number; offset: { x: number; y: number; z: number } };

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
      <button
        className="-ml-0.5 mr-1 p-0.5 rounded hover:bg-white/10"
        title={title || 'Toggle keyframe'}
        onClick={(e) => {
          e.stopPropagation();
          if (!clipId) return;
          const st = useAnimationStore.getState();
          const f = Math.round(st.playhead * (st.fps || 30));
          const T = f / (st.fps || 30);
          st.toggleKeyAt(objectId, property, T, value, 'linear');
        }}
      >
        <DiamondIcon className={`w-3 h-3 ${has ? 'text-amber-400' : 'text-gray-400/70 hover:text-white'}`} strokeWidth={2} />
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-2 text-xs">
      <div className="flex items-center justify-between">
        <label className="text-gray-400">Count</label>
        <div className="flex items-center">
          <KeyBtn path="count" value={Math.max(2, Math.round(s.count ?? 2))} title="Key Count" />
          <DragInput compact min={2} max={200} step={1} value={Math.max(2, Math.round(s.count ?? 2))}
            onChange={(v) => actions.updateModifierSettings(objectId, id, (st) => { st.count = Math.max(2, Math.round(v)); })} />
        </div>
      </div>
      {(['x','y','z'] as const).map((axis) => (
        <div key={axis} className="flex items-center justify-between">
          <label className="text-gray-400">Offset {axis.toUpperCase()}</label>
          <div className="flex items-center">
            <KeyBtn path={`offset.${axis}`} value={(s.offset?.[axis] ?? 0)} title={`Key Offset ${axis.toUpperCase()}`} />
            <DragInput compact step={0.01} precision={2} value={(s.offset?.[axis] ?? 0)}
              onChange={(v) => actions.updateModifierSettings(objectId, id, (st) => { st.offset = { ...(st.offset ?? { x:0,y:0,z:0 }), [axis]: v }; })} />
          </div>
        </div>
      ))}
    </div>
  );
};

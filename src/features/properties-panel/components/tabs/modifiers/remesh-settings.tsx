"use client";
import React from 'react';
import { useModifiersStore, useObjectModifiers } from '@/stores/modifier-store';
import { DragInput } from '@/components/drag-input';
import { useAnimationStore } from '@/stores/animation-store';
import { Diamond as DiamondIcon } from 'lucide-react';

export const RemeshSettings: React.FC<{ objectId: string; id: string }> = ({ objectId, id }) => {
  const clipId = useAnimationStore((st) => st.activeClipId);
  const actions = useModifiersStore();
  const mods = useObjectModifiers(objectId);
  const mod = mods.find((m) => m.id === id);
  if (!mod) return null;
  const s = mod.settings as { mode: 'blocks' | 'quads' | 'smooth'; voxelSize: number };
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
        <label className="text-gray-400">Mode</label>
        <select
          className="bg-black/40 border border-white/10 rounded px-2 py-1 text-gray-200"
          value={s.mode}
          onChange={(e) => actions.updateModifierSettings(objectId, id, (st) => { st.mode = e.target.value; })}
        >
          <option value="blocks">Blocks</option>
          <option value="quads">Quads</option>
          <option value="smooth">Smooth</option>
        </select>
      </div>
      <div className="flex items-center justify-between">
        <label className="text-gray-400">Voxel Size</label>
        <div className="flex items-center">
          <KeyBtn path="voxelSize" value={s.voxelSize ?? 0.1} title="Key Voxel Size" />
          <DragInput compact step={0.01} precision={2} value={s.voxelSize ?? 0.1}
            onChange={(v) => actions.updateModifierSettings(objectId, id, (st) => { st.voxelSize = Math.max(0.001, v); })} />
        </div>
      </div>
    </div>
  );
};

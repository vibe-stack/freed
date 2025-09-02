"use client";
import React from 'react';
import { DragInput } from '@/components/drag-input';
import Switch from '@/components/switch';
import { useModifiersStore, useObjectModifiers } from '@/stores/modifier-store';
import { useAnimationStore } from '@/stores/animation-store';
import { Diamond as DiamondIcon } from 'lucide-react';

export const BevelSettings: React.FC<{ objectId: string; id: string }> = ({ objectId, id }) => {
  const actions = useModifiersStore();
  const mods = useObjectModifiers(objectId);
  const mod = mods.find((m) => m.id === id);
  if (!mod) return null;
  const s = mod.settings as { width: number; segments: number; miter?: 'sharp'|'chamfer'|'arc'; angleThreshold?: number; clampWidth?: boolean; cullDegenerate?: boolean };
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
    <div className="flex flex-col gap-2 text-xs">
      <div className="flex items-center justify-between">
        <label className="text-gray-400">Width</label>
        <div className="flex items-center">
          <KeyBtn path="width" value={s.width ?? 0.02} title="Key Width" />
          <DragInput compact step={0.001} precision={3} value={s.width ?? 0.02}
            onChange={(v) => actions.updateModifierSettings(objectId, id, (st) => { st.width = v; })} />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <label className="text-gray-400">Segments</label>
        <div className="flex items-center">
          <KeyBtn path="segments" value={Math.max(1, Math.min(5, Math.round(s.segments ?? 1)))} title="Key Segments" />
          <DragInput compact min={1} max={5} step={1} value={Math.max(1, Math.min(5, Math.round(s.segments ?? 1)))}
            onChange={(v) => actions.updateModifierSettings(objectId, id, (st) => { st.segments = Math.max(1, Math.min(5, Math.round(v))); })} />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <label className="text-gray-400">Miter</label>
        <select
          className="bg-black/40 border border-white/10 rounded px-2 py-1 text-gray-200"
          value={s.miter ?? 'chamfer'}
          onChange={(e) => actions.updateModifierSettings(objectId, id, (st) => { st.miter = e.target.value; })}
        >
          <option value="sharp">Sharp</option>
          <option value="chamfer">Chamfer</option>
          <option value="arc">Arc</option>
        </select>
      </div>
      <div className="flex items-center justify-between">
        <label className="text-gray-400">Angle</label>
        <div className="flex items-center">
          <KeyBtn path="angleThreshold" value={Math.max(0, Math.min(180, Math.round(s.angleThreshold ?? 30)))} title="Key Angle" />
          <DragInput compact min={0} max={180} step={1} value={Math.max(0, Math.min(180, Math.round(s.angleThreshold ?? 30)))}
            onChange={(v) => actions.updateModifierSettings(objectId, id, (st) => { st.angleThreshold = Math.max(0, Math.min(180, Math.round(v))); })} />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <label className="text-gray-400">Clamp Width</label>
        <Switch checked={!!s.clampWidth} onCheckedChange={(v) => actions.updateModifierSettings(objectId, id, (st) => { st.clampWidth = v; })} />
      </div>
      <div className="flex items-center justify-between">
        <label className="text-gray-400">Cull Degenerate</label>
        <Switch checked={s.cullDegenerate !== false} onCheckedChange={(v) => actions.updateModifierSettings(objectId, id, (st) => { st.cullDegenerate = v; })} />
      </div>
    </div>
  );
};

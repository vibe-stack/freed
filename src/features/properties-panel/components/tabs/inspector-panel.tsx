"use client";

import React, { useMemo } from 'react';
import { useSelectedObject, useSceneStore } from '@/stores/scene-store';
import { DragInput } from '@/components/drag-input';
import Switch from '@/components/switch';
import { LightSection } from './sections/light-section';
import { CameraSection } from './sections/camera-section';
import { ObjectDataSection } from './sections/object-data-section';
import { useAnimationStore, type PropertyPath } from '@/stores/animation-store';
import { Diamond as DiamondIcon } from 'lucide-react';

const Label: React.FC<{ label: string } & React.HTMLAttributes<HTMLDivElement>> = ({ label, children, className = '', ...rest }) => (
  <div className={`text-xs text-gray-400 ${className}`} {...rest}>
    <div className="uppercase tracking-wide mb-1">{label}</div>
    {children}
  </div>
);

const Row: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = '', children, ...rest }) => (
  <div className={`flex items-center gap-2 py-1 ${className}`} {...rest}>{children}</div>
);


export const InspectorPanel: React.FC = () => {
  const selected = useSelectedObject();
  const scene = useSceneStore();
  const playhead = useAnimationStore((s) => s.playhead);
  const fps = useAnimationStore((s) => s.fps);
  const activeClipId = useAnimationStore((s) => s.activeClipId);
  const ensureTrack = useAnimationStore((s) => s.ensureTrack);
  const toggleKeyAt = useAnimationStore((s) => s.toggleKeyAt);
  const hasKeyAtFn = useAnimationStore((s) => s.hasKeyAt);

  if (!selected) {
    return <div className="p-3 text-xs text-gray-500">No object selected.</div>;
  }

  const updateTransform = (partial: Partial<typeof selected.transform>) => {
    scene.setTransform(selected.id, partial);
  };

  const KeyButton: React.FC<{ property: PropertyPath; value: number; title?: string }>
    = ({ property, value, title }) => {
      // Read has-key reactively from the animation store so UI updates on timeline/keys changes
      const has = useAnimationStore((s) => {
        const f = Math.round(s.playhead * (s.fps || 24));
        const T = f / (s.fps || 24);
        const tid = Object.values(s.tracks).find((tr) => tr.targetId === selected.id && tr.property === property)?.id;
        if (!tid) return false;
        const tr = s.tracks[tid];
        return tr.channel.keys.some((k) => Math.abs(k.t - T) < 1e-6);
      });
      return (
        <button
          className={`-ml-0.5 mr-1 p-0.5 rounded hover:bg-white/10 transition-colors`}
          title={title || 'Toggle keyframe'}
          onClick={(e) => {
            e.stopPropagation();
            if (!activeClipId) return; // require a clip to key
            const s = useAnimationStore.getState();
            const f = Math.round(s.playhead * (s.fps || 24));
            const T = f / (s.fps || 24);
            s.toggleKeyAt(selected.id, property, T, value, 'linear');
          }}
        >
          <DiamondIcon className={`w-3 h-3 ${has ? 'text-amber-400' : 'text-gray-400/70 hover:text-white'}`} strokeWidth={2} />
        </button>
      );
    };

  return (
  <div className="p-3 space-y-4 text-gray-200 text-sm">
      <div>
        <div className="text-xs uppercase tracking-wide text-gray-400 mb-2">Object</div>
        <div className="bg-white/5 border border-white/10 rounded p-2">
          <Row>
            <div className="w-16 text-gray-400 text-xs">Name</div>
            <div className="flex-1 truncate">{selected.name}</div>
          </Row>
          <Row>
            <div className="w-16 text-gray-400 text-xs">Visible</div>
            <Switch checked={selected.visible} onCheckedChange={(v) => scene.setVisible(selected.id, v)} />
          </Row>
          <Row>
            <div className="w-16 text-gray-400 text-xs">Locked</div>
            <Switch checked={selected.locked} onCheckedChange={(v) => scene.setLocked(selected.id, v)} />
          </Row>
        </div>
      </div>

      <div>
        <div className="text-xs uppercase tracking-wide text-gray-400 mb-2">Transform</div>
        <div className="bg-white/5 border border-white/10 rounded p-2 space-y-2">
          <Label label="Location">
            <div className="grid grid-cols-3 gap-2">
              <div className="flex items-center">
                <KeyButton property="position.x" value={selected.transform.position.x} title="Key X location" />
                <DragInput compact label="X" value={selected.transform.position.x} precision={2} step={0.05} onChange={(v) => updateTransform({ position: { ...selected.transform.position, x: v } })} />
              </div>
              <div className="flex items-center">
                <KeyButton property="position.y" value={selected.transform.position.y} title="Key Y location" />
                <DragInput compact label="Y" value={selected.transform.position.y} precision={2} step={0.05} onChange={(v) => updateTransform({ position: { ...selected.transform.position, y: v } })} />
              </div>
              <div className="flex items-center">
                <KeyButton property="position.z" value={selected.transform.position.z} title="Key Z location" />
                <DragInput compact label="Z" value={selected.transform.position.z} precision={2} step={0.05} onChange={(v) => updateTransform({ position: { ...selected.transform.position, z: v } })} />
              </div>
            </div>
          </Label>
          <Label label="Rotation">
            <div className="grid grid-cols-3 gap-2">
              <div className="flex items-center">
                <KeyButton property="rotation.x" value={selected.transform.rotation.x} title="Key X rotation" />
                <DragInput compact label="X" value={selected.transform.rotation.x} precision={2} step={1} onChange={(v) => updateTransform({ rotation: { ...selected.transform.rotation, x: v } })} />
              </div>
              <div className="flex items-center">
                <KeyButton property="rotation.y" value={selected.transform.rotation.y} title="Key Y rotation" />
                <DragInput compact label="Y" value={selected.transform.rotation.y} precision={2} step={1} onChange={(v) => updateTransform({ rotation: { ...selected.transform.rotation, y: v } })} />
              </div>
              <div className="flex items-center">
                <KeyButton property="rotation.z" value={selected.transform.rotation.z} title="Key Z rotation" />
                <DragInput compact label="Z" value={selected.transform.rotation.z} precision={2} step={1} onChange={(v) => updateTransform({ rotation: { ...selected.transform.rotation, z: v } })} />
              </div>
            </div>
          </Label>
          <Label label="Scale">
            <div className="grid grid-cols-3 gap-2">
              <div className="flex items-center">
                <KeyButton property="scale.x" value={selected.transform.scale.x} title="Key X scale" />
                <DragInput compact label="X" value={selected.transform.scale.x} precision={2} step={0.05} onChange={(v) => updateTransform({ scale: { ...selected.transform.scale, x: v } })} />
              </div>
              <div className="flex items-center">
                <KeyButton property="scale.y" value={selected.transform.scale.y} title="Key Y scale" />
                <DragInput compact label="Y" value={selected.transform.scale.y} precision={2} step={0.05} onChange={(v) => updateTransform({ scale: { ...selected.transform.scale, y: v } })} />
              </div>
              <div className="flex items-center">
                <KeyButton property="scale.z" value={selected.transform.scale.z} title="Key Z scale" />
                <DragInput compact label="Z" value={selected.transform.scale.z} precision={2} step={0.05} onChange={(v) => updateTransform({ scale: { ...selected.transform.scale, z: v } })} />
              </div>
            </div>
          </Label>
        </div>
      </div>

      {selected.type === 'mesh' && (
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-400 mb-2">Object Data</div>
          <ObjectDataSection objectId={selected.id} />
        </div>
      )}

      {selected.type === 'light' && selected.lightId && (
        <div>
          <LightSection lightId={selected.lightId} />
        </div>
      )}

      {selected.type === 'camera' && selected.cameraId && (
        <div>
          <CameraSection cameraId={selected.cameraId} />
        </div>
      )}
    </div>
  );
};

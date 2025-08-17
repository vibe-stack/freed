"use client";

import React from 'react';
import { useSelectedObject, useSceneStore } from '@/stores/scene-store';
import { DragInput } from '@/components/drag-input';
import Switch from '@/components/switch';
import { LightSection } from './sections/light-section';
import { CameraSection } from './sections/camera-section';
import { ObjectDataSection } from './sections/object-data-section';

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

  if (!selected) {
    return <div className="p-3 text-xs text-gray-500">No object selected.</div>;
  }

  const updateTransform = (partial: Partial<typeof selected.transform>) => {
    scene.setTransform(selected.id, partial);
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
        <DragInput compact label="X" value={selected.transform.position.x} precision={2} step={0.05} onChange={(v) => updateTransform({ position: { ...selected.transform.position, x: v } })} />
        <DragInput compact label="Y" value={selected.transform.position.y} precision={2} step={0.05} onChange={(v) => updateTransform({ position: { ...selected.transform.position, y: v } })} />
        <DragInput compact label="Z" value={selected.transform.position.z} precision={2} step={0.05} onChange={(v) => updateTransform({ position: { ...selected.transform.position, z: v } })} />
            </div>
          </Label>
          <Label label="Rotation">
            <div className="grid grid-cols-3 gap-2">
        <DragInput compact label="X" value={selected.transform.rotation.x} precision={2} step={1} onChange={(v) => updateTransform({ rotation: { ...selected.transform.rotation, x: v } })} />
        <DragInput compact label="Y" value={selected.transform.rotation.y} precision={2} step={1} onChange={(v) => updateTransform({ rotation: { ...selected.transform.rotation, y: v } })} />
        <DragInput compact label="Z" value={selected.transform.rotation.z} precision={2} step={1} onChange={(v) => updateTransform({ rotation: { ...selected.transform.rotation, z: v } })} />
            </div>
          </Label>
          <Label label="Scale">
            <div className="grid grid-cols-3 gap-2">
        <DragInput compact label="X" value={selected.transform.scale.x} precision={2} step={0.05} onChange={(v) => updateTransform({ scale: { ...selected.transform.scale, x: v } })} />
        <DragInput compact label="Y" value={selected.transform.scale.y} precision={2} step={0.05} onChange={(v) => updateTransform({ scale: { ...selected.transform.scale, y: v } })} />
        <DragInput compact label="Z" value={selected.transform.scale.z} precision={2} step={0.05} onChange={(v) => updateTransform({ scale: { ...selected.transform.scale, z: v } })} />
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

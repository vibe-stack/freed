"use client";

import React from 'react';
import { useSceneStore } from '@/stores/scene-store';
import { DragInput } from '@/components/drag-input';

type Props = { cameraId: string };

export const CameraSection: React.FC<Props> = ({ cameraId }) => {
  const scene = useSceneStore();
  const cam = scene.cameras[cameraId];
  if (!cam) return null;

  const set = (update: Partial<typeof cam>) => {
    useSceneStore.setState((s) => {
      Object.assign(s.cameras[cameraId], update);
    });
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded p-2 space-y-2">
      <div className="text-xs uppercase tracking-wide text-gray-400">Camera</div>
      <div className="text-xs text-gray-400">Type: <span className="text-gray-200">{cam.type}</span></div>

      {cam.type === 'perspective' ? (
        <div>
          <div className="text-gray-400 mb-1 text-xs">FOV</div>
          <DragInput value={cam.fov ?? 50} step={0.5} precision={2} onChange={(v) => set({ fov: Math.max(1, Math.min(179, v)) })} />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-gray-400 mb-1 text-xs">Left</div>
            <DragInput value={cam.left ?? -1} step={0.1} precision={2} onChange={(v) => set({ left: v })} />
          </div>
          <div>
            <div className="text-gray-400 mb-1 text-xs">Right</div>
            <DragInput value={cam.right ?? 1} step={0.1} precision={2} onChange={(v) => set({ right: v })} />
          </div>
          <div>
            <div className="text-gray-400 mb-1 text-xs">Top</div>
            <DragInput value={cam.top ?? 1} step={0.1} precision={2} onChange={(v) => set({ top: v })} />
          </div>
          <div>
            <div className="text-gray-400 mb-1 text-xs">Bottom</div>
            <DragInput value={cam.bottom ?? -1} step={0.1} precision={2} onChange={(v) => set({ bottom: v })} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="text-gray-400 mb-1 text-xs">Near</div>
          <DragInput value={cam.near} step={0.01} precision={3} onChange={(v) => set({ near: Math.max(0.001, v) })} />
        </div>
        <div>
          <div className="text-gray-400 mb-1 text-xs">Far</div>
          <DragInput value={cam.far} step={1} precision={0} onChange={(v) => set({ far: Math.max(cam.near + 0.001, v) })} />
        </div>
      </div>
    </div>
  );
};

export default CameraSection;

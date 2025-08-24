"use client";

import React from 'react';
import { useGeometryStore } from '@/stores/geometry-store';
import { DragInput } from '@/components/drag-input';

type Props = { cameraId: string };

export const CameraSection: React.FC<Props> = ({ cameraId }) => {
  const geo = useGeometryStore();
  const cam = geo.cameras[cameraId];
  if (!cam) return null;

  const set = (update: Partial<typeof cam>) => {
    useGeometryStore.setState((s) => {
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
          <div className="text-gray-400 mb-1 text-xs mt-2">Focus</div>
          <DragInput value={cam.focus ?? 10} step={0.1} precision={2} onChange={(v) => set({ focus: Math.max(0, v) })} />
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div>
              <div className="text-gray-400 mb-1 text-xs">Film Gauge</div>
              <DragInput value={cam.filmGauge ?? 35} step={0.5} precision={1} onChange={(v) => set({ filmGauge: Math.max(1, v) })} />
            </div>
            <div>
              <div className="text-gray-400 mb-1 text-xs">Film Offset</div>
              <DragInput value={cam.filmOffset ?? 0} step={0.1} precision={2} onChange={(v) => set({ filmOffset: v })} />
            </div>
          </div>
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

      <div>
        <div className="text-gray-400 mb-1 text-xs">Zoom</div>
        <DragInput value={cam.zoom ?? 1} step={0.05} precision={2} onChange={(v) => set({ zoom: Math.max(0.01, v) })} />
      </div>
    </div>
  );
};

export default CameraSection;

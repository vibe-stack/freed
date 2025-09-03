"use client";

import React from 'react';
import { useSceneStore } from '@/stores/scene-store';
import type { LightType } from '@/types/geometry';
import { DragInput } from '@/components/drag-input';
import { ColorInput } from '@/components/color-input';

type Props = { lightId: string };

export const LightSection: React.FC<Props> = ({ lightId }) => {
  const scene = useSceneStore();
  const light = scene.lights[lightId];
  if (!light) return null;

  const set = (update: Partial<typeof light>) => {
    // Mutate directly within zustand store
    useSceneStore.setState((s) => {
      Object.assign(s.lights[lightId], update);
    });
  };

  const changeType = (t: LightType) => {
    // Ensure sensible defaults when changing type
    const defaults: Partial<typeof light> = { type: t } as any;
    if (t === 'spot') Object.assign(defaults, { angle: Math.PI / 6, penumbra: 0.2, distance: 0, decay: 2 });
    if (t === 'point') Object.assign(defaults, { distance: 0, decay: 2 });
    if (t === 'ambient') Object.assign(defaults, { intensity: 0.8 });
    useSceneStore.setState((s) => { Object.assign(s.lights[lightId], defaults); });
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded p-2 space-y-2">
      <div className="text-xs uppercase tracking-wide text-gray-400">Light</div>
      <div className="text-xs text-gray-400">Type:
        <select
          className="ml-2 bg-transparent text-xs border border-white/10 rounded p-1"
          value={light.type}
          onChange={(e) => changeType(e.target.value as LightType)}
        >
          <option value="directional">Directional</option>
          <option value="spot">Spot</option>
          <option value="point">Point</option>
          <option value="ambient">Ambient</option>
        </select>
      </div>
  <ColorInput label="Color" value={light.color} onChange={(v) => set({ color: v })} />
      <div>
        <div className="text-gray-400 mb-1 text-xs">Intensity</div>
        <DragInput value={light.intensity} step={0.1} precision={2} onChange={(v) => set({ intensity: Math.max(0, v) })} />
      </div>

      {(light.type === 'spot' || light.type === 'point') && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-gray-400 mb-1 text-xs">Distance</div>
            <DragInput value={light.distance ?? 0} step={0.1} precision={2} onChange={(v) => set({ distance: Math.max(0, v) })} />
          </div>
          <div>
            <div className="text-gray-400 mb-1 text-xs">Decay</div>
            <DragInput value={light.decay ?? 2} step={0.1} precision={2} onChange={(v) => set({ decay: Math.max(0, v) })} />
          </div>
        </div>
      )}

      {light.type === 'spot' && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-gray-400 mb-1 text-xs">Angle</div>
            <DragInput value={light.angle ?? Math.PI/6} step={0.01} precision={2} onChange={(v) => set({ angle: Math.max(0, Math.min(Math.PI/2, v)) })} />
          </div>
          <div>
            <div className="text-gray-400 mb-1 text-xs">Penumbra</div>
            <DragInput value={light.penumbra ?? 0} step={0.01} precision={2} onChange={(v) => set({ penumbra: Math.max(0, Math.min(1, v)) })} />
          </div>
        </div>
      )}

  {/* RectAreaLight controls removed for WebGPU compatibility */}
    </div>
  );
};

export default LightSection;

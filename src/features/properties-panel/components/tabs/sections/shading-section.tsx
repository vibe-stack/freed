"use client";

import React from 'react';
import { useGeometryStore } from '@/stores/geometry-store';
import Switch from '@/components/switch';
import { useGeometryStore as useGeo } from '@/stores/geometry-store';

type Props = { meshId: string };

export const ShadingSection: React.FC<Props> = ({ meshId }) => {
  const geo = useGeometryStore();
  const geoStore = useGeo();
  const mesh = geo.meshes.get(meshId);
  if (!mesh) return null;

  const update = (fn: (m: NonNullable<typeof mesh>) => void) => geo.updateMesh(meshId, (m) => fn(m as NonNullable<typeof mesh>));

  return (
    <div className="bg-white/5 border border-white/10 rounded p-2 space-y-2">
      <div className="text-xs uppercase tracking-wide text-gray-400">Shading</div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-400">Cast Shadows</span>
        <Switch checked={!!mesh.castShadow} onCheckedChange={(v) => update((m) => { m.castShadow = v; })} />
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-400">Receive Shadows</span>
        <Switch checked={!!mesh.receiveShadow} onCheckedChange={(v) => update((m) => { m.receiveShadow = v; })} />
      </div>
      <div className="text-xs text-gray-400">
        <div className="mb-1">Mode</div>
        <div className="flex gap-2">
          <label className="flex items-center gap-1">
            <input
              type="radio"
              name={`shading-${meshId}`}
              className="accent-white/70"
              checked={(mesh.shading ?? 'flat') === 'flat'}
              onChange={() => update((m) => { m.shading = 'flat'; })}
            />
            Flat
          </label>
          <label className="flex items-center gap-1">
            <input
              type="radio"
              name={`shading-${meshId}`}
              className="accent-white/70"
              checked={(mesh.shading ?? 'flat') === 'smooth'}
              onChange={() => update((m) => { m.shading = 'smooth'; geoStore.recalculateNormals(meshId); })}
            />
            Smooth
          </label>
        </div>
      </div>
    </div>
  );
};

export default ShadingSection;

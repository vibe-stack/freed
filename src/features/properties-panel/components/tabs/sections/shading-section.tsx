"use client";

import React from 'react';
import { useGeometryStore } from '@/stores/geometry-store';
import Switch from '@/components/switch';
import clsx from 'clsx';

type Props = { meshId: string };

export const ShadingSection: React.FC<Props> = ({ meshId }) => {
  const geo = useGeometryStore();
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
        <div className="inline-flex rounded-md overflow-hidden border border-white/10 bg-white/5">
          <button
            type="button"
            className={clsx(
              'px-2 py-1 text-[11px] transition-colors',
              (mesh.shading ?? 'flat') === 'flat'
                ? 'bg-white/15 text-gray-100'
                : 'text-gray-400 hover:bg-white/10'
            )}
            onClick={() => update((m) => { m.shading = 'flat'; })}
            aria-pressed={(mesh.shading ?? 'flat') === 'flat'}
          >
            Flat
          </button>
          <button
            type="button"
            className={clsx(
              'px-2 py-1 text-[11px] transition-colors',
              (mesh.shading ?? 'flat') === 'smooth'
                ? 'bg-white/15 text-gray-100'
                : 'text-gray-400 hover:bg-white/10'
            )}
            onClick={() => { update((m) => { m.shading = 'smooth'; }); geo.recalculateNormals(meshId); }}
            aria-pressed={(mesh.shading ?? 'flat') === 'smooth'}
          >
            Smooth
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShadingSection;

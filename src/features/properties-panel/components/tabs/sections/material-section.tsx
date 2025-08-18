"use client";

import React from 'react';
import { useGeometryStore } from '@/stores/geometry-store';
import type { Material as MatType } from '@/types/geometry';
import { DragInput } from '@/components/drag-input';
import { ColorInput } from '@/components/color-input';

type Props = { materialId?: string; onAssignMaterial?: (id: string | undefined) => void };

export const MaterialSection: React.FC<Props> = ({ materialId, onAssignMaterial }) => {
  const geo = useGeometryStore();
  const material = materialId ? geo.materials.get(materialId) : undefined;
  const materials = Array.from(geo.materials.values());

  const update = (updater: (m: MatType) => void) => {
    if (!material) return;
    geo.updateMaterial(material.id, updater);
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded p-2 space-y-2">
      <div className="text-xs uppercase tracking-wide text-gray-400 mb-1">Material</div>
      <div className="flex items-center gap-2">
        <select
          className="bg-black/30 border border-white/10 rounded px-2 py-1 text-xs flex-1"
          value={materialId ?? ''}
          onChange={(e) => onAssignMaterial?.(e.target.value || undefined)}
        >
          <option value="">None</option>
          {materials.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
        {/* Minimal add material: create a default PBR material */}
    <button
          className="px-2 py-1 text-xs bg-white/10 hover:bg-white/20 rounded border border-white/10"
          onClick={() => {
            const id = crypto.randomUUID();
      geo.addMaterial({ id, name: `Mat ${materials.length + 1}` , color: { x: 0.8, y: 0.8, z: 0.85 }, roughness: 0.8, metalness: 0.05, emissive: { x:0, y:0, z:0 }, emissiveIntensity: 1 });
            onAssignMaterial?.(id);
          }}
        >
          + New
        </button>
      </div>
      {material && (
        <div className="space-y-2 text-xs text-gray-300">
          <div>
            <div className="text-gray-400 mb-1">Name</div>
            <input
              className="w-full bg-black/30 border border-white/10 rounded px-2 py-1"
              value={material.name}
              onChange={(e) => update((m) => { m.name = e.target.value; })}
            />
          </div>
          <ColorInput label="Color" value={material.color} onChange={(v) => update((m) => { m.color = v; })} />
          <ColorInput label="Emissive" value={material.emissive} onChange={(v) => update((m) => { m.emissive = v; })} />
          <div>
            <div className="text-gray-400 mb-1">Emissive Intensity</div>
            <DragInput value={material.emissiveIntensity ?? 1} step={0.05} precision={2} onChange={(v) => update((m) => { m.emissiveIntensity = Math.max(0, v); })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-gray-400 mb-1">Roughness</div>
              <DragInput value={material.roughness} step={0.01} precision={2} onChange={(v) => update((m) => { m.roughness = Math.max(0, Math.min(1, v)); })} />
            </div>
            <div>
              <div className="text-gray-400 mb-1">Metalness</div>
              <DragInput value={material.metalness} step={0.01} precision={2} onChange={(v) => update((m) => { m.metalness = Math.max(0, Math.min(1, v)); })} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MaterialSection;

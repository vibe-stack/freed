"use client";

import React from 'react';
import { useSceneStore } from '@/stores/scene-store';
import { useGeometryStore } from '@/stores/geometry-store';
import { MaterialSection } from './material-section';
import { ShadingSection } from './shading-section';
import { useTerrainStore } from '@/stores/terrain-store';
import { useTerrainEditorStore } from '@/stores/terrain-editor-store';
import { DragInput } from '@/components/drag-input';

type Props = { objectId: string };

export const ObjectDataSection: React.FC<Props> = ({ objectId }) => {
  const scene = useSceneStore();
  const geo = useGeometryStore();
  const tStore = useTerrainStore();
  const te = useTerrainEditorStore();
  
  const obj = scene.objects[objectId];
  if (!obj) return null;

  if (obj.type !== 'mesh' || !obj.meshId) {
    return <div className="bg-white/5 border border-white/10 rounded p-2 text-xs text-gray-400">No object data for this type.</div>;
  }

  const mesh = geo.meshes.get(obj.meshId);
  const assignMaterial = (id: string | undefined) => {
    if (!mesh) return;
    geo.updateMesh(mesh.id, (m) => { m.materialId = id; });
  };

  // Determine if this mesh belongs to a terrain resource
  const terrainEntry = Object.values(tStore.terrains).find((t) => t.meshId === obj.meshId);

  return (
    <div className="space-y-2">
      {terrainEntry && (
        <div className="bg-white/5 border border-white/10 rounded p-2 space-y-2">
          <div className="text-[11px] uppercase tracking-wide text-gray-400 mb-1">Terrain</div>
          <div className="grid grid-cols-3 gap-2 mb-2">
            <div>
              <div className="text-xs text-gray-400">Width (X)</div>
              <DragInput compact value={terrainEntry.width} step={0.1} precision={2} onChange={(v) => tStore.updateTerrain(terrainEntry.id, (t) => { t.width = Math.max(0.1, v); })} />
            </div>
            <div>
              <div className="text-xs text-gray-400">Depth (Z)</div>
              <DragInput compact value={terrainEntry.height} step={0.1} precision={2} onChange={(v) => tStore.updateTerrain(terrainEntry.id, (t) => { t.height = Math.max(0.1, v); })} />
            </div>
            <div>
              <div className="text-xs text-gray-400">Height Scale</div>
              <DragInput compact value={terrainEntry.heightScale || 3.0} step={0.1} precision={2} onChange={(v) => tStore.updateTerrain(terrainEntry.id, (t) => { t.heightScale = Math.max(0.0, v); })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-xs text-gray-400">Vertex Res X</div>
              <DragInput compact value={terrainEntry.vertexResolution.x} step={1} precision={0} onChange={(v) => tStore.updateTerrain(terrainEntry.id, (t) => { t.vertexResolution.x = Math.max(2, Math.round(v)); })} />
            </div>
            <div>
              <div className="text-xs text-gray-400">Vertex Res Y</div>
              <DragInput compact value={terrainEntry.vertexResolution.y} step={1} precision={0} onChange={(v) => tStore.updateTerrain(terrainEntry.id, (t) => { t.vertexResolution.y = Math.max(2, Math.round(v)); })} />
            </div>
            <div>
              <div className="text-xs text-gray-400">Texture W</div>
              <DragInput compact value={terrainEntry.textureResolution.width} step={16} precision={0} onChange={(v) => tStore.updateTerrain(terrainEntry.id, (t) => { t.textureResolution.width = Math.max(16, Math.round(v)); })} />
            </div>
            <div>
              <div className="text-xs text-gray-400">Texture H</div>
              <DragInput compact value={terrainEntry.textureResolution.height} step={16} precision={0} onChange={(v) => tStore.updateTerrain(terrainEntry.id, (t) => { t.textureResolution.height = Math.max(16, Math.round(v)); })} />
            </div>
          </div>
          <div className="flex gap-2">
            <button className="px-2 py-1 rounded border border-white/10 hover:bg-white/10" onClick={() => te.openFor(terrainEntry.id)}>Open Terrain Editor</button>
            <button className="px-2 py-1 rounded border border-white/10 hover:bg-white/10" onClick={() => tStore.regenerate(terrainEntry.id)}>Regenerate</button>
          </div>
        </div>
      )}

      <MaterialSection materialId={mesh?.materialId} onAssignMaterial={assignMaterial} />
      {mesh && <ShadingSection meshId={mesh.id} />}
    </div>
  );
};

export default ObjectDataSection;

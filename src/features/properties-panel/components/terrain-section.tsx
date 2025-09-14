import React from 'react';
import { DragInput } from '@/components/drag-input';
import { useTerrainStore, useTerrain } from '@/stores/terrain-store';
import { useTerrainEditorStore } from '@/stores/terrain-editor-store';

// Local Label component
const Label: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="text-[11px] text-gray-400">
    <div className="uppercase tracking-wide mb-1">{label}</div>
    {children}
  </div>
);

type Props = {
  terrainId: string;
  objectId: string;
};

export const TerrainSection: React.FC<Props> = ({ terrainId, objectId }) => {
  const terrain = useTerrain(terrainId);
  const updateTerrain = useTerrainStore((s) => s.updateTerrain);
  const openEditor = useTerrainEditorStore((s) => s.openFor);

  if (!terrain) return null;

  return (
    <div className="space-y-2">
      <Label label="Dimensions">
        <div className="grid grid-cols-2 gap-2">
          <DragInput 
            compact 
            label="Width" 
            value={terrain.width} 
            precision={2} 
            step={0.1} 
            onChange={(w) => updateTerrain(terrainId, (t) => { t.width = Math.max(0.1, w); })} 
          />
          <DragInput 
            compact 
            label="Height" 
            value={terrain.height} 
            precision={2} 
            step={0.1} 
            onChange={(h) => updateTerrain(terrainId, (t) => { t.height = Math.max(0.1, h); })} 
          />
        </div>
      </Label>

      <Label label="Vertex Resolution">
        <DragInput 
          compact 
          value={terrain.vertexResolution.x} 
          precision={0} 
          step={1} 
          onChange={(res) => updateTerrain(terrainId, (t) => { 
            const r = Math.max(2, Math.round(res));
            t.vertexResolution.x = r; 
            t.vertexResolution.y = r;
          })} 
        />
      </Label>

      <Label label="Texture Resolution">
        <DragInput 
          compact 
          value={terrain.textureResolution.width} 
          precision={0} 
          step={16} 
          onChange={(res) => updateTerrain(terrainId, (t) => { 
            const r = Math.max(16, Math.round(res));
            t.textureResolution.width = r; 
            t.textureResolution.height = r;
          })} 
        />
      </Label>

      <Label label="Height Scale">
        <DragInput 
          compact 
          value={terrain.heightScale ?? 3.0} 
          precision={2} 
          step={0.1} 
          onChange={(s) => updateTerrain(terrainId, (t) => { t.heightScale = Math.max(0.1, s); })} 
        />
      </Label>

      <Label label="Surface Detail">
        <div className="space-y-2">
          <div className="text-[10px] text-gray-400 mb-1">Crack Features</div>
          <div className="grid grid-cols-2 gap-2">
            <DragInput 
              compact 
              label="Density" 
              value={terrain.surfaceDetail?.crackDensity ?? 0.35} 
              precision={3} 
              step={0.02} 
              onChange={(v) => updateTerrain(terrainId, (t) => { 
                t.surfaceDetail = { ...t.surfaceDetail, crackDensity: Math.max(0, Math.min(1, v)) }; 
              })} 
            />
            <DragInput 
              compact 
              label="Depth" 
              value={terrain.surfaceDetail?.crackDepth ?? 0.4} 
              precision={3} 
              step={0.02} 
              onChange={(v) => updateTerrain(terrainId, (t) => { 
                t.surfaceDetail = { ...t.surfaceDetail, crackDepth: Math.max(0, Math.min(1, v)) }; 
              })} 
            />
          </div>
          
          <div className="text-[10px] text-gray-400 mb-1 mt-2">Rock Strata</div>
          <div className="grid grid-cols-2 gap-2">
            <DragInput 
              compact 
              label="Density" 
              value={terrain.surfaceDetail?.strataDensity ?? 0.45} 
              precision={3} 
              step={0.02} 
              onChange={(v) => updateTerrain(terrainId, (t) => { 
                t.surfaceDetail = { ...t.surfaceDetail, strataDensity: Math.max(0, Math.min(1, v)) }; 
              })} 
            />
            <DragInput 
              compact 
              label="Depth" 
              value={terrain.surfaceDetail?.strataDepth ?? 0.6} 
              precision={3} 
              step={0.02} 
              onChange={(v) => updateTerrain(terrainId, (t) => { 
                t.surfaceDetail = { ...t.surfaceDetail, strataDepth: Math.max(0, Math.min(1, v)) }; 
              })} 
            />
          </div>
          
          <DragInput 
            compact 
            label="Surface Roughness" 
            value={terrain.surfaceDetail?.roughness ?? 0.30} 
            precision={3} 
            step={0.02} 
            onChange={(v) => updateTerrain(terrainId, (t) => { 
              t.surfaceDetail = { ...t.surfaceDetail, roughness: Math.max(0, Math.min(1, v)) }; 
            })} 
          />
        </div>
      </Label>

      <div className="pt-2 space-y-1">
        <button
          className="w-full px-2 py-1 rounded border border-white/10 hover:bg-white/10 text-xs"
          onClick={() => openEditor(terrainId)}
        >
          Open Terrain Editor
        </button>
        <button
          className="w-full px-2 py-1 rounded border border-amber-500/30 hover:bg-amber-500/10 text-xs text-amber-300"
          onClick={() => {
            // Force regeneration by updating a dummy parameter
            updateTerrain(terrainId, (t) => { 
              t.surfaceDetail = { ...t.surfaceDetail, seed: (t.surfaceDetail?.seed ?? 42) + 1 }; 
            });
          }}
        >
          Force Regenerate Terrain
        </button>
      </div>
    </div>
  );
};
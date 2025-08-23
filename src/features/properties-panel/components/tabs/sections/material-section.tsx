"use client";

import React, { useMemo } from 'react';
import { useGeometryStore } from '@/stores/geometry-store';
import type { Material as MatType } from '@/types/geometry';
import { DragInput } from '@/components/drag-input';
import { ColorInput } from '@/components/color-input';
import { useShaderEditorStore } from '@/stores/shader-editor-store';
import type { ShaderGraph } from '@/types/shader';
import { Plus, Beaker, Box, Diamond } from 'lucide-react';

type Props = { materialId?: string; onAssignMaterial?: (id: string | undefined) => void };

export const MaterialSection: React.FC<Props> = ({ materialId, onAssignMaterial }) => {
  const geo = useGeometryStore();
  const openShaderEditor = useShaderEditorStore((s) => s.openFor);
  const seOpen = useShaderEditorStore((s) => s.open);
  const setSeOpen = useShaderEditorStore((s) => s.setOpen);
  const material = materialId ? geo.materials.get(materialId) : undefined;
  const materials = Array.from(geo.materials.values());
  const shaderGraph = materialId ? geo.shaderGraphs.get(materialId) : undefined;

  // Infer current material type from graph output node
  const materialType = useMemo<'standard' | 'physical' | 'phong' | 'toon'>(() => {
    if (!shaderGraph) return 'standard';
    const hasPhysical = shaderGraph.nodes.some((n: any) => n.type === 'output-physical');
    if (hasPhysical) return 'physical';
    const hasPhong = shaderGraph.nodes.some((n: any) => n.type === 'output-phong');
    if (hasPhong) return 'phong';
    const hasToon = shaderGraph.nodes.some((n: any) => n.type === 'output-toon');
    if (hasToon) return 'toon';
    return 'standard';
  }, [shaderGraph?.nodes]);

  const update = (updater: (m: MatType) => void) => {
    if (!material) return;
    geo.updateMaterial(material.id, updater);
  };

  // Helper: if shader graph connects an output to a const node, update that const node instead of raw material
  const updateGraphIfSimple = (field: 'color' | 'roughness' | 'metalness' | 'emissive' | 'emissiveIntensity', value: any) => {
    if (!materialId) return false;
    const g = geo.shaderGraphs.get(materialId);
    if (!g) return false;
    const out = g.nodes.find((n: any) => n.type === 'output' || n.type === 'output-standard' || n.type === 'output-physical');
    if (!out) return false;
    const edge = g.edges.find((e) => e.target === out.id && e.targetHandle === field);
    if (!edge) return false; // nothing wired; leave material prop as source of truth
    const node = g.nodes.find((n) => n.id === edge.source);
    if (!node) return false;
    if (field === 'color' && node.type === 'const-color') {
      geo.updateShaderGraph(materialId, (gg: ShaderGraph) => {
        const nn: any = gg.nodes.find((n) => n.id === node.id);
        if (nn) nn.data = { r: value.x, g: value.y, b: value.z };
      });
      return true;
    }
    if ((field === 'roughness' || field === 'metalness' || field === 'emissiveIntensity') && node.type === 'const-float') {
      geo.updateShaderGraph(materialId, (gg: ShaderGraph) => {
        const nn: any = gg.nodes.find((n) => n.id === node.id);
        if (nn) nn.data = { value };
      });
      return true;
    }
    if (field === 'emissive' && node.type === 'const-color') {
      geo.updateShaderGraph(materialId, (gg: ShaderGraph) => {
        const nn: any = gg.nodes.find((n) => n.id === node.id);
        if (nn) nn.data = { r: value.x, g: value.y, b: value.z };
      });
      return true;
    }
    return false;
  };

  // Change output material type node in the graph
  const setMaterialType = (next: 'standard' | 'physical' | 'phong' | 'toon') => {
    if (!materialId) return;
    geo.ensureDefaultGraph(materialId);
    geo.updateShaderGraph(materialId, (g: ShaderGraph) => {
      // find first output-like node
      let outNode = g.nodes.find((n: any) => n.type === 'output' || n.type === 'output-standard' || n.type === 'output-physical' || n.type === 'output-phong' || n.type === 'output-toon') as any;
      if (!outNode) {
        // create one if missing
        const id = crypto.randomUUID();
        outNode = { id, type: 'output-standard', position: { x: 520, y: 120 } } as any;
        g.nodes = [...g.nodes, outNode as any];
      }
      (outNode as any).type =
        next === 'standard' ? 'output-standard' :
        next === 'physical' ? 'output-physical' :
        next === 'phong' ? 'output-phong' : 'output-toon';
    });
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded p-2 space-y-2">
      {/* Slim header row: assign, new, material type, shader editor toggle */}
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
        {/* + New (icon only) */}
        <button
          className="h-7 w-7 inline-flex items-center justify-center bg-white/10 hover:bg-white/20 rounded border border-white/10"
          title="New Material"
          onClick={() => {
            const id = crypto.randomUUID();
            geo.addMaterial({ id, name: `Mat ${materials.length + 1}` , color: { x: 0.8, y: 0.8, z: 0.85 }, roughness: 0.8, metalness: 0.05, emissive: { x:0, y:0, z:0 }, emissiveIntensity: 1 });
            geo.ensureDefaultGraph(id);
            onAssignMaterial?.(id);
          }}
        >
          <Plus className="h-4 w-4 text-gray-300" />
        </button>
        {/* Shader editor toggle */}
        {material && (
          <button
            className="h-7 w-7 inline-flex items-center justify-center bg-white/10 hover:bg-white/20 rounded border border-white/10"
            onClick={() => {
              if (!seOpen) openShaderEditor(material.id); else setSeOpen(false);
            }}
            title="Toggle Shader Editor (Shift+M)"
          >
            <Beaker className="h-4 w-4 text-gray-300" />
          </button>
        )}
      </div>
      {material && (
        <div className="space-y-2 text-xs text-gray-300">
          {/* Material type selector dropdown below the header */}
          <div>
            <div className="text-gray-400 mb-1">Material Type</div>
            <select
              className="w-full bg-black/30 border border-white/10 rounded px-2 py-1"
              value={materialType}
              onChange={(e) => setMaterialType(e.target.value as any)}
            >
              <option value="standard">Standard (PBR)</option>
              <option value="physical">Physical</option>
              <option value="phong">Phong</option>
              <option value="toon">Toon</option>
            </select>
          </div>
          <div>
            <div className="text-gray-400 mb-1">Name</div>
            <input
              className="w-full bg-black/30 border border-white/10 rounded px-2 py-1"
              value={material.name}
              onChange={(e) => update((m) => { m.name = e.target.value; })}
            />
          </div>
          <ColorInput label="Color" value={material.color} onChange={(v) => { if (!updateGraphIfSimple('color', v)) update((m) => { m.color = v; }); }} />
          <ColorInput label="Emissive" value={material.emissive} onChange={(v) => { if (!updateGraphIfSimple('emissive', v)) update((m) => { m.emissive = v; }); }} />
          <div>
            <div className="text-gray-400 mb-1">Emissive Intensity</div>
            <DragInput value={material.emissiveIntensity ?? 1} step={0.05} precision={2} onChange={(v) => { if (!updateGraphIfSimple('emissiveIntensity', v)) update((m) => { m.emissiveIntensity = Math.max(0, v); }); }} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-gray-400 mb-1">Roughness</div>
              <DragInput value={material.roughness} step={0.01} precision={2} onChange={(v) => { if (!updateGraphIfSimple('roughness', v)) update((m) => { m.roughness = Math.max(0, Math.min(1, v)); }); }} />
            </div>
            <div>
              <div className="text-gray-400 mb-1">Metalness</div>
              <DragInput value={material.metalness} step={0.01} precision={2} onChange={(v) => { if (!updateGraphIfSimple('metalness', v)) update((m) => { m.metalness = Math.max(0, Math.min(1, v)); }); }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MaterialSection;

"use client";

import React, { useMemo } from 'react';
import { useGeometryStore } from '@/stores/geometry-store';
import type { Material as MatType } from '@/types/geometry';
import { DragInput } from '@/components/drag-input';
import { ColorInput } from '@/components/color-input';
import { useShaderEditorStore } from '@/stores/shader-editor-store';
import type { ShaderGraph } from '@/types/shader';
import { Plus, Beaker } from 'lucide-react';

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
  }, [shaderGraph, shaderGraph?.nodes]);

  const update = (updater: (m: MatType) => void) => {
    if (!material) return;
    geo.updateMaterial(material.id, updater);
  };

  // Inspector editable-if-const: find direct const node connected to a given output input
  const getDirectConstNode = (field: 'color' | 'roughness' | 'metalness' | 'emissive' | 'emissiveIntensity') => {
    if (!materialId) return undefined as any;
    const g = geo.shaderGraphs.get(materialId);
    if (!g) return undefined as any;
    const out = g.nodes.find((n: any) => n.type === 'output' || (typeof n.type === 'string' && n.type.startsWith('output-')));
    if (!out) return undefined as any;
    const edge = g.edges.find((e) => e.target === (out as any).id && e.targetHandle === field);
    if (!edge) return undefined as any;
    const node = g.nodes.find((n) => n.id === edge.source) as any;
    return node;
  };

  // Same update semantics as shader editor const nodes
  const updateConstFloat = (nodeId: string, value: number) => {
    if (!materialId) return;
    geo.updateShaderGraph(materialId, (gg: ShaderGraph) => {
      const nn: any = gg.nodes.find((n) => n.id === nodeId);
      if (nn && nn.type === 'const-float') nn.data = { ...(nn.data || {}), value };
    });
  };
  const updateConstColor = (nodeId: string, value: { x: number; y: number; z: number }) => {
    if (!materialId) return;
    geo.updateShaderGraph(materialId, (gg: ShaderGraph) => {
      const nn: any = gg.nodes.find((n) => n.id === nodeId);
      if (nn && nn.type === 'const-color') nn.data = { r: value.x, g: value.y, b: value.z };
    });
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
          {/* Color */}
          {(() => {
            const node: any = getDirectConstNode('color');
            if (node && node.type === 'const-color') {
              const d = node.data || { r: 1, g: 1, b: 1 };
              const v = { x: d.r ?? 1, y: d.g ?? 1, z: d.b ?? 1 };
              return <ColorInput label="Color" value={v} onChange={(nv) => updateConstColor(node.id, nv)} />;
            }
            return (
              <div className="flex items-center justify-between">
                <div className="text-xs text-gray-400">Color</div>
                <button
                  className="px-2 py-1 text-xs bg-white/10 hover:bg-white/20 rounded border border-white/10"
                  onClick={() => material && openShaderEditor(material.id)}
                >Open in editor</button>
              </div>
            );
          })()}
          {/* Emissive */}
          {(() => {
            const node: any = getDirectConstNode('emissive');
            if (node && node.type === 'const-color') {
              const d = node.data || { r: 0, g: 0, b: 0 };
              const v = { x: d.r ?? 0, y: d.g ?? 0, z: d.b ?? 0 };
              return <ColorInput label="Emissive" value={v} onChange={(nv) => updateConstColor(node.id, nv)} />;
            }
            return (
              <div className="flex items-center justify-between">
                <div className="text-xs text-gray-400">Emissive</div>
                <button
                  className="px-2 py-1 text-xs bg-white/10 hover:bg-white/20 rounded border border-white/10"
                  onClick={() => material && openShaderEditor(material.id)}
                >Open in editor</button>
              </div>
            );
          })()}
          {/* Emissive Intensity */}
          {(() => {
            const node: any = getDirectConstNode('emissiveIntensity');
            if (node && node.type === 'const-float') {
              const v = (node.data?.value ?? 1) as number;
              return (
                <div>
                  <div className="text-gray-400 mb-1">Emissive Intensity</div>
                  <DragInput value={v} step={0.05} precision={2} onChange={(nv) => updateConstFloat(node.id, Math.max(0, nv))} />
                </div>
              );
            }
            return (
              <div className="flex items-center justify-between">
                <div className="text-xs text-gray-400">Emissive Intensity</div>
                <button
                  className="px-2 py-1 text-xs bg-white/10 hover:bg-white/20 rounded border border-white/10"
                  onClick={() => material && openShaderEditor(material.id)}
                >Open in editor</button>
              </div>
            );
          })()}
          {/* Roughness / Metalness */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              {(() => {
                const node: any = getDirectConstNode('roughness');
                if (node && node.type === 'const-float') {
                  const v = (node.data?.value ?? (material?.roughness ?? 1)) as number;
                  return (
                    <div>
                      <div className="text-gray-400 mb-1">Roughness</div>
                      <DragInput value={v} step={0.01} precision={2} onChange={(nv) => updateConstFloat(node.id, Math.max(0, Math.min(1, nv)))} />
                    </div>
                  );
                }
                return (
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-gray-400">Roughness</div>
                    <button
                      className="px-2 py-1 text-xs bg-white/10 hover:bg-white/20 rounded border border-white/10"
                      onClick={() => material && openShaderEditor(material.id)}
                    >Open in editor</button>
                  </div>
                );
              })()}
            </div>
            <div>
              {(() => {
                const node: any = getDirectConstNode('metalness');
                if (node && node.type === 'const-float') {
                  const v = (node.data?.value ?? (material?.metalness ?? 0)) as number;
                  return (
                    <div>
                      <div className="text-gray-400 mb-1">Metalness</div>
                      <DragInput value={v} step={0.01} precision={2} onChange={(nv) => updateConstFloat(node.id, Math.max(0, Math.min(1, nv)))} />
                    </div>
                  );
                }
                return (
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-gray-400">Metalness</div>
                    <button
                      className="px-2 py-1 text-xs bg-white/10 hover:bg-white/20 rounded border border-white/10"
                      onClick={() => material && openShaderEditor(material.id)}
                    >Open in editor</button>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MaterialSection;

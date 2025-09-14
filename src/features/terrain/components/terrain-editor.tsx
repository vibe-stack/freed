"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ReactFlow, Background, Controls, MiniMap, ReactFlowProvider, NodeTypes, ConnectionMode, Handle, Position } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useTerrainEditorStore } from '@/stores/terrain-editor-store';
import { useTerrainStore } from '@/stores/terrain-store';
import { useGeometryStore } from '@/stores/geometry-store';
import type { TerrainNodeType } from '@/types/terrain';
import { nanoid } from 'nanoid';
import { ContextMenu } from '@base-ui-components/react/context-menu';
import { DragInput } from '@/components/drag-input';
import { useShaderEditorHotkeys } from '@/features/materials/components/shader-editor/hooks/useShaderEditorHotkeys';

type Props = { open: boolean; onOpenChange: (v: boolean) => void };

const BaseNode: React.FC<any> = ({ id, data, selected }) => {
  const terrainId = data?.terrainId as string | undefined;
  const graph = useGeometryStore((s) => (terrainId ? s.terrainGraphs.get(terrainId) : undefined));
  const updateGraph = useTerrainStore((s) => s.updateGraph);
  const regenerate = useTerrainStore((s) => s.regenerate);
  const n = useMemo(() => graph?.nodes.find((nn: any) => nn.id === id) ?? { id, type: 'input', position: { x: 0, y: 0 }, data: {} }, [graph, id]);

  const scheduleRegen = (tid?: string) => {
    if (!tid) return;
    const key = `__regen_graph_${tid}` as const;
    const anyWin = globalThis as any;
    if (anyWin[key]) clearTimeout(anyWin[key]);
    anyWin[key] = setTimeout(() => { try { regenerate(tid); } catch {} }, 200);
  };

  const setData = (patch: Record<string, any>) => {
    if (!terrainId) return;
    updateGraph(terrainId, (g) => {
      const node = g.nodes.find((nn: any) => nn.id === id);
      if (node) node.data = { ...(node as any).data, ...patch };
    });
    scheduleRegen(terrainId);
  };
  return (
    <div className={`rounded-md border ${selected ? 'border-white/20 bg-[#141a22]/95' : 'border-white/10 bg-[#0f141b]/90'} text-gray-200 text-xs min-w-[200px] transition-colors relative`}>
      {/* IO handles */}
      <Handle type="target" position={Position.Left} id="in" className="!w-2 !h-2 !bg-white/70" />
      <Handle type="source" position={Position.Right} id="out" className="!w-2 !h-2 !bg-white/70" />
      <div className={`px-2 py-1 border-b ${selected ? 'border-white/20' : 'border-white/10'} text-[11px] uppercase tracking-wide text-gray-400 flex items-center justify-between rf-drag`}>
        <span className="cursor-move select-none">{String((n as any).type)}</span>
      </div>
      <div className="px-2 py-2 text-[11px] text-gray-300 space-y-1">
        {n.type === 'perlin' && (
          <div className="space-y-1">
            <div className="grid grid-cols-2 gap-1 items-center"><span className="text-gray-400">Scale</span><DragInput compact value={(n as any).data?.scale ?? 2} step={0.1} precision={2} onChange={(v) => setData({ scale: Math.max(0.01, v) })} /></div>
            <div className="grid grid-cols-2 gap-1 items-center"><span className="text-gray-400">Octaves</span><DragInput compact value={(n as any).data?.octaves ?? 4} step={1} precision={0} onChange={(v) => setData({ octaves: Math.max(1, Math.round(v)) })} /></div>
            <div className="grid grid-cols-2 gap-1 items-center"><span className="text-gray-400">Persistence</span><DragInput compact value={(n as any).data?.persistence ?? 0.5} step={0.05} precision={2} onChange={(v) => setData({ persistence: Math.max(0, Math.min(1, v)) })} /></div>
            <div className="grid grid-cols-2 gap-1 items-center"><span className="text-gray-400">Lacunarity</span><DragInput compact value={(n as any).data?.lacunarity ?? 2.0} step={0.1} precision={2} onChange={(v) => setData({ lacunarity: Math.max(1.0, v) })} /></div>
            <div className="grid grid-cols-2 gap-1 items-center"><span className="text-gray-400">Amplitude</span><DragInput compact value={(n as any).data?.amplitude ?? 1} step={0.05} precision={2} onChange={(v) => setData({ amplitude: v })} /></div>
            <div className="grid grid-cols-2 gap-1 items-center"><span className="text-gray-400">Amount</span><DragInput compact value={(n as any).data?.amount ?? 1} step={0.05} precision={2} onChange={(v) => setData({ amount: Math.max(0, Math.min(1, v)) })} /></div>
            <div className="grid grid-cols-2 gap-1 items-center"><span className="text-gray-400">Op</span>
              <select className="bg-black/40 border border-white/10 rounded px-1 py-0.5"
                value={(n as any).data?.operation ?? 'add'}
                onChange={(e) => setData({ operation: e.target.value })}>
                {['add','mix','max','min','replace'].map((op) => <option key={op} value={op}>{op}</option>)}
              </select>
            </div>
          </div>
        )}
        {n.type === 'voronoi' && (
          <div className="space-y-1">
            <div className="grid grid-cols-2 gap-1 items-center"><span className="text-gray-400">Density</span><DragInput compact value={(n as any).data?.density ?? 4} step={0.1} precision={2} onChange={(v) => setData({ density: Math.max(0.01, v) })} /></div>
            <div className="grid grid-cols-2 gap-1 items-center"><span className="text-gray-400">Jitter</span><DragInput compact value={(n as any).data?.jitter ?? 0.5} step={0.05} precision={2} onChange={(v) => setData({ jitter: Math.max(0, Math.min(1, v)) })} /></div>
            <div className="grid grid-cols-2 gap-1 items-center"><span className="text-gray-400">Metric</span>
              <select className="bg-black/40 border border-white/10 rounded px-1 py-0.5"
                value={(n as any).data?.metric ?? 'euclidean'}
                onChange={(e) => setData({ metric: e.target.value })}>
                {['euclidean','manhattan','chebyshev'].map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-1 items-center"><span className="text-gray-400">Feature</span>
              <select className="bg-black/40 border border-white/10 rounded px-1 py-0.5"
                value={(n as any).data?.feature ?? 'f1'}
                onChange={(e) => setData({ feature: e.target.value })}>
                {['f1','f2','f2-f1'].map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-1 items-center"><span className="text-gray-400">Amplitude</span><DragInput compact value={(n as any).data?.amplitude ?? 1} step={0.05} precision={2} onChange={(v) => setData({ amplitude: v })} /></div>
            <div className="grid grid-cols-2 gap-1 items-center"><span className="text-gray-400">Amount</span><DragInput compact value={(n as any).data?.amount ?? 1} step={0.05} precision={2} onChange={(v) => setData({ amount: Math.max(0, Math.min(1, v)) })} /></div>
            <div className="grid grid-cols-2 gap-1 items-center"><span className="text-gray-400">Op</span>
              <select className="bg-black/40 border border-white/10 rounded px-1 py-0.5"
                value={(n as any).data?.operation ?? 'add'}
                onChange={(e) => setData({ operation: e.target.value })}>
                {['add','mix','max','min','replace'].map((op) => <option key={op} value={op}>{op}</option>)}
              </select>
            </div>
          </div>
        )}
        {n.type === 'mountain' && (
          <div className="space-y-1">
            <div className="grid grid-cols-2 gap-1 items-center"><span className="text-gray-400">Center X</span><DragInput compact value={(n as any).data?.centerX ?? 0.5} step={0.01} precision={2} onChange={(v) => setData({ centerX: Math.max(0, Math.min(1, v)) })} /></div>
            <div className="grid grid-cols-2 gap-1 items-center"><span className="text-gray-400">Center Y</span><DragInput compact value={(n as any).data?.centerY ?? 0.5} step={0.01} precision={2} onChange={(v) => setData({ centerY: Math.max(0, Math.min(1, v)) })} /></div>
            <div className="grid grid-cols-2 gap-1 items-center"><span className="text-gray-400">Radius</span><DragInput compact value={(n as any).data?.radius ?? 0.35} step={0.01} precision={3} onChange={(v) => setData({ radius: Math.max(0.01, v) })} /></div>
            <div className="grid grid-cols-2 gap-1 items-center"><span className="text-gray-400">Peak</span><DragInput compact value={(n as any).data?.peak ?? 1.0} step={0.05} precision={2} onChange={(v) => setData({ peak: Math.max(0, v) })} /></div>
            <div className="grid grid-cols-2 gap-1 items-center"><span className="text-gray-400">Falloff</span><DragInput compact value={(n as any).data?.falloff ?? 2.0} step={0.05} precision={2} onChange={(v) => setData({ falloff: Math.max(0.1, v) })} /></div>
            <div className="grid grid-cols-2 gap-1 items-center"><span className="text-gray-400">Sharpness</span><DragInput compact value={(n as any).data?.sharpness ?? 1.5} step={0.05} precision={2} onChange={(v) => setData({ sharpness: Math.max(0.1, v) })} /></div>
            <div className="grid grid-cols-2 gap-1 items-center"><span className="text-gray-400">Ridges</span><DragInput compact value={(n as any).data?.ridges ?? 0.2} step={0.02} precision={2} onChange={(v) => setData({ ridges: Math.max(0, v) })} /></div>
            <div className="grid grid-cols-2 gap-1 items-center"><span className="text-gray-400">Octaves</span><DragInput compact value={(n as any).data?.octaves ?? 4} step={1} precision={0} onChange={(v) => setData({ octaves: Math.max(1, Math.round(v)) })} /></div>
            <div className="grid grid-cols-2 gap-1 items-center"><span className="text-gray-400">Gain</span><DragInput compact value={(n as any).data?.gain ?? 0.5} step={0.05} precision={2} onChange={(v) => setData({ gain: Math.max(0.01, Math.min(1, v)) })} /></div>
            <div className="grid grid-cols-2 gap-1 items-center"><span className="text-gray-400">Lacunarity</span><DragInput compact value={(n as any).data?.lacunarity ?? 2.0} step={0.05} precision={2} onChange={(v) => setData({ lacunarity: Math.max(1.0, v) })} /></div>
            <div className="grid grid-cols-2 gap-1 items-center"><span className="text-gray-400">Op</span>
              <select className="bg-black/40 border border-white/10 rounded px-1 py-0.5" value={(n as any).data?.operation ?? 'add'} onChange={(e) => setData({ operation: e.target.value })}>
                {['add','mix','max','min','replace'].map((op) => <option key={op} value={op}>{op}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-1 items-center"><span className="text-gray-400">Amount</span><DragInput compact value={(n as any).data?.amount ?? 1} step={0.05} precision={2} onChange={(v) => setData({ amount: Math.max(0, Math.min(1, v)) })} /></div>
          </div>
        )}
        {n.type === 'crater' && (
          <div className="space-y-1">
            <div className="grid grid-cols-2 gap-1 items-center"><span className="text-gray-400">Center X</span><DragInput compact value={(n as any).data?.centerX ?? 0.5} step={0.01} precision={2} onChange={(v) => setData({ centerX: Math.max(0, Math.min(1, v)) })} /></div>
            <div className="grid grid-cols-2 gap-1 items-center"><span className="text-gray-400">Center Y</span><DragInput compact value={(n as any).data?.centerY ?? 0.5} step={0.01} precision={2} onChange={(v) => setData({ centerY: Math.max(0, Math.min(1, v)) })} /></div>
            <div className="grid grid-cols-2 gap-1 items-center"><span className="text-gray-400">Radius</span><DragInput compact value={(n as any).data?.radius ?? 0.25} step={0.01} precision={3} onChange={(v) => setData({ radius: Math.max(0.01, v) })} /></div>
            <div className="grid grid-cols-2 gap-1 items-center"><span className="text-gray-400">Depth</span><DragInput compact value={(n as any).data?.depth ?? 0.6} step={0.05} precision={2} onChange={(v) => setData({ depth: Math.max(0, v) })} /></div>
            <div className="grid grid-cols-2 gap-1 items-center"><span className="text-gray-400">Rim Height</span><DragInput compact value={(n as any).data?.rimHeight ?? 0.2} step={0.02} precision={2} onChange={(v) => setData({ rimHeight: Math.max(0, v) })} /></div>
            <div className="grid grid-cols-2 gap-1 items-center"><span className="text-gray-400">Rim Width</span><DragInput compact value={(n as any).data?.rimWidth ?? 0.1} step={0.01} precision={2} onChange={(v) => setData({ rimWidth: Math.max(0.01, Math.min(0.9, v)) })} /></div>
            <div className="grid grid-cols-2 gap-1 items-center"><span className="text-gray-400">Floor</span><DragInput compact value={(n as any).data?.floor ?? 0.1} step={0.02} precision={2} onChange={(v) => setData({ floor: Math.max(0, v) })} /></div>
            <div className="grid grid-cols-2 gap-1 items-center"><span className="text-gray-400">Smooth</span><DragInput compact value={(n as any).data?.smooth ?? 0.5} step={0.02} precision={2} onChange={(v) => setData({ smooth: Math.max(0, Math.min(1, v)) })} /></div>
            <div className="grid grid-cols-2 gap-1 items-center"><span className="text-gray-400">Op</span>
              <select className="bg-black/40 border border-white/10 rounded px-1 py-0.5" value={(n as any).data?.operation ?? 'add'} onChange={(e) => setData({ operation: e.target.value })}>
                {['add','mix','max','min','replace'].map((op) => <option key={op} value={op}>{op}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-1 items-center"><span className="text-gray-400">Amount</span><DragInput compact value={(n as any).data?.amount ?? 1} step={0.05} precision={2} onChange={(v) => setData({ amount: Math.max(0, Math.min(1, v)) })} /></div>
          </div>
        )}
        {n.type === 'canyon' && (
          <div className="space-y-1">
            <div className="grid grid-cols-2 gap-1 items-center"><span className="text-gray-400">Start X</span><DragInput compact value={(n as any).data?.startX ?? 0.2} step={0.01} precision={2} onChange={(v) => setData({ startX: Math.max(0, Math.min(1, v)) })} /></div>
            <div className="grid grid-cols-2 gap-1 items-center"><span className="text-gray-400">Start Y</span><DragInput compact value={(n as any).data?.startY ?? 0.8} step={0.01} precision={2} onChange={(v) => setData({ startY: Math.max(0, Math.min(1, v)) })} /></div>
            <div className="grid grid-cols-2 gap-1 items-center"><span className="text-gray-400">End X</span><DragInput compact value={(n as any).data?.endX ?? 0.8} step={0.01} precision={2} onChange={(v) => setData({ endX: Math.max(0, Math.min(1, v)) })} /></div>
            <div className="grid grid-cols-2 gap-1 items-center"><span className="text-gray-400">End Y</span><DragInput compact value={(n as any).data?.endY ?? 0.2} step={0.01} precision={2} onChange={(v) => setData({ endY: Math.max(0, Math.min(1, v)) })} /></div>
            <div className="grid grid-cols-2 gap-1 items-center"><span className="text-gray-400">Width</span><DragInput compact value={(n as any).data?.width ?? 0.1} step={0.01} precision={3} onChange={(v) => setData({ width: Math.max(0.01, v) })} /></div>
            <div className="grid grid-cols-2 gap-1 items-center"><span className="text-gray-400">Depth</span><DragInput compact value={(n as any).data?.depth ?? 0.8} step={0.05} precision={2} onChange={(v) => setData({ depth: Math.max(0, v) })} /></div>
            <div className="grid grid-cols-2 gap-1 items-center"><span className="text-gray-400">Meander</span><DragInput compact value={(n as any).data?.meander ?? 0.3} step={0.02} precision={2} onChange={(v) => setData({ meander: Math.max(0, Math.min(1, v)) })} /></div>
            <div className="grid grid-cols-2 gap-1 items-center"><span className="text-gray-400">Roughness</span><DragInput compact value={(n as any).data?.roughness ?? 0.5} step={0.05} precision={2} onChange={(v) => setData({ roughness: Math.max(0, Math.min(1, v)) })} /></div>
            <div className="grid grid-cols-2 gap-1 items-center"><span className="text-gray-400">Side Slope</span><DragInput compact value={(n as any).data?.sideSlope ?? 1.5} step={0.1} precision={2} onChange={(v) => setData({ sideSlope: Math.max(0.1, v) })} /></div>
            <div className="grid grid-cols-2 gap-1 items-center"><span className="text-gray-400">Op</span>
              <select className="bg-black/40 border border-white/10 rounded px-1 py-0.5" value={(n as any).data?.operation ?? 'add'} onChange={(e) => setData({ operation: e.target.value })}>
                {['add','mix','max','min','replace'].map((op) => <option key={op} value={op}>{op}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-1 items-center"><span className="text-gray-400">Amount</span><DragInput compact value={(n as any).data?.amount ?? 1} step={0.05} precision={2} onChange={(v) => setData({ amount: Math.max(0, Math.min(1, v)) })} /></div>
          </div>
        )}
        {n.type === 'dunes' && (
          <div className="space-y-1">
            <div className="grid grid-cols-2 gap-1 items-center"><span className="text-gray-400">Direction</span><DragInput compact value={(n as any).data?.direction ?? 45} step={5} precision={0} onChange={(v) => setData({ direction: v % 360 })} /></div>
            <div className="grid grid-cols-2 gap-1 items-center"><span className="text-gray-400">Wavelength</span><DragInput compact value={(n as any).data?.wavelength ?? 0.15} step={0.01} precision={3} onChange={(v) => setData({ wavelength: Math.max(0.01, v) })} /></div>
            <div className="grid grid-cols-2 gap-1 items-center"><span className="text-gray-400">Height</span><DragInput compact value={(n as any).data?.height ?? 0.4} step={0.02} precision={2} onChange={(v) => setData({ height: Math.max(0, v) })} /></div>
            <div className="grid grid-cols-2 gap-1 items-center"><span className="text-gray-400">Asymmetry</span><DragInput compact value={(n as any).data?.asymmetry ?? 0.7} step={0.05} precision={2} onChange={(v) => setData({ asymmetry: Math.max(0.1, Math.min(0.9, v)) })} /></div>
            <div className="grid grid-cols-2 gap-1 items-center"><span className="text-gray-400">Variation</span><DragInput compact value={(n as any).data?.variation ?? 0.3} step={0.02} precision={2} onChange={(v) => setData({ variation: Math.max(0, Math.min(1, v)) })} /></div>
            <div className="grid grid-cols-2 gap-1 items-center"><span className="text-gray-400">Coverage</span><DragInput compact value={(n as any).data?.coverage ?? 0.8} step={0.05} precision={2} onChange={(v) => setData({ coverage: Math.max(0, Math.min(1, v)) })} /></div>
            <div className="grid grid-cols-2 gap-1 items-center"><span className="text-gray-400">Spacing</span><DragInput compact value={(n as any).data?.spacing ?? 0.6} step={0.05} precision={2} onChange={(v) => setData({ spacing: Math.max(0.1, Math.min(2, v)) })} /></div>
            <div className="grid grid-cols-2 gap-1 items-center"><span className="text-gray-400">Op</span>
              <select className="bg-black/40 border border-white/10 rounded px-1 py-0.5" value={(n as any).data?.operation ?? 'add'} onChange={(e) => setData({ operation: e.target.value })}>
                {['add','mix','max','min','replace'].map((op) => <option key={op} value={op}>{op}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-1 items-center"><span className="text-gray-400">Amount</span><DragInput compact value={(n as any).data?.amount ?? 1} step={0.05} precision={2} onChange={(v) => setData({ amount: Math.max(0, Math.min(1, v)) })} /></div>
          </div>
        )}
        {n.type === 'badlands' && (
          <div className="space-y-1">
            <div className="grid grid-cols-2 gap-1 items-center"><span className="text-gray-400">Scale</span><DragInput compact value={(n as any).data?.scale ?? 3} step={0.1} precision={2} onChange={(v) => setData({ scale: Math.max(0.1, v) })} /></div>
            <div className="grid grid-cols-2 gap-1 items-center"><span className="text-gray-400">Erosion</span><DragInput compact value={(n as any).data?.erosion ?? 0.7} step={0.05} precision={2} onChange={(v) => setData({ erosion: Math.max(0, Math.min(1, v)) })} /></div>
            <div className="grid grid-cols-2 gap-1 items-center"><span className="text-gray-400">Layers</span><DragInput compact value={(n as any).data?.layers ?? 8} step={1} precision={0} onChange={(v) => setData({ layers: Math.max(2, Math.round(v)) })} /></div>
            <div className="grid grid-cols-2 gap-1 items-center"><span className="text-gray-400">Hardness</span><DragInput compact value={(n as any).data?.hardness ?? 0.6} step={0.05} precision={2} onChange={(v) => setData({ hardness: Math.max(0.1, Math.min(1, v)) })} /></div>
            <div className="grid grid-cols-2 gap-1 items-center"><span className="text-gray-400">Steepness</span><DragInput compact value={(n as any).data?.steepness ?? 1.2} step={0.1} precision={2} onChange={(v) => setData({ steepness: Math.max(0.1, v) })} /></div>
            <div className="grid grid-cols-2 gap-1 items-center"><span className="text-gray-400">Roughness</span><DragInput compact value={(n as any).data?.roughness ?? 0.4} step={0.05} precision={2} onChange={(v) => setData({ roughness: Math.max(0, Math.min(1, v)) })} /></div>
            <div className="grid grid-cols-2 gap-1 items-center"><span className="text-gray-400">Octaves</span><DragInput compact value={(n as any).data?.octaves ?? 5} step={1} precision={0} onChange={(v) => setData({ octaves: Math.max(1, Math.round(v)) })} /></div>
            <div className="grid grid-cols-2 gap-1 items-center"><span className="text-gray-400">Op</span>
              <select className="bg-black/40 border border-white/10 rounded px-1 py-0.5" value={(n as any).data?.operation ?? 'add'} onChange={(e) => setData({ operation: e.target.value })}>
                {['add','mix','max','min','replace'].map((op) => <option key={op} value={op}>{op}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-1 items-center"><span className="text-gray-400">Amount</span><DragInput compact value={(n as any).data?.amount ?? 1} step={0.05} precision={2} onChange={(v) => setData({ amount: Math.max(0, Math.min(1, v)) })} /></div>
          </div>
        )}
        {(n as any).data?.seed != null && (
          <div className="text-[10px] text-gray-500">seed: {(n as any).data.seed}</div>
        )}
      </div>
    </div>
  );
};

export const TerrainEditor: React.FC<Props> = ({ open }) => {
  const teOpen = useTerrainEditorStore((s) => s.open);
  const setTeOpen = useTerrainEditorStore((s) => s.setOpen);
  const teTerrainId = useTerrainEditorStore((s) => s.terrainId);
  const effectiveOpen = teOpen ?? open;

  const { updateGraph } = useTerrainStore();
  const graph = useGeometryStore((s) => (teTerrainId ? s.terrainGraphs.get(teTerrainId) : undefined));

  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  const [cmPos, setCmPos] = useState<{ x: number; y: number } | null>(null);
  const [cmOpen, setCmOpen] = useState(false);
  const [cmFlipX, setCmFlipX] = useState(false);
  const [cmFlipY, setCmFlipY] = useState(false);
  useEffect(() => { setPortalContainer(document.body); }, []);

  const nodeTypes = useMemo(() => ({ default: BaseNode, input: BaseNode, output: BaseNode, perlin: BaseNode, voronoi: BaseNode, mountain: BaseNode, crater: BaseNode, canyon: BaseNode, dunes: BaseNode, badlands: BaseNode } as unknown as NodeTypes), []);

  const defaultNodes = useMemo(() => (graph?.nodes ?? []).map((n: any) => ({ id: n.id, type: n.type as any, position: n.position as any, data: { terrainId: teTerrainId }, dragHandle: '.rf-drag', draggable: true })), [graph?.nodes, teTerrainId]);
  const defaultEdges = useMemo(() => (graph?.edges ?? []).map((e: any) => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle, targetHandle: e.targetHandle })), [graph?.edges]);
  const defaultEdgeOptions = useMemo(() => ({ animated: true }), []);

  const [rf, setRf] = useState<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const deleteSelection = () => {
    if (!teTerrainId || !graph) return;
    const nodes = rf?.getNodes() ?? [];
    const edges = rf?.getEdges() ?? [];
    const selNodeIds = new Set(nodes.filter((n: any) => (n as any).selected).map((n: any) => n.id));
    const selEdgeIds = new Set(edges.filter((e: any) => (e as any).selected).map((e: any) => e.id));
    if (selNodeIds.size === 0 && selEdgeIds.size === 0) return;

    updateGraph(teTerrainId, (g) => {
      if (selEdgeIds.size) {
        g.edges = g.edges.filter((e: any) => !selEdgeIds.has(e.id));
      }
      if (selNodeIds.size) {
        const canDelete = (n: any) => n.type !== 'input' && n.type !== 'output';
        const removing = new Set(g.nodes.filter((n: any) => selNodeIds.has(n.id) && canDelete(n)).map((n: any) => n.id));
        if (removing.size) {
          g.nodes = g.nodes.filter((n: any) => !removing.has(n.id));
          g.edges = g.edges.filter((e: any) => !removing.has(e.source) && !removing.has(e.target));
        }
      }
    });

    if (rf) {
      if (selEdgeIds.size) rf.setEdges((eds: any) => eds.filter((e: any) => !selEdgeIds.has(e.id)) as any);
      if (selNodeIds.size) rf.setNodes((nds: any) => nds.filter((n: any) => !selNodeIds.has(n.id)) as any);
    }

    const anyWin: any = globalThis;
    const key = `__regen_graph_${teTerrainId}`;
    if (anyWin[key]) clearTimeout(anyWin[key]);
    anyWin[key] = setTimeout(() => { try { useTerrainStore.getState().regenerate(teTerrainId); } catch {} }, 200);
  };

  // Use the same hotkey handling as the shader editor so key events are captured at
  // document capture phase and propagation is stopped (prevents global app handlers
  // from receiving the Delete/Backspace event and deleting the 3D object).
  useShaderEditorHotkeys(!!effectiveOpen, containerRef, {
    copy: () => {},
    cut: () => {},
    paste: () => {},
    del: () => deleteSelection(),
  });

  const addNodeAt = (type: TerrainNodeType, clientPos?: { x: number; y: number } | null) => {
    if (!teTerrainId) return;
    const id = nanoid();
    const basePos = clientPos && rf?.screenToFlowPosition ? rf.screenToFlowPosition(clientPos) : ({ x: 220, y: 120 } as any);
    const data = type === 'perlin'
      ? { seed: Math.floor(Math.random() * 1e9), scale: 2, octaves: 4, persistence: 0.5, lacunarity: 2.0, amplitude: 1, operation: 'add', amount: 1 }
      : type === 'voronoi'
        ? { seed: Math.floor(Math.random() * 1e9), density: 4, jitter: 0.5, metric: 'euclidean', feature: 'f1', amplitude: 1, operation: 'add', amount: 1 }
        : type === 'mountain'
          ? { seed: Math.floor(Math.random() * 1e9), centerX: 0.5, centerY: 0.5, radius: 0.35, peak: 1.0, falloff: 2.0, sharpness: 1.5, ridges: 0.2, octaves: 4, gain: 0.5, lacunarity: 2.0, operation: 'add', amount: 1 }
          : type === 'crater'
            ? { centerX: 0.5, centerY: 0.5, radius: 0.25, depth: 0.6, rimHeight: 0.2, rimWidth: 0.1, floor: 0.1, smooth: 0.5, operation: 'add', amount: 1 }
            : type === 'canyon'
              ? { startX: 0.2, startY: 0.8, endX: 0.8, endY: 0.2, width: 0.1, depth: 0.8, meander: 0.3, roughness: 0.5, sideSlope: 1.5, operation: 'add', amount: 1 }
              : type === 'dunes'
                ? { seed: Math.floor(Math.random() * 1e9), direction: 45, wavelength: 0.15, height: 0.4, asymmetry: 0.7, variation: 0.3, coverage: 0.8, spacing: 0.6, operation: 'add', amount: 1 }
                : type === 'badlands'
                  ? { seed: Math.floor(Math.random() * 1e9), scale: 3, erosion: 0.7, layers: 8, hardness: 0.6, steepness: 1.2, roughness: 0.4, octaves: 5, operation: 'add', amount: 1 }
                  : {};
    const node: any = { id, type, position: basePos, data };
    if (rf) rf.addNodes([{ id, type: type as any, position: basePos, data: { terrainId: teTerrainId }, dragHandle: '.rf-drag', draggable: true }]);
    updateGraph(teTerrainId, (g) => { g.nodes = [...g.nodes, node]; });
  };

  const onPaneContextMenu: React.MouseEventHandler = (e) => {
    e.preventDefault();
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
    const approxMenuW = 200;
    const approxMenuH = Math.round(vh * 0.4);
    const willOverflowRight = vw - e.clientX < (approxMenuW + 16);
    const willOverflowBottom = vh - e.clientY < (approxMenuH + 16);
    setCmFlipX(willOverflowRight);
    setCmFlipY(willOverflowBottom);
    setCmPos({ x: e.clientX, y: e.clientY });
    setCmOpen(true);
  };

  if (!effectiveOpen) return null;
  return (
    <div className="absolute z-40 pointer-events-auto w-[min(1100px,calc(100%-18rem))]" style={{ left: `50%`, transform: 'translateX(-50%)', bottom: `16px` }}>
      <div className="mx-auto mb-4 h-[calc(50vh-0.75rem)] rounded-lg border border-white/10 bg-black/60 backdrop-blur-lg shadow-xl overflow-hidden" style={{ background: 'rgba(11,14,19,0.6)', backdropFilter: 'blur(16px)' }}>
        <div className="px-3 h-9 flex items-center justify-between border-b border-white/10 bg-transparent text-gray-300 text-xs">
          <div className="uppercase tracking-wide">Terrain Editor</div>
          <div className="flex items-center gap-2">
            <button className="px-2 py-1 rounded border border-white/10 hover:bg-white/10" onClick={() => setTeOpen(false)}>Close</button>
          </div>
        </div>
        <div className="h-[calc(100%-36px)]" ref={containerRef} tabIndex={0}>
          <ReactFlowProvider>
            <ContextMenu.Root open={cmOpen} onOpenChange={setCmOpen}>
              <div className="block h-full" onContextMenu={onPaneContextMenu}>
                <ReactFlow
                  key={teTerrainId || 'no-terrain'}
                  defaultNodes={defaultNodes}
                  defaultEdges={defaultEdges}
                  nodeTypes={nodeTypes}
                  nodesConnectable
                  elementsSelectable
                  nodesDraggable
                  defaultEdgeOptions={defaultEdgeOptions}
                  edgesReconnectable
                  onConnect={(c) => { if (!teTerrainId) return; const id = nanoid(); updateGraph(teTerrainId, (g) => { g.edges = [...g.edges, { id, source: c.source!, target: c.target!, sourceHandle: c.sourceHandle || 'out', targetHandle: c.targetHandle || 'in' } as any]; }); const anyWin: any = globalThis; const key = `__regen_graph_${teTerrainId}`; if (anyWin[key]) clearTimeout(anyWin[key]); anyWin[key] = setTimeout(() => { try { useTerrainStore.getState().regenerate(teTerrainId); } catch {} }, 200); }}
                  onNodesChange={(changes) => {
                    if (!teTerrainId) return;
                    updateGraph(teTerrainId, (g) => {
                      changes.forEach((ch: any) => {
                        if (ch.type === 'position' && ch.id) {
                          const n = g.nodes.find((nn) => nn.id === ch.id);
                          if (n) n.position = { x: ch.position.x, y: ch.position.y } as any;
                        } else if (ch.type === 'remove' && ch.id) {
                          const n = g.nodes.find((nn) => nn.id === ch.id);
                          if (n && n.type !== 'input' && n.type !== 'output') {
                            g.nodes = g.nodes.filter((nn) => nn.id !== ch.id);
                            g.edges = g.edges.filter((e) => e.source !== ch.id && e.target !== ch.id);
                          }
                        }
                      });
                    });
                    const anyWin: any = globalThis; const key = `__regen_graph_${teTerrainId}`; if (anyWin[key]) clearTimeout(anyWin[key]); anyWin[key] = setTimeout(() => { try { useTerrainStore.getState().regenerate(teTerrainId); } catch {} }, 200);
                  }}
                  onEdgesChange={(changes) => {
                    if (!teTerrainId) return;
                    updateGraph(teTerrainId, (g) => {
                      changes.forEach((ch: any) => {
                        if (ch.type === 'remove' && ch.id) {
                          g.edges = g.edges.filter((e) => e.id !== ch.id);
                        }
                      });
                    });
                    const anyWin: any = globalThis; const key = `__regen_graph_${teTerrainId}`; if (anyWin[key]) clearTimeout(anyWin[key]); anyWin[key] = setTimeout(() => { try { useTerrainStore.getState().regenerate(teTerrainId); } catch {} }, 200);
                  }}
                  connectionMode={ConnectionMode.Loose}
                  onInit={(instance) => setRf(instance as any)}
                  fitView
                  colorMode='dark'
                  hidden={false}
                >
                  <Background color="transparent" gap={16} />
                  <MiniMap zoomable pannable className="!bg-transparent !opacity-70" />
                  <Controls className="!bg-transparent" />
                </ReactFlow>
              </div>
              <ContextMenu.Portal container={portalContainer}>
                <ContextMenu.Positioner className="z-90">
                  <ContextMenu.Popup
                    className="z-[9999] min-w-40 rounded-md border border-white/10 bg-zinc-900/90 text-sm text-gray-200 shadow-lg shadow-black/40 relative overflow-hidden"
                    style={{ position: 'fixed', zIndex: 9999, left: (cmPos?.x ?? 0) + (cmFlipX ? -8 : 8), top: (cmPos?.y ?? 0) + (cmFlipY ? -8 : 8), transform: `translate(${cmFlipX ? '-100%' : '0'}, ${cmFlipY ? '-100%' : '0'})` }}
                  >
                    <div className="p-1 h-full max-h-72  overflow-y-auto overscroll-contain">
                      {/* Submenu-like grouped sections */}
                      <div className="px-2 py-1.5 text-[10px] uppercase tracking-wide text-gray-500">Primitives</div>
                      <div className="px-1 pb-1">
                        <button className="w-full text-left px-2 py-1 rounded hover:bg-white/10" onClick={() => { addNodeAt('perlin', cmPos); setCmOpen(false); }}>Perlin Noise</button>
                        <button className="w-full text-left px-2 py-1 rounded hover:bg-white/10" onClick={() => { addNodeAt('voronoi', cmPos); setCmOpen(false); }}>Voronoi</button>
                      </div>
                      <div className="px-2 py-1.5 text-[10px] uppercase tracking-wide text-gray-500">Geoprimitives</div>
                      <div className="px-1 pb-1">
                        <button className="w-full text-left px-2 py-1 rounded hover:bg-white/10" onClick={() => { addNodeAt('mountain', cmPos); setCmOpen(false); }}>Mountain</button>
                        <button className="w-full text-left px-2 py-1 rounded hover:bg-white/10" onClick={() => { addNodeAt('crater', cmPos); setCmOpen(false); }}>Crater</button>
                        <button className="w-full text-left px-2 py-1 rounded hover:bg-white/10" onClick={() => { addNodeAt('canyon', cmPos); setCmOpen(false); }}>Canyon</button>
                        <button className="w-full text-left px-2 py-1 rounded hover:bg-white/10" onClick={() => { addNodeAt('dunes', cmPos); setCmOpen(false); }}>Dunes</button>
                        <button className="w-full text-left px-2 py-1 rounded hover:bg-white/10" onClick={() => { addNodeAt('badlands', cmPos); setCmOpen(false); }}>Badlands</button>
                      </div>
                    </div>
                  </ContextMenu.Popup>
                </ContextMenu.Positioner>
              </ContextMenu.Portal>
            </ContextMenu.Root>
          </ReactFlowProvider>
        </div>
      </div>
    </div>
  );
};

export default TerrainEditor;

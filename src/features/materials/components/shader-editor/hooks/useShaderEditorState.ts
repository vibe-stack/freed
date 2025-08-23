"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import type { ReactFlowInstance, Edge, Node, Connection } from '@xyflow/react';
import { nanoid } from 'nanoid';
import { useGeometryStore } from '@/stores/geometry-store';
import type { ShaderGraph, ShaderNode as SNode, ShaderEdge as SEdge, ShaderNodeType } from '@/types/shader';
import * as ShaderTypes from '@/types/shader';

export function useShaderEditorState(seMaterialIdProp: string | undefined) {
  const [materialId, setMaterialId] = useState<string | undefined>(seMaterialIdProp);
  const materialsMap = useGeometryStore((s) => s.materials);
  const ensureDefaultGraph = useGeometryStore((s) => s.ensureDefaultGraph);
  const updateShaderGraph = useGeometryStore((s) => s.updateShaderGraph);
  const graph = useGeometryStore((s) => (materialId ? s.shaderGraphs.get(materialId) : undefined));
  const [rf, setRf] = useState<ReactFlowInstance | null>(null);

  useEffect(() => {
    if (!materialId) {
      const first = Array.from(materialsMap.keys())[0];
      if (first) setMaterialId(first);
    }
  }, [materialsMap, materialId]);

  useEffect(() => {
    if (materialId) ensureDefaultGraph(materialId);
  }, [materialId, ensureDefaultGraph]);

  const { defaultNodes, defaultEdges } = useMemo(() => {
    if (!graph || !materialId) return { defaultNodes: [] as Node[], defaultEdges: [] as Edge[] };
    const rfNodes: Node[] = graph.nodes.map((n) => ({
      id: n.id,
      position: n.position as any,
      type: n.type as any,
      data: { materialId },
      dragHandle: '.rf-drag',
      draggable: true,
      deletable: n.type !== 'input' && n.type !== 'output',
    }));
    const rfEdges: Edge[] = graph.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
    }));
    return { defaultNodes: rfNodes, defaultEdges: rfEdges };
  }, [graph?.nodes, graph?.edges, materialId]);

  const graphNodes = useMemo(() => graph?.nodes || [], [graph?.nodes]);
  const defaultEdgeOptions = useMemo(() => ({ animated: true }), []);

  // Connect logic reused by validators
  const onConnect = useCallback((c: Connection) => {
    if (!materialId) return;
    const rfNodes = rf?.getNodes?.() ?? [];
    const fromRf = rfNodes.find((n) => n.id === c.source);
    const toRf = rfNodes.find((n) => n.id === c.target);
    const from = fromRf ? ({ id: fromRf.id, type: fromRf.type } as any) : graphNodes.find((n) => n.id === c.source);
    const to = toRf ? ({ id: toRf.id, type: toRf.type } as any) : graphNodes.find((n) => n.id === c.target);
    if (!from || !to || !c.sourceHandle || !c.targetHandle) return;
    let outType = (ShaderTypes.NodeOutputs as any)[from.type]?.[c.sourceHandle as string] as ShaderTypes.SocketType | undefined;
    const dynamicMath = new Set(['add','sub','mul','div','mod','mix']);
    if ((!outType || outType === 'float') && dynamicMath.has((from as any).type)) {
      const dimOf = (t?: ShaderTypes.SocketType) => (t === 'vec4' ? 4 : t === 'vec3' ? 3 : t === 'vec2' ? 2 : t === 'float' ? 1 : 0);
      const edges = graph?.edges ?? [];
      const incoming = edges.filter((e) => e.target === (from as any).id && (e.targetHandle === 'a' || e.targetHandle === 'b'));
      let maxDim = 1;
      for (const e of incoming) {
        const srcNode = graphNodes.find((n) => n.id === e.source) || ((rfNodes.find((n) => n.id === e.source)) ? { type: (rfNodes.find((n) => n.id === e.source) as any).type } as any : undefined);
        const srcOutT = srcNode ? (ShaderTypes.NodeOutputs as any)[(srcNode as any).type]?.[e.sourceHandle as string] as ShaderTypes.SocketType | undefined : undefined;
        maxDim = Math.max(maxDim, dimOf(srcOutT));
      }
      outType = maxDim >= 4 ? 'vec4' : maxDim === 3 ? 'vec3' : maxDim === 2 ? 'vec2' : 'float';
    }
    const inType = (ShaderTypes.NodeInputs as any)[to.type]?.[c.targetHandle as string] as ShaderTypes.SocketType | undefined;
    if (!outType || !inType) return;
    if (!ShaderTypes.isCompatible(outType, inType)) return;
    const edge = { id: nanoid(), source: c.source!, sourceHandle: c.sourceHandle!, target: c.target!, targetHandle: c.targetHandle! } as SEdge;
    setTimeout(() => {
      if (!rf) return;
      const existing = rf.getEdges().filter((e) => e.target === edge.target && (e as any).targetHandle === edge.targetHandle);
      if (existing.length) {
        rf.setEdges((eds) => eds.filter((e) => !(e.target === edge.target && (e as any).targetHandle === edge.targetHandle)));
      }
      rf.addEdges([{ id: edge.id, source: edge.source, target: edge.target, sourceHandle: edge.sourceHandle, targetHandle: edge.targetHandle } as any]);
    }, 0);
    updateShaderGraph(materialId, (g) => {
      g.edges = g.edges.filter((e) => !(e.target === edge.target && e.targetHandle === edge.targetHandle));
      g.edges = [...g.edges, edge];
    });
  }, [materialId, graphNodes, updateShaderGraph, rf, graph?.edges]);

  const isValidConnection = useCallback((connection: Edge | Connection) => {
    const rfNodes = rf?.getNodes?.() ?? [];
    const getNode = (id?: string | null) => {
      if (!id) return undefined;
      const rfn = rfNodes.find((n) => n.id === id);
      return rfn ? ({ id: rfn.id, type: rfn.type } as any) : graphNodes.find((n) => n.id === id);
    };
    const from = getNode(connection.source as any);
    const to = getNode(connection.target as any);
    if (!from || !to || !connection.sourceHandle || !connection.targetHandle) return true;
    let outType = (ShaderTypes.NodeOutputs as any)[from.type]?.[connection.sourceHandle as string] as ShaderTypes.SocketType | undefined;
    const dynamicMath = new Set(['add','sub','mul','div','mod','mix']);
    if ((!outType || outType === 'float') && dynamicMath.has(from.type as any)) {
      const edges = graph?.edges ?? [];
      const incoming = edges.filter((e) => e.target === (from as any).id && (e.targetHandle === 'a' || e.targetHandle === 'b'));
      const dimOf = (t?: ShaderTypes.SocketType) => (t === 'vec4' ? 4 : t === 'vec3' ? 3 : t === 'vec2' ? 2 : t === 'float' ? 1 : 0);
      let maxDim = 1;
      for (const e of incoming) {
        const srcNode = getNode(e.source);
        const srcOutT = srcNode ? (ShaderTypes.NodeOutputs as any)[srcNode.type]?.[e.sourceHandle as string] as ShaderTypes.SocketType | undefined : undefined;
        maxDim = Math.max(maxDim, dimOf(srcOutT));
      }
      outType = maxDim >= 4 ? 'vec4' : maxDim === 3 ? 'vec3' : maxDim === 2 ? 'vec2' : 'float';
    }
    const inType = (ShaderTypes.NodeInputs as any)[to.type]?.[connection.targetHandle as string] as ShaderTypes.SocketType | undefined;
    if (!outType || !inType) return false;
    return ShaderTypes.isCompatible(outType, inType);
  }, [graphNodes, rf, graph?.edges]);

  return {
    materialId,
    setMaterialId,
    materialsMap,
    graph,
    rf,
    setRf,
    defaultNodes,
    defaultEdges,
    defaultEdgeOptions,
    graphNodes,
    onConnect,
    isValidConnection,
    updateShaderGraph,
  };
}

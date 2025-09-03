"use client";

import { useCallback, useRef } from 'react';
import { nanoid as nano } from 'nanoid';
import type { EdgeChange, NodeChange, ReactFlowInstance } from '@xyflow/react';
import type { ShaderNode as SNode } from '@/types/shader';

export function useNodeEdgeChanges(
  materialId: string | undefined,
  graphNodes: SNode[],
  updateShaderGraph: (materialId: string, updater: (g: any) => void) => void,
  rf: ReactFlowInstance | null
) {
  const rAF = useRef<number | null>(null);
  const pendingPositions = useRef<Map<string, { x: number; y: number }>>(new Map());

  const flushPositions = useCallback(() => {
    if (!materialId || pendingPositions.current.size === 0) return;
    const updates = Array.from(pendingPositions.current.entries());
    pendingPositions.current.clear();
    updateShaderGraph(materialId, (g) => {
      for (const [id, pos] of updates) {
        const n = g.nodes.find((nn: SNode) => nn.id === id);
        if (n) n.position = { x: pos.x, y: pos.y } as any;
      }
    });
  }, [materialId, updateShaderGraph]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    if (!materialId) return;
    const filtered = changes.filter((ch: any) => {
      if (ch.type !== 'remove') return true;
      const id = ch.id; if (!id) return true;
      const node = graphNodes.find((n) => n.id === id);
      if (!node) return true;
      return node.type !== 'input' && node.type !== 'output' && node.type !== 'output-standard' && node.type !== 'output-physical' && node.type !== 'output-phong' && node.type !== 'output-toon';
    });
    const posChanges = filtered.filter((ch: any) => ch.type === 'position' && ch.id && ch.position) as any[];
    for (const ch of posChanges) {
      pendingPositions.current.set(ch.id, { x: ch.position.x, y: ch.position.y });
    }
    if (posChanges.length) {
      const anyEnded = posChanges.some((ch: any) => ch.dragging === false);
      if (anyEnded) {
        flushPositions();
      } else {
        if (rAF.current) cancelAnimationFrame(rAF.current);
        rAF.current = requestAnimationFrame(() => {
          rAF.current = null;
          flushPositions();
        });
      }
    }
    // Handle removals immediately
    updateShaderGraph(materialId, (g) => {
      filtered.forEach((ch: any) => {
        if (ch.type === 'remove' && ch.id) {
          const n = g.nodes.find((nn: SNode) => nn.id === ch.id);
          if (!n) return;
          if (n.type === 'input' || n.type === 'output' || n.type === 'output-standard' || n.type === 'output-physical' || n.type === 'output-phong' || n.type === 'output-toon') return;
          g.nodes = g.nodes.filter((nn: SNode) => nn.id !== ch.id);
          g.edges = g.edges.filter((e: any) => e.source !== ch.id && e.target !== ch.id);
        }
      });
    });
    const removedIds = new Set(changes.filter((c) => c.type === 'remove').map((c: any) => c.id as string));
    if (removedIds.size && rf) {
      rf.setNodes((nds) => nds.filter((n) => !removedIds.has(n.id)) as any);
      rf.setEdges((eds) => eds.filter((e) => !removedIds.has(e.source) && !removedIds.has(e.target)) as any);
    }
  }, [flushPositions, materialId, updateShaderGraph, graphNodes, rf]);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    if (!materialId) return;
    updateShaderGraph(materialId, (g) => {
      const removedIds = new Set(changes.filter((c) => c.type === 'remove').map((c) => (c as any).id as string));
      if (removedIds.size > 0) {
        g.edges = g.edges.filter((e: any) => !removedIds.has(e.id));
      }
    });
    const removedIds = new Set(changes.filter((c) => c.type === 'remove').map((c: any) => c.id as string));
    if (removedIds.size && rf) {
      rf.setEdges((eds) => eds.filter((e) => !removedIds.has(e.id)) as any);
    }
  }, [materialId, updateShaderGraph, rf]);

  return { onNodesChange, onEdgesChange };
}

export function useSelectionClipboard(
  materialId: string | undefined,
  graph: any,
  rf: ReactFlowInstance | null,
  updateShaderGraph: (materialId: string, updater: (g: any) => void) => void
) {
  const seClipboardRef = useRef<{ nodes: any[]; edges: any[] } | null>(null);

  const getSelectedIds = useCallback(() => {
    const nodes = rf?.getNodes() ?? [];
    const edges = rf?.getEdges() ?? [];
    const selNodeIds = new Set(nodes.filter((n) => (n as any).selected).map((n) => n.id));
    const selEdgeIds = new Set(edges.filter((e) => (e as any).selected).map((e) => e.id));
    return { selNodeIds, selEdgeIds };
  }, [rf]);

  const copySelection = useCallback(() => {
    if (!materialId || !graph) return;
    const { selNodeIds } = getSelectedIds();
    if (selNodeIds.size === 0) { seClipboardRef.current = null; return; }
    const allowedNodes = graph.nodes.filter((n: any) => selNodeIds.has(n.id) && !['input', 'output', 'output-standard', 'output-physical', 'output-phong', 'output-toon'].includes(n.type));
    if (allowedNodes.length === 0) { seClipboardRef.current = null; return; }
    const allowedIds = new Set(allowedNodes.map((n: any) => n.id));
    const internalEdges = graph.edges.filter((e: any) => allowedIds.has(e.source) && allowedIds.has(e.target));
    seClipboardRef.current = {
      nodes: JSON.parse(JSON.stringify(allowedNodes)),
      edges: JSON.parse(JSON.stringify(internalEdges)),
    };
  }, [materialId, graph, getSelectedIds]);

  const deleteSelection = useCallback(() => {
    if (!materialId || !graph) return;
    const { selNodeIds, selEdgeIds } = getSelectedIds();
    if (selNodeIds.size === 0 && selEdgeIds.size === 0) return;
    updateShaderGraph(materialId, (g) => {
      if (selEdgeIds.size) {
        g.edges = g.edges.filter((e: any) => !selEdgeIds.has(e.id));
      }
      if (selNodeIds.size) {
        const canDelete = (n: any) => !['input', 'output', 'output-standard', 'output-physical', 'output-phong', 'output-toon'].includes(n.type);
        const removing = new Set(g.nodes.filter((n: any) => selNodeIds.has(n.id) && canDelete(n)).map((n: any) => n.id));
        if (removing.size) {
          g.nodes = g.nodes.filter((n: any) => !removing.has(n.id));
          g.edges = g.edges.filter((e: any) => !removing.has(e.source) && !removing.has(e.target));
        }
      }
    });
    if (rf) {
      if (selEdgeIds.size) rf.setEdges((eds) => eds.filter((e) => !selEdgeIds.has(e.id)) as any);
      if (selNodeIds.size) rf.setNodes((nds) => nds.filter((n) => !selNodeIds.has(n.id)) as any);
    }
  }, [materialId, graph, getSelectedIds, updateShaderGraph, rf]);

  const pasteClipboard = useCallback(() => {
    if (!materialId || !graph) return;
    const clip = seClipboardRef.current;
    if (!clip || clip.nodes.length === 0) return;
    const idMap = new Map<string, string>();
    const offset = { x: 24, y: 24 };
    const newNodes = clip.nodes.map((n: any) => {
      const newId = nano();
      idMap.set(n.id, newId);
      const pos = n.position || { x: 0, y: 0 };
      const cloned = { ...n, id: newId, position: { x: pos.x + offset.x, y: pos.y + offset.y } };
      return JSON.parse(JSON.stringify(cloned));
    });
    const newEdges = clip.edges
      .map((e: any) => {
        const s = idMap.get(e.source);
        const t = idMap.get(e.target);
        if (!s || !t) return null;
        return { id: nano(), source: s, target: t, sourceHandle: e.sourceHandle, targetHandle: e.targetHandle };
      })
      .filter(Boolean) as any[];

    updateShaderGraph(materialId, (g) => {
      g.nodes = [...g.nodes, ...newNodes];
      g.edges = [...g.edges, ...newEdges];
    });
    if (rf) {
      rf.addNodes(newNodes.map((n: any) => ({ id: n.id, type: n.type as any, position: n.position as any, data: { materialId }, dragHandle: '.rf-drag', draggable: true } as any)));
      if (newEdges.length) rf.addEdges(newEdges.map((e: any) => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle, targetHandle: e.targetHandle } as any)));
      setTimeout(() => {
        try { (rf as any).updateNodeInternals?.(newNodes.map((n: any) => n.id)); } catch {}
      }, 0);
    }
  }, [materialId, graph, updateShaderGraph, rf]);

  return { copySelection, deleteSelection, pasteClipboard, getSelectedIds };
}

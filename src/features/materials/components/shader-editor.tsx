"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ReactFlow, Background, Controls, MiniMap, ReactFlowProvider, type Edge, type Node, type OnConnect, type Connection, type NodeChange, type EdgeChange, type ReactFlowInstance, NodeTypes, ConnectionMode } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { nanoid } from 'nanoid';
import { useGeometryStore } from '@/stores/geometry-store';
import type { ShaderGraph, ShaderNode as SNode, ShaderEdge as SEdge, ShaderNodeType } from '@/types/shader';
import * as ShaderTypes from '@/types/shader';
import { ContextMenu } from '@base-ui-components/react/context-menu';
import { ShaderContextMenuContent } from './shader-context-menu';
import { useShaderEditorStore } from '@/stores/shader-editor-store';
import { ShaderFlowNode } from './node';

type Props = { open: boolean; onOpenChange: (v: boolean) => void };

// We pass through store graph data directly; RF nodes use shader node types as their `type` and
// minimal data carries only the materialId. The node component reads the full node from the store by id.




export const ShaderEditor: React.FC<Props> = ({ open, onOpenChange }) => {
    // Prefer global store if present to sync with inspector
    const seOpen = useShaderEditorStore((s) => s.open);
    const setSeOpen = useShaderEditorStore((s) => s.setOpen);
    const seMaterialId = useShaderEditorStore((s) => s.materialId);
    const setSeMaterialId = useShaderEditorStore((s) => s.setMaterialId);
    const effectiveOpen = seOpen ?? open;
    const [materialId, setMaterialId] = useState<string | undefined>(seMaterialId);
    const materialsMap = useGeometryStore((s) => s.materials);
    const ensureDefaultGraph = useGeometryStore((s) => s.ensureDefaultGraph);
    const updateShaderGraph = useGeometryStore((s) => s.updateShaderGraph);
    const graph = useGeometryStore((s) => (materialId ? s.shaderGraphs.get(materialId) : undefined));
    const [rf, setRf] = useState<ReactFlowInstance | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
    const [cmPos, setCmPos] = useState<{ x: number; y: number } | null>(null);
    const [cmOpen, setCmOpen] = useState(false);

    useEffect(() => {
        if (seMaterialId !== undefined) setMaterialId(seMaterialId);
    }, [seMaterialId]);
    useEffect(() => {
        if (!materialId) {
            const first = Array.from(materialsMap.keys())[0];
            if (first) setMaterialId(first);
        }
    }, [materialsMap, materialId]);

    useEffect(() => {
        if (materialId) ensureDefaultGraph(materialId);
    }, [materialId, ensureDefaultGraph]);

    useEffect(() => {
        setPortalContainer(document.body);
    }, []);

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

    // Register the same component for all shader node types; RF will route by `type`
    const nodeTypes = useMemo(() => ({
        default: ShaderFlowNode,
        input: ShaderFlowNode,
        output: ShaderFlowNode,
        'const-float': ShaderFlowNode,
        'const-color': ShaderFlowNode,
        uv: ShaderFlowNode,
        normal: ShaderFlowNode,
        add: ShaderFlowNode,
        mul: ShaderFlowNode,
        mix: ShaderFlowNode,
    } as unknown as NodeTypes), []);

    // Optimize callbacks by memoizing on graph.nodes instead of entire graph
    const graphNodes = useMemo(() => graph?.nodes || [], [graph?.nodes]);

    // Memoize default edge options to prevent ReactFlow rerenders
    const defaultEdgeOptions = useMemo(() => ({ animated: true }), []);

    // Remove debug console.log to reduce render noise
    // console.log(edges, nodes)

    // Fit once on init via onInit; avoid repeated fitView calls that can cause constant rerenders

    const onConnect: OnConnect = useCallback((c: Connection) => {
        // Remove debug console.log to reduce render noise
        // console.log("connecting", materialId)
        if (!materialId) return;
        const from = graphNodes.find((n) => n.id === c.source);
        const to = graphNodes.find((n) => n.id === c.target);
        // console.log("connecting 2", from, to, c.sourceHandle, c.targetHandle);
        if (!from || !to || !c.sourceHandle || !c.targetHandle) return;
        const outType = (ShaderTypes.NodeOutputs as any)[from.type]?.[c.sourceHandle as string] as ShaderTypes.SocketType | undefined;
        const inType = (ShaderTypes.NodeInputs as any)[to.type]?.[c.targetHandle as string] as ShaderTypes.SocketType | undefined;
        // console.log("connecting 3", outType, inType);
        if (!outType || !inType) return;
        // console.log("connecting 4", ShaderTypes.isCompatible(outType, inType));
        if (!ShaderTypes.isCompatible(outType, inType)) return;
        const edge = { id: nanoid(), source: c.source!, sourceHandle: c.sourceHandle!, target: c.target!, targetHandle: c.targetHandle! } as SEdge;
        // Enforce single incoming connection per target handle in both RF internal state and store
        setTimeout(() => {
            setRf((inst) => {
                if (!inst) return inst;
                const existing = inst.getEdges().filter((e) => e.target === edge.target && (e as any).targetHandle === edge.targetHandle);
                if (existing.length) {
                    inst.setEdges((eds) => eds.filter((e) => !(e.target === edge.target && (e as any).targetHandle === edge.targetHandle)));
                }
                inst.addEdges([{ id: edge.id, source: edge.source, target: edge.target, sourceHandle: edge.sourceHandle, targetHandle: edge.targetHandle } as any]);
                return inst;
            });
        }, 0);
        updateShaderGraph(materialId, (g) => {
            g.edges = g.edges.filter((e) => !(e.target === edge.target && e.targetHandle === edge.targetHandle));
            g.edges = [...g.edges, edge];
        });
    }, [materialId, graphNodes, updateShaderGraph]);

    // Optimize isValidConnection by memoizing on graph.nodes instead of entire graph
    
    const isValidConnection = useCallback((connection: Edge | Connection) => {
        // Remove debug console.log to reduce render noise
        // console.log("isvalid", graph)
        if (!graphNodes.length) return true; // don't block drag start
        const from = connection.source ? graphNodes.find((n) => n.id === connection.source) : undefined;
        const to = connection.target ? graphNodes.find((n) => n.id === connection.target) : undefined;
        // be permissive until both ends and handles are known
        // console.log("isvalid 2", from, to, connection.sourceHandle, connection.targetHandle)
        if (!from || !to || !connection.sourceHandle || !connection.targetHandle) return true;
        const outType = (ShaderTypes.NodeOutputs as any)[from.type]?.[connection.sourceHandle as string] as ShaderTypes.SocketType | undefined;
        const inType = (ShaderTypes.NodeInputs as any)[to.type]?.[connection.targetHandle as string] as ShaderTypes.SocketType | undefined;
        // console.log("isvalid 3", outType, inType)
        if (!outType || !inType) return false;
        return ShaderTypes.isCompatible(outType, inType);
    }, [graphNodes]);

    const onNodesChange = useCallback((changes: NodeChange[]) => {
        if (!materialId) return;
        // Prevent deletion of input/output nodes
        const filtered = changes.filter((ch: any) => {
            if (ch.type !== 'remove') return true;
            const id = ch.id; if (!id) return true;
            const node = graphNodes.find((n) => n.id === id);
            if (!node) return true;
            return node.type !== 'input' && node.type !== 'output';
        });
        updateShaderGraph(materialId, (g) => {
            filtered.forEach((ch: any) => {
                if (ch.type === 'position' && ch.id && ch.position) {
                    const n = g.nodes.find((nn) => nn.id === ch.id);
                    if (n) n.position = { x: ch.position.x, y: ch.position.y };
                }
                if (ch.type === 'remove' && ch.id) {
                    const n = g.nodes.find((nn) => nn.id === ch.id);
                    if (!n) return;
                    if (n.type === 'input' || n.type === 'output') return; // hard block
                    g.nodes = g.nodes.filter((nn) => nn.id !== ch.id);
                    g.edges = g.edges.filter((e) => e.source !== ch.id && e.target !== ch.id);
                }
            });
        });
        // Reflect removals in RF instance (uncontrolled still needs syncing for removals added via store)
        const removedIds = new Set(changes.filter((c) => c.type === 'remove').map((c: any) => c.id as string));
        if (removedIds.size && rf) {
            rf.setNodes((nds) => nds.filter((n) => !removedIds.has(n.id)) as any);
            rf.setEdges((eds) => eds.filter((e) => !removedIds.has(e.source) && !removedIds.has(e.target)) as any);
        }
    }, [materialId, updateShaderGraph, graphNodes]);

    const onEdgesChange = useCallback((changes: EdgeChange[]) => {
        if (!materialId) return;
        updateShaderGraph(materialId, (g) => {
            const removedIds = new Set(changes.filter((c) => c.type === 'remove').map((c) => (c as any).id as string));
            if (removedIds.size > 0) {
                g.edges = g.edges.filter((e) => !removedIds.has(e.id));
            }
        });
        // Update RF instance too
        const removedIds = new Set(changes.filter((c) => c.type === 'remove').map((c: any) => c.id as string));
        if (removedIds.size && rf) {
            rf.setEdges((eds) => eds.filter((e) => !removedIds.has(e.id)) as any);
        }
    }, [materialId, updateShaderGraph]);

    const addNodeAt = (type: ShaderNodeType, clientPos?: { x: number; y: number } | null) => {
        if (!materialId) return;
        const id = nanoid();
        const basePos = clientPos && rf?.screenToFlowPosition ? rf.screenToFlowPosition(clientPos) : ({ x: 220, y: 120 } as any);
        const node: SNode =
            type === 'const-float' ? ({ id, type, position: basePos as any, data: { value: 1 } } as any) :
                type === 'const-color' ? ({ id, type, position: basePos as any, data: { r: 1, g: 1, b: 1 } } as any) :
                    ({ id, type, position: basePos as any } as any);
        // Update RF internal state immediately
        if (rf) {
            rf.addNodes([{ id, type: type as any, position: basePos as any, data: { materialId }, dragHandle: '.rf-drag', draggable: true } as any]);
        }
        // Persist in store
        updateShaderGraph(materialId, (g) => { g.nodes = [...g.nodes, node]; });
    };

    const onPaneContextMenu: React.MouseEventHandler = (e) => {
        e.preventDefault();
        setCmPos({ x: e.clientX, y: e.clientY });
        setCmOpen(true);
    };

    if (!effectiveOpen) return null;
    return (
        <div className="absolute inset-x-0 bottom-0 h-1/2 z-30 pointer-events-auto">
            <div className="mx-4 mb-4 h-[calc(100%-1rem)] rounded-lg border border-white/10 bg-[#0b0e13]/70 backdrop-blur-md shadow-xl overflow-hidden">
                <div className="h-9 flex items-center justify-between px-3 border-b border-white/10 text-xs text-gray-300">
                    <div className="flex items-center gap-2">
                        <span className="uppercase tracking-wide text-[11px] text-gray-400">Shader Editor</span>
                        <select
                            className="bg-transparent border border-white/10 rounded px-2 py-1 text-gray-200"
                            value={materialId ?? ''}
                            onChange={(e) => { const v = e.target.value || undefined; setMaterialId(v); setSeMaterialId(v); }}
                        >
                            <option value="">Select Material…</option>
                            {Array.from(materialsMap.values()).map((m: any) => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex items-center gap-1">
                        <button className="px-2 py-1 rounded border border-white/10 text-gray-200 hover:bg-white/10" onClick={() => { setSeOpen(false); onOpenChange(false); }}>Close</button>
                    </div>
                </div>
                <div className="h-[calc(100%-36px)]" ref={containerRef}>
                    <ReactFlowProvider>
                        <ContextMenu.Root open={cmOpen} onOpenChange={setCmOpen}>
                            <div className="block h-full shader-flow-root" onContextMenu={onPaneContextMenu}>
                                <ReactFlow
                                    key={materialId || 'no-material'}
                                    defaultNodes={defaultNodes}
                                    defaultEdges={defaultEdges}
                                    nodeTypes={nodeTypes}
                                    nodesConnectable
                                    elementsSelectable
                                    nodesDraggable
                                    defaultEdgeOptions={defaultEdgeOptions}
                                    edgesReconnectable
                                    onNodesChange={onNodesChange}
                                    onEdgesChange={onEdgesChange}
                                    onConnect={onConnect}
                                    isValidConnection={isValidConnection}
                                    connectionMode={ConnectionMode.Loose}
                                    onInit={(instance) => setRf(instance)}
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
                                        className="z-[9999] min-w-48 rounded-md border border-white/10 bg-zinc-900/90 p-1 text-sm text-gray-200 shadow-lg shadow-black/40 relative"
                                        style={{ position: 'fixed', zIndex: 9999, left: cmPos?.x, top: cmPos?.y }}
                                    >
                                        <ShaderContextMenuContent onAdd={(t) => { addNodeAt(t, cmPos); setCmOpen(false); }} />
                                    </ContextMenu.Popup>
                                </ContextMenu.Positioner>
                            </ContextMenu.Portal>
                        </ContextMenu.Root>
                    </ReactFlowProvider>
                    {/* Aggressive override to ensure RF never hides nodes */}
                    <style jsx global>{`
            .shader-flow-root .react-flow,
            .shader-flow-root .react-flow *,
            .shader-flow-root .react-flow__renderer,
            .shader-flow-root .react-flow__nodes,
            .shader-flow-root .react-flow__node,
            .shader-flow-root .react-flow__edges,
            .shader-flow-root .react-flow__edge,
            .shader-flow-root .react-flow__edge-path {
              visibility: visible !important;
              opacity: 1 !important;
            }
            .shader-flow-root .react-flow,
            .shader-flow-root .react-flow__pane,
            .shader-flow-root .react-flow__viewport,
            .shader-flow-root .react-flow__background {
              background: transparent !important;
            }
                        /* Ensure all node wrappers are transparent and unstyled */
                        .shader-flow-root .react-flow__node,
                        .shader-flow-root .react-flow__node-default,
                        .shader-flow-root .react-flow__node-input,
                        .shader-flow-root .react-flow__node-output,
                        .shader-flow-root .react-flow__node-const-float,
                        .shader-flow-root .react-flow__node-const-color,
                        .shader-flow-root .react-flow__node-uv,
                        .shader-flow-root .react-flow__node-normal,
                        .shader-flow-root .react-flow__node-add,
                        .shader-flow-root .react-flow__node-mul,
                        .shader-flow-root .react-flow__node-mix {
              background: transparent !important;
              border: none !important;
              box-shadow: none !important;
            }
          `}</style>
                </div>
            </div>
        </div>
    );
};

export default ShaderEditor;

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
import { useRegisterShortcuts } from '@/components/shortcut-provider';

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
    const [cmFlipX, setCmFlipX] = useState(false);
    const [cmFlipY, setCmFlipY] = useState(false);
    // Local clipboard scoped to shader editor (nodes + internal edges)
    const seClipboardRef = useRef<{ nodes: SNode[]; edges: SEdge[] } | null>(null);
    // Track whether pointer is inside the editor to scope key handling
    const pointerInsideRef = useRef(false);

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
    'output-standard': ShaderFlowNode,
    'output-physical': ShaderFlowNode,
    'output-phong': ShaderFlowNode,
    'output-toon': ShaderFlowNode,
        'const-float': ShaderFlowNode,
        'const-color': ShaderFlowNode,
        uv: ShaderFlowNode,
        normal: ShaderFlowNode,
        add: ShaderFlowNode,
    sub: ShaderFlowNode,
        mul: ShaderFlowNode,
    div: ShaderFlowNode,
    assign: ShaderFlowNode,
    mod: ShaderFlowNode,
    equal: ShaderFlowNode,
    notEqual: ShaderFlowNode,
    lessThan: ShaderFlowNode,
    greaterThan: ShaderFlowNode,
    lessThanEqual: ShaderFlowNode,
    greaterThanEqual: ShaderFlowNode,
    and: ShaderFlowNode,
    or: ShaderFlowNode,
    not: ShaderFlowNode,
    xor: ShaderFlowNode,
    bitAnd: ShaderFlowNode,
    bitNot: ShaderFlowNode,
    bitOr: ShaderFlowNode,
    bitXor: ShaderFlowNode,
    shiftLeft: ShaderFlowNode,
    shiftRight: ShaderFlowNode,
    oscSine: ShaderFlowNode,
    oscSquare: ShaderFlowNode,
    oscTriangle: ShaderFlowNode,
    oscSawtooth: ShaderFlowNode,
    modelDirection: ShaderFlowNode,
    modelViewMatrix: ShaderFlowNode,
    modelNormalMatrix: ShaderFlowNode,
    modelWorldMatrix: ShaderFlowNode,
    modelPosition: ShaderFlowNode,
    modelScale: ShaderFlowNode,
    modelViewPosition: ShaderFlowNode,
    modelWorldMatrixInverse: ShaderFlowNode,
    highpModelViewMatrix: ShaderFlowNode,
    highpModelNormalViewMatrix: ShaderFlowNode,
    mix: ShaderFlowNode,
    // common
    abs: ShaderFlowNode,
    floor: ShaderFlowNode,
    ceil: ShaderFlowNode,
    clamp: ShaderFlowNode,
    saturate: ShaderFlowNode,
    min: ShaderFlowNode,
    max: ShaderFlowNode,
    step: ShaderFlowNode,
    smoothstep: ShaderFlowNode,
    pow: ShaderFlowNode,
    exp: ShaderFlowNode,
    log: ShaderFlowNode,
    sqrt: ShaderFlowNode,
    sign: ShaderFlowNode,
    fract: ShaderFlowNode,
    length: ShaderFlowNode,
    normalize: ShaderFlowNode,
    dot: ShaderFlowNode,
    cross: ShaderFlowNode,
    distance: ShaderFlowNode,
    // trig
    sin: ShaderFlowNode,
    cos: ShaderFlowNode,
    tan: ShaderFlowNode,
    asin: ShaderFlowNode,
    acos: ShaderFlowNode,
    atan: ShaderFlowNode,
    // vectors
    vec2: ShaderFlowNode,
    vec3: ShaderFlowNode,
    vec4: ShaderFlowNode,
    swizzle: ShaderFlowNode,
    combine: ShaderFlowNode,
    // attributes
    positionAttr: ShaderFlowNode,
    normalAttr: ShaderFlowNode,
    uvAttr: ShaderFlowNode,
    viewPosition: ShaderFlowNode,
    worldPosition: ShaderFlowNode,
    cameraPosition: ShaderFlowNode,
    // time
    time: ShaderFlowNode,
    timeSine: ShaderFlowNode,
    timeCos: ShaderFlowNode,
    // conditionals
    select: ShaderFlowNode,
    // camera
    cameraNear: ShaderFlowNode,
    cameraFar: ShaderFlowNode,
    cameraProjectionMatrix: ShaderFlowNode,
    cameraProjectionMatrixInverse: ShaderFlowNode,
    cameraViewMatrix: ShaderFlowNode,
    cameraWorldMatrix: ShaderFlowNode,
    cameraNormalMatrix: ShaderFlowNode,
    // screen & viewport
    screenUV: ShaderFlowNode,
    screenCoordinate: ShaderFlowNode,
    screenSize: ShaderFlowNode,
    viewportUV: ShaderFlowNode,
    viewport: ShaderFlowNode,
    viewportCoordinate: ShaderFlowNode,
    viewportSize: ShaderFlowNode,
    // uv utils
    matcapUV: ShaderFlowNode,
    rotateUV: ShaderFlowNode,
    spherizeUV: ShaderFlowNode,
    spritesheetUV: ShaderFlowNode,
    equirectUV: ShaderFlowNode,
    // interpolation
    remap: ShaderFlowNode,
    remapClamp: ShaderFlowNode,
    // random
    hash: ShaderFlowNode,
    // rotate
    rotate: ShaderFlowNode,
    // blend modes
    blendBurn: ShaderFlowNode,
    blendDodge: ShaderFlowNode,
    blendOverlay: ShaderFlowNode,
    blendScreen: ShaderFlowNode,
    blendColor: ShaderFlowNode,
    // packing
    directionToColor: ShaderFlowNode,
    colorToDirection: ShaderFlowNode,
    // extra math / optics
    reflect: ShaderFlowNode,
    refract: ShaderFlowNode,
    round: ShaderFlowNode,
    trunc: ShaderFlowNode,
    inverseSqrt: ShaderFlowNode,
    degrees: ShaderFlowNode,
    radians: ShaderFlowNode,
    exp2: ShaderFlowNode,
    log2: ShaderFlowNode,
    lengthSq: ShaderFlowNode,
    oneMinus: ShaderFlowNode,
    pow2: ShaderFlowNode,
    pow3: ShaderFlowNode,
    pow4: ShaderFlowNode,
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

    // Debounce node position updates and only commit when interaction settles
    const rAF = useRef<number | null>(null);
    const pendingPositions = useRef<Map<string, { x: number; y: number }>>(new Map());
    const flushPositions = () => {
        if (!materialId || pendingPositions.current.size === 0) return;
        const updates = Array.from(pendingPositions.current.entries());
        pendingPositions.current.clear();
        updateShaderGraph(materialId, (g) => {
            for (const [id, pos] of updates) {
                const n = g.nodes.find((nn) => nn.id === id);
                if (n) n.position = { x: pos.x, y: pos.y } as any;
            }
        });
    };

    const onNodesChange = useCallback((changes: NodeChange[]) => {
        if (!materialId) return;
        // Prevent deletion of input/output nodes
        const filtered = changes.filter((ch: any) => {
            if (ch.type !== 'remove') return true;
            const id = ch.id; if (!id) return true;
            const node = graphNodes.find((n) => n.id === id);
            if (!node) return true;
            return node.type !== 'input' && node.type !== 'output' && node.type !== 'output-standard' && node.type !== 'output-physical' && node.type !== 'output-phong' && node.type !== 'output-toon';
        });
        // Use RAF to throttle many position updates
        const posChanges = filtered.filter((ch: any) => ch.type === 'position' && ch.id && ch.position) as any[];
        for (const ch of posChanges) {
            pendingPositions.current.set(ch.id, { x: ch.position.x, y: ch.position.y });
        }
        if (posChanges.length) {
            // If we have a signal that dragging ended, flush now; otherwise throttle via RAF
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
                    const n = g.nodes.find((nn) => nn.id === ch.id);
                    if (!n) return;
                    if (n.type === 'input' || n.type === 'output' || n.type === 'output-standard' || n.type === 'output-physical' || n.type === 'output-phong' || n.type === 'output-toon') return; // hard block
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

    // Toggle via shortcut: Shift+m to open/close
    useRegisterShortcuts([
        {
            key: 'm',
            shift: true,
            action: () => setSeOpen(!(seOpen ?? false)),
            description: 'Toggle Shader Editor (Shift+m)',
            preventDefault: true,
        },
    ]);

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

    // Helpers for selection and clipboard actions
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
        // Filter out disallowed types
        const allowedNodes = graph.nodes.filter((n) => selNodeIds.has(n.id) && !['input', 'output', 'output-standard', 'output-physical', 'output-phong', 'output-toon'].includes(n.type as any));
        if (allowedNodes.length === 0) { seClipboardRef.current = null; return; }
        const allowedIds = new Set(allowedNodes.map((n) => n.id));
        const internalEdges = graph.edges.filter((e) => allowedIds.has(e.source) && allowedIds.has(e.target));
        // Deep clone minimal
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
            // Remove edges first (selected ones)
            if (selEdgeIds.size) {
                g.edges = g.edges.filter((e) => !selEdgeIds.has(e.id));
            }
            if (selNodeIds.size) {
                const canDelete = (n: SNode) => !['input', 'output', 'output-standard', 'output-physical', 'output-phong', 'output-toon'].includes(n.type as any);
                const removing = new Set(g.nodes.filter((n) => selNodeIds.has(n.id) && canDelete(n)).map((n) => n.id));
                if (removing.size) {
                    g.nodes = g.nodes.filter((n) => !removing.has(n.id));
                    g.edges = g.edges.filter((e) => !removing.has(e.source) && !removing.has(e.target));
                }
            }
        });
        // Reflect in RF immediately
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
        const newNodes: SNode[] = clip.nodes.map((n) => {
            const newId = nanoid();
            idMap.set(n.id, newId);
            const pos = (n.position as any) || { x: 0, y: 0 };
            const cloned: SNode = { ...n, id: newId, position: { x: pos.x + offset.x, y: pos.y + offset.y } as any } as any;
            // keep data as-is for const nodes, etc.
            return JSON.parse(JSON.stringify(cloned));
        });
        const newEdges: SEdge[] = clip.edges
            .map((e) => {
                const s = idMap.get(e.source);
                const t = idMap.get(e.target);
                if (!s || !t) return null;
                return { id: nanoid(), source: s, target: t, sourceHandle: e.sourceHandle, targetHandle: e.targetHandle } as SEdge;
            })
            .filter(Boolean) as SEdge[];

        // Update store first
        updateShaderGraph(materialId, (g) => {
            g.nodes = [...g.nodes, ...newNodes];
            g.edges = [...g.edges, ...newEdges];
        });
        // Add to RF for immediate feedback
        if (rf) {
            rf.addNodes(newNodes.map((n) => ({ id: n.id, type: n.type as any, position: n.position as any, data: { materialId }, dragHandle: '.rf-drag', draggable: true } as any)));
            if (newEdges.length) rf.addEdges(newEdges.map((e) => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle, targetHandle: e.targetHandle } as any)));
        }
    }, [materialId, graph, updateShaderGraph, rf]);

    // Key handling scoped to shader editor
    useEffect(() => {
        if (!effectiveOpen) return;
        const root = containerRef.current;
        if (!root) return;
        const onEnter = () => { pointerInsideRef.current = true; };
        const onLeave = () => { pointerInsideRef.current = false; };
        root.addEventListener('pointerenter', onEnter);
        root.addEventListener('pointerleave', onLeave);

        const onKeyDown = (e: KeyboardEvent) => {
            // If the event target is inside our shader editor or the pointer is inside, handle it here
            const target = e.target as HTMLElement;
            const inside = !!(target && root.contains(target)) || pointerInsideRef.current;
            if (!inside) return;
            if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || (target as any).contentEditable === 'true')) return;

            const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
            const isMeta = e.metaKey || e.ctrlKey;

            if (isMeta && k === 'c') {
                e.preventDefault(); e.stopPropagation();
                copySelection();
                return;
            }
            if (isMeta && k === 'x') {
                e.preventDefault(); e.stopPropagation();
                copySelection();
                deleteSelection();
                return;
            }
            if (isMeta && k === 'v') {
                e.preventDefault(); e.stopPropagation();
                pasteClipboard();
                return;
            }
            if (k === 'Backspace' || k === 'Delete') {
                e.preventDefault(); e.stopPropagation();
                deleteSelection();
                return;
            }
        };
        document.addEventListener('keydown', onKeyDown, true);
        return () => {
            document.removeEventListener('keydown', onKeyDown, true);
            root.removeEventListener('pointerenter', onEnter);
            root.removeEventListener('pointerleave', onLeave);
        };
    }, [effectiveOpen, copySelection, deleteSelection, pasteClipboard]);

    const onPaneContextMenu: React.MouseEventHandler = (e) => {
        e.preventDefault();
        // Determine if we need to flip horizontally/vertically to keep within viewport
        const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
        const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
        const approxMenuW = 240; // px, rough min width
        const approxMenuH = Math.round(vh * 0.6); // matches h-[60vh]
        const willOverflowRight = vw - e.clientX < (approxMenuW + 16);
        const willOverflowBottom = vh - e.clientY < (approxMenuH + 16);
        setCmFlipX(willOverflowRight);
        setCmFlipY(willOverflowBottom);
        setCmPos({ x: e.clientX, y: e.clientY });
        setCmOpen(true);
    };

    if (!effectiveOpen) return null;
    return (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-0 z-30 pointer-events-auto w-[min(1100px,calc(100%-18rem))]">
            <div className="mx-auto mb-4 h-[calc(50vh-0.75rem)] rounded-lg border border-white/10 bg-[#0b0e13]/70 backdrop-blur-md shadow-xl overflow-hidden">
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
                                        className="z-[9999] min-w-48 rounded-md border border-white/10 bg-zinc-900/90 text-sm text-gray-200 shadow-lg shadow-black/40 relative overflow-hidden"
                                        style={{
                                            position: 'fixed',
                                            zIndex: 9999,
                                            left: (cmPos?.x ?? 0) + (cmFlipX ? -8 : 8),
                                            top: (cmPos?.y ?? 0) + (cmFlipY ? -8 : 8),
                                            transform: `translate(${cmFlipX ? '-100%' : '0'}, ${cmFlipY ? '-100%' : '0'})`
                                        }}
                                    >
                                            <div className="p-1 h-full max-h-72  overflow-y-auto overscroll-contain">
                                            <ShaderContextMenuContent onAdd={(t) => { addNodeAt(t, cmPos); setCmOpen(false); }} />
                                        </div>
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
                        .shader-flow-root .react-flow__node-output-standard,
                        .shader-flow-root .react-flow__node-output-physical,
                        .shader-flow-root .react-flow__node-const-float,
                        .shader-flow-root .react-flow__node-const-color,
                        .shader-flow-root .react-flow__node-uv,
                        .shader-flow-root .react-flow__node-normal,
                        .shader-flow-root .react-flow__node-add,
                        .shader-flow-root .react-flow__node-sub,
                        .shader-flow-root .react-flow__node-mul,
                        .shader-flow-root .react-flow__node-div,
                        .shader-flow-root .react-flow__node-assign,
                        .shader-flow-root .react-flow__node-mod,
                        .shader-flow-root .react-flow__node-equal,
                        .shader-flow-root .react-flow__node-notEqual,
                        .shader-flow-root .react-flow__node-lessThan,
                        .shader-flow-root .react-flow__node-greaterThan,
                        .shader-flow-root .react-flow__node-lessThanEqual,
                        .shader-flow-root .react-flow__node-greaterThanEqual,
                        .shader-flow-root .react-flow__node-and,
                        .shader-flow-root .react-flow__node-or,
                        .shader-flow-root .react-flow__node-not,
                        .shader-flow-root .react-flow__node-xor,
                        .shader-flow-root .react-flow__node-bitAnd,
                        .shader-flow-root .react-flow__node-bitNot,
                        .shader-flow-root .react-flow__node-bitOr,
                        .shader-flow-root .react-flow__node-bitXor,
                        .shader-flow-root .react-flow__node-shiftLeft,
                        .shader-flow-root .react-flow__node-shiftRight,
                        .shader-flow-root .react-flow__node-abs,
                        .shader-flow-root .react-flow__node-floor,
                        .shader-flow-root .react-flow__node-ceil,
                        .shader-flow-root .react-flow__node-clamp,
                        .shader-flow-root .react-flow__node-saturate,
                        .shader-flow-root .react-flow__node-min,
                        .shader-flow-root .react-flow__node-max,
                        .shader-flow-root .react-flow__node-step,
                        .shader-flow-root .react-flow__node-smoothstep,
                        .shader-flow-root .react-flow__node-pow,
                        .shader-flow-root .react-flow__node-exp,
                        .shader-flow-root .react-flow__node-log,
                        .shader-flow-root .react-flow__node-sqrt,
                        .shader-flow-root .react-flow__node-sign,
                        .shader-flow-root .react-flow__node-fract,
                        .shader-flow-root .react-flow__node-length,
                        .shader-flow-root .react-flow__node-normalize,
                        .shader-flow-root .react-flow__node-dot,
                        .shader-flow-root .react-flow__node-cross,
                        .shader-flow-root .react-flow__node-distance,
                        .shader-flow-root .react-flow__node-sin,
                        .shader-flow-root .react-flow__node-cos,
                        .shader-flow-root .react-flow__node-tan,
                        .shader-flow-root .react-flow__node-asin,
                        .shader-flow-root .react-flow__node-acos,
                        .shader-flow-root .react-flow__node-atan,
                        .shader-flow-root .react-flow__node-vec2,
                        .shader-flow-root .react-flow__node-vec3,
                        .shader-flow-root .react-flow__node-vec4,
                        .shader-flow-root .react-flow__node-swizzle,
                        .shader-flow-root .react-flow__node-combine,
                        .shader-flow-root .react-flow__node-positionAttr,
                        .shader-flow-root .react-flow__node-normalAttr,
                        .shader-flow-root .react-flow__node-uvAttr,
                        .shader-flow-root .react-flow__node-viewPosition,
                        .shader-flow-root .react-flow__node-worldPosition,
                        .shader-flow-root .react-flow__node-cameraPosition,
                        .shader-flow-root .react-flow__node-time,
                        .shader-flow-root .react-flow__node-timeSine,
                        .shader-flow-root .react-flow__node-timeCos,
                        .shader-flow-root .react-flow__node-oscSine,
                        .shader-flow-root .react-flow__node-oscSquare,
                        .shader-flow-root .react-flow__node-oscTriangle,
                        .shader-flow-root .react-flow__node-oscSawtooth,
                        .shader-flow-root .react-flow__node-modelDirection,
                        .shader-flow-root .react-flow__node-modelViewMatrix,
                        .shader-flow-root .react-flow__node-modelNormalMatrix,
                        .shader-flow-root .react-flow__node-modelWorldMatrix,
                        .shader-flow-root .react-flow__node-modelPosition,
                        .shader-flow-root .react-flow__node-modelScale,
                        .shader-flow-root .react-flow__node-modelViewPosition,
                        .shader-flow-root .react-flow__node-modelWorldMatrixInverse,
                        .shader-flow-root .react-flow__node-highpModelViewMatrix,
                        .shader-flow-root .react-flow__node-highpModelNormalViewMatrix,
                        .shader-flow-root .react-flow__node-mix,
                        .shader-flow-root .react-flow__node-select,
                        .shader-flow-root .react-flow__node-cameraNear,
                        .shader-flow-root .react-flow__node-cameraFar,
                        .shader-flow-root .react-flow__node-cameraProjectionMatrix,
                        .shader-flow-root .react-flow__node-cameraProjectionMatrixInverse,
                        .shader-flow-root .react-flow__node-cameraViewMatrix,
                        .shader-flow-root .react-flow__node-cameraWorldMatrix,
                        .shader-flow-root .react-flow__node-cameraNormalMatrix,
                        .shader-flow-root .react-flow__node-screenUV,
                        .shader-flow-root .react-flow__node-screenCoordinate,
                        .shader-flow-root .react-flow__node-screenSize,
                        .shader-flow-root .react-flow__node-viewportUV,
                        .shader-flow-root .react-flow__node-viewport,
                        .shader-flow-root .react-flow__node-viewportCoordinate,
                        .shader-flow-root .react-flow__node-viewportSize,
                        .shader-flow-root .react-flow__node-matcapUV,
                        .shader-flow-root .react-flow__node-rotateUV,
                        .shader-flow-root .react-flow__node-spherizeUV,
                        .shader-flow-root .react-flow__node-spritesheetUV,
                        .shader-flow-root .react-flow__node-equirectUV,
                        .shader-flow-root .react-flow__node-remap,
                        .shader-flow-root .react-flow__node-remapClamp,
                        .shader-flow-root .react-flow__node-hash,
                        .shader-flow-root .react-flow__node-rotate,
                        .shader-flow-root .react-flow__node-blendBurn,
                        .shader-flow-root .react-flow__node-blendDodge,
                        .shader-flow-root .react-flow__node-blendOverlay,
                        .shader-flow-root .react-flow__node-blendScreen,
                        .shader-flow-root .react-flow__node-blendColor,
                        .shader-flow-root .react-flow__node-directionToColor,
                        .shader-flow-root .react-flow__node-colorToDirection,
                        .shader-flow-root .react-flow__node-reflect,
                        .shader-flow-root .react-flow__node-refract,
                        .shader-flow-root .react-flow__node-round,
                        .shader-flow-root .react-flow__node-trunc,
                        .shader-flow-root .react-flow__node-inverseSqrt,
                        .shader-flow-root .react-flow__node-degrees,
                        .shader-flow-root .react-flow__node-radians,
                        .shader-flow-root .react-flow__node-exp2,
                        .shader-flow-root .react-flow__node-log2,
                        .shader-flow-root .react-flow__node-lengthSq,
                        .shader-flow-root .react-flow__node-oneMinus,
                        .shader-flow-root .react-flow__node-pow2,
                        .shader-flow-root .react-flow__node-pow3,
                        .shader-flow-root .react-flow__node-pow4 {
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

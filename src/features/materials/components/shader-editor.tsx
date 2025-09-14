"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ReactFlow, Background, Controls, MiniMap, ReactFlowProvider, NodeTypes, ConnectionMode } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useGeometryStore } from '@/stores/geometry-store';
import { nanoid } from 'nanoid';
import type { ShaderNodeType } from '@/types/shader';
import { ContextMenu } from '@base-ui-components/react/context-menu';
import { ShaderContextMenuContent } from './shader-context-menu';
import { useShaderEditorStore } from '@/stores/shader-editor-store';
import { ShaderFlowNode } from './node';
import { useRegisterShortcuts } from '@/components/shortcut-provider';
import { useShaderEditorState } from './shader-editor/hooks/useShaderEditorState';
import { useNodeEdgeChanges, useSelectionClipboard } from './shader-editor/hooks/useFlowInteractions';
import { useShaderEditorHotkeys } from './shader-editor/hooks/useShaderEditorHotkeys';
import EditorHeader from './shader-editor/components/EditorHeader';

type Props = { open: boolean; onOpenChange: (v: boolean) => void };

// We pass through store graph data directly; RF nodes use shader node types as their `type` and
// minimal data carries only the materialId. The node component reads the full node from the store by id.

export const ShaderEditor: React.FC<Props> = ({ open, onOpenChange }) => {
    const seOpen = useShaderEditorStore((s) => s.open);
    const setSeOpen = useShaderEditorStore((s) => s.setOpen);
    const seMaterialId = useShaderEditorStore((s) => s.materialId);
    const setSeMaterialId = useShaderEditorStore((s) => s.setMaterialId);
    const effectiveOpen = seOpen ?? open;

    const materialsMap = useGeometryStore((s) => s.materials);

    const {
        materialId,
        setMaterialId,
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
    } = useShaderEditorState(seMaterialId);

    const containerRef = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState<{ x: number; y: number }>(() => {
        if (typeof window === 'undefined') return { x: 0, y: 0 };
        try {
            const raw = localStorage.getItem('shaderEditorPos');
            if (raw) return JSON.parse(raw);
        } catch { }
        return { x: 0, y: 0 };
    });
    const dragRef = useRef<{ dragging: boolean; ox: number; oy: number; sx: number; sy: number }>({ dragging: false, ox: 0, oy: 0, sx: 0, sy: 0 });
    // Track if we are actively dragging (for global listeners)
    const dragging = useRef(false);
    useEffect(() => {
        try { localStorage.setItem('shaderEditorPos', JSON.stringify(pos)); } catch { }
    }, [pos]);
    const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
    const [cmPos, setCmPos] = useState<{ x: number; y: number } | null>(null);
    const [cmOpen, setCmOpen] = useState(false);
    const [cmFlipX, setCmFlipX] = useState(false);
    const [cmFlipY, setCmFlipY] = useState(false);

    useEffect(() => { setPortalContainer(document.body); }, []);
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
        texture: ShaderFlowNode,
        uvScale: ShaderFlowNode,
        uvTransform: ShaderFlowNode,
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
        unpack: ShaderFlowNode,
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
        // debug nodes
        debugHeight: ShaderFlowNode,
        debugWorldY: ShaderFlowNode,
        debugLocalY: ShaderFlowNode,
        vertexPosition: ShaderFlowNode,
        vertexY: ShaderFlowNode,
        testAllAxes: ShaderFlowNode,
    } as unknown as NodeTypes), []);

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

    const { onNodesChange, onEdgesChange } = useNodeEdgeChanges(materialId, graphNodes as any, updateShaderGraph as any, rf as any);

    const addNodeAt = (type: ShaderNodeType, clientPos?: { x: number; y: number } | null) => {
        if (!materialId) return;
        const id = nanoid();
        const basePos = clientPos && (rf as any)?.screenToFlowPosition ? (rf as any).screenToFlowPosition(clientPos) : ({ x: 220, y: 120 } as any);
        const node: any =
            type === 'const-float' ? ({ id, type, position: basePos as any, data: { value: 1 } } as any) :
                type === 'const-color' ? ({ id, type, position: basePos as any, data: { r: 1, g: 1, b: 1 } } as any) :
                    type === 'texture' ? ({ id, type, position: basePos as any, data: { fileId: undefined } } as any) :
                        ({ id, type, position: basePos as any } as any);
        // Update RF internal state immediately
        if (rf) { (rf as any).addNodes([{ id, type: type as any, position: basePos as any, data: { materialId }, dragHandle: '.rf-drag', draggable: true } as any]); }
        // Persist in store
        updateShaderGraph(materialId, (g) => { g.nodes = [...g.nodes, node]; });
    };

    const { copySelection, deleteSelection, pasteClipboard } = useSelectionClipboard(materialId, graph, rf as any, updateShaderGraph as any);

    useShaderEditorHotkeys(!!effectiveOpen, containerRef, {
        copy: () => copySelection(),
        cut: () => { copySelection(); deleteSelection(); },
        paste: () => pasteClipboard(),
        del: () => deleteSelection(),
    });

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

    // --- Global drag logic ---
    const handleHeaderMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
        const withinHeader = e.clientY >= rect.top && e.clientY <= rect.top + 36;
        if (!withinHeader) return;
        dragRef.current = { dragging: true, ox: e.clientX, oy: e.clientY, sx: pos.x, sy: pos.y };
        dragging.current = true;
        function onMouseMove(ev: MouseEvent) {
            if (!dragging.current) return;
            const dx = ev.clientX - dragRef.current.ox;
            const dy = ev.clientY - dragRef.current.oy;
            setPos({ x: dragRef.current.sx + dx, y: dragRef.current.sy - dy });
        }
        function onMouseUp() {
            dragging.current = false;
            dragRef.current.dragging = false;
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        }
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        // e.preventDefault();
    };

    if (!effectiveOpen) return null;
    return (
        <div
            className="absolute z-40 pointer-events-auto w-[min(1100px,calc(100%-18rem))]"
            style={{ left: `calc(50% + ${pos.x}px)`, transform: 'translateX(-50%)', bottom: `${16 + pos.y}px` }}
        >
            <div
                className="mx-auto mb-4 h-[calc(50vh-0.75rem)] rounded-lg border border-white/10 bg-black/60 backdrop-blur-lg shadow-xl overflow-hidden"
                style={{ background: 'rgba(11,14,19,0.6)', backdropFilter: 'blur(16px)' }}
                onMouseDown={handleHeaderMouseDown}
            >
                <EditorHeader
                    materialId={materialId}
                    materials={materialsMap}
                    onMaterialChange={(v) => { setMaterialId(v); setSeMaterialId(v); }}
                    onClose={() => { setSeOpen(false); onOpenChange(false); }}
                />
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
                    {/* Global overrides moved to imported CSS: shader-flow.css */}
                </div>
            </div>
        </div>
    );
};

export default ShaderEditor;

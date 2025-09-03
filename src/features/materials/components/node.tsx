"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Handle, Position, useUpdateNodeInternals } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useGeometryStore } from '@/stores/geometry-store';
import * as ShaderTypes from '@/types/shader';
import { DragInput } from '@/components/drag-input';
import type { ShaderNode as SNode } from '@/types/shader';
import ColorInput from '@/components/color-input';
import type { Vector3 } from '@/types/geometry';
import { ensureFileIdForBlob, getOrCreateDownloadUrl, getSuggestedFilename } from '@/stores/files-store';

type NodeData = { materialId?: string };
export const ShaderFlowNode: React.FC<any> = ({ id, data, isConnectable, selected }) => {
    const materialId = (data as NodeData).materialId;
    const graph = useGeometryStore((s) => (materialId ? s.shaderGraphs.get(materialId) : undefined));
    const n = useMemo(() => (graph?.nodes.find((nn) => nn.id === id) ?? { id, type: 'input', position: { x: 0, y: 0 }, hidden: false }) as SNode, [graph, id]);
    const inputs = (ShaderTypes.NodeInputs as any)[n.type] ?? {} as Record<string, ShaderTypes.SocketType>;
    const baseOutputs = useMemo(() => ((ShaderTypes.NodeOutputs as any)[n.type] ?? {}) as Record<string, ShaderTypes.SocketType>, [n?.type]);
    const updateShaderGraph = useGeometryStore((s) => s.updateShaderGraph);
    const updateNodeInternals = useUpdateNodeInternals();
    const [hoveringDrop, setHoveringDrop] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const updateFloat = (value: number) => {
    if (!materialId) return;
    updateShaderGraph(materialId, (g) => {
            const node = g.nodes.find((nn) => nn.id === n.id);
            if (node && (node as any).type === 'const-float') {
                (node as any).data = { ...(node as any).data, value };
            }
        });
    };

    const updateColor = (v: Vector3) => {
    if (!materialId) return;
    updateShaderGraph(materialId, (g) => {
            const node = g.nodes.find((nn) => nn.id === n.id);
            if (node && (node as any).type === 'const-color') {
                (node as any).data = { r: v.x, g: v.y, b: v.z };
            }
        });
    };

    const colorVec = useMemo<Vector3 | null>(() => {
        if ((n as any).type !== 'const-color') return null;
        const d = (n as any).data || { r: 1, g: 1, b: 1 };
        return { x: d.r ?? 1, y: d.g ?? 1, z: d.b ?? 1 } as Vector3;
    }, [n]);

    const floatVal = useMemo<number | null>(() => {
        if ((n as any).type !== 'const-float') return null;
        return (n as any).data?.value ?? 0;
    }, [n]);

    const textureFileId = useMemo<string | null>(() => {
        if ((n as any).type !== 'texture') return null;
        return (n as any).data?.fileId ?? null;
    }, [n]);

    const textureColorSpace = useMemo<'sRGB' | 'linear'>(() => {
        if ((n as any).type !== 'texture') return 'sRGB';
        const v = (n as any).data?.colorSpace;
        return v === 'linear' ? 'linear' : 'sRGB';
    }, [n]);

    const onPickTexture = useCallback(() => {
        if (!fileInputRef.current) return;
        fileInputRef.current.click();
    }, []);

    const onFileChosen = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!materialId) return;
        const f = e.target.files?.[0];
        (e.target as any).value = '';
        if (!f) return;
        const id = await ensureFileIdForBlob(f, f.name);
        updateShaderGraph(materialId, (g) => {
            const node = g.nodes.find((nn) => nn.id === n.id);
            if (node && (node as any).type === 'texture') {
                (node as any).data = { ...(node as any).data, fileId: id, name: f.name };
            }
        });
    }, [materialId, n?.id, updateShaderGraph]);

    const onDropFiles = useCallback(async (e: React.DragEvent) => {
        e.preventDefault();
        setHoveringDrop(false);
        if (!materialId || (n as any).type !== 'texture') return;
        const f = e.dataTransfer.files?.[0];
        if (!f) return;
        const id = await ensureFileIdForBlob(f, f.name);
        updateShaderGraph(materialId, (g) => {
            const node = g.nodes.find((nn) => nn.id === n.id);
            if (node && (node as any).type === 'texture') {
                (node as any).data = { ...(node as any).data, fileId: id, name: f.name };
            }
        });
    }, [materialId, n, updateShaderGraph]);

    const onDragOver = useCallback((e: React.DragEvent) => {
        if ((n as any).type !== 'texture') return;
        e.preventDefault();
        setHoveringDrop(true);
    }, [n]);
    const onDragLeave = useCallback(() => setHoveringDrop(false), []);

    // Force RF to re-measure this node after mount and when dynamic content changes
    const nodeType = (n as any)?.type;
    useEffect(() => {
        const t = setTimeout(() => updateNodeInternals(id), 0);
        return () => clearTimeout(t);
    }, [id, updateNodeInternals, nodeType, floatVal, colorVec?.x, colorVec?.y, colorVec?.z, textureFileId]);

    // Dynamic output typing for math nodes (add/sub/mul/div/mod/mix)
    const dynOutputs = useMemo(() => {
        const o = { ...baseOutputs } as Record<string, ShaderTypes.SocketType>;
        const dynMath = new Set(['add','sub','mul','div','mod','mix']);
        if (dynMath.has((n as any).type) && 'out' in o) {
            const dimOf = (t?: ShaderTypes.SocketType) => (t === 'vec4' ? 4 : t === 'vec3' ? 3 : t === 'vec2' ? 2 : t === 'float' ? 1 : 0);
            const edges = graph?.edges ?? [];
            const incoming = edges.filter((e) => e.target === n.id && (e.targetHandle === 'a' || e.targetHandle === 'b'));
            let maxDim = 1;
            for (const e of incoming) {
                const srcNode = graph?.nodes.find((nn) => nn.id === e.source);
                const srcOutT = srcNode ? ((ShaderTypes.NodeOutputs as any)[(srcNode as any).type]?.[e.sourceHandle as string] as ShaderTypes.SocketType | undefined) : undefined;
                maxDim = Math.max(maxDim, dimOf(srcOutT));
            }
            o.out = maxDim >= 4 ? 'vec4' : maxDim === 3 ? 'vec3' : maxDim === 2 ? 'vec2' : 'float';
        }
        return o;
    }, [baseOutputs, graph?.edges, graph?.nodes, n]);

    return (
        <div className={`rounded-md border ${selected ? 'border-white/20 bg-[#141a22]/95' : 'border-white/10 bg-[#0f141b]/90'} text-gray-200 text-xs min-w-[160px] transition-colors`}> 
            <div className={`px-2 py-1 border-b ${selected ? 'border-white/20' : 'border-white/10'} text-[11px] uppercase tracking-wide text-gray-400 flex items-center justify-between rf-drag`}>
                <span className="cursor-move select-none">{String(n.type)}</span>
            </div>
            <div className="px-2 py-1 grid grid-cols-2 gap-x-4">
                <div className="space-y-1">
                    {Object.entries(inputs).map(([key, type]) => (
                        <div key={key} className="relative">
                            <Handle
                                type="target"
                                id={key}
                                position={Position.Left}
                                isConnectable={isConnectable}
                                className="!w-2.5 !h-2.5 !bg-white/70 hover:!bg-white rounded-full !z-10"
                                style={{ zIndex: 10 }}
                            />
                            <span className="pl-3 text-gray-300 pointer-events-none">
                                {key}
                                <span className="text-gray-500">:{String(type)}</span>
                            </span>
                        </div>
                    ))}
                </div>
                <div className="space-y-1">
                    {Object.entries(dynOutputs).map(([key, type]) => (
                        <div key={key} className="relative text-right">
                            <span className="pr-3 text-gray-300 pointer-events-none">
                                {key}
                                <span className="text-gray-500">:{String(type)}</span>
                            </span>
                            <Handle
                                type="source"
                                id={key}
                                position={Position.Right}
                                isConnectable={isConnectable}
                                className="!w-2.5 !h-2.5 !bg-white/70 hover:!bg-white rounded-full !z-10"
                                style={{ zIndex: 10 }}
                            />
                        </div>
                    ))}
                </div>
            </div>
            {/* Inline controls for const/texture nodes */}
        {(n as any).type === 'const-float' && (
                <div className="px-2 pb-2">
            <DragInput value={floatVal ?? 0} onChange={updateFloat} onValueCommit={updateFloat} precision={2} step={0.01} label="Value" />
                </div>
            )}
            {(n as any).type === 'const-color' && colorVec && (
                <div className="px-2 pb-2">
                    <ColorInput value={colorVec} onChange={updateColor} label="Color" />
                </div>
            )}
            {(n as any).type === 'texture' && (
                <div className={`px-2 pb-2`} onDrop={onDropFiles} onDragOver={onDragOver} onDragLeave={onDragLeave}>
                    <div className={`border border-white/10 rounded p-2 flex items-center gap-2 ${hoveringDrop ? 'bg-white/5' : ''}`}>
                        <div className="w-12 h-12 bg-black/30 rounded overflow-hidden flex items-center justify-center">
                            {textureFileId ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={getOrCreateDownloadUrl(textureFileId) ?? undefined} alt={getSuggestedFilename(textureFileId) || 'texture'} className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-[10px] text-gray-500 text-center px-1">Drop image</span>
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-[11px] text-gray-400">{textureFileId ? (getSuggestedFilename(textureFileId) || 'Texture') : 'No texture'}</div>
                            <div className="flex gap-2 mt-1">
                                <button className="px-2 py-1 rounded border border-white/10 hover:bg-white/10" onClick={onPickTexture}>Choose…</button>
                                {textureFileId && <a className="px-2 py-1 rounded border border-white/10 hover:bg-white/10" href={getOrCreateDownloadUrl(textureFileId) || '#'} download>Download</a>}
                            </div>
                            <div className="mt-2 flex items-center gap-2">
                                <label className="text-[10px] text-gray-500">Color Space</label>
                                <select
                                    className="bg-transparent border border-white/10 rounded px-1 py-0.5 text-[11px]"
                                    value={textureColorSpace}
                                    onChange={(e) => {
                                        if (!materialId) return;
                                        const value = e.target.value === 'linear' ? 'linear' : 'sRGB';
                                        updateShaderGraph(materialId, (g) => {
                                            const node = g.nodes.find((nn) => nn.id === n.id);
                                            if (node && (node as any).type === 'texture') {
                                                (node as any).data = { ...(node as any).data, colorSpace: value };
                                            }
                                        });
                                    }}
                                >
                                    <option value="sRGB">sRGB (color)</option>
                                    <option value="linear">Linear (data)</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFileChosen} />
                </div>
            )}
        </div>
    );
};
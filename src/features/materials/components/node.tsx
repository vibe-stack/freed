"use client";

import React, { useEffect, useMemo } from 'react';
import { Handle, Position, useUpdateNodeInternals } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useGeometryStore } from '@/stores/geometry-store';
import * as ShaderTypes from '@/types/shader';
import { DragInput } from '@/components/drag-input';
import type { ShaderNode as SNode } from '@/types/shader';
import ColorInput from '@/components/color-input';
import type { Vector3 } from '@/types/geometry';

type NodeData = { materialId?: string };
export const ShaderFlowNode: React.FC<any> = ({ id, data, isConnectable, selected }) => {
    const materialId = (data as NodeData).materialId;
    const graph = useGeometryStore((s) => (materialId ? s.shaderGraphs.get(materialId) : undefined));
    const n = (graph?.nodes.find((nn) => nn.id === id) ?? { id, type: 'input', position: { x: 0, y: 0 }, hidden: false }) as SNode;
    const inputs = (ShaderTypes.NodeInputs as any)[n.type] ?? {} as Record<string, ShaderTypes.SocketType>;
    const outputs = (ShaderTypes.NodeOutputs as any)[n.type] ?? {} as Record<string, ShaderTypes.SocketType>;
    const updateShaderGraph = useGeometryStore((s) => s.updateShaderGraph);
    const updateNodeInternals = useUpdateNodeInternals();

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

    // Force RF to re-measure this node after mount and when dynamic content changes
    useEffect(() => {
        const t = setTimeout(() => updateNodeInternals(id), 0);
        return () => clearTimeout(t);
    }, [id, updateNodeInternals, (n as any)?.type, floatVal, colorVec?.x, colorVec?.y, colorVec?.z]);

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
                    {Object.entries(outputs).map(([key, type]) => (
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
            {/* Inline controls for const nodes */}
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
        </div>
    );
};
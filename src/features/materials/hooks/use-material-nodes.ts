"use client";

import { useMemo } from 'react';
import { useGeometryStore } from '@/stores/geometry-store';
import { buildTSLMaterialFactory } from '@/utils/shader-tsl/index';
import * as THREE from 'three/webgpu';

/**
 * useMaterialNodes(materialId)
 * Returns a Three.js Material generated from the material's shader graph using TSL.
 * The returned material updates when the graph changes.
 */
export function useMaterialNodes(materialId?: string) {
  const graph = useGeometryStore((s) => (materialId ? s.shaderGraphs.get(materialId) : undefined));
  // Rebuild factory when graph structure changes
  return useMemo(() => {
    if (!materialId || !graph) return null;
    const { createAuto } = buildTSLMaterialFactory(graph);
    // Construct material immediately for R3F consumption
    const mat = createAuto() as THREE.Material;
    // Safety: enforce double-side consistently
    (mat as any).side = THREE.DoubleSide;
    // Prefer back-face shadowing to mitigate acne on thin meshes
    (mat as any).shadowSide = THREE.BackSide;
    return mat;
  }, [graph, materialId]);
}

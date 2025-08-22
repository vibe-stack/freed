"use client";

import { useMemo } from 'react';
import { useGeometryStore } from '@/stores/geometry-store';
import { buildTSLMaterialFactory } from '@/utils/shader-tsl';
import * as THREE from 'three';

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
  const { createStandardNodeMaterial } = buildTSLMaterialFactory(graph);
  // Construct material immediately for R3F consumption
  return createStandardNodeMaterial();
  }, [materialId, graph?.nodes, graph?.edges]);
}

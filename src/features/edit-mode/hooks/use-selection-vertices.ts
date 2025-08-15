'use client';

import { useMemo } from 'react';
import { Vector3 } from 'three';
import { Vertex } from '@/types/geometry';
import { useSelectionStore } from '@/stores/selection-store';
import { useGeometryStore } from '@/stores/geometry-store';

export function useSelectionVertices(meshId: string, localVertices?: Vertex[] | null) {
  const selectionStore = useSelectionStore();
  const geometryStore = useGeometryStore();

  const mesh = geometryStore.meshes.get(meshId);

  const vertices = useMemo(() => {
    if (localVertices && localVertices.length > 0) return localVertices;
    if (!mesh) return [] as Vertex[];
    const sel = selectionStore.selection;
    if (sel.selectionMode === 'vertex') {
      return mesh.vertices.filter((v) => sel.vertexIds.includes(v.id));
    }
    if (sel.selectionMode === 'edge') {
      const ids = new Set<string>();
      sel.edgeIds.forEach((eid) => {
        const e = mesh.edges.find((ed) => ed.id === eid);
        if (e) e.vertexIds.forEach((id) => ids.add(id));
      });
      return mesh.vertices.filter((v) => ids.has(v.id));
    }
    if (sel.selectionMode === 'face') {
      const ids = new Set<string>();
      sel.faceIds.forEach((fid) => {
        const f = mesh.faces.find((fc) => fc.id === fid);
        if (f) f.vertexIds.forEach((id) => ids.add(id));
      });
      return mesh.vertices.filter((v) => ids.has(v.id));
    }
    return [] as Vertex[];
  }, [localVertices, selectionStore.selection, mesh]);

  const centroid = useMemo(() => {
    if (!vertices || vertices.length === 0) return null as Vector3 | null;
    const c = vertices.reduce(
      (acc, v) => ({ x: acc.x + v.position.x, y: acc.y + v.position.y, z: acc.z + v.position.z }),
      { x: 0, y: 0, z: 0 }
    );
    return new Vector3(c.x / vertices.length, c.y / vertices.length, c.z / vertices.length);
  }, [vertices]);

  return { vertices, centroid } as const;
}

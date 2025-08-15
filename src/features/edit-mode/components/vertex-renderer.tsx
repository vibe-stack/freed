'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { ThreeEvent, useThree } from '@react-three/fiber';
import { Color, PerspectiveCamera, Vector3, Object3D, InstancedMesh, BoxGeometry, MeshBasicMaterial } from 'three';
import { useGeometryStore } from '../../../stores/geometry-store';
import { Vertex } from '../../../types/geometry';

const ORANGE = new Color(1.0, 0.5, 0.0);
const BLACK = new Color(0, 0, 0);

// Convert desired pixel size to world-space scale so cubes appear constant on screen
function getScreenScale(camera: PerspectiveCamera, position: Vector3, viewportHeight: number, pixelSize = 10): number {
  const distance = camera.position.distanceTo(position);
  const vFOV = (camera.fov * Math.PI) / 180;
  const worldScreenHeightAtDistance = 2 * Math.tan(vFOV / 2) * distance;
  return (pixelSize / viewportHeight) * worldScreenHeightAtDistance;
}

interface VertexRendererProps {
  meshId: string;
  selectedVertexIds: string[];
  onVertexClick: (vertexId: string, event: ThreeEvent<PointerEvent>) => void;
  selectionMode: string;
  localVertices?: Vertex[]; // For showing local changes during tool operations
}

export const VertexRenderer: React.FC<VertexRendererProps> = ({
  meshId,
  selectedVertexIds,
  onVertexClick,
  selectionMode,
  localVertices
}) => {
  const { camera, size } = useThree();
  const geometryStore = useGeometryStore();
  const mesh = geometryStore.meshes.get(meshId);
  const selectedRef = useRef<InstancedMesh | null>(null);
  const unselectedRef = useRef<InstancedMesh | null>(null);
  const tmp = useMemo(() => new Object3D(), []);
  const boxGeo = useMemo(() => new BoxGeometry(0.5, 0.5, 0.5), []);
  const blackMat = useMemo(() => new MeshBasicMaterial({ color: BLACK, depthTest: false, depthWrite: false }), []);
  const orangeMat = useMemo(() => new MeshBasicMaterial({ color: ORANGE, depthTest: false, depthWrite: false }), []);
  
  // Merge local vertex overrides (during tool operations) with mesh vertices so all vertices are always visible
  const vertices = useMemo(() => {
    const base = mesh?.vertices || [];
    if (!localVertices || localVertices.length === 0) return base;
    const overrides = new Map(localVertices.map(v => [v.id, v] as const));
    return base.map(v => overrides.get(v.id) || v);
  }, [mesh?.vertices, localVertices]);
  
  const { selectedVerts, unselectedVerts } = useMemo(() => {
    const selSet = new Set(selectedVertexIds);
    const selected: { id: string; position: Vector3; scale: number }[] = [];
    const unselected: { id: string; position: Vector3; scale: number }[] = [];
    for (const v of vertices) {
      const position = new Vector3(v.position.x, v.position.y, v.position.z);
      const scale = getScreenScale(camera as PerspectiveCamera, position, size.height, 10);
      const item = { id: v.id, position, scale };
      if (selSet.has(v.id)) selected.push(item);
      else unselected.push(item);
    }
    return { selectedVerts: selected, unselectedVerts: unselected };
  }, [vertices, selectedVertexIds, camera, size.height]);

  // Populate instance matrices when data changes
  useEffect(() => {
    const r = unselectedRef.current;
    if (!r) return;
    const count = unselectedVerts.length;
    for (let i = 0; i < count; i++) {
      const v = unselectedVerts[i];
      tmp.position.copy(v.position);
      tmp.scale.set(v.scale, v.scale, v.scale);
      tmp.updateMatrix();
      r.setMatrixAt(i, tmp.matrix);
    }
    r.count = count;
    r.instanceMatrix.needsUpdate = true;
  }, [unselectedVerts, tmp]);

  useEffect(() => {
    const r = selectedRef.current;
    if (!r) return;
    const count = selectedVerts.length;
    for (let i = 0; i < count; i++) {
      const v = selectedVerts[i];
      tmp.position.copy(v.position);
      tmp.scale.set(v.scale, v.scale, v.scale);
      tmp.updateMatrix();
      r.setMatrixAt(i, tmp.matrix);
    }
    r.count = count;
    r.instanceMatrix.needsUpdate = true;
  }, [selectedVerts, tmp]);

  const handleUnselectedPointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (selectionMode !== 'vertex') return;
    e.stopPropagation();
    const idx: number = e.instanceId ?? -1;
    if (idx < 0) return;
    const v = unselectedVerts[idx];
    if (v) onVertexClick(v.id, e);
  };

  const handleSelectedPointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (selectionMode !== 'vertex') return;
    e.stopPropagation();
    const idx: number = e.instanceId ?? -1;
    if (idx < 0) return;
    const v = selectedVerts[idx];
    if (v) onVertexClick(v.id, e);
  };

  return (
    <>
      {/* Unselected vertices */}
      <instancedMesh
        ref={unselectedRef}
        args={[boxGeo, blackMat, Math.max(1, unselectedVerts.length)]}
        onPointerDown={handleUnselectedPointerDown}
        renderOrder={3000}
      >
        {/* geometry and material provided via args */}
      </instancedMesh>

      {/* Selected vertices */}
      <instancedMesh
        ref={selectedRef}
        args={[boxGeo, orangeMat, Math.max(1, selectedVerts.length)]}
        onPointerDown={handleSelectedPointerDown}
        renderOrder={3001}
      >
        {/* geometry and material provided via args */}
      </instancedMesh>
    </>
  );
};

'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { ThreeEvent, useThree, useFrame } from '@react-three/fiber';
import { Color, PerspectiveCamera, Vector3, Object3D, InstancedMesh, BoxGeometry, MeshBasicMaterial, Euler } from 'three';
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
  objectScale?: { x: number; y: number; z: number }; // parent object scale for compensation
  objectRotation?: { x: number; y: number; z: number };
  objectPosition?: { x: number; y: number; z: number };
}

export const VertexRenderer: React.FC<VertexRendererProps> = ({
  meshId,
  selectedVertexIds,
  onVertexClick,
  selectionMode,
  localVertices,
  objectScale,
  objectRotation,
  objectPosition
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
    const selected: { id: string; position: Vector3 }[] = [];
    const unselected: { id: string; position: Vector3 }[] = [];
    for (const v of vertices) {
      const position = new Vector3(v.position.x, v.position.y, v.position.z);
      const item = { id: v.id, position };
      if (selSet.has(v.id)) selected.push(item);
      else unselected.push(item);
    }
    return { selectedVerts: selected, unselectedVerts: unselected };
  }, [vertices, selectedVertexIds]);

  // Populate instance matrices when data changes
  // Per-frame update to keep handle size constant in screen space as camera moves
  useFrame(() => {
    const update = (ref: InstancedMesh | null, arr: { position: Vector3 }[]) => {
      if (!ref) return;
      const count = arr.length;
      for (let i = 0; i < count; i++) {
        const v = arr[i];
        // local position inside the object's transform group
        tmp.position.copy(v.position);
        // compute world position for distance-based scaling
        const wp = v.position.clone();
        if (objectScale) {
          wp.set(wp.x * objectScale.x, wp.y * objectScale.y, wp.z * objectScale.z);
        }
        if (objectRotation) {
          wp.applyEuler(new Euler(objectRotation.x, objectRotation.y, objectRotation.z));
        }
        if (objectPosition) {
          wp.add(new Vector3(objectPosition.x, objectPosition.y, objectPosition.z));
        }
        const pxScale = getScreenScale(camera as PerspectiveCamera, wp, size.height, 10);
        // compensate per-axis object scale so cubes remain visually constant
        const sx = pxScale / Math.max(1e-6, Math.abs(objectScale?.x ?? 1));
        const sy = pxScale / Math.max(1e-6, Math.abs(objectScale?.y ?? 1));
        const sz = pxScale / Math.max(1e-6, Math.abs(objectScale?.z ?? 1));
        tmp.scale.set(sx, sy, sz);
        tmp.updateMatrix();
        ref.setMatrixAt(i, tmp.matrix);
      }
      ref.count = count;
      ref.instanceMatrix.needsUpdate = true;
    };

    update(unselectedRef.current, unselectedVerts);
    update(selectedRef.current, selectedVerts);
  });

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
  // Use total vertices count as capacity so instanceId stays stable across selections
  args={[boxGeo, blackMat, Math.max(1, (mesh?.vertices.length ?? unselectedVerts.length))]}
        onPointerDown={handleUnselectedPointerDown}
  // Only raycast in vertex mode; otherwise don't steal clicks
  raycast={selectionMode === 'vertex' ? (InstancedMesh.prototype.raycast as unknown as any) : (() => {})}
        renderOrder={3000}
      >
        {/* geometry and material provided via args */}
      </instancedMesh>

      {/* Selected vertices */}
      <instancedMesh
        ref={selectedRef}
  args={[boxGeo, orangeMat, Math.max(1, (mesh?.vertices.length ?? selectedVerts.length))]}
        onPointerDown={handleSelectedPointerDown}
  raycast={selectionMode === 'vertex' ? (InstancedMesh.prototype.raycast as unknown as any) : (() => {})}
        renderOrder={3001}
      >
        {/* geometry and material provided via args */}
      </instancedMesh>
    </>
  );
};

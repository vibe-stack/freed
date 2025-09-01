'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { ThreeEvent, useThree, useFrame } from '@react-three/fiber';
import { Color, PerspectiveCamera, Vector3, Object3D, InstancedMesh, BoxGeometry, MeshBasicMaterial, Euler } from 'three/webgpu';
import { useMesh } from '../../../stores/geometry-store';
import { Vertex } from '../../../types/geometry';

const ORANGE = new Color(1.0, 0.5, 0.0);
const BLACK = new Color(0, 0, 0);

// Convert desired pixel size to world-space scale so cubes appear constant on screen
function getScreenScale(camera: PerspectiveCamera, position: Vector3, viewportHeight: number, pixelSize = 14): number {
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
  const mesh = useMesh(meshId);
  const selectedRef = useRef<InstancedMesh | null>(null);
  const unselectedRef = useRef<InstancedMesh | null>(null);
  const prevSelCountRef = useRef(0);
  const prevUnselCountRef = useRef(0);
  // Keep stable mapping from instance index -> vertex id for picking
  const indexToUnselectedId = useRef<string[]>([]);
  const indexToSelectedId = useRef<string[]>([]);
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

  // Maintain instance index mapping arrays to resolve instanceId -> vertexId on click
  useEffect(() => {
    const unSelIds: string[] = [];
    const selIds: string[] = [];
    const selSet = new Set(selectedVertexIds);
    for (const v of vertices) {
      if (selSet.has(v.id)) selIds.push(v.id);
      else unSelIds.push(v.id);
    }
    indexToUnselectedId.current = unSelIds;
    indexToSelectedId.current = selIds;
    // Note: Don't set count here - let useFrame handle the correct counts
  }, [vertices, selectedVertexIds]);
  
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

  // Force instanced meshes to remount when capacity (vertex count) changes
  const instanceCapacity = Math.max(1, vertices.length);

  // Populate instance matrices when data changes
  // Per-frame update only adjusts scale with camera; positions update when vertices or camera change
  useFrame(() => {
    const update = (ref: InstancedMesh | null, arr: { position: Vector3 }[], prevRef: React.MutableRefObject<number>) => {
      if (!ref) return;
      const count = Math.max(0, arr.length);
      // Render exactly 'count' instances; allow 0 to avoid ghost instance
      ref.count = count;
      
      // Create a new temp object for each update to avoid interference
      const localTmp = new Object3D();
      
      // Update valid instances
      for (let i = 0; i < count; i++) {
        const v = arr[i];
        // local position inside the object's transform group
        localTmp.position.copy(v.position);
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
        localTmp.scale.set(sx, sy, sz);
        localTmp.updateMatrix();
        ref.setMatrixAt(i, localTmp.matrix);
      }
      
      // Zero out any leftover instances from previous frame to avoid stale instances
      // Use a separate temp object to avoid affecting the main tmp object
      const cleanupTmp = new Object3D();
      cleanupTmp.position.set(0, 0, 0);
      cleanupTmp.scale.set(0, 0, 0);
      cleanupTmp.updateMatrix();
      for (let i = count; i < prevRef.current; i++) {
        ref.setMatrixAt(i, cleanupTmp.matrix);
      }
      
      ref.instanceMatrix.needsUpdate = true;
      prevRef.current = count;
    };

    update(unselectedRef.current, unselectedVerts, prevUnselCountRef);
    update(selectedRef.current, selectedVerts, prevSelCountRef);
  });

  const handleUnselectedClick = (e: ThreeEvent<PointerEvent>) => {
    if (selectionMode !== 'vertex') return;
    e.stopPropagation();
  const idx: number = e.instanceId ?? -1;
  if (idx < 0) return;
  const id = indexToUnselectedId.current[idx];
  if (id) onVertexClick(id, e);
  };

  const handleSelectedClick = (e: ThreeEvent<PointerEvent>) => {
    if (selectionMode !== 'vertex') return;
    e.stopPropagation();
  const idx: number = e.instanceId ?? -1;
  if (idx < 0) return;
  const id = indexToSelectedId.current[idx];
  if (id) onVertexClick(id, e);
  };

  return (
    <>
      {/* Unselected vertices */}
  <instancedMesh
    key={`unselected-${instanceCapacity}`}
        ref={unselectedRef}
    // Capacity equals total vertex count to keep instanceId stable
    args={[boxGeo, blackMat, instanceCapacity]}
  onPointerDown={handleUnselectedClick}
    // Only raycast in vertex mode; otherwise don't steal clicks
    raycast={selectionMode === 'vertex' ? (InstancedMesh.prototype.raycast as unknown as any) : (() => {})}
        renderOrder={3000}
      >
        {/* geometry and material provided via args */}
      </instancedMesh>

      {/* Selected vertices */}
  <instancedMesh
    key={`selected-${instanceCapacity}`}
        ref={selectedRef}
    args={[boxGeo, orangeMat, instanceCapacity]}
  onPointerDown={handleSelectedClick}
    raycast={selectionMode === 'vertex' ? (InstancedMesh.prototype.raycast as unknown as any) : (() => {})}
        renderOrder={3001}
      >
        {/* geometry and material provided via args */}
      </instancedMesh>
    </>
  );
};

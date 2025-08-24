'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { Color, BufferGeometry, Float32BufferAttribute, LineSegments, Matrix4, Vector3, PerspectiveCamera } from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import { useMesh } from '../../../stores/geometry-store';
import { Vertex } from '../../../types/geometry';
import { useThree } from '@react-three/fiber';

const ORANGE = new Color(1.0, 0.5, 0.0);
const BLACK = new Color(0, 0, 0);

interface EdgeRendererProps {
  meshId: string;
  selectedEdgeIds: string[];
  onEdgeClick: (edgeId: string, event: ThreeEvent<PointerEvent>) => void;
  selectionMode: string;
  localVertices?: Vertex[]; // For showing local changes during tool operations
}

export const EdgeRenderer: React.FC<EdgeRendererProps> = ({
  meshId,
  selectedEdgeIds,
  onEdgeClick,
  selectionMode,
  localVertices
}) => {
  const { camera, size } = useThree();
  const mesh = useMesh(meshId);
  const lineRef = useRef<LineSegments | null>(null);
  
  // Merge local vertex overrides when provided
  const vertices = useMemo(() => {
    const base = mesh?.vertices || [];
    if (!localVertices || localVertices.length === 0) return base;
    const overrides = new Map(localVertices.map(v => [v.id, v] as const));
    return base.map(v => overrides.get(v.id) || v);
  }, [mesh?.vertices, localVertices]);
  const edges = mesh?.edges || [];
  
  const batched = useMemo(() => {
    const vertexMap = new Map(vertices.map(v => [v.id, v] as const));
    const count = edges.length;
    const geometry = new BufferGeometry();
    if (count === 0) {
      // Avoid zero-sized GPU buffers with WebGPU. Provide a minimal placeholder and drawRange=0.
      const positions = new Float32Array(6);
      const colors = new Float32Array([0, 0, 0, 0, 0, 0]);
      geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
      geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
      geometry.setDrawRange(0, 0);
    } else {
      const positions = new Float32Array(count * 2 * 3);
      const colors = new Float32Array(count * 2 * 3);
      const sel = new Set(selectedEdgeIds);
      for (let i = 0; i < count; i++) {
        const e = edges[i];
        const v0 = vertexMap.get(e.vertexIds[0]);
        const v1 = vertexMap.get(e.vertexIds[1]);
        if (!v0 || !v1) continue;
        const o = i * 6;
        positions[o + 0] = v0.position.x; positions[o + 1] = v0.position.y; positions[o + 2] = v0.position.z;
        positions[o + 3] = v1.position.x; positions[o + 4] = v1.position.y; positions[o + 5] = v1.position.z;
        const c = sel.has(e.id) ? ORANGE : BLACK;
        for (let j = 0; j < 2; j++) {
          const k = o + j * 3;
          colors[k + 0] = c.r; colors[k + 1] = c.g; colors[k + 2] = c.b;
        }
      }
      geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
      geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
      geometry.computeBoundingSphere();
    }
    return { geometry };
  }, [edges, vertices, selectedEdgeIds]);

  useEffect(() => {
    if (lineRef.current) {
      // Ensure render order for overlay
      lineRef.current.renderOrder = 2000;
    }
  }, []);

  const handleClick = (event: ThreeEvent<PointerEvent>) => {
    if (selectionMode !== 'edge') return;
    event.stopPropagation();
    // Robust picking: choose the edge with minimum distance to the click ray in WORLD space
    // and accept only if within a screen-space pixel threshold
    if (!lineRef.current) return;
    const matWorld = new Matrix4().copy(lineRef.current.matrixWorld);
    const aW = new Vector3();
    const bW = new Vector3();
    const tmp = new Vector3();
    const rayOrigin = event.ray.origin.clone();
    const rayDir = event.ray.direction.clone();
    const vtxMap = new Map(vertices.map(v => [v.id, v] as const));

    // Helper: squared distance between world-space segment AB and ray O + t*D
    function raySegmentDist2(o: Vector3, d: Vector3, a: Vector3, b: Vector3) {
      // Based on closest points between two segments (ray treated as infinite in +t)
      const u = d; // ray direction (unit)
      const v = tmp.copy(b).sub(a); // segment direction
      const w0 = a.clone().sub(o);
      const aU = u.dot(u); // =1 if normalized
      const bU = u.dot(v);
      const cU = v.dot(v);
      const dU = u.dot(w0);
      const eU = v.dot(w0);
      const denom = aU * cU - bU * bU + 1e-12;
      let sc = (bU * eU - cU * dU) / denom; // ray param
      let tc = (aU * eU - bU * dU) / denom; // seg param [0,1]
      // Clamp segment param to [0,1]
      if (tc < 0) tc = 0; else if (tc > 1) tc = 1;
      // For the ray, only allow sc >= 0
      if (sc < 0) sc = 0;
      const pc = o.clone().addScaledVector(u, sc);
      const qc = a.clone().addScaledVector(v, tc);
      return { dist2: pc.distanceToSquared(qc), pc, qc };
    }

    let bestIdx = -1;
    let bestDist2 = Infinity;
    let bestPoint: Vector3 | null = null;
    for (let i = 0; i < edges.length; i++) {
      const e = edges[i];
      const v0 = vtxMap.get(e.vertexIds[0]);
      const v1 = vtxMap.get(e.vertexIds[1]);
      if (!v0 || !v1) continue;
      aW.set(v0.position.x, v0.position.y, v0.position.z).applyMatrix4(matWorld);
      bW.set(v1.position.x, v1.position.y, v1.position.z).applyMatrix4(matWorld);
      const { dist2, pc } = raySegmentDist2(rayOrigin, rayDir, aW, bW);
      if (dist2 < bestDist2) { bestDist2 = dist2; bestIdx = i; bestPoint = pc; }
    }

    if (bestIdx >= 0) {
      // Screen-space threshold: accept only if within ~10px
      const pixThreshold = 10; // px
      // Convert pixel threshold to world units at the hit depth
      const cam = camera as PerspectiveCamera;
      const hitDist = bestPoint ? cam.position.distanceTo(bestPoint) : cam.position.distanceTo(lineRef.current.position);
      const vFOV = (cam.fov * Math.PI) / 180;
      const worldScreenHeight = 2 * Math.tan(vFOV / 2) * hitDist;
      const worldTol = (pixThreshold / size.height) * worldScreenHeight;
      if (Math.sqrt(bestDist2) <= worldTol) {
        onEdgeClick(edges[bestIdx].id, event);
      }
    }
  };

  return (
  <lineSegments
      ref={lineRef}
      onClick={handleClick}
      // Important: disable raycasting when not in edge mode so it doesn't steal clicks
  raycast={selectionMode === 'edge' ? (LineSegments.prototype.raycast as unknown as any) : (() => {})}
    >
      <bufferGeometry attach="geometry">
        <bufferAttribute attach="attributes-position" args={[batched.geometry.getAttribute('position')!.array as Float32Array, 3]} />
        <bufferAttribute attach="attributes-color" args={[batched.geometry.getAttribute('color')!.array as Float32Array, 3]} />
      </bufferGeometry>
      <lineBasicMaterial vertexColors depthTest={false} depthWrite={false} />
    </lineSegments>
  );
};

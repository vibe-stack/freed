'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { Color, BufferGeometry, Float32BufferAttribute, LineSegments } from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import { useGeometryStore } from '../../../stores/geometry-store';
import { Vertex } from '../../../types/geometry';

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
  const geometryStore = useGeometryStore();
  const mesh = geometryStore.meshes.get(meshId);
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
    // Approximate picking by finding nearest segment to intersection point
    // Convert world-space intersection point to this object's local space
    const ptLocal = lineRef.current ? lineRef.current.worldToLocal(event.point.clone()) : event.point;
    // Use the same merged vertices used for rendering (respects local preview)
    const vtxMap = new Map(vertices.map(v => [v.id, v] as const));
    let best = -1;
    let bestDist = Infinity;
    for (let i = 0; i < edges.length; i++) {
      const e = edges[i];
      const v0 = vtxMap.get(e.vertexIds[0]);
      const v1 = vtxMap.get(e.vertexIds[1]);
      if (!v0 || !v1) continue;
      const ax = v0.position.x, ay = v0.position.y, az = v0.position.z;
      const bx = v1.position.x, by = v1.position.y, bz = v1.position.z;
      // point-line distance in 3D
      const abx = bx - ax, aby = by - ay, abz = bz - az;
      const apx = ptLocal.x - ax, apy = ptLocal.y - ay, apz = ptLocal.z - az;
      const t = Math.max(0, Math.min(1, (apx*abx + apy*aby + apz*abz) / (abx*abx + aby*aby + abz*abz + 1e-6)));
      const cx = ax + abx * t, cy = ay + aby * t, cz = az + abz * t;
      const dx = ptLocal.x - cx, dy = ptLocal.y - cy, dz = ptLocal.z - cz;
      const d2 = dx*dx + dy*dy + dz*dz;
      if (d2 < bestDist) { bestDist = d2; best = i; }
    }
    if (best >= 0) onEdgeClick(edges[best].id, event);
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

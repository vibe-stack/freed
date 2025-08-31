'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { Color, BufferGeometry, Float32BufferAttribute, LineSegments, Matrix4, Vector3, PerspectiveCamera, OrthographicCamera } from 'three/webgpu';
import type { ThreeEvent } from '@react-three/fiber';
import { useMesh } from '../../../stores/geometry-store';
import { Vertex } from '../../../types/geometry';
import { useThree } from '@react-three/fiber';

const ORANGE = new Color(1.0, 0.5, 0.0);
const BLACK = new Color(0, 0, 0);
const RED = new Color(1, 0, 0);

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
        const c = e.seam ? RED : (sel.has(e.id) ? ORANGE : BLACK);
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

  // Custom raycast that expands line threshold to ~8px in screen space
  const customRaycast = function(this: any, raycaster: any, intersects: any[]) {
    const obj = lineRef.current as any;
    if (!obj) return;
    const cam: any = (camera as any);
    let worldTol = 0.01; // fallback
    if (cam.isPerspectiveCamera) {
      const center = obj.geometry.boundingSphere?.center?.clone?.().applyMatrix4(obj.matrixWorld) || obj.getWorldPosition(new Vector3());
      const dist = cam.position.distanceTo(center);
      const vFOV = (cam.fov * Math.PI) / 180;
      const worldScreenHeight = 2 * Math.tan(vFOV / 2) * dist;
      worldTol = (8 / size.height) * worldScreenHeight; // 8px
    } else if (cam.isOrthographicCamera) {
      const worldScreenHeight = cam.top - cam.bottom;
      worldTol = (8 / size.height) * worldScreenHeight;
    }
    const prev = raycaster.params?.Line?.threshold ?? 1;
    raycaster.params = raycaster.params || {};
    raycaster.params.Line = { ...(raycaster.params.Line || {}), threshold: Math.max(prev, worldTol) };
    (LineSegments.prototype.raycast as any).call(this, raycaster, intersects);
    // restore not strictly necessary
  } as any;

  const handleClick = (event: ThreeEvent<PointerEvent>) => {
    if (selectionMode !== 'edge') return;
    event.stopPropagation();
    
    if (!lineRef.current) return;
    
    // Get mouse position in normalized device coordinates (-1 to +1)
    const mouse = {
      x: (event.nativeEvent.offsetX / size.width) * 2 - 1,
      y: -(event.nativeEvent.offsetY / size.height) * 2 + 1
    };
    
    const matWorld = new Matrix4().copy(lineRef.current.matrixWorld);
    const vtxMap = new Map(vertices.map(v => [v.id, v] as const));
    const worldPos1 = new Vector3();
    const worldPos2 = new Vector3();
    const screenPos1 = new Vector3();
    const screenPos2 = new Vector3();
    
    // Helper function to calculate perpendicular distance from point to line segment in 2D
    function distanceToLineSegment2D(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const lengthSq = dx * dx + dy * dy;
      
      if (lengthSq === 0) {
        // Degenerate case: line segment is a point
        const distSq = (px - x1) * (px - x1) + (py - y1) * (py - y1);
        return Math.sqrt(distSq);
      }
      
      // Find the projection parameter t (0 <= t <= 1)
      let t = ((px - x1) * dx + (py - y1) * dy) / lengthSq;
      t = Math.max(0, Math.min(1, t));
      
      // Find the closest point on the segment
      const closestX = x1 + t * dx;
      const closestY = y1 + t * dy;
      
      // Calculate distance
      const distX = px - closestX;
      const distY = py - closestY;
      return Math.sqrt(distX * distX + distY * distY);
    }
    
    const SELECTION_THRESHOLD = 8; // pixels
    const candidates: Array<{edgeIndex: number, distance: number, depth: number}> = [];
    
    // Test all edges
    for (let i = 0; i < edges.length; i++) {
      const edge = edges[i];
      const v0 = vtxMap.get(edge.vertexIds[0]);
      const v1 = vtxMap.get(edge.vertexIds[1]);
      if (!v0 || !v1) continue;
      
      // Transform vertices to world space
      worldPos1.set(v0.position.x, v0.position.y, v0.position.z).applyMatrix4(matWorld);
      worldPos2.set(v1.position.x, v1.position.y, v1.position.z).applyMatrix4(matWorld);
      
      // Project to screen space
      screenPos1.copy(worldPos1).project(camera);
      screenPos2.copy(worldPos2).project(camera);
      
      // Skip if both points are behind the camera
      if (screenPos1.z > 1 && screenPos2.z > 1) continue;
      
      // Calculate screen-space distance in pixels
      const screenDist = distanceToLineSegment2D(
        mouse.x, mouse.y,
        screenPos1.x, screenPos1.y,
        screenPos2.x, screenPos2.y
      );
      
      // Convert normalized distance to pixels
      const pixelDistance = screenDist * Math.min(size.width, size.height) * 0.5;
      
      if (pixelDistance <= SELECTION_THRESHOLD) {
        // Calculate depth (average Z of the edge in view space)
        const avgDepth = (screenPos1.z + screenPos2.z) * 0.5;
        candidates.push({
          edgeIndex: i,
          distance: pixelDistance,
          depth: avgDepth
        });
      }
    }
    
    if (candidates.length > 0) {
      // Sort by depth first (closest first), then by distance if depths are equal
      candidates.sort((a, b) => {
        const depthDiff = a.depth - b.depth;
        if (Math.abs(depthDiff) > 0.001) return depthDiff;
        return a.distance - b.distance;
      });
      
      const bestEdge = candidates[0];
      onEdgeClick(edges[bestEdge.edgeIndex].id, event);
    }
  };

  return (
    <lineSegments
      ref={lineRef}
      onPointerDown={handleClick}
      // Important: disable raycasting when not in edge mode so it doesn't steal clicks
      raycast={selectionMode === 'edge' ? (customRaycast as any) : (() => { })}
    >
      <bufferGeometry attach="geometry">
        <bufferAttribute attach="attributes-position" args={[batched.geometry.getAttribute('position')!.array as Float32Array, 3]} />
        <bufferAttribute attach="attributes-color" args={[batched.geometry.getAttribute('color')!.array as Float32Array, 3]} />
      </bufferGeometry>
      <lineBasicMaterial vertexColors depthTest={false} depthWrite={false} />
    </lineSegments>
  );
};

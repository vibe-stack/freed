'use client';

import React, { useMemo } from 'react';
import { Color, Vector3 } from 'three';
import { useGeometryStore } from '../../stores/geometry-store';
import { Face, Vertex } from '../../types/geometry';
import { convertQuadToTriangles } from '../../utils/geometry';

const ORANGE = new Color(1.0, 0.5, 0.0);
const GREY = new Color(0.5, 0.5, 0.5);

interface FaceRendererProps {
  meshId: string;
  selectedFaceIds: string[];
  onFaceClick: (faceId: string, event: any) => void;
  selectionMode: string;
  localVertices?: Vertex[]; // For showing local changes during tool operations
}

export const FaceRenderer: React.FC<FaceRendererProps> = ({
  meshId,
  selectedFaceIds,
  onFaceClick,
  selectionMode,
  localVertices
}) => {
  const geometryStore = useGeometryStore();
  const mesh = geometryStore.meshes.get(meshId);
  
  // Merge local vertex overrides when provided
  const vertices = useMemo(() => {
    const base = mesh?.vertices || [];
    if (!localVertices || localVertices.length === 0) return base;
    const overrides = new Map(localVertices.map(v => [v.id, v] as const));
    return base.map(v => overrides.get(v.id) || v);
  }, [mesh?.vertices, localVertices]);
  const faces = mesh?.faces || [];
  
  const faceData = useMemo(() => {
    const vertexMap = new Map(vertices.map(v => [v.id, v]));
    
    return faces.map(face => {
      const faceVertices = face.vertexIds.map(vid => vertexMap.get(vid)).filter(Boolean);
      if (faceVertices.length < 3) return null;
      const isSelected = selectedFaceIds.includes(face.id);
      
      // Convert face to triangles for rendering
      const triangles = convertQuadToTriangles(face.vertexIds);
      const positions: number[] = [];
      const normals: number[] = [];
      triangles.forEach(tri => {
        const v0 = vertexMap.get(tri[0])!;
        const v1 = vertexMap.get(tri[1])!;
        const v2 = vertexMap.get(tri[2])!;
        const p0 = new Vector3(v0.position.x, v0.position.y, v0.position.z);
        const p1 = new Vector3(v1.position.x, v1.position.y, v1.position.z);
        const p2 = new Vector3(v2.position.x, v2.position.y, v2.position.z);
        const n = new Vector3().subVectors(p1, p0).cross(new Vector3().subVectors(p2, p0)).normalize();
        positions.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
        for (let i = 0; i < 3; i++) normals.push(n.x, n.y, n.z);
      });
      
      return {
        id: face.id,
        positions,
        normals,
        isSelected
      };
    }).filter(Boolean);
  }, [faces, vertices, selectedFaceIds]);

  const handleFacePointerDown = (faceId: string) => (event: any) => {
    if (selectionMode === 'face') {
      event.stopPropagation();
      onFaceClick(faceId, event);
    }
  };

  return (
    <>
      {faceData.map(face => {
        if (!face) return null;
        return (
          <mesh key={face.id} onPointerDown={handleFacePointerDown(face.id)} renderOrder={1000}>
            <bufferGeometry>
              {/* @ts-ignore */}
              <bufferAttribute attach="attributes-position" args={[new Float32Array(face.positions), 3]} />
              {/* @ts-ignore */}
              <bufferAttribute attach="attributes-normal" args={[new Float32Array(face.normals), 3]} />
            </bufferGeometry>
            <meshBasicMaterial color={face.isSelected ? ORANGE : GREY} side={2} transparent opacity={0.5} depthWrite={false} />
          </mesh>
        );
      })}
    </>
  );
};

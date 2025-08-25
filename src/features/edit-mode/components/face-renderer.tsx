'use client';

import React, { useMemo, useRef } from 'react';
import { Color, Vector3, BufferGeometry, Float32BufferAttribute, Mesh, DoubleSide } from 'three/webgpu';
import type { ThreeEvent } from '@react-three/fiber';
import { useGeometryStore } from '../../../stores/geometry-store';
import { Vertex } from '../../../types/geometry';
import { convertQuadToTriangles } from '../../../utils/geometry';

const ORANGE = new Color(1.0, 0.5, 0.0);
const GREY = new Color(0.5, 0.5, 0.5);

interface FaceRendererProps {
  meshId: string;
  selectedFaceIds: string[];
  onFaceClick: (faceId: string, event: ThreeEvent<PointerEvent>) => void;
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
  const meshSelRef = useRef<Mesh | null>(null);
  const meshUnRef = useRef<Mesh | null>(null);
  
  // Merge local vertex overrides when provided
  const vertices = useMemo(() => {
    const base = mesh?.vertices || [];
    if (!localVertices || localVertices.length === 0) return base;
    const overrides = new Map(localVertices.map(v => [v.id, v] as const));
    return base.map(v => overrides.get(v.id) || v);
  }, [mesh?.vertices, localVertices]);
  const faces = mesh?.faces || [];
  
  const batched = useMemo(() => {
    const vertexMap = new Map(vertices.map(v => [v.id, v] as const));
    const selSet = new Set(selectedFaceIds);
  const posSel: number[] = [];
  const normSel: number[] = [];
  const posUn: number[] = [];
  const normUn: number[] = [];
    const triToFaceSel: string[] = [];
    const triToFaceUn: string[] = [];
    for (const face of faces) {
      const faceVertices = face.vertexIds.map(vid => vertexMap.get(vid)).filter(Boolean);
      if (faceVertices.length < 3) continue;
      const isSelected = selSet.has(face.id);
      const triangles = convertQuadToTriangles(face.vertexIds);
      for (const tri of triangles) {
        const v0 = vertexMap.get(tri[0])!;
        const v1 = vertexMap.get(tri[1])!;
        const v2 = vertexMap.get(tri[2])!;
        const p0 = new Vector3(v0.position.x, v0.position.y, v0.position.z);
        const p1 = new Vector3(v1.position.x, v1.position.y, v1.position.z);
        const p2 = new Vector3(v2.position.x, v2.position.y, v2.position.z);
        const n = new Vector3().subVectors(p1, p0).cross(new Vector3().subVectors(p2, p0)).normalize();
        const targetPos = isSelected ? posSel : posUn;
        const targetNorm = isSelected ? normSel : normUn;
        targetPos.push(
          p0.x, p0.y, p0.z,
          p1.x, p1.y, p1.z,
          p2.x, p2.y, p2.z
        );
        for (let i = 0; i < 3; i++) targetNorm.push(n.x, n.y, n.z);
        if (isSelected) triToFaceSel.push(face.id);
        else triToFaceUn.push(face.id);
      }
    }
    const geoSel = new BufferGeometry();
    const geoUn = new BufferGeometry();
    if (posSel.length > 0) {
      geoSel.setAttribute('position', new Float32BufferAttribute(new Float32Array(posSel), 3));
      geoSel.setAttribute('normal', new Float32BufferAttribute(new Float32Array(normSel), 3));
      geoSel.computeBoundingSphere();
    }
    if (posUn.length > 0) {
      geoUn.setAttribute('position', new Float32BufferAttribute(new Float32Array(posUn), 3));
      geoUn.setAttribute('normal', new Float32BufferAttribute(new Float32Array(normUn), 3));
      geoUn.computeBoundingSphere();
    }
  return { geoSel, geoUn, triToFaceSel, triToFaceUn, hasSel: posSel.length > 0, hasUn: posUn.length > 0 };
  }, [faces, vertices, selectedFaceIds]);

  // no-op: picking handled on batched meshes

  return (
    <>
      {/* Unselected faces */}
      {batched.hasUn && (
        <mesh
          ref={meshUnRef}
          renderOrder={999}
          // Disable raycast when not in face mode so vertices/edges receive events
          raycast={selectionMode === 'face' ? (Mesh.prototype.raycast as unknown as any) : (() => {})}
          onClick={(e: ThreeEvent<PointerEvent>) => {
            if (selectionMode !== 'face') return;
            e.stopPropagation();
            const triIdx: number = e.faceIndex ?? -1; // faceIndex is the triangle index
            if (triIdx < 0) return;
            const fid = batched.triToFaceUn[triIdx] as string | undefined;
            if (fid) onFaceClick(fid, e);
          }}
        >
          {/* Use built BufferGeometry to avoid zero-sized GPU buffers issues on WebGPU */}
          <primitive attach="geometry" object={batched.geoUn} />
          <meshBasicMaterial color={GREY} side={DoubleSide} transparent opacity={0.5} depthWrite={false} />
        </mesh>
      )}
      {/* Selected faces */}
      {batched.hasSel && (
        <mesh
          ref={meshSelRef}
          renderOrder={1000}
          raycast={selectionMode === 'face' ? (Mesh.prototype.raycast as unknown as any) : (() => {})}
          onClick={(e: ThreeEvent<PointerEvent>) => {
            if (selectionMode !== 'face') return;
            e.stopPropagation();
            const triIdx: number = e.faceIndex ?? -1;
            if (triIdx < 0) return;
            const fid = batched.triToFaceSel[triIdx] as string | undefined;
            if (fid) onFaceClick(fid, e);
          }}
        >
          <primitive attach="geometry" object={batched.geoSel} />
          <meshBasicMaterial color={ORANGE} side={DoubleSide} transparent opacity={0.5} depthWrite={false} />
        </mesh>
      )}
    </>
  );
};

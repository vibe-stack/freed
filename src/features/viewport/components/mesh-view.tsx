'use client';

import React, { useMemo } from 'react';
import { BufferGeometry, DoubleSide, Float32BufferAttribute, MeshStandardMaterial, Color, Vector3 } from 'three';
import { useViewportStore } from '@/stores/viewport-store';
import { useGeometryStore } from '@/stores/geometry-store';
import { useSceneStore } from '@/stores/scene-store';
import { useSelection, useSelectionStore } from '@/stores/selection-store';
import { convertQuadToTriangles } from '@/utils/geometry';

type Props = { objectId: string };

const MeshView: React.FC<Props> = ({ objectId }) => {
  const scene = useSceneStore();
  const geometryStore = useGeometryStore();
  const selection = useSelection();
  const selectionActions = useSelectionStore();
  const obj = scene.objects[objectId];
  const mesh = obj?.meshId ? geometryStore.meshes.get(obj.meshId) : undefined;
  const shading = useViewportStore((s) => s.shadingMode);
  const isSelected = selection.objectIds.includes(objectId);

  const { geom, mat } = useMemo(() => {
    if (!mesh) return { geom: undefined, mat: undefined } as any;

    const geo = new BufferGeometry();
    const vertexMap = new Map(mesh.vertices.map((v) => [v.id, v] as const));
    const positions: number[] = [];
    const normals: number[] = [];

    mesh.faces.forEach((face) => {
      const tris = convertQuadToTriangles(face.vertexIds);
      tris.forEach((tri) => {
        const v0 = vertexMap.get(tri[0])!;
        const v1 = vertexMap.get(tri[1])!;
        const v2 = vertexMap.get(tri[2])!;
        const p0 = new Vector3(v0.position.x, v0.position.y, v0.position.z);
        const p1 = new Vector3(v1.position.x, v1.position.y, v1.position.z);
        const p2 = new Vector3(v2.position.x, v2.position.y, v2.position.z);
        const faceNormal = new Vector3()
          .subVectors(p1, p0)
          .cross(new Vector3().subVectors(p2, p0))
          .normalize();
        positions.push(
          p0.x,
          p0.y,
          p0.z,
          p1.x,
          p1.y,
          p1.z,
          p2.x,
          p2.y,
          p2.z
        );
        for (let i = 0; i < 3; i++) normals.push(faceNormal.x, faceNormal.y, faceNormal.z);
      });
    });

    geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new Float32BufferAttribute(normals, 3));
    geo.computeBoundingSphere();

    const material = new MeshStandardMaterial({
      color: new Color(isSelected ? 0.45 : 0.8, isSelected ? 0.65 : 0.8, isSelected ? 1.0 : 0.85),
      roughness: 0.8,
      metalness: 0.05,
      wireframe: shading === 'wireframe',
      side: DoubleSide,
      flatShading: true,
    });

    return { geom: geo, mat: material };
  }, [mesh, shading, isSelected]);

  if (!obj || !mesh || !geom || !mat) return null as any;

  const onPointerDown = (e: any) => {
    if (selection.viewMode === 'object') {
      e.stopPropagation();
      scene.selectObject(objectId);
      selectionActions.selectObjects([objectId]);
    }
  };

  const onDoubleClick = (e: any) => {
    e.stopPropagation();
    if (selection.viewMode === 'object' && obj.meshId) {
      selectionActions.enterEditMode(obj.meshId);
    }
  };

  return (
    <group
      position={[obj.transform.position.x, obj.transform.position.y, obj.transform.position.z]}
      rotation={[obj.transform.rotation.x, obj.transform.rotation.y, obj.transform.rotation.z]}
      scale={[obj.transform.scale.x, obj.transform.scale.y, obj.transform.scale.z]}
      visible={obj.visible}
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
    >
      {/* @ts-ignore */}
      <mesh geometry={geom} material={mat as any} raycast={selection.viewMode === 'edit' ? ((_: any) => {}) : undefined} />
    </group>
  );
};

export default MeshView;

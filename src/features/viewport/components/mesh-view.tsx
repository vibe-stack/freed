'use client';

import React, { useMemo } from 'react';
import { BufferGeometry, DoubleSide, Float32BufferAttribute, MeshStandardMaterial, Color, Vector3, Raycaster, Intersection, Material, Mesh } from 'three';
import { useViewportStore } from '@/stores/viewport-store';
import { useGeometryStore } from '@/stores/geometry-store';
import { useSceneStore } from '@/stores/scene-store';
import { useSelectionStore, useViewMode } from '@/stores/selection-store';
import { useToolStore } from '@/stores/tool-store';
import { convertQuadToTriangles } from '@/utils/geometry';
import { useObjectModifiers } from '@/stores/modifier-store';
import { applyModifiersToMesh } from '@/utils/modifiers';

type Props = { objectId: string; noTransform?: boolean };

const MeshView: React.FC<Props> = ({ objectId, noTransform = false }) => {
  const scene = useSceneStore();
  const geometryStore = useGeometryStore();
  const viewMode = useViewMode();
  const editMeshId = useSelectionStore((s) => s.selection.meshId);
  const selectionActions = useSelectionStore();
  const obj = scene.objects[objectId];
  const mesh = obj?.meshId ? geometryStore.meshes.get(obj.meshId) : undefined;
  const shading = useViewportStore((s) => s.shadingMode);
  const isSelected = useSelectionStore((s) => s.selection.objectIds.includes(objectId));
  const tool = useToolStore();
  const isLocked = !!obj?.locked;
  const modifiers = useObjectModifiers(objectId);

  // Evaluate modifier stack at render time (non-destructive). In edit mode for the target mesh, show base geometry to avoid breaking edit overlays.
  const displayMesh = useMemo(() => {
    if (!mesh) return undefined;
    const editingThis = viewMode === 'edit' && obj?.meshId && obj.meshId === editMeshId;
    if (editingThis) return mesh;
    const activeMods = modifiers.filter((m) => m.enabled);
    if (activeMods.length === 0) return mesh;
    try {
      return applyModifiersToMesh(mesh, activeMods);
    } catch {
      return mesh;
    }
  }, [mesh, modifiers, viewMode, editMeshId, obj?.meshId]);

  const geomAndMat = useMemo<{ geom: BufferGeometry; mat: MeshStandardMaterial } | null>(() => {
    const dmesh = displayMesh;
    if (!dmesh) return null;

    const geo = new BufferGeometry();
    const vertexMap = new Map(dmesh.vertices.map((v) => [v.id, v] as const));
  const positions: number[] = [];
  const normals: number[] = [];

    dmesh.faces.forEach((face) => {
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
  const useSmooth = (dmesh.shading ?? 'flat') === 'smooth';
        if (useSmooth) {
          const n0 = v0.normal; const n1 = v1.normal; const n2 = v2.normal;
          normals.push(n0.x, n0.y, n0.z, n1.x, n1.y, n1.z, n2.x, n2.y, n2.z);
        } else {
          for (let i = 0; i < 3; i++) normals.push(faceNormal.x, faceNormal.y, faceNormal.z);
        }
      });
    });

    geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new Float32BufferAttribute(normals, 3));
    geo.computeBoundingSphere();

    // Material selection: use mesh.materialId when shading === 'material'
    let color = new Color(0.8, 0.8, 0.85);
    let roughness = 0.8;
    let metalness = 0.05;
    let emissive = new Color(0, 0, 0);
  let emissiveIntensity = 1;
  if (shading === 'material' && dmesh.materialId) {
      const matRes = geometryStore.materials.get(dmesh.materialId);
      if (matRes) {
        color = new Color(matRes.color.x, matRes.color.y, matRes.color.z);
        roughness = matRes.roughness;
        metalness = matRes.metalness;
        emissive = new Color(matRes.emissive.x, matRes.emissive.y, matRes.emissive.z);
    emissiveIntensity = matRes.emissiveIntensity ?? 1;
      }
    }
    // Highlight selection with orange override in non-material modes
    if (isSelected && shading !== 'material') {
      color = new Color('#ff9900');
    }
    const material = new MeshStandardMaterial({
      color,
      roughness,
      metalness,
      emissive,
  emissiveIntensity,
      wireframe: shading === 'wireframe',
      side: DoubleSide,
      flatShading: (dmesh.shading ?? 'flat') === 'flat',
      // Use back-face shadowing to mitigate acne on coplanar/thin meshes
      shadowSide: 1, // BackSide in three constants
    });

    return { geom: geo, mat: material };
  }, [
    // Rebuild when topology or vertex attributes change
    displayMesh?.vertices,
    displayMesh?.faces,
    displayMesh?.materialId,
    displayMesh?.shading,
    shading,
    isSelected,
    geometryStore.materials,
  ]);

  if (!obj || !displayMesh || !geomAndMat) return null;

  const onPointerDown = (e: React.PointerEvent) => {
    if (viewMode === 'object') {
      if (isLocked) return; // ignore interactions when locked
      e.stopPropagation();
      const isShift = e.shiftKey;
      if (isShift) selectionActions.toggleObjectSelection(objectId);
      else selectionActions.selectObjects([objectId], false);
      scene.selectObject(objectId);
    }
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLocked) return;
    if (viewMode === 'object' && obj.meshId) {
      selectionActions.enterEditMode(obj.meshId);
    }
  };

  // Choose transform source: live localData during active tool, otherwise scene store
  const t = (() => {
    if (tool.isActive && tool.localData && tool.localData.kind === 'object-transform') {
      const lt = tool.localData.transforms[objectId];
      if (lt) return lt;
    }
    return obj.transform;
  })();

  // Important: never leave an own `raycast` property as undefined, it shadows Mesh.prototype.raycast.
  // Use noop to disable and the prototype method to enable.
  const raycastFn: ((raycaster: Raycaster, intersects: Intersection[]) => void) | undefined =
    isLocked
      ? (() => {})
      : (viewMode === 'edit' && obj.meshId === editMeshId)
      ? (() => {})
      : (Mesh.prototype.raycast as unknown as (raycaster: Raycaster, intersects: Intersection[]) => void);

  const meshEl = (
    <mesh
      geometry={geomAndMat.geom}
      material={geomAndMat.mat as unknown as Material}
  castShadow={!!displayMesh.castShadow && shading === 'material'}
  receiveShadow={!!displayMesh.receiveShadow && shading === 'material'}
      // Disable raycast when locked so clicks pass through
      // In edit mode, disable raycast only for the specific object being edited
      raycast={raycastFn}
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
    />
  );

  if (noTransform) return meshEl;

  return (
    <group
      position={[t.position.x, t.position.y, t.position.z]}
      rotation={[t.rotation.x, t.rotation.y, t.rotation.z]}
      scale={[t.scale.x, t.scale.y, t.scale.z]}
      visible={obj.visible}
      castShadow
      receiveShadow
    >
      {meshEl}
    </group>
  );
};

export default MeshView;

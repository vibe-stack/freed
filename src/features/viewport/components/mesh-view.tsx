'use client';

import React, { useMemo, useRef } from 'react';
import { BufferGeometry, DoubleSide, Float32BufferAttribute, MeshStandardMaterial, Color, Vector3, Raycaster, Intersection, Material, Mesh } from 'three/webgpu';
import { useViewportStore } from '@/stores/viewport-store';
import { useGeometryStore } from '@/stores/geometry-store';
import { useSceneStore } from '@/stores/scene-store';
import { useSelectionStore, useViewMode } from '@/stores/selection-store';
import { useToolStore } from '@/stores/tool-store';
import { convertQuadToTriangles } from '@/utils/geometry';
import { useObjectModifiers } from '@/stores/modifier-store';
import { applyModifiersToMesh } from '@/utils/modifiers';
import { useMaterialNodes } from '@/features/materials/hooks/use-material-nodes';

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
  const uvs: number[] = [];
  const uvs2: number[] = [];

    dmesh.faces.forEach((face) => {
      const tris = convertQuadToTriangles(face.vertexIds);
      tris.forEach((tri) => {
        const v0 = vertexMap.get(tri[0])!; const v1 = vertexMap.get(tri[1])!; const v2 = vertexMap.get(tri[2])!;
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
        // Per-loop UVs: if face.uvs present, map vertex index within face
        const loopUV = (vid: string) => {
          if (!face.uvs) return vertexMap.get(vid)!.uv;
          const idx = face.vertexIds.indexOf(vid);
          return face.uvs[idx] || vertexMap.get(vid)!.uv;
        };
        const uv0 = loopUV(tri[0]); const uv1 = loopUV(tri[1]); const uv2_ = loopUV(tri[2]);
        uvs.push(uv0.x, uv0.y, uv1.x, uv1.y, uv2_.x, uv2_.y);
  // Optional uv2
  const u20 = v0.uv2 ?? uv0; const u21 = v1.uv2 ?? uv1; const u22 = v2.uv2 ?? uv2_;
  uvs2.push(u20.x, u20.y, u21.x, u21.y, u22.x, u22.y);
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
  if (uvs.length) geo.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  if (uvs2.length) (geo as any).setAttribute('uv2', new Float32BufferAttribute(uvs2, 2));
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
    // Default to 1 when not specified; 0 kills emissive which can hide bloom
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
    displayMesh,
    shading,
    isSelected,
    geometryStore.materials,
  ]);

  // Node-based material integration (only in material shading mode)
  const nodeMaterial = useMaterialNodes(shading === 'material' ? displayMesh?.materialId : undefined);

  // Effective emissive intensity used when applying node materials
  const emissiveIntensityForNode = useMemo(() => {
    let ei = 1;
    if (shading === 'material' && displayMesh?.materialId) {
      const matRes = geometryStore.materials.get(displayMesh.materialId);
      if (matRes) ei = matRes.emissiveIntensity ?? 1;
    }
    return ei;
  }, [shading, displayMesh?.materialId, geometryStore.materials]);

  // Track the pointer-down position to distinguish orbit/drag from a click
  const downRef = useRef<{ x: number; y: number; id: string } | null>(null);

  if (!obj || !displayMesh || !geomAndMat) return null;

  const onPointerDown = (e: React.PointerEvent) => {
    if (viewMode !== 'object') return;
    if (isLocked) return;
    // Do NOT stop propagation here, we want OrbitControls to receive this for orbiting
    downRef.current = { x: e.clientX, y: e.clientY, id: objectId };
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (viewMode !== 'object') return;
    if (isLocked) return;
    const start = downRef.current;
    downRef.current = null;
    if (!start) return;
    // Require same mesh and small movement threshold (<= 10 px)
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    const dist = Math.hypot(dx, dy);
    const sameMesh = start.id === objectId;
    if (!sameMesh || dist > 10) return; // treat as orbit/drag, not a click selection
    // True click: select
    e.stopPropagation();
    const isShift = e.shiftKey;
    if (isShift) selectionActions.toggleObjectSelection(objectId);
    else selectionActions.selectObjects([objectId], false);
    scene.selectObject(objectId);
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
      ? (() => { })
      : (viewMode === 'edit' && obj.meshId === editMeshId)
        ? (() => { })
        : (Mesh.prototype.raycast as unknown as (raycaster: Raycaster, intersects: Intersection[]) => void);

  // If we have a TSL node material, prefer it always (TSL-only system)
  const activeMaterial: Material = (nodeMaterial as unknown as Material) ?? (geomAndMat.mat as unknown as Material);
  // Apply viewport flags to node material too
  if (nodeMaterial) {
    (nodeMaterial as any).wireframe = shading === 'wireframe';
    (nodeMaterial as any).flatShading = (displayMesh.shading ?? 'flat') === 'flat';
    // Enforce double-sided rendering always for materials
    (nodeMaterial as any).side = DoubleSide;
    (nodeMaterial as any).shadowSide = 1; // BackSide
  // Carry emissive intensity through to node materials when available
  // Node materials from TSL support emissiveIntensity like standard node materials
  (nodeMaterial as any).emissiveIntensity = emissiveIntensityForNode;
  }

  const meshEl = (
    <mesh
      geometry={geomAndMat.geom}
      material={activeMaterial}
      castShadow={!!displayMesh.castShadow}
      receiveShadow={!!displayMesh.receiveShadow}
      // Disable raycast when locked so clicks pass through
      // In edit mode, disable raycast only for the specific object being edited
      raycast={raycastFn}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
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

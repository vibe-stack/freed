'use client';

import React, { useRef } from 'react';
import { Raycaster, Intersection, Mesh } from 'three/webgpu';
import useDisplayMesh from '../hooks/useDisplayMesh';
import useGeometryAndMaterial from '../hooks/useGeometryAndMaterial';
import { useViewportStore } from '@/stores/viewport-store';
import { useGeometryStore } from '@/stores/geometry-store';
import { useSceneStore } from '@/stores/scene-store';
import { useSelectionStore, useViewMode } from '@/stores/selection-store';
import { useToolStore } from '@/stores/tool-store';
import { useObjectModifiers } from '@/stores/modifier-store';
import useShaderMaterialRenderer from './use-shader-material-renderer';

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
  const displayMesh = useDisplayMesh({ mesh, modifiers, viewMode, editMeshId, objMeshId: obj?.meshId });

  const geomAndMat = useGeometryAndMaterial({ displayMesh, shading, isSelected, materials: geometryStore.materials });

  // Material renderer hook returns the final material (node material preferred)
  const activeMaterial = useShaderMaterialRenderer({ displayMesh, shading, isSelected, materials: geometryStore.materials });

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

  // geomAndMat.mat was a placeholder earlier; ensure we use the material from the hook
  // NOTE: geomAndMat.mat is no longer used directly.

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

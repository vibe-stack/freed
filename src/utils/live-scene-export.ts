"use client";

// Build an export THREE.Scene from the live R3F scene graph, excluding helpers and overlays.

import {
  Scene,
  Group,
  Object3D,
  Mesh as ThreeMesh,
  MeshStandardMaterial,
} from 'three/webgpu';
import { getObject3D } from '@/features/viewport/hooks/object3d-registry';
import { useSceneStore } from '@/stores/scene-store';
import { useGeometryStore } from '@/stores/geometry-store';
import type { ExportFormat } from '@/utils/three-export';

type BuildFromLiveParams = {
  includeObjectIds: string[];
  includeChildren: boolean;
  format: ExportFormat;
};

// Helpers to identify editor-only objects that must not be exported
const isHelperObject = (o: Object3D): boolean => {
  // Remove common helper types and anything we explicitly tag later if needed
  const t = (o as any).type as string | undefined;
  if (!t) return false;
  if (t.endsWith('Helper')) return true; // CameraHelper, SpotLightHelper, etc.
  if (t === 'GridHelper' || t === 'AxesHelper') return true;
  // Drei's useHelper sometimes sets name or userData
  if ((o.name ?? '').toLowerCase().includes('helper')) return true;
  if ((o.userData && (o.userData as any).__helper) === true) return true;
  return false;
};

const deepCloneWithoutHelpers = (root: Object3D): Object3D => {
  // Clone hierarchy
  const clone = root.clone(true);
  // Remove helpers and ensure unique material/geometry instances
  const toRemove: Object3D[] = [];
  clone.traverse((child: any) => {
    if (isHelperObject(child)) {
      toRemove.push(child);
      return;
    }
    // Detach editor-only raycast overrides (noop functions) if any
    if ('raycast' in child && typeof child.raycast === 'function' && child.raycast.length === 0) {
      delete child.raycast;
    }
    if (child.isMesh) {
      if (child.geometry?.clone) child.geometry = child.geometry.clone();
      if (Array.isArray(child.material)) {
        child.material = child.material.map((m: any) => (m?.clone ? m.clone() : m));
      } else if (child.material?.clone) {
        child.material = child.material.clone();
      }
    }
  });
  toRemove.forEach((c) => c.parent?.remove(c));
  return clone;
};

// Convert NodeMaterials and non-PBR viewport materials to MeshStandardMaterial using store values
const normalizeMaterialsForFormat = (group: Object3D, owningObjectId: string, format: ExportFormat) => {
  const sceneState = useSceneStore.getState();
  const geomState = useGeometryStore.getState();
  const obj = sceneState.objects[owningObjectId];
  const meshRes = obj?.meshId ? geomState.meshes.get(obj.meshId) : undefined;
  const matRes = meshRes?.materialId ? geomState.materials.get(meshRes.materialId) : undefined;

  group.traverse((child: any) => {
    if (!child.isMesh) return;
    // Always export cast/receive flags as they are in the live scene
    if ((format === 'gltf' || format === 'glb') && child.material) {
      const isNodeMat = Boolean((child.material as any)?.isNodeMaterial);
      const isStd = Boolean((child.material as any)?.isMeshStandardMaterial);
      if (isNodeMat || !isStd) {
        // Replace with a MeshStandardMaterial snapshot from our internal material store if available
        const m = new MeshStandardMaterial();
        if (matRes) {
          m.color.setRGB(matRes.color.x, matRes.color.y, matRes.color.z);
          m.roughness = matRes.roughness;
          m.metalness = matRes.metalness;
          m.emissive.setRGB(matRes.emissive.x, matRes.emissive.y, matRes.emissive.z);
          m.emissiveIntensity = matRes.emissiveIntensity ?? 1;
        }
        // Preserve shading flags
        (m as any).flatShading = (meshRes?.shading ?? 'flat') === 'flat';
        (m as any).side = (child.material as any).side ?? m.side;
        (m as any).wireframe = false; // never export wireframe
        child.material = m;
      }
    }
  });
};

// Ensure light intensities are the "real" values from store (viewport non-material mode may zero them)
const restoreLightParamsFromStore = (group: Object3D, owningObjectId: string) => {
  const sceneState = useSceneStore.getState();
  const obj = sceneState.objects[owningObjectId];
  if (!obj || obj.type !== 'light' || !obj.lightId) return;
  const lightRes = sceneState.lights[obj.lightId];
  if (!lightRes) return;
  group.traverse((child: any) => {
    if (child.isLight) {
      if (typeof lightRes.intensity === 'number') child.intensity = lightRes.intensity;
      if ('distance' in child && typeof lightRes.distance === 'number') child.distance = lightRes.distance;
      if ('angle' in child && typeof lightRes.angle === 'number') child.angle = lightRes.angle;
      if ('penumbra' in child && typeof lightRes.penumbra === 'number') child.penumbra = lightRes.penumbra;
      if ('decay' in child && typeof lightRes.decay === 'number') child.decay = lightRes.decay;
      if (lightRes.color) child.color.setRGB(lightRes.color.x, lightRes.color.y, lightRes.color.z);
      // Shadow defaults sensible for export
      if ('castShadow' in child) child.castShadow = true;
    }
  });
};

export function buildExportSceneFromLive(params: BuildFromLiveParams): Scene {
  const sceneOut = new Scene();
  const { includeObjectIds, includeChildren, format } = params;

  // Expand include set with children from scene store if requested
  const sceneState = useSceneStore.getState();
  const include = new Set<string>();
  const addWithChildren = (id: string) => {
    if (include.has(id)) return;
    include.add(id);
    if (!includeChildren) return;
    const o = sceneState.objects[id];
    if (o) o.children.forEach(addWithChildren);
  };
  includeObjectIds.forEach(addWithChildren);

  // For each id, locate the live Object3D root and clone it for export
  for (const id of include) {
    const live = getObject3D(id);
    if (!live) continue; // object not mounted or hidden-view; skip
    const cloned = deepCloneWithoutHelpers(live);
    // Normalize materials depending on format (notably GLTF/GLB) and restore light params
    normalizeMaterialsForFormat(cloned, id, format);
    restoreLightParamsFromStore(cloned, id);
    // Attach to export scene
    // Preserve transform baked into the group already
    sceneOut.add(cloned);
  }

  return sceneOut;
}

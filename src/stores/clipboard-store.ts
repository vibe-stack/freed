'use client';

import { create } from 'zustand';
import { Mesh, SceneObject } from '@/types/geometry';
import { useSelectionStore } from './selection-store';
import { useSceneStore } from './scene-store';
import { useGeometryStore } from './geometry-store';
import { createVertex, createFace, createMeshFromGeometry } from '@/utils/geometry';

type ClipboardPayload = {
  objects: SceneObject[];
  meshes: Record<string, Mesh>; // by meshId
};

interface ClipboardState {
  hasClipboard: boolean;
  payload: ClipboardPayload | null;
  copySelection: () => void;
  cutSelection: () => void;
  paste: () => void;
  clear: () => void;
}

function deepCloneMeshWithNewIds(mesh: Mesh): Mesh {
  // Recreate vertices/faces and rebuild edges to ensure new IDs everywhere
  const newVertices = mesh.vertices.map((v) => createVertex({ ...v.position }, { ...v.normal }, { ...v.uv }));
  // Map old vertex id -> new vertex id
  const vidMap = new Map<string, string>();
  mesh.vertices.forEach((v, i) => vidMap.set(v.id, newVertices[i].id));
  const newFaces = mesh.faces.map((f) => createFace(f.vertexIds.map((old) => vidMap.get(old)!)));
  const newMesh = createMeshFromGeometry(mesh.name, newVertices, newFaces);
  newMesh.visible = mesh.visible;
  newMesh.locked = mesh.locked;
  // Preserve transform defaults (meshes in this app don't seem to use mesh.transform in rendering)
  newMesh.transform = JSON.parse(JSON.stringify(mesh.transform));
  return newMesh;
}

export const useClipboardStore = create<ClipboardState>((set, get) => ({
  hasClipboard: false,
  payload: null,
  clear: () => set({ hasClipboard: false, payload: null }),
  copySelection: () => {
    const selection = useSelectionStore.getState().selection;
    if (selection.viewMode !== 'object' || selection.objectIds.length === 0) return;
    const scene = useSceneStore.getState();
    const geo = useGeometryStore.getState();
    const objects: SceneObject[] = [];
    const meshes: Record<string, Mesh> = {};
    selection.objectIds.forEach((oid) => {
      const obj = scene.objects[oid];
      if (!obj) return;
      objects.push(JSON.parse(JSON.stringify(obj)));
      if (obj.meshId) {
        const m = geo.meshes.get(obj.meshId);
        if (m && !meshes[m.id]) meshes[m.id] = JSON.parse(JSON.stringify(m));
      }
    });
    set({ hasClipboard: true, payload: { objects, meshes } });
  },
  cutSelection: () => {
    const selection = useSelectionStore.getState().selection;
    if (selection.viewMode !== 'object' || selection.objectIds.length === 0) return;
    get().copySelection();
    // Remove from scene
    const scene = useSceneStore.getState();
    selection.objectIds.forEach((oid) => scene.removeObject(oid));
    useSelectionStore.getState().clearSelection();
  },
  paste: () => {
    const { payload } = get();
    if (!payload) return;
    const scene = useSceneStore.getState();
    const geo = useGeometryStore.getState();
    const selectionActions = useSelectionStore.getState();

    const oldToNewMeshId = new Map<string, string>();
    const newObjectIds: string[] = [];

    // Clone meshes with new IDs first
    Object.values(payload.meshes).forEach((mesh) => {
      const newMesh = deepCloneMeshWithNewIds(mesh);
      geo.addMesh(newMesh);
      oldToNewMeshId.set(mesh.id, newMesh.id);
    });

    // Paste objects with slight offset to avoid overlap
    const offset = 0.5; // simple constant offset per paste
    payload.objects.forEach((obj) => {
      const clone: SceneObject = {
        ...JSON.parse(JSON.stringify(obj)),
        id: crypto.randomUUID(),
        parentId: null, // paste at root to keep it simple
        children: [],
      };
      if (clone.meshId) {
        const newMeshId = oldToNewMeshId.get(obj.meshId!);
        if (newMeshId) clone.meshId = newMeshId;
      }
      // Offset position slightly
      clone.transform.position.x += offset;
      clone.transform.position.z += offset;
      scene.addObject(clone);
      newObjectIds.push(clone.id);
    });

    // Select the newly pasted objects
    selectionActions.setViewMode('object');
    selectionActions.selectObjects(newObjectIds, false);
  },
}));

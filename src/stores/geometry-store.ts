import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { subscribeWithSelector } from 'zustand/middleware';
import { useMemo } from 'react';
import { Mesh, Material, CameraResource, CameraType } from '../types/geometry';
import type { ShaderGraph } from '@/types/shader';
import { nanoid } from 'nanoid';
import { useSceneStore } from './scene-store';
import { applyModifiersToMesh, type ModifierStackItem, type ModifierType, createDefaultSettings } from '../utils/modifiers';
import {
  createCubeMesh,
  calculateVertexNormals,
  createPlaneMesh,
  createCylinderMesh,
  createConeMesh,
  createUVSphereMesh,
  createIcoSphereMesh,
  createTorusMesh,
  buildEdgesFromFaces,
} from '../utils/geometry';
import { enableMapSet } from 'immer';
import { temporal } from 'zundo';

enableMapSet();

interface GeometryState {
  meshes: Map<string, Mesh>;
  materials: Map<string, Material>;
  // Material shader graphs
  shaderGraphs: Map<string, ShaderGraph>; // key: materialId
  selectedMeshId: string | null;
  // Map objectId -> array stack top-to-bottom
  modifierStacks: Record<string, ModifierStackItem[]>;
  // Camera resources (by cameraId referenced from Scene objects)
  cameras: Record<string, CameraResource>;
}

interface GeometryActions {
  // Mesh operations
  addMesh: (mesh: Mesh) => void;
  removeMesh: (meshId: string) => void;
  updateMesh: (meshId: string, updater: (mesh: Mesh) => void) => void;
  selectMesh: (meshId: string | null) => void;
  reset: () => void;
  // UV seams
  setEdgeSeams: (meshId: string, edgeIds: string[], seam: boolean) => void;
  clearAllSeams: (meshId: string) => void;

  // Material operations
  addMaterial: (material: Material) => void;
  removeMaterial: (materialId: string) => void;
  updateMaterial: (materialId: string, updater: (material: Material) => void) => void;

  // Shader graph operations (by material)
  ensureDefaultGraph: (materialId: string) => void;
  setShaderGraph: (materialId: string, graph: ShaderGraph) => void;
  updateShaderGraph: (materialId: string, updater: (graph: ShaderGraph) => void) => void;
  removeShaderGraph: (materialId: string) => void;

  // Utility operations
  createCube: (size?: number) => string;
  createPlane: (width?: number, height?: number, wSeg?: number, hSeg?: number) => string;
  createCylinder: (radiusTop?: number, radiusBottom?: number, height?: number, radialSegments?: number, heightSegments?: number) => string;
  createCone: (radius?: number, height?: number, radialSegments?: number, heightSegments?: number) => string;
  createUVSphere: (radius?: number, widthSegments?: number, heightSegments?: number) => string;
  createIcoSphere: (radius?: number, subdivisions?: number) => string;
  createTorus: (ringRadius?: number, tubeRadius?: number, radialSegments?: number, tubularSegments?: number) => string;
  replaceGeometry: (meshId: string, vertices: Mesh['vertices'], faces: Mesh['faces']) => void;
  recalculateNormals: (meshId: string) => void;

  // Modifier operations (by Scene objectId)
  addModifier: (objectId: string, type: ModifierType) => string; // returns modifier id
  removeModifier: (objectId: string, modifierId: string) => void;
  moveModifier: (objectId: string, fromIndex: number, toIndex: number) => void;
  setModifierEnabled: (objectId: string, modifierId: string, enabled: boolean) => void;
  updateModifierSettings: (objectId: string, modifierId: string, updater: (settings: any) => void) => void;
  applyModifier: (objectId: string, modifierId: string) => void;
  clearAllModifiers: (objectId: string) => void;

  // Camera resources
  addCamera: (camera: CameraResource) => void;
  updateCamera: (cameraId: string, updater: (cam: CameraResource) => void) => void;
  removeCamera: (cameraId: string) => void;
}

type GeometryStore = GeometryState & GeometryActions;

export const useGeometryStore = create<GeometryStore>()(
  temporal(
    subscribeWithSelector(
      immer((set, _get) => ({
        // Initial state
        meshes: new Map(),
        materials: new Map(),
        shaderGraphs: new Map(),
        selectedMeshId: null,
        modifierStacks: {},
        cameras: {},

        // Mesh operations
        addMesh: (mesh: Mesh) => {
          set((state) => {
            state.meshes.set(mesh.id, mesh);
          });
        },

        removeMesh: (meshId: string) => {
          set((state) => {
            state.meshes.delete(meshId);
            if (state.selectedMeshId === meshId) {
              state.selectedMeshId = null;
            }
          });
        },

        updateMesh: (meshId: string, updater: (mesh: Mesh) => void) => {
          set((state) => {
            const mesh = state.meshes.get(meshId);
            if (mesh) {
              updater(mesh);
              // Ensure array identity changes so memoized consumers update
              mesh.vertices = mesh.vertices.slice();
              // Also clone faces/edges arrays to propagate topology changes to renderers
              mesh.faces = mesh.faces.slice();
              mesh.edges = mesh.edges.slice();
            }
          });
        },
        // UV seams
        setEdgeSeams: (meshId, edgeIds, seam) => {
          set((state) => {
            const mesh = state.meshes.get(meshId);
            if (!mesh) return;
            const set = new Set(edgeIds);
            for (const e of mesh.edges) if (set.has(e.id)) e.seam = !!seam;
            mesh.edges = mesh.edges.slice();
          });
        },
        clearAllSeams: (meshId) => {
          set((state) => {
            const mesh = state.meshes.get(meshId);
            if (!mesh) return;
            for (const e of mesh.edges) e.seam = false;
            mesh.edges = mesh.edges.slice();
          });
        },

        selectMesh: (meshId: string | null) => {
          set((state) => {
            state.selectedMeshId = meshId;
          });
        },
        reset: () => {
          set((state) => {
            state.meshes = new Map();
            state.materials = new Map();
            state.shaderGraphs = new Map();
            state.selectedMeshId = null;
            state.cameras = {};
          });
        },

        // Material operations
        addMaterial: (material: Material) => {
          set((state) => {
            state.materials.set(material.id, material);
            // lazily create a default graph when material is created
            if (!state.shaderGraphs.has(material.id)) {
              const idIn = nanoid();
              const idOut = nanoid();
              state.shaderGraphs.set(material.id, {
                materialId: material.id,
                nodes: [
                  { id: idIn, type: 'input', position: { x: 40, y: 160 } } as any,
                  { id: idOut, type: 'output-standard', position: { x: 760, y: 160 } } as any,
                  { id: 'color', type: 'const-color', position: { x: 360, y: 80 }, data: { r: material.color.x, g: material.color.y, b: material.color.z } } as any,
                  { id: 'rough', type: 'const-float', position: { x: 360, y: 200 }, data: { value: material.roughness } } as any,
                  { id: 'metal', type: 'const-float', position: { x: 360, y: 320 }, data: { value: material.metalness } } as any,
                  { id: 'emissive', type: 'const-color', position: { x: 360, y: 440 }, data: { r: material.emissive.x, g: material.emissive.y, b: material.emissive.z } } as any,
                  { id: 'emissiveIntensity', type: 'const-float', position: { x: 360, y: 560 }, data: { value: material.emissiveIntensity ?? 1 } } as any,
                ],
                edges: [
                  { id: nanoid(), source: 'color', sourceHandle: 'out', target: idOut, targetHandle: 'color' },
                  { id: nanoid(), source: 'rough', sourceHandle: 'out', target: idOut, targetHandle: 'roughness' },
                  { id: nanoid(), source: 'metal', sourceHandle: 'out', target: idOut, targetHandle: 'metalness' },
                  { id: nanoid(), source: 'emissive', sourceHandle: 'out', target: idOut, targetHandle: 'emissive' },
                  { id: nanoid(), source: 'emissiveIntensity', sourceHandle: 'out', target: idOut, targetHandle: 'emissiveIntensity' },
                ],
              });
            }
          });
        },

        removeMaterial: (materialId: string) => {
          set((state) => {
            state.materials.delete(materialId);
            state.shaderGraphs.delete(materialId);
          });
        },

        updateMaterial: (materialId: string, updater: (material: Material) => void) => {
          set((state) => {
            const material = state.materials.get(materialId);
            if (material) {
              updater(material);
            }
          });
        },

        // Shader graph operations
        ensureDefaultGraph: (materialId: string) => {
          set((state) => {
            if (state.shaderGraphs.has(materialId)) return;
            const idIn = nanoid();
            const idOut = nanoid();
            const mat = state.materials.get(materialId);
            state.shaderGraphs.set(materialId, {
              materialId,
              nodes: [
                { id: idIn, type: 'input', position: { x: 40, y: 160 } } as any,
                { id: idOut, type: 'output-standard', position: { x: 760, y: 160 } } as any,
                { id: 'color', type: 'const-color', position: { x: 360, y: 80 }, data: { r: mat?.color.x ?? 0.8, g: mat?.color.y ?? 0.8, b: mat?.color.z ?? 0.85 } } as any,
                { id: 'rough', type: 'const-float', position: { x: 360, y: 200 }, data: { value: mat?.roughness ?? 0.8 } } as any,
                { id: 'metal', type: 'const-float', position: { x: 360, y: 320 }, data: { value: mat?.metalness ?? 0.05 } } as any,
                { id: 'emissive', type: 'const-color', position: { x: 360, y: 440 }, data: { r: mat?.emissive.x ?? 0, g: mat?.emissive.y ?? 0, b: mat?.emissive.z ?? 0 } } as any,
                { id: 'emissiveIntensity', type: 'const-float', position: { x: 360, y: 560 }, data: { value: mat?.emissiveIntensity ?? 1 } } as any,
              ],
              edges: [
                { id: nanoid(), source: 'color', sourceHandle: 'out', target: idOut, targetHandle: 'color' },
                { id: nanoid(), source: 'rough', sourceHandle: 'out', target: idOut, targetHandle: 'roughness' },
                { id: nanoid(), source: 'metal', sourceHandle: 'out', target: idOut, targetHandle: 'metalness' },
                { id: nanoid(), source: 'emissive', sourceHandle: 'out', target: idOut, targetHandle: 'emissive' },
                { id: nanoid(), source: 'emissiveIntensity', sourceHandle: 'out', target: idOut, targetHandle: 'emissiveIntensity' },
              ],
            });
          });
        },
        setShaderGraph: (materialId: string, graph: ShaderGraph) => {
          set((state) => { state.shaderGraphs.set(materialId, graph); });
        },
        updateShaderGraph: (materialId: string, updater: (graph: ShaderGraph) => void) => {
          set((state) => {
            const g = state.shaderGraphs.get(materialId);
            if (g) {
              const next = { ...g, nodes: g.nodes.slice(), edges: g.edges.slice() };
              updater(next);
              state.shaderGraphs.set(materialId, next);
            }
          });
        },
        removeShaderGraph: (materialId: string) => {
          set((state) => { state.shaderGraphs.delete(materialId); });
        },

        // Utility operations
        createCube: (size: number = 1) => {
          const cube = createCubeMesh(size);
          set((state) => {
            state.meshes.set(cube.id, cube);
            state.selectedMeshId = cube.id;
          });
          return cube.id;
        },
        createPlane: (width = 1, height = 1, wSeg = 1, hSeg = 1) => {
          const mesh = createPlaneMesh(width, height, wSeg, hSeg);
          set((state) => {
            state.meshes.set(mesh.id, mesh);
            state.selectedMeshId = mesh.id;
          });
          return mesh.id;
        },
        createCylinder: (radiusTop = 0.5, radiusBottom = 0.5, height = 1.5, radialSegments = 16, heightSegments = 1) => {
          const mesh = createCylinderMesh(radiusTop, radiusBottom, height, radialSegments, heightSegments, true);
          set((state) => {
            state.meshes.set(mesh.id, mesh);
            state.selectedMeshId = mesh.id;
          });
          return mesh.id;
        },
        createCone: (radius = 0.5, height = 1.5, radialSegments = 16, heightSegments = 1) => {
          const mesh = createConeMesh(radius, height, radialSegments, heightSegments, true);
          set((state) => {
            state.meshes.set(mesh.id, mesh);
            state.selectedMeshId = mesh.id;
          });
          return mesh.id;
        },
        createUVSphere: (radius = 0.75, widthSegments = 16, heightSegments = 12) => {
          const mesh = createUVSphereMesh(radius, widthSegments, heightSegments);
          set((state) => {
            state.meshes.set(mesh.id, mesh);
            state.selectedMeshId = mesh.id;
          });
          return mesh.id;
        },
        createIcoSphere: (radius = 0.75, subdivisions = 1) => {
          const mesh = createIcoSphereMesh(radius, subdivisions);
          set((state) => {
            state.meshes.set(mesh.id, mesh);
            state.selectedMeshId = mesh.id;
          });
          return mesh.id;
        },
        createTorus: (ringRadius = 1, tubeRadius = 0.3, radialSegments = 16, tubularSegments = 24) => {
          const mesh = createTorusMesh(ringRadius, tubeRadius, radialSegments, tubularSegments);
          set((state) => {
            state.meshes.set(mesh.id, mesh);
            state.selectedMeshId = mesh.id;
          });
          return mesh.id;
        },
        replaceGeometry: (meshId, vertices, faces) => {
          set((state) => {
            const mesh = state.meshes.get(meshId);
            if (mesh) {
              mesh.vertices = vertices;
              mesh.faces = faces;
              mesh.edges = buildEdgesFromFaces(vertices, faces);
              mesh.vertices = calculateVertexNormals(mesh);
            }
          });
        },

        recalculateNormals: (meshId: string) => {
          set((state) => {
            const mesh = state.meshes.get(meshId);
            if (mesh) {
              mesh.vertices = calculateVertexNormals(mesh);
            }
          });
        },

        // Modifier operations
        addModifier: (objectId, type) => {
          const id = nanoid();
          set((state) => {
            const stack = state.modifierStacks[objectId] ?? [];
            const next = [...stack, { id, type, enabled: true, settings: createDefaultSettings(type) }];
            state.modifierStacks[objectId] = next;
          });
          return id;
        },

        removeModifier: (objectId, modifierId) => {
          set((state) => {
            const stack = state.modifierStacks[objectId];
            if (!stack) return;
            const idx = stack.findIndex((m: ModifierStackItem) => m.id === modifierId);
            if (idx >= 0) {
              const next = stack.slice(0, idx).concat(stack.slice(idx + 1));
              state.modifierStacks[objectId] = next;
            }
          });
          // Also remove any animation tracks that reference this modifier's settings
          try {
            // Dynamic require to avoid circular imports
            const { useAnimationStore } = require('./animation-store');
            const anim = useAnimationStore.getState();
            const toRemove: string[] = Object.values(anim.tracks)
              .filter((tr: any) => tr.targetId === objectId && typeof tr.property === 'string' && tr.property.startsWith(`mod.${modifierId}.`))
              .map((tr: any) => tr.id);
            if (toRemove.length) {
              useAnimationStore.setState((s: any) => {
                toRemove.forEach((tid) => {
                  if (s.tracks[tid]) delete s.tracks[tid];
                  if (s._sortedCache) delete s._sortedCache[tid];
                  s.selection.trackIds = s.selection.trackIds.filter((id: string) => id !== tid);
                  delete s.selection.keys[tid];
                  if (s.soloTrackIds?.has && s.soloTrackIds.has(tid)) s.soloTrackIds.delete(tid);
                });
                s.soloTrackIds = new Set<string>(Array.from(s.soloTrackIds || []));
                Object.values(s.clips || {}).forEach((clip: any) => {
                  clip.trackIds = clip.trackIds.filter((id: string) => !toRemove.includes(id));
                });
              });
            }
          } catch (e) {
            // Non-fatal: if animation store isn't available, skip cleanup
          }
        },

        moveModifier: (objectId, fromIndex, toIndex) => {
          set((state) => {
            const stack = state.modifierStacks[objectId];
            if (!stack) return;
            const from = Math.max(0, Math.min(fromIndex, stack.length - 1));
            const to = Math.max(0, Math.min(toIndex, stack.length - 1));
            if (from === to) return;
            const next = stack.slice();
            const [item] = next.splice(from, 1);
            next.splice(to, 0, item);
            state.modifierStacks[objectId] = next;
          });
        },

        setModifierEnabled: (objectId, modifierId, enabled) => {
          set((state) => {
            const stack = state.modifierStacks[objectId];
            if (!stack) return;
            const idx = stack.findIndex((m: ModifierStackItem) => m.id === modifierId);
            if (idx >= 0) {
              const prev = stack[idx];
              const next = stack.slice();
              next[idx] = { ...prev, enabled };
              state.modifierStacks[objectId] = next;
            }
          });
        },

        updateModifierSettings: (objectId, modifierId, updater) => {
          set((state) => {
            const stack = state.modifierStacks[objectId];
            if (!stack) return;
            const idx = stack.findIndex((m: ModifierStackItem) => m.id === modifierId);
            if (idx >= 0) {
              const prev = stack[idx];
              const nextSettings = { ...prev.settings };
              updater(nextSettings);
              const next = stack.slice();
              next[idx] = { ...prev, settings: nextSettings };
              state.modifierStacks[objectId] = next;
            }
          });
        },

        applyModifier: (objectId, modifierId) => {
          // Group geometry replacement and stack trimming into a single history step
          const scene = useSceneStore.getState();
          set((state) => {
            const obj = scene.objects[objectId];
            if (!obj || obj.type !== 'mesh' || !obj.meshId) return;
            const mesh = state.meshes.get(obj.meshId);
            if (!mesh) return;

            const stack = (state.modifierStacks[objectId] ?? []) as ModifierStackItem[];
            const idx = stack.findIndex((m) => m.id === modifierId);
            if (idx < 0) return;

            const toApply = stack.slice(0, idx + 1);
            const evaluated: Mesh = applyModifiersToMesh(mesh, toApply);

            // Bake into base mesh (inline to keep a single set)
            mesh.vertices = evaluated.vertices;
            mesh.faces = evaluated.faces;
            mesh.edges = buildEdgesFromFaces(mesh.vertices, mesh.faces);
            mesh.vertices = calculateVertexNormals(mesh);

            // Trim applied modifiers from the stack
            const next = stack.slice();
            next.splice(0, idx + 1);
            state.modifierStacks[objectId] = next;
          });
        },

        clearAllModifiers: (objectId) => {
          set((state) => { delete state.modifierStacks[objectId]; });
        },

        // Camera resources
        addCamera: (camera: CameraResource) => {
          set((state) => {
            state.cameras[camera.id] = camera;
          });
        },
        updateCamera: (cameraId: string, updater: (cam: CameraResource) => void) => {
          set((state) => {
            const cam = state.cameras[cameraId];
            if (cam) {
              // Work on a shallow copy so subscribers receive a new reference
              const draft = { ...cam } as CameraResource;
              updater(draft);
              state.cameras[cameraId] = draft;
            }
          });
        },
        removeCamera: (cameraId: string) => {
          set((state) => {
            delete state.cameras[cameraId];
          });
        },
      }))
    ),
    {
      partialize: (state) => ({
        meshes: state.meshes,
        materials: state.materials,
        shaderGraphs: state.shaderGraphs,
        selectedMeshId: state.selectedMeshId,
        modifierStacks: state.modifierStacks,
        cameras: state.cameras,
      }),
    }
  )
);

// Selector hooks for optimized re-renders
export const useMeshes = () => {
  const meshesMap = useGeometryStore((state) => state.meshes);
  return useMemo(() => Array.from(meshesMap.values()), [meshesMap]);
};

export const useSelectedMesh = () => {
  const selectedMeshId = useGeometryStore((state) => state.selectedMeshId);
  const meshesMap = useGeometryStore((state) => state.meshes);
  return useMemo(() =>
    selectedMeshId ? meshesMap.get(selectedMeshId) || null : null,
    [selectedMeshId, meshesMap]
  );
};

export const useMesh = (meshId: string) => useGeometryStore((state) => state.meshes.get(meshId));
export const useSelectedMeshId = () => useGeometryStore((state) => state.selectedMeshId);
export const useCameraResource = (cameraId: string) => useGeometryStore((s) => s.cameras[cameraId]);
export const useCameras = () => useGeometryStore((s) => s.cameras);

// Helpers for undo/redo of geometry edits
export const geometryUndo = () => {
  try {
    const api = (useGeometryStore as any).temporal?.getState?.();
    api?.undo?.();
  } catch { }
};

export const geometryRedo = () => {
  try {
    const api = (useGeometryStore as any).temporal?.getState?.();
    api?.redo?.();
  } catch { }
};

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { subscribeWithSelector } from 'zustand/middleware';
import { useMemo } from 'react';
import { Mesh, Material } from '../types/geometry';
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
}

interface GeometryActions {
  // Mesh operations
  addMesh: (mesh: Mesh) => void;
  removeMesh: (meshId: string) => void;
  updateMesh: (meshId: string, updater: (mesh: Mesh) => void) => void;
  selectMesh: (meshId: string | null) => void;
  reset: () => void;
  
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
                { id: idOut, type: 'output-standard', position: { x: 520, y: 120 } } as any,
                { id: 'baseColor', type: 'const-color', position: { x: 260, y: 80 }, data: { r: material.color.x, g: material.color.y, b: material.color.z } } as any,
                { id: 'rough', type: 'const-float', position: { x: 260, y: 180 }, data: { value: material.roughness } } as any,
                { id: 'metal', type: 'const-float', position: { x: 260, y: 240 }, data: { value: material.metalness } } as any,
              ],
              edges: [
                { id: nanoid(), source: 'baseColor', sourceHandle: 'out', target: idOut, targetHandle: 'color' },
                { id: nanoid(), source: 'rough', sourceHandle: 'out', target: idOut, targetHandle: 'roughness' },
                { id: nanoid(), source: 'metal', sourceHandle: 'out', target: idOut, targetHandle: 'metalness' },
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
              { id: idOut, type: 'output-standard', position: { x: 520, y: 120 } } as any,
              { id: 'color', type: 'const-color', position: { x: 260, y: 80 }, data: { r: mat?.color.x ?? 0.8, g: mat?.color.y ?? 0.8, b: mat?.color.z ?? 0.85 } } as any,
              { id: 'rough', type: 'const-float', position: { x: 260, y: 180 }, data: { value: mat?.roughness ?? 0.8 } } as any,
              { id: 'metal', type: 'const-float', position: { x: 260, y: 240 }, data: { value: mat?.metalness ?? 0.05 } } as any,
            ],
            edges: [
              { id: nanoid(), source: 'color', sourceHandle: 'out', target: idOut, targetHandle: 'color' },
              { id: nanoid(), source: 'rough', sourceHandle: 'out', target: idOut, targetHandle: 'roughness' },
              { id: nanoid(), source: 'metal', sourceHandle: 'out', target: idOut, targetHandle: 'metalness' },
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
      }))
    ),
    {
      partialize: (state) => ({
        meshes: state.meshes,
        materials: state.materials,
  shaderGraphs: state.shaderGraphs,
        selectedMeshId: state.selectedMeshId,
        modifierStacks: state.modifierStacks,
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

// Helpers for undo/redo of geometry edits
export const geometryUndo = () => {
  try {
    const api = (useGeometryStore as any).temporal?.getState?.();
    api?.undo?.();
  } catch {}
};

export const geometryRedo = () => {
  try {
    const api = (useGeometryStore as any).temporal?.getState?.();
    api?.redo?.();
  } catch {}
};

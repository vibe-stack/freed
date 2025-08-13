import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { subscribeWithSelector } from 'zustand/middleware';
import { useMemo } from 'react';
import { Mesh, Material } from '../types/geometry';
import { createCubeMesh, calculateVertexNormals } from '../utils/geometry';
import { enableMapSet } from 'immer';

enableMapSet();

interface GeometryState {
  meshes: Map<string, Mesh>;
  materials: Map<string, Material>;
  selectedMeshId: string | null;
}

interface GeometryActions {
  // Mesh operations
  addMesh: (mesh: Mesh) => void;
  removeMesh: (meshId: string) => void;
  updateMesh: (meshId: string, updater: (mesh: Mesh) => void) => void;
  selectMesh: (meshId: string | null) => void;
  
  // Material operations
  addMaterial: (material: Material) => void;
  removeMaterial: (materialId: string) => void;
  updateMaterial: (materialId: string, updater: (material: Material) => void) => void;
  
  // Utility operations
  createCube: (size?: number) => string;
  recalculateNormals: (meshId: string) => void;
}

type GeometryStore = GeometryState & GeometryActions;

export const useGeometryStore = create<GeometryStore>()(
  subscribeWithSelector(
    immer((set, get) => ({
      // Initial state
      meshes: new Map(),
      materials: new Map(),
      selectedMeshId: null,
      
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
          }
        });
      },
      
      selectMesh: (meshId: string | null) => {
        set((state) => {
          state.selectedMeshId = meshId;
        });
      },
      
      // Material operations
      addMaterial: (material: Material) => {
        set((state) => {
          state.materials.set(material.id, material);
        });
      },
      
      removeMaterial: (materialId: string) => {
        set((state) => {
          state.materials.delete(materialId);
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
      
      // Utility operations
      createCube: (size: number = 1) => {
        const cube = createCubeMesh(size);
        set((state) => {
          state.meshes.set(cube.id, cube);
          state.selectedMeshId = cube.id;
        });
        return cube.id;
      },
      
      recalculateNormals: (meshId: string) => {
        set((state) => {
          const mesh = state.meshes.get(meshId);
          if (mesh) {
            mesh.vertices = calculateVertexNormals(mesh);
          }
        });
      },
    }))
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

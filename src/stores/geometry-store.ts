import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { subscribeWithSelector } from 'zustand/middleware';
import { useMemo } from 'react';
import { Mesh, Material } from '../types/geometry';
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
  reset: () => void;
  
  // Material operations
  addMaterial: (material: Material) => void;
  removeMaterial: (materialId: string) => void;
  updateMaterial: (materialId: string, updater: (material: Material) => void) => void;
  
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
}

type GeometryStore = GeometryState & GeometryActions;

export const useGeometryStore = create<GeometryStore>()(
  subscribeWithSelector(
    immer((set, _get) => ({
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
            // Ensure array identity changes so memoized consumers update
            mesh.vertices = mesh.vertices.slice();
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
          state.selectedMeshId = null;
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

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { subscribeWithSelector } from 'zustand/middleware';
import { Selection, SelectionMode, ViewMode } from '../types/geometry';
import { useSceneStore } from './scene-store';
import { useGeometryStore } from './geometry-store';
import { useToolStore } from './tool-store';

interface SelectionState {
  selection: Selection;
}

interface SelectionActions {
  setViewMode: (mode: ViewMode) => void;
  setSelectionMode: (mode: SelectionMode) => void;
  selectMesh: (meshId: string | null) => void;
  selectVertices: (meshId: string, vertexIds: string[], additive?: boolean) => void;
  selectEdges: (meshId: string, edgeIds: string[], additive?: boolean) => void;
  selectFaces: (meshId: string, faceIds: string[], additive?: boolean) => void;
  selectObjects: (objectIds: string[], additive?: boolean) => void;
  toggleObjectSelection: (objectId: string) => void;
  clearSelection: () => void;
  selectAll: () => void;
  toggleVertexSelection: (meshId: string, vertexId: string) => void;
  toggleEdgeSelection: (meshId: string, edgeId: string) => void;
  toggleFaceSelection: (meshId: string, faceId: string) => void;
  hasSelection: () => boolean;
  getSelectionCount: () => number;
  enterEditMode: (meshId: string) => void;
  exitEditMode: () => void;
  reset: () => void;
}

type SelectionStore = SelectionState & SelectionActions;

export const useSelectionStore = create<SelectionStore>()(
  subscribeWithSelector(
    immer((set, get) => ({
      // Initial state
      selection: {
        viewMode: 'object',
        selectionMode: 'vertex',
        meshId: null,
        vertexIds: [],
        edgeIds: [],
        faceIds: [],
        objectIds: [],
      },
      
      // Actions
      setViewMode: (viewMode: ViewMode) => {
        set((state) => {
          // Cancel any active tools when changing modes
          useToolStore.getState().reset();
          state.selection.viewMode = viewMode;
          // Clear all selections when changing view modes
          state.selection.vertexIds = [];
          state.selection.edgeIds = [];
          state.selection.faceIds = [];
          state.selection.objectIds = [];
          
          // In object mode, clear mesh selection
          if (viewMode === 'object') {
            state.selection.meshId = null;
            // Ensure selection mode resets to vertex for next edit session
            state.selection.selectionMode = 'vertex';
          }
        });
      },
      
      setSelectionMode: (mode: SelectionMode) => {
        set((state) => {
          // Only allow selection mode changes in edit mode
          if (state.selection.viewMode !== 'edit') return;
          const sel = state.selection;
          const prevMode = sel.selectionMode;
          if (prevMode === mode) return; // no-op
          sel.selectionMode = mode;

          // If no mesh or topology, just clear
          const meshId = sel.meshId;
          const geo = useGeometryStore.getState();
          const mesh = meshId ? geo.meshes.get(meshId) : null;
          if (!mesh) {
            sel.vertexIds = [];
            sel.edgeIds = [];
            sel.faceIds = [];
            return;
          }

          // Helpers
          const uniq = <T,>(arr: T[]) => Array.from(new Set(arr));
          const edgeKey = (a: string, b: string) => (a < b ? `${a}-${b}` : `${b}-${a}`);
          const edgeIdByKey = new Map(mesh.edges.map((e) => [edgeKey(e.vertexIds[0], e.vertexIds[1]), e.id] as const));
          const faceEdges = (faceVertexIds: string[]) => {
            const ids: string[] = [];
            for (let i = 0; i < faceVertexIds.length; i++) {
              const a = faceVertexIds[i];
              const b = faceVertexIds[(i + 1) % faceVertexIds.length];
              const id = edgeIdByKey.get(edgeKey(a, b));
              if (id) ids.push(id);
            }
            return ids;
          };

          // Compute next selection based on previous selection content
          if (mode === 'vertex') {
            if (prevMode === 'edge') {
              // Select all vertices from selected edges
              const next = uniq(
                mesh.edges
                  .filter((e) => sel.edgeIds.includes(e.id))
                  .flatMap((e) => e.vertexIds)
              );
              sel.vertexIds = next;
            } else if (prevMode === 'face') {
              // Select all vertices from selected faces
              const next = uniq(
                mesh.faces
                  .filter((f) => sel.faceIds.includes(f.id))
                  .flatMap((f) => f.vertexIds)
              );
              sel.vertexIds = next;
            } else {
              sel.vertexIds = sel.vertexIds.slice();
            }
            sel.edgeIds = [];
            sel.faceIds = [];
          } else if (mode === 'edge') {
            if (prevMode === 'vertex') {
              // Promote to edges where both vertices are selected
              const vset = new Set(sel.vertexIds);
              const next = mesh.edges
                .filter((e) => vset.has(e.vertexIds[0]) && vset.has(e.vertexIds[1]))
                .map((e) => e.id);
              sel.edgeIds = next;
            } else if (prevMode === 'face') {
              // Select all edges belonging to selected faces
              const fset = new Set(sel.faceIds);
              const next = uniq(
                mesh.faces
                  .filter((f) => fset.has(f.id))
                  .flatMap((f) => faceEdges(f.vertexIds))
              );
              sel.edgeIds = next;
            } else {
              sel.edgeIds = sel.edgeIds.slice();
            }
            sel.vertexIds = [];
            sel.faceIds = [];
          } else if (mode === 'face') {
            if (prevMode === 'vertex') {
              // Promote to faces where all vertices are selected
              const vset = new Set(sel.vertexIds);
              const next = mesh.faces
                .filter((f) => f.vertexIds.every((v) => vset.has(v)))
                .map((f) => f.id);
              sel.faceIds = next;
            } else if (prevMode === 'edge') {
              // Promote to faces where all edges are selected
              const eset = new Set(sel.edgeIds);
              const next = mesh.faces
                .filter((f) => faceEdges(f.vertexIds).every((e) => eset.has(e)))
                .map((f) => f.id);
              sel.faceIds = next;
            } else {
              sel.faceIds = sel.faceIds.slice();
            }
            sel.vertexIds = [];
            sel.edgeIds = [];
          }
        });
      },
      
      enterEditMode: (meshId: string) => {
        set((state) => {
          useToolStore.getState().reset();
          state.selection.viewMode = 'edit';
          state.selection.meshId = meshId;
          state.selection.selectionMode = 'vertex';
          // Clear edit selections but preserve object selection for return
          state.selection.vertexIds = [];
          state.selection.edgeIds = [];
          state.selection.faceIds = [];
          // Keep objectIds so we can restore selection when exiting edit mode
        });
      },
      
      exitEditMode: () => {
        set((state) => {
          useToolStore.getState().reset();
          state.selection.viewMode = 'object';
          state.selection.meshId = null;
          // Clear component selections
          state.selection.vertexIds = [];
          state.selection.edgeIds = [];
          state.selection.faceIds = [];
          // Preserve objectIds to maintain object selection when returning to object mode
          // state.selection.objectIds = []; // Don't clear this!
          state.selection.selectionMode = 'vertex';
        });
      },
      
      selectMesh: (meshId: string | null) => {
        set((state) => {
          state.selection.meshId = meshId;
          // Clear sub-selections when changing mesh
          state.selection.vertexIds = [];
          state.selection.edgeIds = [];
          state.selection.faceIds = [];
        });
      },
      
      selectVertices: (meshId: string, vertexIds: string[], additive: boolean = false) => {
        set((state) => {
          // Only allow in edit mode
          if (state.selection.viewMode !== 'edit') return;
          
          state.selection.meshId = meshId;
          state.selection.selectionMode = 'vertex';
          
          if (additive) {
            // Add to existing selection (union)
            const existingIds = new Set(state.selection.vertexIds);
            vertexIds.forEach(id => existingIds.add(id));
            state.selection.vertexIds = Array.from(existingIds);
          } else {
            state.selection.vertexIds = vertexIds;
          }
          
          // Clear other selection types
          state.selection.edgeIds = [];
          state.selection.faceIds = [];
          state.selection.objectIds = [];
        });
      },
      
      selectEdges: (meshId: string, edgeIds: string[], additive: boolean = false) => {
        set((state) => {
          // Only allow in edit mode
          if (state.selection.viewMode !== 'edit') return;
          
          state.selection.meshId = meshId;
          state.selection.selectionMode = 'edge';
          
          if (additive) {
            const existingIds = new Set(state.selection.edgeIds);
            edgeIds.forEach(id => existingIds.add(id));
            state.selection.edgeIds = Array.from(existingIds);
          } else {
            state.selection.edgeIds = edgeIds;
          }
          
          // Clear other selection types
          state.selection.vertexIds = [];
          state.selection.faceIds = [];
          state.selection.objectIds = [];
        });
      },
      
      selectFaces: (meshId: string, faceIds: string[], additive: boolean = false) => {
        set((state) => {
          // Only allow in edit mode
          if (state.selection.viewMode !== 'edit') return;
          
          state.selection.meshId = meshId;
          state.selection.selectionMode = 'face';
          
          if (additive) {
            const existingIds = new Set(state.selection.faceIds);
            faceIds.forEach(id => existingIds.add(id));
            state.selection.faceIds = Array.from(existingIds);
          } else {
            state.selection.faceIds = faceIds;
          }
          
          // Clear other selection types
          state.selection.vertexIds = [];
          state.selection.edgeIds = [];
          state.selection.objectIds = [];
        });
      },
      
      selectObjects: (objectIds: string[], additive: boolean = false) => {
        set((state) => {
          // Only allow in object mode
          if (state.selection.viewMode !== 'object') return;
          // Filter out locked objects using scene store
          const scene = useSceneStore.getState();
          const filtered = objectIds.filter((id) => !scene.objects[id]?.locked);
          
          state.selection.meshId = null;
          
          if (additive) {
            const existingIds = new Set(state.selection.objectIds);
            filtered.forEach(id => existingIds.add(id));
            state.selection.objectIds = Array.from(existingIds);
          } else {
            state.selection.objectIds = filtered;
          }
          
          // Clear other selection types
          state.selection.vertexIds = [];
          state.selection.edgeIds = [];
          state.selection.faceIds = [];
        });
      },
      
      toggleObjectSelection: (objectId: string) => {
        set((state) => {
          // Only allow in object mode
          if (state.selection.viewMode !== 'object') return;
          // Disallow toggling locked objects
          const scene = useSceneStore.getState();
          if (scene.objects[objectId]?.locked) return;
          
          const idx = state.selection.objectIds.indexOf(objectId);
          if (idx >= 0) {
            state.selection.objectIds.splice(idx, 1);
          } else {
            state.selection.objectIds.push(objectId);
          }
          // Ensure component selections are cleared in object mode
          state.selection.vertexIds = [];
          state.selection.edgeIds = [];
          state.selection.faceIds = [];
          state.selection.meshId = null;
        });
      },
      
      clearSelection: () => {
        set((state) => {
          state.selection.vertexIds = [];
          state.selection.edgeIds = [];
          state.selection.faceIds = [];
          state.selection.objectIds = [];
          // Keep mode and meshId
        });
      },

      selectAll: () => {
        const sel = get().selection;
        if (sel.viewMode === 'object') {
          const scene = useSceneStore.getState();
          const all = Object.values(scene.objects)
            .filter((o) => !o.locked)
            .map((o) => o.id);
          set((state) => {
            state.selection.objectIds = all;
            state.selection.vertexIds = [];
            state.selection.edgeIds = [];
            state.selection.faceIds = [];
            state.selection.meshId = null;
          });
        } else if (sel.viewMode === 'edit' && sel.meshId) {
          const meshId = sel.meshId;
          // Gather vertex/edge/face ids from geometry store
          const geo = useGeometryStore.getState();
          const mesh = geo.meshes.get(meshId);
          if (!mesh) return;
          set((state) => {
            if (state.selection.selectionMode === 'vertex') {
              state.selection.vertexIds = mesh.vertices.map((v) => v.id);
              state.selection.edgeIds = [];
              state.selection.faceIds = [];
            } else if (state.selection.selectionMode === 'edge') {
              state.selection.edgeIds = mesh.edges.map((e) => e.id);
              state.selection.vertexIds = [];
              state.selection.faceIds = [];
            } else {
              state.selection.faceIds = mesh.faces.map((f) => f.id);
              state.selection.vertexIds = [];
              state.selection.edgeIds = [];
            }
          });
        }
      },
      
      toggleVertexSelection: (meshId: string, vertexId: string) => {
        set((state) => {
          // Only allow in edit mode
          if (state.selection.viewMode !== 'edit') return;
          
          state.selection.meshId = meshId;
          state.selection.selectionMode = 'vertex';
          
          const index = state.selection.vertexIds.indexOf(vertexId);
          if (index >= 0) {
            state.selection.vertexIds.splice(index, 1);
          } else {
            state.selection.vertexIds.push(vertexId);
          }
          
          // Clear other selection types
          state.selection.edgeIds = [];
          state.selection.faceIds = [];
          state.selection.objectIds = [];
        });
      },
      
      toggleEdgeSelection: (meshId: string, edgeId: string) => {
        set((state) => {
          // Only allow in edit mode
          if (state.selection.viewMode !== 'edit') return;
          
          state.selection.meshId = meshId;
          state.selection.selectionMode = 'edge';
          
          const index = state.selection.edgeIds.indexOf(edgeId);
          if (index >= 0) {
            state.selection.edgeIds.splice(index, 1);
          } else {
            state.selection.edgeIds.push(edgeId);
          }
          
          // Clear other selection types
          state.selection.vertexIds = [];
          state.selection.faceIds = [];
          state.selection.objectIds = [];
        });
      },
      
      toggleFaceSelection: (meshId: string, faceId: string) => {
        set((state) => {
          // Only allow in edit mode
          if (state.selection.viewMode !== 'edit') return;
          
          state.selection.meshId = meshId;
          state.selection.selectionMode = 'face';
          
          const index = state.selection.faceIds.indexOf(faceId);
          if (index >= 0) {
            state.selection.faceIds.splice(index, 1);
          } else {
            state.selection.faceIds.push(faceId);
          }
          
          // Clear other selection types
          state.selection.vertexIds = [];
          state.selection.edgeIds = [];
          state.selection.objectIds = [];
        });
      },
      
      hasSelection: () => {
        const state = get().selection;
        return state.vertexIds.length > 0 || 
               state.edgeIds.length > 0 || 
               state.faceIds.length > 0 || 
               state.objectIds.length > 0;
      },
      
      getSelectionCount: () => {
        const state = get().selection;
        return state.vertexIds.length + 
               state.edgeIds.length + 
               state.faceIds.length + 
               state.objectIds.length;
      },
      reset: () => {
        set((state) => {
          state.selection = {
            viewMode: 'object',
            selectionMode: 'vertex',
            meshId: null,
            vertexIds: [],
            edgeIds: [],
            faceIds: [],
            objectIds: [],
          };
        });
      },
    }))
  )
);

// Selector hooks for optimized re-renders
export const useSelection = () => useSelectionStore((state) => state.selection);
export const useViewMode = () => useSelectionStore((state) => state.selection.viewMode);
export const useSelectionMode = () => useSelectionStore((state) => state.selection.selectionMode);
export const useSelectedVertices = () => useSelectionStore((state) => state.selection.vertexIds);
export const useSelectedEdges = () => useSelectionStore((state) => state.selection.edgeIds);
export const useSelectedFaces = () => useSelectionStore((state) => state.selection.faceIds);
export const useHasSelection = () => useSelectionStore((state) => state.hasSelection());
export const useSelectionCount = () => useSelectionStore((state) => state.getSelectionCount());

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { subscribeWithSelector } from 'zustand/middleware';
import { Selection, SelectionMode, ViewMode } from '../types/geometry';

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
  clearSelection: () => void;
  toggleVertexSelection: (meshId: string, vertexId: string) => void;
  toggleEdgeSelection: (meshId: string, edgeId: string) => void;
  toggleFaceSelection: (meshId: string, faceId: string) => void;
  hasSelection: () => boolean;
  getSelectionCount: () => number;
  enterEditMode: (meshId: string) => void;
  exitEditMode: () => void;
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
          state.selection.viewMode = viewMode;
          // Clear all selections when changing view modes
          state.selection.vertexIds = [];
          state.selection.edgeIds = [];
          state.selection.faceIds = [];
          state.selection.objectIds = [];
          
          // In object mode, clear mesh selection
          if (viewMode === 'object') {
            state.selection.meshId = null;
          }
        });
      },
      
      setSelectionMode: (mode: SelectionMode) => {
        set((state) => {
          // Only allow selection mode changes in edit mode
          if (state.selection.viewMode !== 'edit') return;
          
          state.selection.selectionMode = mode;
          // Clear component selections when changing selection modes
          state.selection.vertexIds = [];
          state.selection.edgeIds = [];
          state.selection.faceIds = [];
        });
      },
      
      enterEditMode: (meshId: string) => {
        set((state) => {
          state.selection.viewMode = 'edit';
          state.selection.meshId = meshId;
          state.selection.selectionMode = 'vertex';
          // Clear all selections
          state.selection.vertexIds = [];
          state.selection.edgeIds = [];
          state.selection.faceIds = [];
          state.selection.objectIds = [];
        });
      },
      
      exitEditMode: () => {
        set((state) => {
          state.selection.viewMode = 'object';
          state.selection.meshId = null;
          // Clear component selections
          state.selection.vertexIds = [];
          state.selection.edgeIds = [];
          state.selection.faceIds = [];
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
          
          state.selection.meshId = null;
          
          if (additive) {
            const existingIds = new Set(state.selection.objectIds);
            objectIds.forEach(id => existingIds.add(id));
            state.selection.objectIds = Array.from(existingIds);
          } else {
            state.selection.objectIds = objectIds;
          }
          
          // Clear other selection types
          state.selection.vertexIds = [];
          state.selection.edgeIds = [];
          state.selection.faceIds = [];
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

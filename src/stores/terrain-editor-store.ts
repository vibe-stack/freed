import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

interface TerrainEditorState {
  open: boolean;
  terrainId?: string;
}

interface TerrainEditorActions {
  setOpen: (open: boolean) => void;
  openFor: (terrainId: string) => void;
  setTerrainId: (terrainId?: string) => void;
  reset: () => void;
}

type TerrainEditorStore = TerrainEditorState & TerrainEditorActions;

export const useTerrainEditorStore = create<TerrainEditorStore>()(
  subscribeWithSelector((set) => ({
    open: false,
    terrainId: undefined,
    setOpen: (open) => set({ open }),
    openFor: (terrainId) => set({ open: true, terrainId }),
    setTerrainId: (terrainId) => set({ terrainId }),
    reset: () => set({ open: false, terrainId: undefined }),
  }))
);

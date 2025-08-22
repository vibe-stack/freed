import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

interface ShaderEditorState {
  open: boolean;
  materialId?: string;
}

interface ShaderEditorActions {
  setOpen: (open: boolean) => void;
  openFor: (materialId: string) => void;
  setMaterialId: (materialId?: string) => void;
  reset: () => void;
}

type ShaderEditorStore = ShaderEditorState & ShaderEditorActions;

export const useShaderEditorStore = create<ShaderEditorStore>()(
  subscribeWithSelector((set) => ({
    open: false,
    materialId: undefined,
    setOpen: (open) => set({ open }),
    openFor: (materialId) => set({ open: true, materialId }),
    setMaterialId: (materialId) => set({ materialId }),
    reset: () => set({ open: false, materialId: undefined }),
  }))
);

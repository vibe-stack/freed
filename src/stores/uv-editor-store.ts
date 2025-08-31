import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

interface UVEditorState {
  open: boolean;
  setOpen: (v: boolean) => void;
  selection: Set<string>; // vertex ids selected
  setSelection: (ids: string[]) => void;
  toggleSelection: (id: string) => void;
  clearSelection: () => void;
}

export const useUVEditorStore = create<UVEditorState>()(
  immer((set, get) => ({
    open: false,
    setOpen: (v) => set((s) => { s.open = v; }),
    selection: new Set<string>(),
    setSelection: (ids) => set((s) => { s.selection = new Set(ids); }),
    toggleSelection: (id) => set((s) => {
      if (s.selection.has(id)) s.selection.delete(id); else s.selection.add(id);
      s.selection = new Set(s.selection);
    }),
    clearSelection: () => set((s) => { s.selection = new Set(); }),
  }))
);

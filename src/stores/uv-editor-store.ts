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
  immer((set) => ({
    open: false,
    setOpen: (v) => set((s) => { s.open = v; }),
    selection: new Set<string>(),
    setSelection: (ids) => set((s) => {
      const newSelection = new Set(ids);
      if (s.selection.size !== newSelection.size || ![...s.selection].every(id => newSelection.has(id))) {
        s.selection = newSelection;
      }
    }),
    toggleSelection: (id) => set((s) => {
      if (s.selection.has(id)) s.selection.delete(id); else s.selection.add(id);
      s.selection = new Set(s.selection);
    }),
    clearSelection: () => set((s) => { s.selection = new Set(); }),
  }))
);

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { subscribeWithSelector } from 'zustand/middleware';

// Holds ephemeral workspace metadata like last saved file handle (for Save / Save As behavior)

interface WorkspaceState {
  currentFileName: string | null;
  fileHandle: any | null; // FileSystemFileHandle when supported
}

interface WorkspaceActions {
  setFileInfo: (name: string | null, handle: any | null) => void;
  reset: () => void;
}

type WorkspaceStore = WorkspaceState & WorkspaceActions;

export const useWorkspaceStore = create<WorkspaceStore>()(
  subscribeWithSelector(
    immer((set) => ({
      currentFileName: null,
      fileHandle: null,
      setFileInfo: (name, handle) => set((s) => { s.currentFileName = name; s.fileHandle = handle; }),
      reset: () => set((s) => { s.currentFileName = null; s.fileHandle = null; }),
    }))
  )
);

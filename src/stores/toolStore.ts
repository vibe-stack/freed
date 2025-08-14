import { create } from 'zustand';

export type ToolMode = 'none' | 'move' | 'rotate' | 'scale';
export type AxisLock = 'none' | 'x' | 'y' | 'z';

interface ToolState {
  tool: ToolMode;
  isActive: boolean;
  axisLock: AxisLock;
  localData: any; // Holds a local copy of selected data during operation
  startOperation: (tool: ToolMode, localData: any) => void;
  setAxisLock: (axis: AxisLock) => void;
  endOperation: (commit: boolean) => void;
  reset: () => void;
}

export const useToolStore = create<ToolState>((set) => ({
  tool: 'none',
  isActive: false,
  axisLock: 'none',
  localData: null,
  startOperation: (tool, localData) => set({ tool, isActive: true, localData }),
  setAxisLock: (axis) => set({ axisLock: axis }),
  endOperation: (commit) => set({ tool: 'none', isActive: false, axisLock: 'none', localData: null }),
  reset: () => set({ tool: 'none', isActive: false, axisLock: 'none', localData: null }),
}));

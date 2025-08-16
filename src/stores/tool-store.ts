import { create } from 'zustand';
import type { Transform } from '@/types/geometry';

export type ToolMode = 'none' | 'move' | 'rotate' | 'scale';
export type AxisLock = 'none' | 'x' | 'y' | 'z';

type LocalData = { kind: 'object-transform'; transforms: Record<string, Transform> } | null;

interface ToolState {
  tool: ToolMode;
  isActive: boolean;
  axisLock: AxisLock;
  localData: LocalData; // Holds a local copy of selected data during operation
  startOperation: (tool: ToolMode, localData: LocalData) => void;
  setLocalData: (localData: LocalData) => void;
  setAxisLock: (axis: AxisLock) => void;
  endOperation: (commit: boolean) => void;
  reset: () => void;
  // Sensitivity controls
  moveSensitivity: number; // world delta per pixel scaled by distance
  rotateSensitivity: number; // radians per pixel
  scaleSensitivity: number; // scale factor delta per pixel
  setMoveSensitivity: (value: number) => void;
  setRotateSensitivity: (value: number) => void;
  setScaleSensitivity: (value: number) => void;
}

export const useToolStore = create<ToolState>((set) => ({
  tool: 'none',
  isActive: false,
  axisLock: 'none',
  localData: null,
  startOperation: (tool, localData) => set({ tool, isActive: true, localData }),
  setLocalData: (localData) => set({ localData }),
  setAxisLock: (axis) => set({ axisLock: axis }),
  endOperation: (_commit) => set({ tool: 'none', isActive: false, axisLock: 'none', localData: null }),
  reset: () => set({ tool: 'none', isActive: false, axisLock: 'none', localData: null }),
  // Sensitivity defaults (tuned lower than previous hardcoded values)
  moveSensitivity: 0.0025,
  rotateSensitivity: 0.005,
  scaleSensitivity: 0.005,
  setMoveSensitivity: (value) => set({ moveSensitivity: Math.max(0, value) }),
  setRotateSensitivity: (value) => set({ rotateSensitivity: Math.max(0, value) }),
  setScaleSensitivity: (value) => set({ scaleSensitivity: Math.max(0, value) }),
}));

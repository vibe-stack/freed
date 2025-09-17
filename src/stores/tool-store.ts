import { create } from 'zustand';
import type { Transform } from '@/types/geometry';

export type ToolMode =
  | 'none'
  // Mesh editing transforms
  | 'move' | 'rotate' | 'scale' | 'extrude' | 'inset' | 'bevel' | 'chamfer' | 'fillet' | 'loopcut' | 'knife'
  // Sculpt brushes
  | 'sculpt-draw' | 'sculpt-clay' | 'sculpt-inflate' | 'sculpt-blob' | 'sculpt-crease'
  | 'sculpt-smooth' | 'sculpt-flatten' | 'sculpt-contrast' | 'sculpt-fill' | 'sculpt-deepen'
  | 'sculpt-scrape' | 'sculpt-peaks' | 'sculpt-pinch' | 'sculpt-magnify' | 'sculpt-grab'
  | 'sculpt-snake-hook' | 'sculpt-thumb' | 'sculpt-nudge' | 'sculpt-rotate' | 'sculpt-simplify';
export type AxisLock = 'none' | 'x' | 'y' | 'z';

type LocalData =
  | { kind: 'object-transform'; transforms: Record<string, Transform> }
  | { kind: 'loopcut'; objectId: string; meshId: string; faceId: string; edge: [string, string]; segments: number }
  | { kind: 'knife'; meshId: string; cutPoints: Array<{ x: number; y: number; z: number; faceId: string }>; previewPath: Array<{ a: { x: number; y: number; z: number }; b: { x: number; y: number; z: number } }>; hoverLine?: { a: { x: number; y: number; z: number }; b: { x: number; y: number; z: number } } }
  | null;

interface ToolState {
  tool: ToolMode;
  isActive: boolean;
  axisLock: AxisLock;
  localData: LocalData; // Holds a local copy of selected data during operation
  // Visual grouping while in Edit mode: which tool palette is shown (mesh vs sculpt)
  editPalette: 'mesh' | 'sculpt';
  setEditPalette: (p: 'mesh' | 'sculpt') => void;
  // Sculpt stroke lifecycle
  sculptStrokeActive: boolean;
  setSculptStrokeActive: (active: boolean) => void;
  // Marquee selection state (disables camera orbit/pan/zoom while active)
  marqueeActive: boolean;
  setMarqueeActive: (active: boolean) => void;
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
  // Sculpt brush defaults
  brushRadius: number; // world units
  brushStrength: number; // 0..1 per sample
  brushFalloff: 'smooth' | 'linear' | 'sharp';
  setBrushRadius: (r: number) => void;
  setBrushStrength: (s: number) => void;
  setBrushFalloff: (f: 'smooth' | 'linear' | 'sharp') => void;
  // Optional per-brush options
  pinchFactor: number; // 0..2 (1 default)
  rakeFactor: number; // 0..1
  planeOffset: number; // -1..1
  setPinchFactor: (v: number) => void;
  setRakeFactor: (v: number) => void;
  setPlaneOffset: (v: number) => void;
  // Sculpt symmetry
  symmetryEnabled: boolean;
  symmetryAxis: 'x' | 'y' | 'z';
  setSymmetryEnabled: (v: boolean) => void;
  setSymmetryAxis: (a: 'x' | 'y' | 'z') => void;
}

export const useToolStore = create<ToolState>((set) => ({
  tool: 'none',
  isActive: false,
  axisLock: 'none',
  localData: null,
  editPalette: 'mesh',
  setEditPalette: (p) => set({ editPalette: p }),
  sculptStrokeActive: false,
  setSculptStrokeActive: (active) => set({ sculptStrokeActive: active }),
  marqueeActive: false,
  setMarqueeActive: (active) => set({ marqueeActive: active }),
  startOperation: (tool, localData) => set({ tool, isActive: true, localData }),
  setLocalData: (localData) => set({ localData }),
  setAxisLock: (axis) => set({ axisLock: axis }),
  endOperation: () => set({ tool: 'none', isActive: false, axisLock: 'none', localData: null }),
  reset: () => set({ tool: 'none', isActive: false, axisLock: 'none', localData: null }),
  // Sensitivity defaults (tuned lower than previous hardcoded values)
  moveSensitivity: 0.0025,
  rotateSensitivity: 0.005,
  scaleSensitivity: 0.005,
  setMoveSensitivity: (value) => set({ moveSensitivity: Math.max(0, value) }),
  setRotateSensitivity: (value) => set({ rotateSensitivity: Math.max(0, value) }),
  setScaleSensitivity: (value) => set({ scaleSensitivity: Math.max(0, value) }),
  // Sculpt brush defaults
  brushRadius: 0.5,
  brushStrength: 0.5,
  brushFalloff: 'smooth',
  setBrushRadius: (r) => set({ brushRadius: Math.max(0.001, r) }),
  setBrushStrength: (s) => set({ brushStrength: Math.max(0, Math.min(1, s)) }),
  setBrushFalloff: (f) => set({ brushFalloff: f }),
  pinchFactor: 1,
  rakeFactor: 0,
  planeOffset: 0,
  setPinchFactor: (v) => set({ pinchFactor: Math.max(0, Math.min(2, v)) }),
  setRakeFactor: (v) => set({ rakeFactor: Math.max(0, Math.min(1, v)) }),
  setPlaneOffset: (v) => set({ planeOffset: Math.max(-1, Math.min(1, v)) }),
  // Symmetry defaults
  symmetryEnabled: false,
  symmetryAxis: 'x',
  setSymmetryEnabled: (v) => set({ symmetryEnabled: v }),
  setSymmetryAxis: (a) => set({ symmetryAxis: a }),
}));

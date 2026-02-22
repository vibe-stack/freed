import { create } from 'zustand';
import type { BrushShape } from '../brushes/types';

export type PlacementPhase = 'idle' | 'footprint' | 'height' | 'cutout' | 'curve';

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

interface QuickBrushState {
  activeBrush: BrushShape;
  phase: PlacementPhase;
  /** World-space anchor (corner for rect, center for radial) */
  anchor: Vec3 | null;
  /** World-space drag endpoint (updates every mousemove in footprint phase) */
  current: Vec3 | null;
  /** Surface normal at the anchor point */
  normal: Vec3;
  /** Surface tangent at the anchor point (orthogonal to normal) */
  tangent: Vec3;
  /** Signed extrusion height in phase 2 (positive/negative along normal) */
  height: number;
  /** Door opening width ratio (0..1), used in phase 3 for door brush */
  doorOpeningRatio: number;
  /** Stairs step count controlled via mouse wheel in stage 2 */
  stairsCount: number;
  /** Arch segment count controlled via mouse wheel in stage 2 */
  archSegments: number;
  /** Stairs curvature amount controlled in final stage */
  stairsCurve: number;
}

interface QuickBrushActions {
  setActiveBrush(b: BrushShape): void;

  /** Call on mousedown: start footprint drag */
  beginFootprint(anchor: Vec3, normal: Vec3, tangent: Vec3): void;

  /** Call on mousemove during footprint phase */
  updateFootprint(current: Vec3): void;

  /** Call on mouseup: transition footprint → height */
  commitFootprint(): void;

  /** Explicit phase transitions for multi-stage brushes */
  beginHeight(): void;
  beginCutout(): void;
  beginCurve(): void;

  /** Set signed extrusion height during height phase */
  setHeight(height: number): void;

  /** Call on mousemove during door cutout phase */
  setDoorOpeningRatio(ratio: number): void;

  /** Increment/decrement stairs step count (mouse wheel) */
  adjustStairsCount(delta: number): void;

  /** Increment/decrement arch segment count (mouse wheel) */
  adjustArchSegments(delta: number): void;

  /** Set stairs curvature for stairs / closed-stairs final stage */
  setStairsCurve(curve: number): void;

  /** Call on click during height phase: reset to idle (brush stays active for next placement) */
  commitPlacement(): void;

  /** Cancel at any point: reset to idle */
  cancel(): void;
}

const UP: Vec3 = { x: 0, y: 1, z: 0 };
const RIGHT: Vec3 = { x: 1, y: 0, z: 0 };

export const useQuickBrushStore = create<QuickBrushState & QuickBrushActions>((set) => ({
  activeBrush: 'cube',
  phase: 'idle',
  anchor: null,
  current: null,
  normal: UP,
  tangent: RIGHT,
  height: 0,
  doorOpeningRatio: 0.6,
  stairsCount: 6,
  archSegments: 8,
  stairsCurve: 0,

  setActiveBrush: (b) =>
    set((s) =>
      s.phase !== 'idle'
        ? {
            activeBrush: b,
            phase: 'idle',
            anchor: null,
            current: null,
            height: 0,
            doorOpeningRatio: 0.6,
            stairsCount: 6,
            archSegments: 8,
            stairsCurve: 0,
          }
        : { activeBrush: b }
    ),

  beginFootprint: (anchor, normal, tangent) =>
    set({
      phase: 'footprint',
      anchor,
      current: anchor,
      normal,
      tangent,
      height: 0.1,
      doorOpeningRatio: 0.6,
      stairsCount: 6,
      archSegments: 8,
      stairsCurve: 0,
    }),

  updateFootprint: (current) => set({ current }),

  commitFootprint: () => set({ phase: 'height' }),

  beginHeight: () => set({ phase: 'height' }),

  beginCutout: () => set({ phase: 'cutout' }),

  beginCurve: () => set({ phase: 'curve' }),

  setHeight: (height) =>
    set({ height: Math.max(-200, Math.min(200, height)) }),

  setDoorOpeningRatio: (ratio) =>
    set({ doorOpeningRatio: Math.min(0.9, Math.max(0.15, ratio)) }),

  adjustStairsCount: (delta) =>
    set((s) => ({ stairsCount: Math.max(2, Math.min(64, s.stairsCount + delta)) })),

  adjustArchSegments: (delta) =>
    set((s) => ({ archSegments: Math.max(4, Math.min(64, s.archSegments + delta)) })),

  setStairsCurve: (curve) =>
    set({ stairsCurve: curve }),

  commitPlacement: () =>
    set({
      phase: 'idle',
      anchor: null,
      current: null,
      height: 0,
      doorOpeningRatio: 0.6,
      stairsCount: 6,
      archSegments: 8,
      stairsCurve: 0,
    }),

  cancel: () =>
    set({
      phase: 'idle',
      anchor: null,
      current: null,
      height: 0,
      doorOpeningRatio: 0.6,
      stairsCount: 6,
      archSegments: 8,
      stairsCurve: 0,
    }),
}));

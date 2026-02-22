import { create } from 'zustand';
import type { BrushShape } from '../brushes/types';

export type PlacementPhase = 'idle' | 'footprint' | 'height';

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
  /** Accumulated height in phase 2 */
  height: number;
}

interface QuickBrushActions {
  setActiveBrush(b: BrushShape): void;

  /** Call on mousedown: start footprint drag */
  beginFootprint(anchor: Vec3, normal: Vec3, tangent: Vec3): void;

  /** Call on mousemove during footprint phase */
  updateFootprint(current: Vec3): void;

  /** Call on mouseup: transition footprint → height */
  commitFootprint(): void;

  /** Call on mousemove during height phase */
  updateHeight(delta: number): void;

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

  setActiveBrush: (b) => set({ activeBrush: b }),

  beginFootprint: (anchor, normal, tangent) =>
    set({
      phase: 'footprint',
      anchor,
      current: anchor,
      normal,
      tangent,
      height: 0.1,
    }),

  updateFootprint: (current) => set({ current }),

  commitFootprint: () => set({ phase: 'height' }),

  updateHeight: (delta) =>
    set((s) => ({ height: Math.max(0.05, s.height + delta) })),

  commitPlacement: () =>
    set({
      phase: 'idle',
      anchor: null,
      current: null,
      height: 0,
    }),

  cancel: () =>
    set({
      phase: 'idle',
      anchor: null,
      current: null,
      height: 0,
    }),
}));

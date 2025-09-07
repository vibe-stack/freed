import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { subscribeWithSelector } from 'zustand/middleware';
import { nanoid } from 'nanoid';
import { vec3 } from '@/utils/geometry';

export interface FluidSystemConfig {
  id: string;
  name: string;
  seed: number;
  capacity: number; // max particles
  emissionRate: number; // per frame
  emitterObjectId: string | null; // object providing emission transform
  particleObjectId: string | null; // mesh object whose geometry+material we instance
  volumeObjectId: string | null; // mesh object defining container volume (AABB of its world bbox)
  substeps: number; // solver substeps per frame
  solverIterations: number; // PBF iterations
  restDensity: number;
  radius: number; // smoothing radius
  gravity: { x: number; y: number; z: number };
  viscosity: number;
  bounce: number; // boundary bounce (0-1)
  drag: number; // velocity damp 0-1
  enableViscosity: boolean;
  enableDrag: boolean;
}

export interface FluidState { systems: Record<string, FluidSystemConfig>; }

interface FluidActions {
  addSystem: (partial?: Partial<FluidSystemConfig>) => string;
  updateSystem: (id: string, partial: Partial<FluidSystemConfig>) => void;
  removeSystem: (id: string) => void;
  getSystem: (id: string) => FluidSystemConfig | undefined;
}

export type FluidStore = FluidState & FluidActions;

const defaultFluidSystem = (): FluidSystemConfig => ({
  id: nanoid(),
  name: 'Fluid',
  seed: Math.floor(Math.random() * 1_000_000) | 0,
  capacity: 20000,
  emissionRate: 200,
  emitterObjectId: null,
  particleObjectId: null,
  volumeObjectId: null,
  substeps: 1,
  solverIterations: 4,
  restDensity: 1.0,
  radius: 0.1,
  gravity: vec3(0, -0.016, 0),
  viscosity: 0.1,
  bounce: 0.2,
  drag: 0.0005,
  enableViscosity: true,
  enableDrag: true,
});

export const useFluidStore = create<FluidStore>()(
  subscribeWithSelector(
    immer((set, get) => ({
      systems: {},
      addSystem: (partial) => {
        const sys = { ...defaultFluidSystem(), ...(partial || {}) };
        set((s) => { s.systems[sys.id] = sys; });
        return sys.id;
      },
      updateSystem: (id, partial) => set((s) => { const sys = s.systems[id]; if (sys) Object.assign(sys, partial); }),
      removeSystem: (id) => set((s) => { delete s.systems[id]; }),
      getSystem: (id) => get().systems[id],
    }))
  )
);

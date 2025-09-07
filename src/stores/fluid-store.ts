import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { subscribeWithSelector } from 'zustand/middleware';
import { nanoid } from 'nanoid';
import type { Vector3 } from '@/types/geometry';
import { vec3 } from '@/utils/geometry';

export interface FluidSystemConfig {
  id: string;
  name?: string;
  seed: number; // deterministic seed for scrubbing
  capacity: number; // number of particles
  emitterObjectId: string | null; // defaults to owning object when null
  particleObjectId: string | null; // mesh providing particle shape
  volumeObjectId: string | null; // mesh providing simulation volume/bounds (AABB in world)
  emissionRate: number; // particles per frame injected (clamped by remaining slots)
  gravity: Vector3; // applied each frame
  initialVelocity: Vector3; // base velocity added on spawn (in world space)
  damping: number; // velocity damping (0..1)
  viscosity: number; // simple neighbor velocity blending factor (0..1)
  speed: number; // global speed multiplier for integration
  bounce: number; // energy preserved on volume bounds bounce (0..1)
  particleLifetime: number; // frames; 0 => immortal (stay until reused)
  size: number; // uniform scale for instanced particles (ignored if particle mesh has scale)
}

interface FluidState { systems: Record<string, FluidSystemConfig>; }
interface FluidActions {
  addSystem: (partial?: Partial<FluidSystemConfig>) => string;
  removeSystem: (id: string) => void;
  updateSystem: (id: string, partial: Partial<FluidSystemConfig>) => void;
  getSystem: (id: string) => FluidSystemConfig | undefined;
}

export type FluidStore = FluidState & FluidActions;

const defaultFluidSystem = (): FluidSystemConfig => ({
  id: nanoid(),
  name: 'Fluid System',
  seed: Math.floor(Math.random() * 1_000_000) | 0,
  capacity: 8000,
  emitterObjectId: null,
  particleObjectId: null,
  volumeObjectId: null,
  emissionRate: 50,
  gravity: vec3(0, -0.002, 0),
  initialVelocity: vec3(0, 0, 0),
  damping: 0.0025,
  viscosity: 0.1,
  speed: 1,
  bounce: 0.4,
  particleLifetime: 0,
  size: 0.08,
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
      removeSystem: (id) => set((s) => { delete s.systems[id]; }),
      updateSystem: (id, partial) => set((s) => { const sys = s.systems[id]; if (sys) Object.assign(sys, partial); }),
      getSystem: (id) => get().systems[id],
    }))
  )
);

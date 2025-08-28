import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { subscribeWithSelector } from 'zustand/middleware';
import type { Vector3 } from '@/types/geometry';
import { vec3 } from '@/utils/geometry';
import { nanoid } from 'nanoid';

export interface ParticleSystemConfig {
  id: string;
  name?: string;
  seed: number; // deterministic seed for scrubbing
  capacity: number; // max instances; clamped for backend limits
  emitterObjectId: string | null; // optional override; if null, use owning object's transform
  particleObjectId: string | null; // scene object id providing geometry; only mesh objects supported
  emissionRate: number; // particles per frame
  velocity: Vector3; // initial velocity per frame units
  velocityLocal: boolean; // interpret velocity in emitter local space
  velocityJitter: number; // random spherical jitter added to velocity (world units per frame)
  spawnMode: 'point' | 'surface'; // spawn at emitter point/jitter or on emitter mesh surface
  positionJitter: number; // radius for local positional jitter when spawnMode is 'point'
  particleLifetime: number; // frames
  minScale: number;
  maxScale: number;
  angularVelocity: Vector3; // radians per frame
  gravity: Vector3; // per frame^2
  wind: Vector3; // per frame^2 (constant acceleration)
}

interface ParticlesState {
  systems: Record<string, ParticleSystemConfig>;
}

interface ParticlesActions {
  addSystem: (partial?: Partial<ParticleSystemConfig>) => string; // returns id
  removeSystem: (id: string) => void;
  updateSystem: (id: string, partial: Partial<ParticleSystemConfig>) => void;
  getSystem: (id: string) => ParticleSystemConfig | undefined;
}

export type ParticlesStore = ParticlesState & ParticlesActions;

const defaultSystem = (): ParticleSystemConfig => ({
  id: nanoid(),
  name: 'Particle System',
  seed: Math.floor(Math.random() * 1_000_000) | 0,
  capacity: 5000,
  emitterObjectId: null,
  particleObjectId: null,
  emissionRate: 5,
  velocity: vec3(0, 0.05, 0),
  velocityLocal: true,
  velocityJitter: 0,
  spawnMode: 'point',
  positionJitter: 0,
  particleLifetime: 60, // 60 frames
  minScale: 0.2,
  maxScale: 1,
  angularVelocity: vec3(0, 0, 0.05),
  gravity: vec3(0, -0.002, 0),
  wind: vec3(0, 0, 0),
});

export const useParticlesStore = create<ParticlesStore>()(
  subscribeWithSelector(
    immer((set, get) => ({
      systems: {},
      addSystem: (partial) => {
        const sys = { ...defaultSystem(), ...(partial || {}) };
        set((s) => { s.systems[sys.id] = sys; });
        return sys.id;
      },
      removeSystem: (id) => set((s) => { delete s.systems[id]; }),
      updateSystem: (id, partial) => set((s) => { const sys = s.systems[id]; if (sys) Object.assign(sys, partial); }),
      getSystem: (id) => get().systems[id],
    }))
  )
);

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { subscribeWithSelector } from 'zustand/middleware';
import type { Vector3 } from '@/types/geometry';
import { vec3 } from '@/utils/geometry';

export type EnvPreset =
  | 'none'
  | 'apartment'
  | 'city'
  | 'dawn'
  | 'forest'
  | 'lobby'
  | 'night'
  | 'park'
  | 'studio'
  | 'sunset'
  | 'warehouse';

export type ToneMappingMode = 'None' | 'Linear' | 'Reinhard' | 'Cineon' | 'ACESFilmic';
export type ShadowType = 'Basic' | 'PCF' | 'PCFSoft';

export interface BloomSettings {
  enabled: boolean;
  intensity: number;
  luminanceThreshold: number;
  luminanceSmoothing: number;
  mipmapBlur: boolean;
  kernelSize: 'VERY_SMALL' | 'SMALL' | 'MEDIUM' | 'LARGE' | 'HUGE';
  resolutionX: number; // Resolution.AUTO_SIZE == 0 in postprocessing
  resolutionY: number;
  blendFunction: 'ADD' | 'ALPHA' | 'AVERAGE' | 'COLOR' | 'COLOR_BURN' | 'COLOR_DODGE' | 'DARKEN' | 'DIFFERENCE' | 'DIVIDE' | 'EXCLUSION' | 'HALF' | 'HARD_LIGHT' | 'HUE' | 'INVERT' | 'LIGHTEN' | 'LINEAR_BURN' | 'LINEAR_DODGE' | 'LUMINOSITY' | 'MULTIPLY' | 'NEGATION' | 'NORMAL' | 'OVERLAY' | 'REFLECT' | 'SATURATION' | 'SCREEN' | 'SKIP' | 'SOFT_LIGHT' | 'SUBTRACT' | 'VIVID_LIGHT';
}

export interface DoFSettings {
  enabled: boolean;
  focusDistance: number; // 0-1
  focalLength: number; // 0-1
  bokehScale: number; // >0
  blendFunction: BloomSettings['blendFunction'];
}

export interface FogSettings {
  type: 'none' | 'linear' | 'exp2';
  color: Vector3;
  near: number;
  far: number;
  density: number; // for exp2
}

export interface RendererSettings {
  toneMapping: ToneMappingMode;
  exposure: number;
  physicallyCorrectLights: boolean;
  shadows: boolean;
  shadowType: ShadowType;
}

export interface WorldState {
  environment: EnvPreset;
  bloom: BloomSettings;
  dof: DoFSettings;
  fog: FogSettings;
  renderer: RendererSettings;
}

interface WorldActions {
  setEnvironment: (env: EnvPreset) => void;
  setBloom: (partial: Partial<BloomSettings>) => void;
  setDoF: (partial: Partial<DoFSettings>) => void;
  setFog: (partial: Partial<FogSettings>) => void;
  setRenderer: (partial: Partial<RendererSettings>) => void;
  reset: () => void;
}

type WorldStore = WorldState & WorldActions;

const defaultState: WorldState = {
  environment: 'none',
  bloom: {
    enabled: false,
    intensity: 1,
    luminanceThreshold: 0.9,
    luminanceSmoothing: 0.025,
    mipmapBlur: false,
    kernelSize: 'LARGE',
    resolutionX: 0, // AUTO_SIZE
    resolutionY: 0, // AUTO_SIZE
    blendFunction: 'SCREEN',
  },
  dof: {
    enabled: false,
    focusDistance: 0,
    focalLength: 0.02,
    bokehScale: 2,
    blendFunction: 'NORMAL',
  },
  fog: {
    type: 'none',
    color: vec3(0.14, 0.14, 0.14),
    near: 1,
    far: 100,
    density: 0.015,
  },
  renderer: {
    toneMapping: 'ACESFilmic',
    exposure: 1,
    physicallyCorrectLights: true,
    shadows: true,
    shadowType: 'PCFSoft',
  },
};

export const useWorldStore = create<WorldStore>()(
  subscribeWithSelector(
    immer((set) => ({
      ...defaultState,
      setEnvironment: (environment) => set((s) => void (s.environment = environment)),
      setBloom: (partial) => set((s) => void Object.assign(s.bloom, partial)),
      setDoF: (partial) => set((s) => void Object.assign(s.dof, partial)),
      setFog: (partial) => set((s) => void Object.assign(s.fog, partial)),
      setRenderer: (partial) => set((s) => void Object.assign(s.renderer, partial)),
      reset: () => set(() => ({ ...defaultState })),
    }))
  )
);

// Selectors
export const useEnvironment = () => useWorldStore((s) => s.environment);
export const useBloom = () => useWorldStore((s) => s.bloom);
export const useDoF = () => useWorldStore((s) => s.dof);
export const useFog = () => useWorldStore((s) => s.fog);
export const useRendererSettings = () => useWorldStore((s) => s.renderer);

import * as TSL from 'three/tsl';
import { useShaderTimeStore } from '@/stores/shader-time-store';
import { useAnimationStore } from '@/stores/animation-store';

// Registry for per-material animation timer uniforms
let ACTIVE_MATERIAL_ID: string | null = null;
const animUniforms = new Map<string, { time?: any; frame?: any }>();

export function setActiveMaterialId(id: string | null) {
  ACTIVE_MATERIAL_ID = id;
}

export function updateAnimUniforms(timeSec: number, fps: number) {
  for (const entry of animUniforms.values()) {
    if (entry.time) entry.time.value = timeSec;
    if (entry.frame) entry.frame.value = Math.round(timeSec * fps);
  }
}

export const timeResolvers = {
  time: () => (TSL as any).timerLocal?.() ?? (TSL as any).time ?? null,
  timeSine: () => (TSL as any).timerLocal?.().sin() ?? null,
  timeCos: () => (TSL as any).timerLocal?.().cos() ?? null,
  // Animation-driven timers
  animTime: () => {
    const t = useShaderTimeStore.getState().animTime;
    const u = (TSL as any).uniform(t);
    if (ACTIVE_MATERIAL_ID) {
      const rec = animUniforms.get(ACTIVE_MATERIAL_ID) || {};
      rec.time = u;
      animUniforms.set(ACTIVE_MATERIAL_ID, rec);
    }
    return u;
  },
  animFrame: () => {
    const s = useAnimationStore.getState();
    const f = Math.round(useShaderTimeStore.getState().animTime * (s.fps || 24));
    const u = (TSL as any).uniform(f);
    if (ACTIVE_MATERIAL_ID) {
      const rec = animUniforms.get(ACTIVE_MATERIAL_ID) || {};
      rec.frame = u;
      animUniforms.set(ACTIVE_MATERIAL_ID, rec);
    }
    return u;
  },
} as const;

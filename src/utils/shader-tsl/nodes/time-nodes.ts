import * as TSL from 'three/tsl';
import { animationTimer, animationFps } from '@/utils/shader-tsl/animation-timer';

export const timeResolvers = {
  // Built-in time sources (fallback to timerLocal/time if available)
  time: () => (TSL as any).timerLocal?.() ?? (TSL as any).time ?? null,
  timeSine: () => (TSL as any).timerLocal?.().sin() ?? null,
  timeCos: () => (TSL as any).timerLocal?.().cos() ?? null,
  // Animation-driven timers: shared uniforms updated from the animation system
  animTime: () => animationTimer,
  animFrame: () => {
    const mulNode = (animationTimer as any).mul?.(animationFps) ?? (TSL as any).mul?.(animationTimer, animationFps) ?? null;
    if (!mulNode) return null;
    return (mulNode as any).round?.() ?? (TSL as any).round?.(mulNode) ?? mulNode;
  },
} as const;

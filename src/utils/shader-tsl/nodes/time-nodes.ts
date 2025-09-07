import * as TSL from 'three/tsl';
import { animationTimer, animationFps } from '@/utils/shader-tsl/animation-timer';

export const timeResolvers = {
  // Built-in time sources (fallback to timerLocal/time if available)
  time: () => (TSL).timerLocal?.() ?? (TSL).time ?? null,
  timeSine: () => (TSL).timerLocal?.().sin() ?? null,
  timeCos: () => (TSL).timerLocal?.().cos() ?? null,
  // Animation-driven timers: shared uniforms updated from the animation system
  animTime: () => animationTimer,
  animFrame: () => {
    const mulNode = (animationTimer).mul?.(animationFps) ?? (TSL).mul?.(animationTimer, animationFps) ?? null;
    if (!mulNode) return null;
    return (mulNode).round?.() ?? (TSL).round?.(mulNode) ?? mulNode;
  },
} as const;

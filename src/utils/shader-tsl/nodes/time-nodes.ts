import * as TSL from 'three/tsl';

export const timeResolvers = {
  time: () => (TSL as any).timerLocal?.() ?? (TSL as any).time ?? null,
  timeSine: () => (TSL as any).timerLocal?.().sin() ?? null,
  timeCos: () => (TSL as any).timerLocal?.().cos() ?? null,
} as const;

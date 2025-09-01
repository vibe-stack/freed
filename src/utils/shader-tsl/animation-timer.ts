import * as TSL from 'three/tsl';

// Global uniforms used by shader graphs to reference the animation playhead and fps.
// These are driven from the animation system (see AnimationSampler) and shared by all materials.
export const animationTimer = (TSL as any).uniform?.(0) ?? TSL.float(0);
export const animationFps = (TSL as any).uniform?.(30) ?? TSL.float(30);

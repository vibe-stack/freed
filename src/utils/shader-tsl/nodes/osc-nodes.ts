import * as TSL from 'three/tsl';
import type { ShaderNode } from '@/types/shader';

export const oscResolvers = {
  oscSine: () => (TSL as any).oscSine(),
  oscSquare: () => (TSL as any).oscSquare(),
  oscTriangle: () => (TSL as any).oscTriangle(),
  oscSawtooth: () => (TSL as any).oscSawtooth(),
  // Model builtins grouped here too
  modelDirection: () => (TSL as any).modelDirection ?? TSL.vec3(0, 0, 1),
  modelViewMatrix: () => (TSL as any).modelViewMatrix ?? null,
  modelNormalMatrix: () => (TSL as any).modelNormalMatrix ?? null,
  modelWorldMatrix: () => (TSL as any).modelWorldMatrix ?? null,
  modelPosition: () => (TSL as any).modelPosition ?? TSL.vec3(0, 0, 0),
  modelScale: () => (TSL as any).modelScale ?? TSL.vec3(1, 1, 1),
  modelViewPosition: () => (TSL as any).modelViewPosition ?? TSL.vec3(0, 0, 0),
  modelWorldMatrixInverse: () => (TSL as any).modelWorldMatrixInverse ?? null,
  highpModelViewMatrix: () => (TSL as any).modelViewMatrix ?? null,
  highpModelNormalViewMatrix: () => (TSL as any).highpModelNormalViewMatrix ?? (TSL as any).modelNormalMatrix ?? null,
} as const;

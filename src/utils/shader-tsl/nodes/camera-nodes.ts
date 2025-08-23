import * as TSL from 'three/tsl';

export const cameraResolvers = {
  cameraNear: () => (TSL as any).cameraNear ?? null,
  cameraFar: () => (TSL as any).cameraFar ?? null,
  cameraProjectionMatrix: () => (TSL as any).cameraProjectionMatrix ?? null,
  cameraProjectionMatrixInverse: () => (TSL as any).cameraProjectionMatrixInverse ?? null,
  cameraViewMatrix: () => (TSL as any).cameraViewMatrix ?? null,
  cameraWorldMatrix: () => (TSL as any).cameraWorldMatrix ?? null,
  cameraNormalMatrix: () => (TSL as any).cameraNormalMatrix ?? null,
} as const;

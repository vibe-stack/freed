import * as TSL from 'three/tsl';

export const cameraResolvers = {
  cameraNear: () => (TSL).cameraNear ?? null,
  cameraFar: () => (TSL).cameraFar ?? null,
  cameraProjectionMatrix: () => (TSL).cameraProjectionMatrix ?? null,
  cameraProjectionMatrixInverse: () => (TSL).cameraProjectionMatrixInverse ?? null,
  cameraViewMatrix: () => (TSL).cameraViewMatrix ?? null,
  cameraWorldMatrix: () => (TSL).cameraWorldMatrix ?? null,
  cameraNormalMatrix: () => (TSL).cameraNormalMatrix ?? null,
} as const;

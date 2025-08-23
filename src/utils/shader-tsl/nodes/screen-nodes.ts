import * as TSL from 'three/tsl';

export const screenResolvers = {
  screenUV: () => (TSL as any).screenUV ?? null,
  screenCoordinate: () => (TSL as any).screenCoordinate ?? null,
  screenSize: () => (TSL as any).screenSize ?? null,
  viewportUV: () => (TSL as any).viewportUV ?? null,
  viewport: () => (TSL as any).viewport ?? null,
  viewportCoordinate: () => (TSL as any).viewportCoordinate ?? null,
  viewportSize: () => (TSL as any).viewportSize ?? null,
} as const;

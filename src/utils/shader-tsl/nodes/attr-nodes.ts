import * as TSL from 'three/tsl';

export const attrResolvers = {
  // Local vertex position (object space coordinates)
  // Try multiple fallback patterns to ensure we get actual vertex positions
  positionAttr: () => {
    return (TSL as any).positionLocal ?? 
           (TSL as any).position ?? 
           (TSL as any).attribute?.('position') ?? 
           null;
  },
  normalAttr: () => (TSL as any).normalLocal ?? null,
  uvAttr: () => TSL.uv(),
  // View space position (camera relative)
  viewPosition: () => (TSL as any).modelViewPosition ?? null,
  // World space position (scene coordinates, after transform)
  worldPosition: () => {
    return (TSL as any).positionWorld ?? 
           (TSL as any).worldPosition ?? 
           null;
  },
  cameraPosition: () => (TSL as any).cameraPosition ?? null,
} as const;

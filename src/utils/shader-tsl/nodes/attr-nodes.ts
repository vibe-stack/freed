import * as TSL from 'three/tsl';
import type { ShaderNode } from '@/types/shader';

export const attrResolvers = {
  positionAttr: () => (TSL as any).positionLocal?.() ?? null,
  normalAttr: () => (TSL as any).normalLocal ?? null,
  uvAttr: () => TSL.uv(),
  // Fallback to modelViewPosition which is widely available across TSL versions
  viewPosition: () => (TSL as any).modelViewPosition ?? null,
  worldPosition: () => (TSL as any).positionWorld ?? null,
  cameraPosition: () => (TSL as any).cameraPosition ?? null,
} as const;

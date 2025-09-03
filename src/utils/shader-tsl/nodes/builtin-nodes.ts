import * as TSL from 'three/tsl';
import type { ShaderNode } from '@/types/shader';

export const builtinResolvers = {
  input: (_node: ShaderNode, outHandle: string) => {
    if (outHandle === 'uv') return TSL.uv();
    // three/tsl doesn't expose uv2() across all builds; use primary uv as a safe fallback for now
    if (outHandle === 'uv2') return TSL.uv();
    if (outHandle === 'normal') return (TSL as any).normalWorld;
    return null;
  },
  uv: () => TSL.uv(),
  // Fallback to primary uv for uv2 until a robust attribute-based node is added
  uv2: () => TSL.uv(),
  normal: () => (TSL as any).normalWorld,
} as const;

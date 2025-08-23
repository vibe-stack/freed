import * as TSL from 'three/tsl';
import type { ShaderNode } from '@/types/shader';

export const builtinResolvers = {
  input: (_node: ShaderNode, outHandle: string) => {
    if (outHandle === 'uv') return TSL.uv();
    if (outHandle === 'normal') return (TSL as any).normalWorld;
    return null;
  },
  uv: () => TSL.uv(),
  normal: () => (TSL as any).normalWorld,
} as const;

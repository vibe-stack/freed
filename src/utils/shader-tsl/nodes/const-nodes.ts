import * as TSL from 'three/tsl';
import type { ShaderNode, ConstFloatNode, ConstColorNode } from '@/types/shader';

export const constResolvers = {
  'const-float': (node: ShaderNode) => {
    const v = (node as ConstFloatNode).data?.value ?? 0;
    return TSL.float(v);
  },
  'const-color': (node: ShaderNode) => {
    const d = (node as ConstColorNode).data ?? { r: 1, g: 1, b: 1 };
    return TSL.vec3(d.r ?? 1, d.g ?? 1, d.b ?? 1);
  },
} as const;

type Resolvers = typeof constResolvers;
export type ConstNodeKey = keyof Resolvers;
export type NodeResolver = Resolvers[ConstNodeKey];

// Wrap to uniform resolver signature
export const constResolverWrap: Record<string, any> = Object.fromEntries(
  Object.entries(constResolvers).map(([k, fn]) => [k, (n: ShaderNode) => (fn as any)(n)])
);

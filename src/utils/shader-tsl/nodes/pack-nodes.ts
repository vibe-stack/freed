import * as TSL from 'three/tsl';
import type { ShaderNode } from '@/types/shader';

type Ctx = { findInput: (nodeId: string, handle: string) => { from: ShaderNode; fromHandle: string } | null };

export const packResolvers = {
  directionToColor: (n: ShaderNode, _o: string, ctx: Ctx, build: any) => {
    const v = ctx.findInput(n.id, 'value');
    return (TSL as any).directionToColor?.(v ? build(v.from, v.fromHandle) : TSL.vec3(0, 0, 1)) ?? null;
  },
  colorToDirection: (n: ShaderNode, _o: string, ctx: Ctx, build: any) => {
    const v = ctx.findInput(n.id, 'value');
    return (TSL as any).colorToDirection?.(v ? build(v.from, v.fromHandle) : TSL.vec3(0, 0, 1)) ?? null;
  },
} as const;

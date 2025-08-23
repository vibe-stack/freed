import * as TSL from 'three/tsl';
import type { ShaderNode } from '@/types/shader';

type Ctx = { findInput: (nodeId: string, handle: string) => { from: ShaderNode; fromHandle: string } | null };

export const rotateResolvers = {
  rotate: (n: ShaderNode, _o: string, ctx: Ctx, build: any) => {
    const p = ctx.findInput(n.id, 'position');
    const r = ctx.findInput(n.id, 'rotation');
    return (TSL as any).rotate?.(
      p ? build(p.from, p.fromHandle) : TSL.vec3(0, 0, 0),
      r ? build(r.from, r.fromHandle) : TSL.vec3(0, 0, 0)
    ) ?? (p ? build(p.from, p.fromHandle) : TSL.vec3(0, 0, 0));
  },
} as const;

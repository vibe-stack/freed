import * as TSL from 'three/tsl';
import type { ShaderNode } from '@/types/shader';

type Ctx = { findInput: (nodeId: string, handle: string) => { from: ShaderNode; fromHandle: string } | null };

export const conditionalResolvers = {
  select: (n: ShaderNode, _o: string, ctx: Ctx, build: any) => {
    const c = ctx.findInput(n.id, 'cond');
    const a = ctx.findInput(n.id, 'a');
    const b = ctx.findInput(n.id, 'b');
    const cond = c ? build(c.from, c.fromHandle) : null;
    const av = a ? build(a.from, a.fromHandle) : null;
    const bv = b ? build(b.from, b.fromHandle) : null;
    const selectFn: any = (TSL as any).select ?? ((cond: any, t: any, f: any) => cond ? t : f);
    return selectFn(cond, av, bv);
  },
} as const;

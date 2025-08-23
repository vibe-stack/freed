import * as TSL from 'three/tsl';
import type { ShaderNode } from '@/types/shader';

type Ctx = { findInput: (nodeId: string, handle: string) => { from: ShaderNode; fromHandle: string } | null };

export const randomResolvers = {
  hash: (n: ShaderNode, _o: string, ctx: Ctx, build: any) => {
    const s = ctx.findInput(n.id, 'seed');
    const hv: any = (TSL as any).hash ?? null;
    return hv ? hv(s ? build(s.from, s.fromHandle) : TSL.float(0)) : null;
  },
} as const;

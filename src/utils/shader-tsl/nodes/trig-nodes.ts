import * as TSL from 'three/tsl';
import type { ShaderNode } from '@/types/shader';

type Ctx = { findInput: (nodeId: string, handle: string) => { from: ShaderNode; fromHandle: string } | null };

const in1 = (n: ShaderNode, ctx: Ctx, build: any, key = 'x') => {
  const a = ctx.findInput(n.id, key);
  return a ? build(a.from, a.fromHandle) : null;
};

export const trigResolvers = {
  sin: (n: ShaderNode, _o: string, ctx: Ctx, build: any) => TSL.sin(in1(n, ctx, build)),
  cos: (n: ShaderNode, _o: string, ctx: Ctx, build: any) => TSL.cos(in1(n, ctx, build)),
  tan: (n: ShaderNode, _o: string, ctx: Ctx, build: any) => (TSL as any).tan?.(in1(n, ctx, build)) ?? in1(n, ctx, build),
  asin: (n: ShaderNode, _o: string, ctx: Ctx, build: any) => (TSL as any).asin?.(in1(n, ctx, build)) ?? in1(n, ctx, build),
  acos: (n: ShaderNode, _o: string, ctx: Ctx, build: any) => (TSL as any).acos?.(in1(n, ctx, build)) ?? in1(n, ctx, build),
  atan: (n: ShaderNode, _o: string, ctx: Ctx, build: any) => (TSL as any).atan?.(in1(n, ctx, build)) ?? in1(n, ctx, build),
} as const;

import * as TSL from 'three/tsl';
import type { ShaderNode } from '@/types/shader';

type Ctx = { findInput: (nodeId: string, handle: string) => { from: ShaderNode; fromHandle: string } | null };

export const interpResolvers = {
  remap: (n: ShaderNode, _o: string, ctx: Ctx, build: any) => {
    const x = ctx.findInput(n.id, 'x');
    const inLow = ctx.findInput(n.id, 'inLow');
    const inHigh = ctx.findInput(n.id, 'inHigh');
    const outLow = ctx.findInput(n.id, 'outLow');
    const outHigh = ctx.findInput(n.id, 'outHigh');
    return (TSL as any).remap?.(
      x ? build(x.from, x.fromHandle) : TSL.float(0),
      inLow ? build(inLow.from, inLow.fromHandle) : TSL.float(0),
      inHigh ? build(inHigh.from, inHigh.fromHandle) : TSL.float(1),
      outLow ? build(outLow.from, outLow.fromHandle) : TSL.float(0),
      outHigh ? build(outHigh.from, outHigh.fromHandle) : TSL.float(1)
    ) ?? null;
  },
  remapClamp: (n: ShaderNode, _o: string, ctx: Ctx, build: any) => {
    const x = ctx.findInput(n.id, 'x');
    const inLow = ctx.findInput(n.id, 'inLow');
    const inHigh = ctx.findInput(n.id, 'inHigh');
    const outLow = ctx.findInput(n.id, 'outLow');
    const outHigh = ctx.findInput(n.id, 'outHigh');
    return (TSL as any).remapClamp?.(
      x ? build(x.from, x.fromHandle) : TSL.float(0),
      inLow ? build(inLow.from, inLow.fromHandle) : TSL.float(0),
      inHigh ? build(inHigh.from, inHigh.fromHandle) : TSL.float(1),
      outLow ? build(outLow.from, outLow.fromHandle) : TSL.float(0),
      outHigh ? build(outHigh.from, outHigh.fromHandle) : TSL.float(1)
    ) ?? null;
  },
} as const;

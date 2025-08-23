import * as TSL from 'three/tsl';
import type { ShaderNode } from '@/types/shader';
import * as ShaderTypes from '@/types/shader';

type Ctx = { findInput: (nodeId: string, handle: string) => { from: ShaderNode; fromHandle: string } | null };

export const vectorResolvers = {
  vec2: (n: ShaderNode, _o: string, ctx: Ctx, build: any) => {
    const ax = ctx.findInput(n.id, 'x');
    const ay = ctx.findInput(n.id, 'y');
    return TSL.vec2(ax ? build(ax.from, ax.fromHandle) : TSL.float(0), ay ? build(ay.from, ay.fromHandle) : TSL.float(0));
  },
  vec3: (n: ShaderNode, _o: string, ctx: Ctx, build: any) => {
    const ax = ctx.findInput(n.id, 'x');
    const ay = ctx.findInput(n.id, 'y');
    const az = ctx.findInput(n.id, 'z');
    return TSL.vec3(
      ax ? build(ax.from, ax.fromHandle) : TSL.float(0),
      ay ? build(ay.from, ay.fromHandle) : TSL.float(0),
      az ? build(az.from, az.fromHandle) : TSL.float(0)
    );
  },
  vec4: (n: ShaderNode, _o: string, ctx: Ctx, build: any) => {
    const ax = ctx.findInput(n.id, 'x');
    const ay = ctx.findInput(n.id, 'y');
    const az = ctx.findInput(n.id, 'z');
    const aw = ctx.findInput(n.id, 'w');
    return TSL.vec4(
      ax ? build(ax.from, ax.fromHandle) : TSL.float(0),
      ay ? build(ay.from, ay.fromHandle) : TSL.float(0),
      az ? build(az.from, az.fromHandle) : TSL.float(0),
      aw ? build(aw.from, aw.fromHandle) : TSL.float(1)
    );
  },
  swizzle: (n: any, _o: string, ctx: Ctx, build: any) => {
    // n.data.mask e.g., 'x', 'xy', 'xyz', 'rgba'
    const a = ctx.findInput(n.id, 'in');
    const v = a ? build(a.from, a.fromHandle) : null;
    const mask: string = n.data?.mask ?? 'x';
    // TSL supports getMember for swizzles
    return (v as any)?.getMember?.(mask) ?? v;
  },
  combine: (n: any, _o: string, ctx: Ctx, build: any) => {
    // Combine individual channels to vecN based on mask length
    const x = ctx.findInput(n.id, 'x');
    const y = ctx.findInput(n.id, 'y');
    const z = ctx.findInput(n.id, 'z');
    const w = ctx.findInput(n.id, 'w');
    const mask: string = n.data?.mask ?? 'xyz';
    const comps = [x, y, z, w].map((c) => (c ? build(c.from, c.fromHandle) : TSL.float(0)));
    if (mask.length === 2) return TSL.vec2(comps[0], comps[1]);
    if (mask.length === 3) return TSL.vec3(comps[0], comps[1], comps[2]);
    if (mask.length === 4) return TSL.vec4(comps[0], comps[1], comps[2], comps[3]);
    return comps[0];
  },
  unpack: (n: any, out: string, ctx: Ctx, build: any) => {
    const inp = ctx.findInput(n.id, 'value');
    const srcExpr = inp ? build(inp.from, inp.fromHandle) : null;
    // Determine dimension of the source vector from declared output type
    const outT = inp ? (ShaderTypes.NodeOutputs as any)[(inp.from as any).type]?.[inp.fromHandle as string] as ShaderTypes.SocketType | undefined : undefined;
    const dim = outT === 'vec4' ? 4 : outT === 'vec3' ? 3 : outT === 'vec2' ? 2 : 1;
    const idx = out === 'x' ? 0 : out === 'y' ? 1 : out === 'z' ? 2 : 3;
    if (!srcExpr) return TSL.float(0);
    if (idx < dim) {
      const member = out; // 'x'|'y'|'z'|'w'
      return (srcExpr as any)?.getMember?.(member) ?? srcExpr;
    }
    // Default missing components: z/y -> 0, w -> 1
    return idx === 3 ? TSL.float(1) : TSL.float(0);
  },
} as const;

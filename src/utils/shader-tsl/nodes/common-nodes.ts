import * as TSL from 'three/tsl';
import type { ShaderNode } from '@/types/shader';

type Ctx = { findInput: (nodeId: string, handle: string) => { from: ShaderNode; fromHandle: string } | null };

const in1 = (n: ShaderNode, ctx: Ctx, build: any, key = 'x') => {
  const a = ctx.findInput(n.id, key);
  return a ? build(a.from, a.fromHandle) : null;
};
const in2 = (n: ShaderNode, ctx: Ctx, build: any, aKey = 'a', bKey = 'b') => {
  const a = ctx.findInput(n.id, aKey);
  const b = ctx.findInput(n.id, bKey);
  return [a ? build(a.from, a.fromHandle) : null, b ? build(b.from, b.fromHandle) : null];
};

export const commonResolvers = {
  abs: (n: ShaderNode, _o: string, ctx: Ctx, build: any) => TSL.abs(in1(n, ctx, build)),
  floor: (n: ShaderNode, _o: string, ctx: Ctx, build: any) => (TSL as any).floor?.(in1(n, ctx, build)) ?? in1(n, ctx, build),
  ceil: (n: ShaderNode, _o: string, ctx: Ctx, build: any) => (TSL as any).ceil?.(in1(n, ctx, build)) ?? in1(n, ctx, build),
  clamp: (n: ShaderNode, _o: string, ctx: Ctx, build: any) => {
    const [x, minV] = in2(n, ctx, build, 'x', 'min');
    const maxIn = ctx.findInput(n.id, 'max');
    const maxV = maxIn ? build(maxIn.from, maxIn.fromHandle) : null;
    return TSL.clamp(x, minV, maxV);
  },
  saturate: (n: ShaderNode, _o: string, ctx: Ctx, build: any) => TSL.saturate(in1(n, ctx, build)),
  min: (n: ShaderNode, _o: string, ctx: Ctx, build: any) => {
    const [a, b] = in2(n, ctx, build);
    return (TSL as any).min?.(a, b) ?? a;
  },
  max: (n: ShaderNode, _o: string, ctx: Ctx, build: any) => {
    const [a, b] = in2(n, ctx, build);
    return (TSL as any).max?.(a, b) ?? a;
  },
  step: (n: ShaderNode, _o: string, ctx: Ctx, build: any) => {
    const [edge, x] = in2(n, ctx, build, 'edge', 'x');
    return TSL.step(edge, x);
  },
  smoothstep: (n: ShaderNode, _o: string, ctx: Ctx, build: any) => {
    const a = ctx.findInput(n.id, 'a');
    const b = ctx.findInput(n.id, 'b');
    const x = ctx.findInput(n.id, 'x');
    return TSL.smoothstep(a ? build(a.from, a.fromHandle) : null, b ? build(b.from, b.fromHandle) : null, x ? build(x.from, x.fromHandle) : null);
  },
  pow: (n: ShaderNode, _o: string, ctx: Ctx, build: any) => {
    const [a, b] = in2(n, ctx, build);
    return TSL.pow(a, b);
  },
  exp: (n: ShaderNode, _o: string, ctx: Ctx, build: any) => (TSL as any).exp?.(in1(n, ctx, build)) ?? in1(n, ctx, build),
  log: (n: ShaderNode, _o: string, ctx: Ctx, build: any) => (TSL as any).log?.(in1(n, ctx, build)) ?? in1(n, ctx, build),
  sqrt: (n: ShaderNode, _o: string, ctx: Ctx, build: any) => TSL.sqrt(in1(n, ctx, build)),
  sign: (n: ShaderNode, _o: string, ctx: Ctx, build: any) => (TSL as any).sign?.(in1(n, ctx, build)) ?? in1(n, ctx, build),
  fract: (n: ShaderNode, _o: string, ctx: Ctx, build: any) => TSL.fract(in1(n, ctx, build)),
  length: (n: ShaderNode, _o: string, ctx: Ctx, build: any) => TSL.length(in1(n, ctx, build)),
  normalize: (n: ShaderNode, _o: string, ctx: Ctx, build: any) => TSL.normalize(in1(n, ctx, build)),
  dot: (n: ShaderNode, _o: string, ctx: Ctx, build: any) => {
    const [a, b] = in2(n, ctx, build);
    return TSL.dot(a, b);
  },
  cross: (n: ShaderNode, _o: string, ctx: Ctx, build: any) => {
    const [a, b] = in2(n, ctx, build);
    return (TSL as any).cross?.(a, b) ?? a;
  },
  distance: (n: ShaderNode, _o: string, ctx: Ctx, build: any) => {
    const [a, b] = in2(n, ctx, build);
    return (TSL as any).distance?.(a, b) ?? TSL.length(TSL.sub(a, b));
  },
  reflect: (n: ShaderNode, _o: string, ctx: Ctx, build: any) => {
    const a = ctx.findInput(n.id, 'I');
    const b = ctx.findInput(n.id, 'N');
    return (TSL as any).reflect?.(a ? build(a.from, a.fromHandle) : null, b ? build(b.from, b.fromHandle) : null) ?? null;
  },
  refract: (n: ShaderNode, _o: string, ctx: Ctx, build: any) => {
    const I = ctx.findInput(n.id, 'I');
    const N = ctx.findInput(n.id, 'N');
    const eta = ctx.findInput(n.id, 'eta');
    return (TSL as any).refract?.(
      I ? build(I.from, I.fromHandle) : null,
      N ? build(N.from, N.fromHandle) : null,
      eta ? build(eta.from, eta.fromHandle) : TSL.float(1)
    ) ?? null;
  },
  round: (n: ShaderNode, _o: string, ctx: Ctx, build: any) => (TSL as any).round?.(in1(n, ctx, build)) ?? in1(n, ctx, build),
  trunc: (n: ShaderNode, _o: string, ctx: Ctx, build: any) => (TSL as any).trunc?.(in1(n, ctx, build)) ?? in1(n, ctx, build),
  inverseSqrt: (n: ShaderNode, _o: string, ctx: Ctx, build: any) => (TSL as any).inverseSqrt?.(in1(n, ctx, build)) ?? in1(n, ctx, build),
  degrees: (n: ShaderNode, _o: string, ctx: Ctx, build: any) => (TSL as any).degrees?.(in1(n, ctx, build)) ?? in1(n, ctx, build),
  radians: (n: ShaderNode, _o: string, ctx: Ctx, build: any) => (TSL as any).radians?.(in1(n, ctx, build)) ?? in1(n, ctx, build),
  exp2: (n: ShaderNode, _o: string, ctx: Ctx, build: any) => (TSL as any).exp2?.(in1(n, ctx, build)) ?? in1(n, ctx, build),
  log2: (n: ShaderNode, _o: string, ctx: Ctx, build: any) => (TSL as any).log2?.(in1(n, ctx, build)) ?? in1(n, ctx, build),
  lengthSq: (n: ShaderNode, _o: string, ctx: Ctx, build: any) => (TSL as any).lengthSq?.(in1(n, ctx, build)) ?? null,
  oneMinus: (n: ShaderNode, _o: string, ctx: Ctx, build: any) => (TSL as any).oneMinus?.(in1(n, ctx, build)) ?? null,
  pow2: (n: ShaderNode, _o: string, ctx: Ctx, build: any) => (TSL as any).pow2?.(in1(n, ctx, build)) ?? null,
  pow3: (n: ShaderNode, _o: string, ctx: Ctx, build: any) => (TSL as any).pow3?.(in1(n, ctx, build)) ?? null,
  pow4: (n: ShaderNode, _o: string, ctx: Ctx, build: any) => (TSL as any).pow4?.(in1(n, ctx, build)) ?? null,
} as const;

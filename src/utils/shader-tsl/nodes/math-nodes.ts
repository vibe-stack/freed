import * as TSL from 'three/tsl';
import type { ShaderNode } from '@/types/shader';

type Ctx = { findInput: (nodeId: string, handle: string) => { from: ShaderNode; fromHandle: string } | null };

const op2 = (name: keyof typeof TSL, a: any, b: any) => {
  const fn: any = (TSL as any)[name];
  return typeof fn === 'function' ? fn(a, b) : a;
};
const op1 = (name: keyof typeof TSL, a: any) => {
  const fn: any = (TSL as any)[name];
  return typeof fn === 'function' ? fn(a) : a;
};

export const mathResolvers = {
  add: (n: ShaderNode, _out: string, ctx: Ctx, build: any) => {
    const a = ctx.findInput(n.id, 'a');
    const b = ctx.findInput(n.id, 'b');
    return TSL.add(a ? build(a.from, a.fromHandle) : null, b ? build(b.from, b.fromHandle) : null);
  },
  sub: (n: ShaderNode, _out: string, ctx: Ctx, build: any) => {
    const a = ctx.findInput(n.id, 'a');
    const b = ctx.findInput(n.id, 'b');
    return op2('sub', a ? build(a.from, a.fromHandle) : null, b ? build(b.from, b.fromHandle) : null);
  },
  mul: (n: ShaderNode, _out: string, ctx: Ctx, build: any) => {
    const a = ctx.findInput(n.id, 'a');
    const b = ctx.findInput(n.id, 'b');
    // TSL.mul handles vector*scalar and vector*vector
    return TSL.mul(a ? build(a.from, a.fromHandle) : null, b ? build(b.from, b.fromHandle) : null);
  },
  div: (n: ShaderNode, _out: string, ctx: Ctx, build: any) => {
    const a = ctx.findInput(n.id, 'a');
    const b = ctx.findInput(n.id, 'b');
    return op2('div', a ? build(a.from, a.fromHandle) : null, b ? build(b.from, b.fromHandle) : null);
  },
  assign: (n: ShaderNode, _out: string, ctx: Ctx, build: any) => {
    const a = ctx.findInput(n.id, 'a');
    const b = ctx.findInput(n.id, 'b');
    return b ? build(b.from, b.fromHandle) : a ? build(a.from, a.fromHandle) : null;
  },
  mod: (n: ShaderNode, _out: string, ctx: Ctx, build: any) => {
    const a = ctx.findInput(n.id, 'a');
    const b = ctx.findInput(n.id, 'b');
    return op2('mod', a ? build(a.from, a.fromHandle) : null, b ? build(b.from, b.fromHandle) : null);
  },
  equal: (n: ShaderNode, _out: string, ctx: Ctx, build: any) => {
    const a = ctx.findInput(n.id, 'a');
    const b = ctx.findInput(n.id, 'b');
    return op2('equal', a ? build(a.from, a.fromHandle) : null, b ? build(b.from, b.fromHandle) : null);
  },
  notEqual: (n: ShaderNode, _out: string, ctx: Ctx, build: any) => {
    const a = ctx.findInput(n.id, 'a');
    const b = ctx.findInput(n.id, 'b');
    return op2('notEqual', a ? build(a.from, a.fromHandle) : null, b ? build(b.from, b.fromHandle) : null);
  },
  lessThan: (n: ShaderNode, _out: string, ctx: Ctx, build: any) => {
    const a = ctx.findInput(n.id, 'a');
    const b = ctx.findInput(n.id, 'b');
    return op2('lessThan', a ? build(a.from, a.fromHandle) : null, b ? build(b.from, b.fromHandle) : null);
  },
  greaterThan: (n: ShaderNode, _out: string, ctx: Ctx, build: any) => {
    const a = ctx.findInput(n.id, 'a');
    const b = ctx.findInput(n.id, 'b');
    return op2('greaterThan', a ? build(a.from, a.fromHandle) : null, b ? build(b.from, b.fromHandle) : null);
  },
  lessThanEqual: (n: ShaderNode, _out: string, ctx: Ctx, build: any) => {
    const a = ctx.findInput(n.id, 'a');
    const b = ctx.findInput(n.id, 'b');
    return op2('lessThanEqual', a ? build(a.from, a.fromHandle) : null, b ? build(b.from, b.fromHandle) : null);
  },
  greaterThanEqual: (n: ShaderNode, _out: string, ctx: Ctx, build: any) => {
    const a = ctx.findInput(n.id, 'a');
    const b = ctx.findInput(n.id, 'b');
    return op2('greaterThanEqual', a ? build(a.from, a.fromHandle) : null, b ? build(b.from, b.fromHandle) : null);
  },
  and: (n: ShaderNode, _out: string, ctx: Ctx, build: any) => {
    const a = ctx.findInput(n.id, 'a');
    const b = ctx.findInput(n.id, 'b');
    return op2('and', a ? build(a.from, a.fromHandle) : null, b ? build(b.from, b.fromHandle) : null);
  },
  or: (n: ShaderNode, _out: string, ctx: Ctx, build: any) => {
    const a = ctx.findInput(n.id, 'a');
    const b = ctx.findInput(n.id, 'b');
    return op2('or', a ? build(a.from, a.fromHandle) : null, b ? build(b.from, b.fromHandle) : null);
  },
  not: (n: ShaderNode, _out: string, ctx: Ctx, build: any) => {
    const a = ctx.findInput(n.id, 'a');
    return op1('not', a ? build(a.from, a.fromHandle) : null);
  },
  xor: (n: ShaderNode, _out: string, ctx: Ctx, build: any) => {
    const a = ctx.findInput(n.id, 'a');
    const b = ctx.findInput(n.id, 'b');
    return op2('xor', a ? build(a.from, a.fromHandle) : null, b ? build(b.from, b.fromHandle) : null);
  },
  bitAnd: (n: ShaderNode, _out: string, ctx: Ctx, build: any) => {
    const a = ctx.findInput(n.id, 'a');
    const b = ctx.findInput(n.id, 'b');
    return op2('bitAnd', a ? build(a.from, a.fromHandle) : null, b ? build(b.from, b.fromHandle) : null);
  },
  bitNot: (n: ShaderNode, _out: string, ctx: Ctx, build: any) => {
    const a = ctx.findInput(n.id, 'a');
    return op1('bitNot', a ? build(a.from, a.fromHandle) : null);
  },
  bitOr: (n: ShaderNode, _out: string, ctx: Ctx, build: any) => {
    const a = ctx.findInput(n.id, 'a');
    const b = ctx.findInput(n.id, 'b');
    return op2('bitOr', a ? build(a.from, a.fromHandle) : null, b ? build(b.from, b.fromHandle) : null);
  },
  bitXor: (n: ShaderNode, _out: string, ctx: Ctx, build: any) => {
    const a = ctx.findInput(n.id, 'a');
    const b = ctx.findInput(n.id, 'b');
    return op2('bitXor', a ? build(a.from, a.fromHandle) : null, b ? build(b.from, b.fromHandle) : null);
  },
  shiftLeft: (n: ShaderNode, _out: string, ctx: Ctx, build: any) => {
    const a = ctx.findInput(n.id, 'a');
    const b = ctx.findInput(n.id, 'b');
    return op2('shiftLeft', a ? build(a.from, a.fromHandle) : null, b ? build(b.from, b.fromHandle) : null);
  },
  shiftRight: (n: ShaderNode, _out: string, ctx: Ctx, build: any) => {
    const a = ctx.findInput(n.id, 'a');
    const b = ctx.findInput(n.id, 'b');
    return op2('shiftRight', a ? build(a.from, a.fromHandle) : null, b ? build(b.from, b.fromHandle) : null);
  },
  mix: (n: ShaderNode, _out: string, ctx: Ctx, build: any) => {
    const a = ctx.findInput(n.id, 'a');
    const b = ctx.findInput(n.id, 'b');
    const t = ctx.findInput(n.id, 't');
    return TSL.mix(
      a ? build(a.from, a.fromHandle) : null,
      b ? build(b.from, b.fromHandle) : null,
      t ? build(t.from, t.fromHandle) : null
    );
  },
} as const;

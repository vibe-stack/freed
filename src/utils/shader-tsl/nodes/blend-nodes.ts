import * as TSL from 'three/tsl';
import type { ShaderNode } from '@/types/shader';

type Ctx = { findInput: (nodeId: string, handle: string) => { from: ShaderNode; fromHandle: string } | null };

function ab(n: ShaderNode, ctx: Ctx, build: any) {
  const a = ctx.findInput(n.id, 'a');
  const b = ctx.findInput(n.id, 'b');
  return [a ? build(a.from, a.fromHandle) : TSL.vec3(0, 0, 0), b ? build(b.from, b.fromHandle) : TSL.vec3(0, 0, 0)];
}

export const blendResolvers = {
  blendBurn: (n: ShaderNode, _o: string, ctx: Ctx, build: any) => (TSL as any).blendBurn?.(...ab(n, ctx, build)) ?? null,
  blendDodge: (n: ShaderNode, _o: string, ctx: Ctx, build: any) => (TSL as any).blendDodge?.(...ab(n, ctx, build)) ?? null,
  blendOverlay: (n: ShaderNode, _o: string, ctx: Ctx, build: any) => (TSL as any).blendOverlay?.(...ab(n, ctx, build)) ?? null,
  blendScreen: (n: ShaderNode, _o: string, ctx: Ctx, build: any) => (TSL as any).blendScreen?.(...ab(n, ctx, build)) ?? null,
  blendColor: (n: ShaderNode, _o: string, ctx: Ctx, build: any) => (TSL as any).blendColor?.(...ab(n, ctx, build)) ?? null,
} as const;

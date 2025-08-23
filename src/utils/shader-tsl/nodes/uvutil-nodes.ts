import * as TSL from 'three/tsl';
import type { ShaderNode } from '@/types/shader';

type Ctx = { findInput: (nodeId: string, handle: string) => { from: ShaderNode; fromHandle: string } | null };

export const uvUtilResolvers = {
  matcapUV: () => (TSL as any).matcapUV ?? null,
  rotateUV: (n: ShaderNode, _o: string, ctx: Ctx, build: any) => {
    const uv = ctx.findInput(n.id, 'uv');
    const rot = ctx.findInput(n.id, 'rotation');
    return (TSL as any).rotateUV?.(
      uv ? build(uv.from, uv.fromHandle) : (TSL as any).uv?.(),
      rot ? build(rot.from, rot.fromHandle) : TSL.float(0)
    ) ?? (uv ? build(uv.from, uv.fromHandle) : (TSL as any).uv?.());
  },
  spherizeUV: (n: ShaderNode, _o: string, ctx: Ctx, build: any) => {
    const uv = ctx.findInput(n.id, 'uv');
    const s = ctx.findInput(n.id, 'strength');
    return (TSL as any).spherizeUV?.(
      uv ? build(uv.from, uv.fromHandle) : (TSL as any).uv?.(),
      s ? build(s.from, s.fromHandle) : TSL.float(0)
    ) ?? (uv ? build(uv.from, uv.fromHandle) : (TSL as any).uv?.());
  },
  spritesheetUV: (n: ShaderNode, _o: string, ctx: Ctx, build: any) => {
    const c = ctx.findInput(n.id, 'count');
    const uv = ctx.findInput(n.id, 'uv');
    const f = ctx.findInput(n.id, 'frame');
    return (TSL as any).spritesheetUV?.(
      c ? build(c.from, c.fromHandle) : TSL.float(1),
      uv ? build(uv.from, uv.fromHandle) : (TSL as any).uv?.(),
      f ? build(f.from, f.fromHandle) : TSL.float(0)
    ) ?? (uv ? build(uv.from, uv.fromHandle) : (TSL as any).uv?.());
  },
  equirectUV: (n: ShaderNode, _o: string, ctx: Ctx, build: any) => {
    const d = ctx.findInput(n.id, 'direction');
    return (TSL as any).equirectUV?.(d ? build(d.from, d.fromHandle) : (TSL as any).positionWorldDirection ?? TSL.vec3(0, 0, 1)) ?? null;
  },
} as const;

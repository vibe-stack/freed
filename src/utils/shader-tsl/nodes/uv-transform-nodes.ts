import * as TSL from 'three/tsl';
import type { ShaderNode } from '@/types/shader';

type Ctx = { findInput: (nodeId: string, handle: string) => { from: ShaderNode; fromHandle: string } | null };

export const uvTransformResolvers = {
  uvScale: (n: ShaderNode, _o: string, ctx: Ctx, build: any) => {
    const uvIn = ctx.findInput(n.id, 'uv');
    const scaleIn = ctx.findInput(n.id, 'scale');
    const uv = uvIn ? build(uvIn.from, uvIn.fromHandle) : (TSL as any).uv?.();
    const scale = scaleIn ? build(scaleIn.from, scaleIn.fromHandle) : TSL.vec2(1, 1);
    return (TSL as any).mul ? (TSL as any).mul(uv, scale) : uv.mul?.(scale) ?? uv; // graceful fallback
  },
  uvTransform: (n: ShaderNode, _o: string, ctx: Ctx, build: any) => {
    const uvIn = ctx.findInput(n.id, 'uv');
    const offIn = ctx.findInput(n.id, 'offset');
    const rotIn = ctx.findInput(n.id, 'rotation');
    const scaleIn = ctx.findInput(n.id, 'scale');
  const centerIn = ctx.findInput(n.id, 'center');
    const uv = uvIn ? build(uvIn.from, uvIn.fromHandle) : (TSL as any).uv?.();
    const offset = offIn ? build(offIn.from, offIn.fromHandle) : TSL.vec2(0, 0);
    const scale = scaleIn ? build(scaleIn.from, scaleIn.fromHandle) : TSL.vec2(1, 1);
    const rotation = rotIn ? build(rotIn.from, rotIn.fromHandle) : TSL.float(0);
  // uv' = ((uv - center) rotated by rotation, then scaled) + center + offset
  // Default center to (0,0) to match three.js Texture default and glTF KHR_texture_transform default
  const center = centerIn ? build(centerIn.from, centerIn.fromHandle) : TSL.vec2(0, 0);
  const uvCentered = (TSL as any).sub ? (TSL as any).sub(uv, center) : uv.sub?.(center) ?? uv;
    const c = (TSL as any).cos ? (TSL as any).cos(rotation) : rotation;
    const s = (TSL as any).sin ? (TSL as any).sin(rotation) : rotation;
    const rotX = (TSL as any).sub ? (TSL as any).sub((TSL as any).mul(uvCentered.x, c), (TSL as any).mul(uvCentered.y, s)) : uvCentered.x;
    const rotY = (TSL as any).add ? (TSL as any).add((TSL as any).mul(uvCentered.x, s), (TSL as any).mul(uvCentered.y, c)) : uvCentered.y;
  const uvRot = TSL.vec2(rotX, rotY);
  const uvScaled = (TSL as any).mul ? (TSL as any).mul(uvRot, scale) : uvRot;
  const uvUncentered = (TSL as any).add ? (TSL as any).add(uvScaled, center) : uvScaled;
  const uvOff = (TSL as any).add ? (TSL as any).add(uvUncentered, offset) : uvUncentered;
    return uvOff;
  },
} as const;

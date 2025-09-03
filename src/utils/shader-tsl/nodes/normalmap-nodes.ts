import * as TSL from 'three/tsl';
import type { ShaderNode } from '@/types/shader';

type Ctx = { findInput: (nodeId: string, handle: string) => { from: ShaderNode; fromHandle: string } | null };

export const normalMapResolvers = {
  normalMap: (n: ShaderNode, _o: string, ctx: Ctx, build: any) => {
    const uvIn = ctx.findInput(n.id, 'uv');
    const scaleIn = ctx.findInput(n.id, 'scale');
    const uvExpr = uvIn ? build(uvIn.from, uvIn.fromHandle) : (TSL as any).uv?.();
    const scaleExpr = scaleIn ? build(scaleIn.from, scaleIn.fromHandle) : TSL.float(1);

    // This node expects a texture node connected upstream to provide the sampled normal map value
    // Find first incoming edge to this node's implicit 'map' input by scanning 'uv' edge source siblings
    // Since our minimal builder doesn’t expose multiple inputs registry, we rely on pattern: texture -> normalMap
    // So we evaluate the first connected source for this node, excluding 'uv' and 'scale'
    const sampleFrom = (() => {
      // naive: try a sibling connection called 'in'
      const texIn = ctx.findInput(n.id, 'in');
      return texIn ? build(texIn.from, texIn.fromHandle) : null;
    })();

    // If not found, just return world normal to avoid errors
    if (!sampleFrom) return (TSL as any).normalWorld ?? TSL.vec3(0, 0, 1);

    // If TSL has a normalMap helper, use it; otherwise derive from RG to tangent space approximation
    const nmHelper = (TSL as any).normalMap;
    if (nmHelper) {
      return nmHelper(sampleFrom, uvExpr, scaleExpr);
    }
    // Fallback: unpack normal from texture (assumes texture sampled upstream as vec4 in tangent space),
    // convert from [0,1] to [-1,1], apply scale to XY, and re-normalize in world space using derivative trick.
    const t = sampleFrom; // vec4
    const nTS = (TSL as any).sub ? (TSL as any).sub((TSL as any).mul(t.xyz, TSL.float(2)), TSL.float(1)) : t;
    const nScaled = TSL.vec3((TSL as any).mul(nTS.x, scaleExpr), (TSL as any).mul(nTS.y, scaleExpr), nTS.z);
    // Without TBN, approximate by perturbing camera-space normal (best-effort)
    const N = (TSL as any).normalWorld ?? TSL.vec3(0, 0, 1);
    // This is a crude fallback; proper TBN requires vertex tangents
    return (TSL as any).normalize ? (TSL as any).normalize((TSL as any).add(N, nScaled)) : N;
  },
} as const;

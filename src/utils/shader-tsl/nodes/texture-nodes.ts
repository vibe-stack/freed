import * as TSL from 'three/tsl';
import type { ShaderNode } from '@/types/shader';
import { getFile } from '@/stores/files-store';
import * as THREE from 'three/webgpu';

type Ctx = { findInput: (nodeId: string, handle: string) => { from: ShaderNode; fromHandle: string } | null };

// Cache created THREE.Texture per file id to avoid recreating
const texCache = new Map<string, THREE.Texture>();

function textureFromFileId(id?: string, colorSpace?: 'sRGB' | 'linear'): THREE.Texture | null {
  if (!id) return null;
  const key = `${id}|${colorSpace || 'sRGB'}`;
  let tex = texCache.get(key);
  if (tex) return tex;
  const sf = getFile(id);
  if (!sf) return null;
  // Create an ImageBitmap-backed texture for efficiency
  const blobUrl = (sf as any)._objectUrl || URL.createObjectURL(sf.blob);
  (sf as any)._objectUrl = blobUrl;
  tex = new THREE.Texture();
  tex.name = sf.name;
  // Apply requested color space: 'sRGB' for color maps, 'linear' for data maps (normals/roughness/etc.)
  const SRGB = (THREE as any).SRGBColorSpace;
  const LINEAR = (THREE as any).LinearSRGBColorSpace ?? (THREE as any).LinearSRGBColorSpace;
  (tex as any).colorSpace = colorSpace === 'linear' ? LINEAR : SRGB;
  // Kick async upload via ImageBitmap
  createImageBitmap(sf.blob).then((bmp) => {
    (tex as any).image = bmp;
    tex.needsUpdate = true;
  }).catch(() => {
    // Fallback: leave texture empty
  });
  texCache.set(key, tex);
  return tex;
}

export const textureResolvers = {
  texture: (n: ShaderNode, _o: string, ctx: Ctx, build: any) => {
    const fileId: string | undefined = (n as any).data?.fileId;
    const colorSpace: 'sRGB' | 'linear' | undefined = (n as any).data?.colorSpace === 'linear' ? 'linear' : 'sRGB';
    const tex = textureFromFileId(fileId, colorSpace);
    if (!tex) return TSL.vec4(0, 0, 0, 1);
    
    // Get UV input or use default uv()
    const uvIn = ctx.findInput(n.id, 'uv');
    const uvExpr = uvIn ? build(uvIn.from, uvIn.fromHandle) : (TSL as any).uv?.();
    
    // Sample the texture directly with TSL.texture()
    return (TSL as any).texture?.(tex, uvExpr) ?? TSL.vec4(0, 0, 0, 1);
  },
} as const;

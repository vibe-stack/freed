import type { TerrainNode } from '@/types/terrain';

// Radial mountain profile with falloff and roughness
// h = peak * (1 - r^sharpness)^falloff + ridges
function fbm(x: number, y: number, seed: number, octaves: number, gain: number, lacunarity: number) {
  let sum = 0; let amp = 0.5; let freq = 1; const s = seed;
  const hash = (ix: number, iy: number) => {
    const h = Math.sin((ix * 374761393 + iy * 668265263) ^ s) * 43758.5453;
    return h - Math.floor(h);
  };
  const noise = (x: number, y: number) => {
    const ix = Math.floor(x); const iy = Math.floor(y);
    const fx = x - ix; const fy = y - iy;
    const v00 = hash(ix, iy);
    const v10 = hash(ix + 1, iy);
    const v01 = hash(ix, iy + 1);
    const v11 = hash(ix + 1, iy + 1);
    const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
    const u = fade(fx); const v = fade(fy);
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    return lerp(lerp(v00, v10, u), lerp(v01, v11, u), v);
  };
  for (let i = 0; i < Math.max(1, Math.floor(octaves)); i++) {
    sum += (noise(x * freq, y * freq) * 2 - 1) * amp;
    freq *= lacunarity; amp *= gain;
  }
  return sum;
}

export function evaluateMountain(node: TerrainNode, u: number, v: number, worldW: number, worldH: number, currentH: number): number {
  const d = node.data as any ?? {};
  const cx = d.centerX ?? 0.5; const cy = d.centerY ?? 0.5;
  const peak = d.peak ?? 1.0;
  const radius = Math.max(1e-6, d.radius ?? 0.4); // in UV
  const falloff = d.falloff ?? 2.0;
  const sharpness = d.sharpness ?? 1.5;
  const ridgesAmp = d.ridges ?? 0.2;
  const seed = d.seed ?? 1;
  const octaves = d.octaves ?? 4;
  const gain = d.gain ?? 0.5;
  const lacunarity = d.lacunarity ?? 2.0;

  const dx = (u - cx) / radius; const dy = (v - cy) / radius;
  const r = Math.sqrt(dx * dx + dy * dy);
  // Base radial profile in [0,1]
  let base = 0;
  if (r < 1) {
    const t = Math.pow(1 - Math.pow(r, sharpness), falloff);
    base = t * peak;
  }
  // Add ridges via abs(fbm)
  const rough = Math.abs(fbm(u * worldW / radius, v * worldH / radius, seed, octaves, gain, lacunarity));
  const h = base + rough * ridgesAmp * peak;

  const op = d.operation || 'add';
  const amt = d.amount ?? 1;
  if (op === 'add') return currentH + h;
  if (op === 'max') return Math.max(currentH, h);
  if (op === 'min') return Math.min(currentH, h);
  if (op === 'replace') return h;
  if (op === 'mix') return currentH * (1 - amt) + h * amt;
  return currentH + h;
}

import type { TerrainNode } from '@/types/terrain';

// 2D Perlin-like value noise with multiple octaves
function perlin2D(x: number, y: number, seed: number, octaves: number, persistence: number, lacunarity: number): number {
  // Precompute gradients for integer grid cells via seeded hash
  const grad = new Map<string, { x: number; y: number }>();
  const gradient = (ix: number, iy: number) => {
    const key = ix + ',' + iy;
    let g = grad.get(key);
    if (!g) {
      // Hash
      const h = Math.sin((ix * 374761393 + iy * 668265263) ^ seed) * 43758.5453;
      const a = (h - Math.floor(h)) * Math.PI * 2;
      g = { x: Math.cos(a), y: Math.sin(a) };
      grad.set(key, g);
    }
    return g;
  };
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const dot = (gx: number, gy: number, x: number, y: number) => gx * x + gy * y;

  const noise = (x: number, y: number) => {
    const ix = Math.floor(x); const iy = Math.floor(y);
    const fx = x - ix; const fy = y - iy;
    const g00 = gradient(ix, iy); const g10 = gradient(ix + 1, iy);
    const g01 = gradient(ix, iy + 1); const g11 = gradient(ix + 1, iy + 1);
    const n00 = dot(g00.x, g00.y, fx, fy);
    const n10 = dot(g10.x, g10.y, fx - 1, fy);
    const n01 = dot(g01.x, g01.y, fx, fy - 1);
    const n11 = dot(g11.x, g11.y, fx - 1, fy - 1);
    const u = fade(fx); const v = fade(fy);
    return lerp(lerp(n00, n10, u), lerp(n01, n11, u), v);
  };

  let amp = 1; let freq = 1; let sum = 0; let norm = 0;
  for (let o = 0; o < Math.max(1, Math.floor(octaves)); o++) {
    sum += noise(x * freq, y * freq) * amp;
    norm += Math.abs(amp);
    amp *= persistence;
    freq *= lacunarity;
  }
  return norm > 0 ? (sum / norm) : sum;
}

export function evaluatePerlin(node: TerrainNode, u: number, v: number, worldW: number, worldH: number, currentH: number): number {
  const d = node.data as any ?? {};
  const freqScale = 1 / Math.max(1e-6, d.scale || 1);
  const nx = (u * worldW) * freqScale;
  const ny = (v * worldH) * freqScale;
  const val = perlin2D(nx, ny, d.seed || 1, d.octaves || 4, d.persistence ?? 0.5, d.lacunarity ?? 2.0);
  // Remap approximately -1..1 to 0..1 for stable additive composition
  const val01 = (val * 0.5) + 0.5;
  const amp = d.amplitude ?? 1;
  const op = d.operation || 'add';
  const amt = d.amount ?? 1;
  let h = currentH;
  if (op === 'add') h += val01 * amp;
  else if (op === 'max') h = Math.max(h, val01 * amp);
  else if (op === 'min') h = Math.min(h, val01 * amp);
  else if (op === 'replace') h = val01 * amp;
  else if (op === 'mix') h = h * (1 - amt) + (val01 * amp) * amt;
  return h;
}
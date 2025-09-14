import type { TerrainNode } from '@/types/terrain';

// Advanced mountain generator with realistic features
// Includes ridges, valleys, erosion patterns, and slope-based details

function hash2d(x: number, y: number, seed: number): number {
  const h = Math.sin((x * 374761393 + y * 668265263) ^ seed) * 43758.5453;
  return h - Math.floor(h);
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function noise2d(x: number, y: number, seed: number): number {
  const ix = Math.floor(x); const iy = Math.floor(y);
  const fx = x - ix; const fy = y - iy;
  
  const v00 = hash2d(ix, iy, seed);
  const v10 = hash2d(ix + 1, iy, seed);
  const v01 = hash2d(ix, iy + 1, seed);
  const v11 = hash2d(ix + 1, iy + 1, seed);
  
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  const u = fade(fx); const v = fade(fy);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  
  return lerp(lerp(v00, v10, u), lerp(v01, v11, u), v);
}

function fbm(x: number, y: number, seed: number, octaves: number, gain: number, lacunarity: number): number {
  let sum = 0; let amp = 0.5; let freq = 1;
  for (let i = 0; i < Math.max(1, Math.floor(octaves)); i++) {
    sum += (noise2d(x * freq, y * freq, seed) * 2 - 1) * amp;
    freq *= lacunarity; amp *= gain;
  }
  return sum;
}

// Gentle ridge noise - creates subtle mountain ridges
function ridgeNoise(x: number, y: number, seed: number, octaves: number): number {
  let sum = 0; let amp = 1; let freq = 1;
  for (let i = 0; i < octaves; i++) {
    const n = noise2d(x * freq, y * freq, seed + i);
    // Much gentler ridge formation - no abs() and smoother curves
    const ridge = Math.pow(1 - Math.abs(n * 2 - 1), 2);
    sum += ridge * amp;
    freq *= 2.0; amp *= 0.6;
  }
  return sum * 0.5; // Reduced overall intensity
}

// Creates gentle valley patterns
function valleyNoise(x: number, y: number, seed: number): number {
  const n1 = noise2d(x * 0.3, y * 0.3, seed);
  const n2 = noise2d(x * 0.8, y * 0.8, seed + 100);
  // Gentler valley formation
  return (n1 + n2) * 0.5;
}

// Gentle erosion simulation - smooths and rounds peaks
function erosionPattern(x: number, y: number, seed: number, strength: number): number {
  const flowNoise = noise2d(x * 0.4, y * 0.4, seed + 200);
  const weathering = noise2d(x * 1.5, y * 1.5, seed + 300);
  
  // Gentle weathering effect that smooths rather than cuts
  return flowNoise * weathering * strength * 0.3;
}

// Mountain base shape with gentle multiple peaks
function mountainBase(dx: number, dy: number, radius: number, peakCount: number, seed: number): number {
  const angle = Math.atan2(dy, dx);
  const r = Math.sqrt(dx * dx + dy * dy) / radius;
  
  if (r >= 1) return 0;
  
  // Create gentle multiple peaks
  let peakInfluence = 0;
  for (let i = 0; i < peakCount; i++) {
    const peakAngle = (i / peakCount) * Math.PI * 2 + hash2d(i, 0, seed) * 0.3;
    const peakDist = 0.2 + hash2d(i, 1, seed) * 0.3; // Closer peaks
    const peakStr = 0.5 + hash2d(i, 2, seed) * 0.3; // Gentler peaks
    
    const peakX = Math.cos(peakAngle) * peakDist;
    const peakY = Math.sin(peakAngle) * peakDist;
    
    const distToPeak = Math.sqrt((dx - peakX) * (dx - peakX) + (dy - peakY) * (dy - peakY));
    const peakFalloff = Math.exp(-distToPeak * 2); // Gentler falloff
    peakInfluence += peakFalloff * peakStr;
  }
  
  // Gentler base mountain shape
  const asymmetry = 1 + Math.sin(angle * 2 + seed) * 0.15; // Less asymmetry
  const profile = Math.pow(1 - r, 2.0) * asymmetry; // Smoother profile
  
  return profile * (0.7 + peakInfluence * 0.3);
}

export function evaluateMountain(node: TerrainNode, u: number, v: number, worldW: number, worldH: number, currentH: number): number {
  const d = node.data as any ?? {};
  const cx = d.centerX ?? 0.5; const cy = d.centerY ?? 0.5;
  const peak = d.peak ?? 1.0;
  const radius = Math.max(1e-6, d.radius ?? 0.4); // in UV
  
  // Mountain characteristics - much gentler defaults
  const peakCount = d.peakCount ?? 2; // Fewer peaks
  const ridgeStrength = d.ridgeStrength ?? 0.15; // Much less aggressive
  const valleyDepth = d.valleyDepth ?? 0.1; // Shallower valleys
  const erosionStrength = d.erosionStrength ?? 0.05; // Gentle erosion
  const detailScale = d.detailScale ?? 4.0; // Larger scale details
  const roughness = d.roughness ?? 0.1; // Much less roughness
  const seed = d.seed ?? 1;

  // Coordinate transformation
  const dx = (u - cx) / radius; 
  const dy = (v - cy) / radius;
  const r = Math.sqrt(dx * dx + dy * dy);
  
  // Early exit if outside mountain radius
  if (r >= 1.1) return currentH;
  
  // World coordinates for noise sampling
  const worldX = u * worldW;
  const worldY = v * worldH;
  const scale = detailScale / radius;
  
  // 1. Base mountain shape with gentle multiple peaks
  let height = mountainBase(dx, dy, 1.0, peakCount, seed) * peak;
  
  // 2. Add very gentle ridges only to mid-elevation areas
  const ridges = ridgeNoise(worldX * scale * 0.3, worldY * scale * 0.3, seed + 100, 2);
  const ridgeMask = smoothstep(0.2, 0.6, height / peak) * smoothstep(0.9, 0.7, height / peak);
  height += ridges * ridgeStrength * peak * ridgeMask;
  
  // 3. Very subtle valley variation
  const valleys = valleyNoise(worldX * scale * 0.2, worldY * scale * 0.2, seed + 200);
  const valleyMask = smoothstep(0.1, 0.4, height / peak);
  height += valleys * valleyDepth * peak * valleyMask * 0.5;
  
  // 4. Gentle weathering/erosion for natural rounding
  const erosion = erosionPattern(worldX * scale * 0.5, worldY * scale * 0.5, seed + 300, erosionStrength);
  height += erosion * peak;
  
  // 5. Very fine surface detail only
  const detail = fbm(worldX * scale, worldY * scale, seed + 400, 2, 0.4, 2.0);
  const detailMask = smoothstep(0.05, 0.2, height / peak);
  height += detail * roughness * peak * detailMask * 0.3;
  
  // 6. Smooth distance-based falloff
  const falloff = smoothstep(1.1, 0.8, r);
  height *= falloff;
  
  // Add gentle overall smoothing
  height = height * 0.9 + (height * 0.1); // Very subtle smoothing
  
  // Ensure non-negative height
  height = Math.max(0, height);

  // Apply operation
  const op = d.operation || 'add';
  const amt = d.amount ?? 1;
  
  switch (op) {
    case 'add': return currentH + height * amt;
    case 'max': return Math.max(currentH, height * amt);
    case 'min': return Math.min(currentH, height * amt);
    case 'replace': return height * amt;
    case 'mix': return currentH * (1 - amt) + height * amt;
    default: return currentH + height * amt;
  }
}

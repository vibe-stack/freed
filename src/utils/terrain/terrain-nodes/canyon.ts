import type { TerrainNode } from '@/types/terrain';

// Advanced Canyon Generator - Gaea Quality
// Simulates realistic canyon formation through fluvial erosion with:
// - Meandering channels with natural sinuosity
// - Branching tributary systems
// - Stratified rock layers with differential erosion
// - Realistic canyon profile with terraced walls
// - Secondary erosion features (gullies, alcoves)

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
    sum += (noise2d(x * freq, y * freq, seed + i) * 2 - 1) * amp;
    freq *= lacunarity; amp *= gain;
  }
  return sum;
}

// Generate meandering canyon centerline
function canyonCenterline(t: number, meanders: number, seed: number): { x: number; y: number } {
  // Primary meandering using sine waves with natural frequency variation
  const baseFreq = 2.0 + meanders * 3.0;
  const meander1 = Math.sin(t * baseFreq + hash2d(0, 0, seed) * Math.PI * 2) * meanders;
  const meander2 = Math.sin(t * baseFreq * 1.618 + hash2d(1, 0, seed) * Math.PI * 2) * meanders * 0.5;
  
  // Add natural irregularity
  const irregularity = fbm(t * 8, 0, seed + 100, 3, 0.5, 2.0) * meanders * 0.3;
  
  return {
    x: meander1 + meander2 + irregularity,
    y: t
  };
}

// Distance to canyon centerline with branching
function distanceToCanyonSystem(u: number, v: number, centerX: number, centerY: number, 
                               length: number, angle: number, meanders: number, 
                               branches: number, seed: number): number {
  // Transform to canyon-local coordinates
  const cos_a = Math.cos(angle);
  const sin_a = Math.sin(angle);
  const localX = (u - centerX) * cos_a + (v - centerY) * sin_a;
  const localY = -(u - centerX) * sin_a + (v - centerY) * cos_a;
  
  // Normalize to canyon parameter t (0 to 1 along length)
  const t = (localY + length * 0.5) / length;
  
  let minDist = Infinity;
  
  // Main canyon channel
  if (t >= 0 && t <= 1) {
    const centerline = canyonCenterline(t, meanders, seed);
    const distToMain = Math.abs(localX - centerline.x);
    minDist = Math.min(minDist, distToMain);
  }
  
  // Tributary branches
  for (let i = 0; i < branches; i++) {
    const branchT = 0.2 + (i / Math.max(1, branches - 1)) * 0.6; // Distribute along canyon
    const branchSeed = seed + 1000 + i;
    const branchAngle = (hash2d(i, 0, branchSeed) - 0.5) * Math.PI * 0.6; // ±54°
    const branchLength = length * (0.3 + hash2d(i, 1, branchSeed) * 0.4); // 30-70% of main
    const branchMeanders = meanders * 0.5;
    
    // Branch starting point on main canyon
    const mainCenter = canyonCenterline(branchT, meanders, seed);
    const branchStartX = mainCenter.x;
    const branchStartY = branchT * length - length * 0.5;
    
    // Transform to branch-local coordinates
    const cos_b = Math.cos(branchAngle);
    const sin_b = Math.sin(branchAngle);
    const branchLocalX = (localX - branchStartX) * cos_b + (localY - branchStartY) * sin_b;
    const branchLocalY = -(localX - branchStartX) * sin_b + (localY - branchStartY) * cos_b;
    
    const branchT_param = branchLocalY / branchLength;
    if (branchT_param >= 0 && branchT_param <= 1) {
      const branchCenter = canyonCenterline(branchT_param, branchMeanders, branchSeed);
      const distToBranch = Math.abs(branchLocalX - branchCenter.x);
      // Scale branch influence by distance along branch
      const branchScale = 1.0 - branchT_param * 0.3;
      minDist = Math.min(minDist, distToBranch / branchScale);
    }
  }
  
  return minDist;
}

// Canyon depth profile with realistic V-shape and terracing
function canyonDepthProfile(distance: number, width: number, depth: number, 
                           stratification: number, erosion: number, seed: number): number {
  if (distance >= width) return 0;
  
  const normalizedDist = distance / width;
  
  // Base V-shaped profile with realistic angle of repose
  let baseProfile = Math.pow(1 - normalizedDist, 1.5) * depth;
  
  // Add stratified terracing (horizontal rock layers)
  let terracing = 0;
  if (stratification > 0) {
    const layerHeight = depth / (5 + stratification * 10);
    const currentLayer = Math.floor(baseProfile / layerHeight);
    const layerProgress = (baseProfile % layerHeight) / layerHeight;
    
    // Harder layers create benches, softer layers erode faster
    const hardnessVariation = noise2d(currentLayer * 0.1, 0, seed + 500);
    const isHardLayer = hardnessVariation > 0.2;
    
    if (isHardLayer && layerProgress < 0.7) {
      // Create flat benches on hard layers
      terracing = currentLayer * layerHeight + layerProgress * layerHeight * 0.3;
    } else {
      // Normal erosion on soft layers
      terracing = baseProfile;
    }
    
    // Blend between terraced and smooth
    baseProfile = baseProfile * (1 - stratification) + terracing * stratification;
  }
  
  // Add erosional complexity (gullies, alcoves, spalling)
  if (erosion > 0) {
    // Vertical gullies on canyon walls
    const gullyNoise = fbm(distance * 10, baseProfile * 8, seed + 600, 4, 0.6, 2.1);
    const gullyMask = smoothstep(0.1, 0.8, normalizedDist) * smoothstep(0.9, 0.3, normalizedDist);
    const gullies = gullyNoise * erosion * depth * 0.15 * gullyMask;
    
    // Alcove weathering (rounded erosion features)
    const alcoveNoise = noise2d(distance * 3, baseProfile * 2, seed + 700);
    const alcoveMask = smoothstep(0.3, 0.7, normalizedDist);
    const alcoves = Math.max(0, alcoveNoise - 0.3) * erosion * depth * 0.1 * alcoveMask;
    
    baseProfile += gullies + alcoves;
  }
  
  return Math.max(0, baseProfile);
}

export function evaluateCanyon(node: TerrainNode, u: number, v: number, worldW: number, worldH: number, currentH: number): number {
  const d = node.data as any ?? {};
  
  // Canyon parameters
  const centerX = d.centerX ?? 0.5;
  const centerY = d.centerY ?? 0.5;
  const width = Math.max(1e-6, d.width ?? 0.1);
  const length = Math.max(1e-6, d.length ?? 0.4);
  const depth = d.depth ?? 0.8;
  const angle = d.angle ?? 0; // radians
  const meanders = Math.max(0, d.meanders ?? 0.3);
  const branches = Math.max(0, Math.floor(d.branches ?? 2));
  const erosion = Math.max(0, Math.min(1, d.erosion ?? 0.5));
  const stratification = Math.max(0, Math.min(1, d.stratification ?? 0.4));
  const seed = d.seed ?? 42;
  
  // Calculate distance to canyon system
  const distanceToCanyon = distanceToCanyonSystem(u, v, centerX, centerY, length, angle, meanders, branches, seed);
  
  // Early exit if far from canyon
  const maxInfluence = width * 1.5;
  if (distanceToCanyon > maxInfluence) return currentH;
  
  // Calculate canyon depth based on distance and profile
  const canyonHeight = canyonDepthProfile(distanceToCanyon, width, depth, stratification, erosion, seed);
  
  // Smooth falloff beyond canyon walls
  const falloffStart = width;
  const falloffEnd = maxInfluence;
  const falloffMask = distanceToCanyon > falloffStart 
    ? smoothstep(falloffEnd, falloffStart, distanceToCanyon)
    : 1.0;
  
  const finalHeight = -canyonHeight * falloffMask; // Negative because it's erosion
  
  // Apply operation
  const operation = d.operation || 'add';
  const amount = d.amount ?? 1;
  
  switch (operation) {
    case 'add': return currentH + finalHeight * amount;
    case 'max': return Math.max(currentH, finalHeight * amount);
    case 'min': return Math.min(currentH, finalHeight * amount);
    case 'replace': return finalHeight * amount;
    case 'mix': return currentH * (1 - amount) + finalHeight * amount;
    default: return currentH + finalHeight * amount;
  }
}
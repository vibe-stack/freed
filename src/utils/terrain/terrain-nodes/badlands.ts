import type { TerrainNode } from '@/types/terrain';

// Advanced Badlands Generator - Gaea Quality
// Simulates realistic badlands terrain formation through:
// - Horizontal sedimentary stratification with varying hardness
// - Vertical erosion channels and drainage networks
// - Differential weathering based on rock resistance
// - Geological processes (tilting, faulting, jointing)
// - Complex gully and arroyo systems
// - Natural coloration and texture patterns

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

// Ridge noise for sharp erosional features
function ridgeNoise(x: number, y: number, seed: number, octaves: number): number {
  let sum = 0; let amp = 1; let freq = 1;
  for (let i = 0; i < octaves; i++) {
    const n = noise2d(x * freq, y * freq, seed + i);
    const ridge = 1 - Math.abs(n * 2 - 1); // Create ridges
    sum += ridge * amp;
    freq *= 2.0; amp *= 0.5;
  }
  return sum;
}

// Generate sedimentary rock layers with varying hardness
function stratifiedBase(x: number, y: number, height: number, stratification: number, 
                       hardness: number, tilting: number, seed: number): number {
  if (stratification <= 0) return height;
  
  // Apply geological tilting
  const tiltedHeight = height + (x * 0.1 + y * 0.05) * tilting;
  
  // Create horizontal layers
  const layerThickness = 0.05 + stratification * 0.1;
  const layerIndex = Math.floor(tiltedHeight / layerThickness);
  const layerProgress = (tiltedHeight % layerThickness) / layerThickness;
  
  // Vary layer hardness based on geological processes
  const layerHardness = hash2d(layerIndex, 0, seed + 1000);
  const isHardLayer = layerHardness > (0.5 - hardness * 0.3);
  
  let adjustedHeight = tiltedHeight;
  
  if (isHardLayer) {
    // Hard layers resist erosion - create flat benches
    const benchHeight = layerIndex * layerThickness + layerProgress * layerThickness * 0.3;
    adjustedHeight = benchHeight + layerProgress * layerThickness * 0.2;
  } else {
    // Soft layers erode more easily - create recessed areas
    const recessDepth = stratification * 0.03;
    adjustedHeight = tiltedHeight - recessDepth * (1 - layerProgress);
  }
  
  return adjustedHeight;
}

// Generate fault systems and structural geology
function applyFaulting(x: number, y: number, height: number, faulting: number, seed: number): number {
  if (faulting <= 0) return height;
  
  let result = height;
  
  // Major fault lines
  const faultSpacing = 0.3;
  const numFaults = Math.floor(1 / faultSpacing * faulting);
  
  for (let i = 0; i < numFaults; i++) {
    const faultSeed = seed + 2000 + i;
    const faultAngle = hash2d(i, 0, faultSeed) * Math.PI * 2;
    const faultOffset = hash2d(i, 1, faultSeed) * 0.8 - 0.4;
    const faultPosition = hash2d(i, 2, faultSeed);
    
    // Distance to fault line
    const cos_a = Math.cos(faultAngle);
    const sin_a = Math.sin(faultAngle);
    const rotatedX = x * cos_a + y * sin_a;
    const distanceToFault = Math.abs(rotatedX - faultPosition);
    
    // Fault influence zone
    const faultWidth = 0.02 + faulting * 0.05;
    if (distanceToFault < faultWidth) {
      const faultInfluence = smoothstep(faultWidth, 0, distanceToFault);
      const displacement = faultOffset * faulting * 0.1;
      
      // Determine which side of fault we're on
      const side = rotatedX > faultPosition ? 1 : -1;
      result += displacement * side * faultInfluence;
    }
  }
  
  return result;
}

// Generate erosional drainage networks
function drainageErosion(x: number, y: number, height: number, drainageComplexity: number, 
                        erosion: number, scale: number, seed: number): number {
  if (drainageComplexity <= 0 || erosion <= 0) return height;
  
  let result = height;
  const drainageScale = scale * 2.0;
  
  // Primary drainage channels
  const primaryFlow = fbm(x * drainageScale * 0.5, y * drainageScale * 0.5, seed + 3000, 4, 0.6, 2.0);
  const primaryMask = smoothstep(-0.2, -0.4, primaryFlow); // Negative values become channels
  const primaryErosion = primaryMask * erosion * 0.15;
  
  // Secondary gullies and arroyos
  const secondaryFlow = fbm(x * drainageScale * 1.5, y * drainageScale * 1.5, seed + 4000, 3, 0.5, 2.0);
  const secondaryMask = smoothstep(-0.1, -0.3, secondaryFlow);
  const secondaryErosion = secondaryMask * erosion * 0.08;
  
  // Tertiary drainage (finest detail)
  const tertiaryFlow = fbm(x * drainageScale * 4.0, y * drainageScale * 4.0, seed + 5000, 2, 0.4, 2.0);
  const tertiaryMask = smoothstep(0, -0.2, tertiaryFlow);
  const tertiaryErosion = tertiaryMask * erosion * 0.04;
  
  // Apply erosion based on drainage complexity
  const totalErosion = (primaryErosion + secondaryErosion * drainageComplexity + 
                       tertiaryErosion * drainageComplexity * drainageComplexity);
  
  result -= totalErosion;
  
  // Add headward erosion (channels cutting back into hillsides)
  const headwardNoise = ridgeNoise(x * drainageScale * 3, y * drainageScale * 3, seed + 6000, 2);
  const headwardMask = primaryMask + secondaryMask * 0.5;
  result -= headwardNoise * erosion * 0.02 * headwardMask * drainageComplexity;
  
  return result;
}

// Add surface weathering and mass wasting
function surfaceWeathering(x: number, y: number, height: number, weathering: number, 
                          scale: number, seed: number): number {
  if (weathering <= 0) return height;
  
  let result = height;
  
  // Chemical weathering (creates rounded forms)
  const chemicalWeathering = fbm(x * scale * 8, y * scale * 8, seed + 7000, 3, 0.5, 2.0);
  const chemicalAmount = weathering * 0.02;
  result += chemicalWeathering * chemicalAmount;
  
  // Physical weathering (creates angular breakdown)
  const physicalWeathering = noise2d(x * scale * 15, y * scale * 15, seed + 8000);
  const physicalAmount = weathering * 0.015;
  result -= Math.max(0, physicalWeathering - 0.6) * physicalAmount;
  
  // Mass wasting (slope failure and debris flows)
  const slopeNoise = fbm(x * scale * 3, y * scale * 3, seed + 9000, 2, 0.6, 2.0);
  const slopeMask = smoothstep(0.1, 0.4, height); // More mass wasting on higher slopes
  const massWasting = slopeNoise * weathering * 0.01 * slopeMask;
  result -= Math.max(0, massWasting);
  
  return result;
}

// Generate caprock and resistant formations
function caprockFormations(x: number, y: number, height: number, hardness: number, 
                          scale: number, seed: number): number {
  if (hardness <= 0) return height;
  
  // Resistant caprock layers that protect underlying softer rock
  const caprockNoise = noise2d(x * scale * 0.8, y * scale * 0.8, seed + 10000);
  const caprockMask = smoothstep(0.3, 0.7, caprockNoise);
  
  // Caprock creates mesas and buttes
  const caprockHeight = hardness * 0.1 * caprockMask;
  
  // Protected areas under caprock erode less
  const protectionNoise = fbm(x * scale * 2, y * scale * 2, seed + 11000, 2, 0.5, 2.0);
  const protection = caprockMask * hardness * 0.05;
  
  return height + caprockHeight + Math.max(0, protection * protectionNoise);
}

export function evaluateBadlands(node: TerrainNode, u: number, v: number, worldW: number, worldH: number, currentH: number): number {
  const d = node.data as any ?? {};
  
  // Badlands parameters
  const scale = Math.max(0.1, d.scale ?? 2.0);
  const stratification = Math.max(0, Math.min(1, d.stratification ?? 0.6));
  const erosion = Math.max(0, Math.min(1, d.erosion ?? 0.7));
  const weathering = Math.max(0, Math.min(1, d.weathering ?? 0.5));
  const hardness = Math.max(0, Math.min(1, d.hardness ?? 0.4));
  const tilting = Math.max(0, Math.min(1, d.tilting ?? 0.2));
  const faulting = Math.max(0, Math.min(1, d.faulting ?? 0.3));
  const drainageComplexity = Math.max(0, Math.min(1, d.drainageComplexity ?? 0.6));
  const seed = d.seed ?? 456;
  
  // World coordinates for noise sampling
  const worldX = u * worldW * 0.01; // Scale down for appropriate noise frequencies
  const worldY = v * worldH * 0.01;
  
  // Start with base terrain elevation
  const baseNoise = fbm(worldX * scale * 0.3, worldY * scale * 0.3, seed, 4, 0.6, 2.0);
  let height = baseNoise * 0.3; // Moderate base elevation
  
  // Apply geological stratification
  height = stratifiedBase(worldX, worldY, height, stratification, hardness, tilting, seed);
  
  // Apply structural geology (faulting)
  height = applyFaulting(worldX, worldY, height, faulting, seed);
  
  // Apply erosional processes
  height = drainageErosion(worldX, worldY, height, drainageComplexity, erosion, scale, seed);
  
  // Apply weathering processes
  height = surfaceWeathering(worldX, worldY, height, weathering, scale, seed);
  
  // Apply resistant formations (caprock)
  height = caprockFormations(worldX, worldY, height, hardness, scale, seed);
  
  // Add fine surface texture
  const surfaceTexture = fbm(worldX * scale * 10, worldY * scale * 10, seed + 12000, 2, 0.4, 2.0);
  height += surfaceTexture * 0.005;
  
  // Ensure reasonable height range
  height = Math.max(0, height);
  
  // Apply operation
  const operation = d.operation || 'add';
  const amount = d.amount ?? 1;
  
  switch (operation) {
    case 'add': return currentH + height * amount;
    case 'max': return Math.max(currentH, height * amount);
    case 'min': return Math.min(currentH, height * amount);
    case 'replace': return height * amount;
    case 'mix': return currentH * (1 - amount) + height * amount;
    default: return currentH + height * amount;
  }
}
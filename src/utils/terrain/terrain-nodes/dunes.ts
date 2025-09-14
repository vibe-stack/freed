import type { TerrainNode } from '@/types/terrain';

// Advanced Sand Dunes Generator - Gaea Quality
// Simulates realistic aeolian (wind-formed) sand dune systems with:
// - Multiple dune types (barchan, linear, star, parabolic)
// - Asymmetric profiles (gentle windward, steep leeward slopes)
// - Secondary ripple patterns and interdune areas
// - Migration patterns and slip face dynamics
// - Natural dune field organization and spacing

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

// Rotate a 2D vector by angle
function rotate2D(x: number, y: number, angle: number): { x: number; y: number } {
  const cos_a = Math.cos(angle);
  const sin_a = Math.sin(angle);
  return {
    x: x * cos_a - y * sin_a,
    y: x * sin_a + y * cos_a
  };
}

// Generate dune centers using Poisson-like distribution
function getDuneCenters(u: number, v: number, density: number, seed: number): Array<{ x: number; y: number; type: number; size: number }> {
  const centers: Array<{ x: number; y: number; type: number; size: number }> = [];
  const cellSize = 1.0 / Math.max(0.1, density);
  
  // Sample cells in a grid around the query point
  const cellX = Math.floor(u / cellSize);
  const cellY = Math.floor(v / cellSize);
  
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const gridX = cellX + dx;
      const gridY = cellY + dy;
      
      // Generate consistent random values for this cell
      const h1 = hash2d(gridX, gridY, seed);
      const h2 = hash2d(gridX, gridY, seed + 1000);
      const h3 = hash2d(gridX, gridY, seed + 2000);
      const h4 = hash2d(gridX, gridY, seed + 3000);
      
      // Random position within cell
      const centerX = (gridX + h1) * cellSize;
      const centerY = (gridY + h2) * cellSize;
      
      // Dune characteristics
      const duneType = h3; // 0-1 for different dune shapes
      const duneSize = 0.5 + h4 * 0.8; // Size variation
      
      centers.push({ x: centerX, y: centerY, type: duneType, size: duneSize });
    }
  }
  
  return centers;
}

// Asymmetric dune profile with slip face
function duneProfile(distance: number, duneRadius: number, height: number, 
                    asymmetry: number, slipface: number, windAngle: number): number {
  if (distance >= duneRadius) return 0;
  
  const normalizedDist = distance / duneRadius;
  
  // Determine if we're on windward (upwind) or leeward (downwind) side
  // windAngle = 0 means wind from negative Y (bottom to top)
  const isLeeward = windAngle > Math.PI * 0.5 && windAngle < Math.PI * 1.5;
  
  let profile: number;
  
  if (isLeeward) {
    // Leeward (slip face) - steep, sharp dropoff
    const steepness = 1.5 + slipface * 2.0; // More slipface = steeper
    profile = Math.pow(1 - normalizedDist, steepness);
    
    // Add slip face inflection point
    if (normalizedDist > 0.7) {
      const slipFactor = (normalizedDist - 0.7) / 0.3;
      profile *= (1 - slipFactor * slipface * 0.8);
    }
  } else {
    // Windward - gentle slope shaped by wind erosion
    const gentleness = 0.5 + asymmetry; // More asymmetry = gentler windward
    profile = Math.pow(1 - normalizedDist, gentleness);
    
    // Add wind erosion scouring near base
    if (normalizedDist > 0.8) {
      const scourFactor = (normalizedDist - 0.8) / 0.2;
      profile *= (1 - scourFactor * 0.3);
    }
  }
  
  return profile * height;
}

// Generate complex dune system
function evaluateDuneSystem(u: number, v: number, density: number, height: number, 
                           wavelength: number, asymmetry: number, slipface: number, 
                           windDirection: number, migration: number, seed: number): number {
  const duneCenters = getDuneCenters(u, v, density, seed);
  let totalHeight = 0;
  let totalWeight = 0;
  
  for (const center of duneCenters) {
    const dx = u - center.x;
    const dy = v - center.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Dune size based on wavelength and individual variation
    const duneRadius = wavelength * 0.5 * center.size;
    
    if (distance < duneRadius * 1.2) { // Slight overlap for smooth blending
      // Calculate wind angle relative to dune center
      const vectorAngle = Math.atan2(dy, dx);
      const relativeWindAngle = vectorAngle - windDirection;
      
      // Dune shape variation based on type
      let shapeModifier = 1.0;
      const duneType = center.type;
      
      if (duneType < 0.3) {
        // Barchan (crescent) dunes - horns pointing downwind
        const hornFactor = Math.sin(relativeWindAngle * 2) * 0.3;
        shapeModifier = 1.0 + hornFactor * Math.max(0, 1 - distance / duneRadius);
      } else if (duneType < 0.6) {
        // Linear (seif) dunes - elongated parallel to wind
        const elongation = rotate2D(dx, dy, -windDirection);
        const linearFactor = Math.abs(elongation.x) / Math.max(0.1, Math.abs(elongation.y));
        shapeModifier = 1.0 / (1.0 + linearFactor * 0.5);
      } else {
        // Star dunes - multi-directional ridges
        const starArms = Math.sin(relativeWindAngle * 3) * 0.2;
        shapeModifier = 1.0 + starArms;
      }
      
      // Add migration patterns (dune movement over time)
      const migrationOffset = migration * noise2d(center.x * 0.1, center.y * 0.1, seed + 4000) * wavelength * 0.1;
      const migratedX = center.x + Math.cos(windDirection) * migrationOffset;
      const migratedY = center.y + Math.sin(windDirection) * migrationOffset;
      const migratedDx = u - migratedX;
      const migratedDy = v - migratedY;
      const migratedDistance = Math.sqrt(migratedDx * migratedDx + migratedDy * migratedDy);
      
      // Calculate dune height at this point
      const duneHeight = duneProfile(migratedDistance, duneRadius, height * center.size * shapeModifier, 
                                   asymmetry, slipface, relativeWindAngle);
      
      // Weight by distance for smooth blending
      const weight = Math.max(0, 1 - migratedDistance / (duneRadius * 1.2));
      
      totalHeight += duneHeight * weight;
      totalWeight += weight;
    }
  }
  
  return totalWeight > 0 ? totalHeight / totalWeight : 0;
}

// Add interdune areas and ripple patterns
function addDuneComplexity(u: number, v: number, baseHeight: number, complexity: number, 
                          wavelength: number, windDirection: number, seed: number): number {
  if (complexity <= 0) return baseHeight;
  
  let result = baseHeight;
  
  // Sand ripples - small scale regular patterns perpendicular to wind
  const rippleScale = wavelength * 0.02; // Much smaller than dunes
  const rippleFreq = 1.0 / rippleScale;
  
  // Rotate coordinates to align ripples perpendicular to wind
  const rotated = rotate2D(u, v, -windDirection + Math.PI * 0.5);
  const ripplePattern = Math.sin(rotated.x * rippleFreq * Math.PI * 2) * complexity * 0.01;
  
  // Ripples stronger in interdune areas (where base height is low)
  const rippleMask = Math.exp(-baseHeight * 3.0); // Stronger where height is low
  result += ripplePattern * rippleMask;
  
  // Secondary wind scour patterns
  const scourNoise = fbm(u * 8, v * 8, seed + 5000, 3, 0.6, 2.0);
  const scourMask = smoothstep(0.02, 0.1, baseHeight) * smoothstep(0.3, 0.15, baseHeight);
  result += scourNoise * complexity * 0.005 * scourMask;
  
  // Interdune deflation (wind erosion between dunes)
  const deflationNoise = noise2d(u * 3, v * 3, seed + 6000);
  const deflationMask = Math.exp(-baseHeight * 2.0);
  result -= Math.max(0, deflationNoise - 0.3) * complexity * 0.02 * deflationMask;
  
  return Math.max(0, result);
}

export function evaluateDunes(node: TerrainNode, u: number, v: number, worldW: number, worldH: number, currentH: number): number {
  const d = node.data as any ?? {};
  
  // Dune system parameters
  const density = Math.max(0.1, d.density ?? 2.0);
  const height = Math.max(0, d.height ?? 0.4);
  const wavelength = Math.max(0.01, d.wavelength ?? 0.15);
  const asymmetry = Math.max(0, Math.min(2, d.asymmetry ?? 0.7));
  const slipface = Math.max(0, Math.min(1, d.slipface ?? 0.8));
  const complexity = Math.max(0, Math.min(1, d.complexity ?? 0.5));
  const windDirection = d.windDirection ?? 0; // radians
  const migration = Math.max(0, Math.min(1, d.migration ?? 0.3));
  const seed = d.seed ?? 123;
  
  // Generate base dune system
  let duneHeight = evaluateDuneSystem(u, v, density, height, wavelength, asymmetry, 
                                     slipface, windDirection, migration, seed);
  
  // Add complexity (ripples, scour, etc.)
  duneHeight = addDuneComplexity(u, v, duneHeight, complexity, wavelength, windDirection, seed);
  
  // Apply operation
  const operation = d.operation || 'add';
  const amount = d.amount ?? 1;
  
  switch (operation) {
    case 'add': return currentH + duneHeight * amount;
    case 'max': return Math.max(currentH, duneHeight * amount);
    case 'min': return Math.min(currentH, duneHeight * amount);
    case 'replace': return duneHeight * amount;
    case 'mix': return currentH * (1 - amount) + duneHeight * amount;
    default: return currentH + duneHeight * amount;
  }
}
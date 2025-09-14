
// Generate a terrain-aware normal map. Core goals:
// - Accurate normals from central differences (world-space aware via dx, dy)
// - Strata follows isocontours of height (lines: f(height) with small noise warp)
// - Cracks are optional and subtle, not dominating
// - Fine roughness adds micro-variation without banding
export function bakeEnhancedNormalMap(
  height: Float32Array,
  texW: number,
  texH: number,
  dx: number,
  dy: number,
  options: {
    crackDensity?: number;
    crackDepth?: number;
    strataDensity?: number;
    strataDepth?: number;
    roughness?: number;
    seed?: number;
  } = {}
): Float32Array {
  const {
    crackDensity = 0.25, // Increased from 0.04
    crackDepth = 0.4,    // Increased from 0.15
    strataDensity = 0.4, // Increased from 0.2
    strataDepth = 0.6,   // Increased from 0.25
    roughness = 0.15,    // Increased from 0.08
    seed = 12345,
  } = options;

  const normals = new Float32Array(texW * texH * 4);

  // Deterministic value noise helpers
  const ihash = (x: number, y: number, s: number) => {
    // 32-bit integer hash, fast and deterministic
    let h = x | 0;
    h = Math.imul(h ^ ((y | 0) + 0x9e3779b9 + (h << 6) + (h >>> 2)), 0x85ebca6b);
    h ^= s;
    h ^= h >>> 15;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296; // 0..1
  };

  const valueNoise = (x: number, y: number, freq: number, oct: number, amp: number, s: number) => {
    let sum = 0, a = amp, f = freq;
    for (let i = 0; i < oct; i++) {
      const xi = Math.floor(x * f);
      const yi = Math.floor(y * f);
      // Bilinear blend of 4 hashed corners
      const tx = x * f - xi; const ty = y * f - yi;
      const h00 = ihash(xi, yi, s + i);
      const h10 = ihash(xi + 1, yi, s + i);
      const h01 = ihash(xi, yi + 1, s + i);
      const h11 = ihash(xi + 1, yi + 1, s + i);
      const hx0 = h00 * (1 - tx) + h10 * tx;
      const hx1 = h01 * (1 - tx) + h11 * tx;
      sum += (hx0 * (1 - ty) + hx1 * ty) * (a * 2 - a); // remap 0..1 to -a..a
      a *= 0.5;
      f *= 2;
    }
    return sum;
  };

  // Access with clamping
  const idx = (x: number, y: number) => (Math.max(0, Math.min(texH - 1, y)) * texW + Math.max(0, Math.min(texW - 1, x)));
  const get = (x: number, y: number) => height[idx(x, y)];

  // Precompute a gentle warp field to bend strata lines along contours
  const warpScale = 0.5; // 0..1 in UV space
  const warp = (u: number, v: number) => {
    const wx = valueNoise(u, v, 4, 3, 0.5, seed + 17);
    const wy = valueNoise(u + 37.2, v - 11.7, 4, 3, 0.5, seed + 29);
    return { wx: wx * warpScale, wy: wy * warpScale };
  };

  for (let y = 0; y < texH; y++) {
    for (let x = 0; x < texW; x++) {
      const hC = get(x, y);

      // Central differences (clamped) scaled by world units
      const hL = get(x - 1, y), hR = get(x + 1, y);
      const hD = get(x, y - 1), hU = get(x, y + 1);
      let gx = (hR - hL) / (2 * Math.max(1e-6, dx));
      let gy = (hU - hD) / (2 * Math.max(1e-6, dy));

      // Slope magnitude for feature weighting
      const slope = Math.hypot(gx, gy);

      // Strata: function of height with small UV warp so bands follow isocontours
      // Convert to UV in 0..1
      const u = x / Math.max(1, texW - 1);
      const v = y / Math.max(1, texH - 1);
      const { wx, wy } = warp(u, v);
      const warpedHeight = get(
        Math.round(x + wx * (texW - 1) * 0.04), // Increased warp influence
        Math.round(y + wy * (texH - 1) * 0.04)
      );
      // Enhanced strata with multiple frequency bands for realism
      const strataFreq1 = 15 * strataDensity; // Primary bands
      const strataFreq2 = 45 * strataDensity; // Fine detail bands
      const bands1 = Math.abs(((warpedHeight * strataFreq1) % 1) - 0.5) * 2;
      const bands2 = Math.abs(((warpedHeight * strataFreq2) % 1) - 0.5) * 2;
      const combinedBands = bands1 * 0.7 + bands2 * 0.3; // Mix frequencies
      const strataStrength = strataDepth * (0.4 + 0.6 * Math.min(1, slope * 3)); // More dramatic on slopes
      // Apply stronger strata influence
      const strataEffect = (combinedBands - 0.5) * strataStrength * 1.5;
      gx += (gx !== 0 || gy !== 0 ? (gx / Math.max(1e-6, slope)) : 0) * strataEffect;
      gy += (gx !== 0 || gy !== 0 ? (gy / Math.max(1e-6, slope)) : 0) * strataEffect;

      // Enhanced cracks: multiple scales and more dramatic placement
      if (crackDensity > 0 && crackDepth > 0) {
        // Primary large cracks
        const c1 = valueNoise(u + 100, v - 200, 25, 2, 1, seed + 123);
        const crackMask1 = c1 > 0.55 ? (c1 - 0.55) / 0.45 : 0; // More frequent cracks
        
        // Secondary fine cracks
        const c2 = valueNoise(u - 50, v + 150, 60, 3, 1, seed + 456);
        const crackMask2 = c2 > 0.7 ? (c2 - 0.7) / 0.3 : 0;
        
        // Combine crack masks
        const crackMask = Math.max(crackMask1, crackMask2 * 0.6);
        
        // Enhanced concavity detection - cracks prefer valleys and transitions
        const concavity = Math.max(0, (get(x, y) - Math.min(hL, hR, hD, hU))) * 6;
        const slopeInfluence = Math.min(1, slope * 4); // More cracks on steep areas
        
        const crack = crackMask * (concavity + slopeInfluence * 0.5) * crackDepth * crackDensity * 2;
        gx -= crack;
        gy -= crack;
      }

      // Enhanced micro-roughness with multiple scales
      if (roughness > 0) {
        // Fine grain roughness
        const r1 = valueNoise(u - 50.2, v + 77.7, 100, 2, 1, seed + 321);
        // Medium grain roughness  
        const r2 = valueNoise(u + 25.1, v - 33.4, 200, 3, 0.8, seed + 654);
        // Combine scales
        const combinedRough = (r1 - 0.5) * 0.7 + (r2 - 0.5) * 0.3;
        
        // Scale roughness by slope - more variation on steep areas
        const roughScale = 1 + slope * 2;
        gx += combinedRough * roughness * roughScale;
        gy += combinedRough * roughness * roughScale;
      }

      // Compose normal
      const nx = -gx;
      const ny = -gy;
      const nz = 1;
      const invLen = 1 / Math.max(1e-6, Math.hypot(nx, ny, nz));
      const i = (y * texW + x) * 4;
      normals[i + 0] = nx * invLen;
      normals[i + 1] = ny * invLen;
      normals[i + 2] = nz * invLen;
      normals[i + 3] = 1;
    }
  }

  return normals;
}
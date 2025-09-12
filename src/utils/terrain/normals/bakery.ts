
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
    crackDensity = 0.04,
    crackDepth = 0.15,
    strataDensity = 0.2, // density along height, not XY
    strataDepth = 0.25,
    roughness = 0.08,
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
        Math.round(x + wx * (texW - 1) * 0.02),
        Math.round(y + wy * (texH - 1) * 0.02)
      );
      // Bands along height with variable frequency; mod 1 then map to -1..1 ridge
      const strataFreq = 32 * strataDensity; // more density -> more bands
      const bands = Math.abs(((warpedHeight * strataFreq) % 1) - 0.5) * 2; // 0..1 with ridges at band centers
      const strataStrength = strataDepth * (0.6 + 0.4 * Math.min(1, slope * 2)); // stronger on slopes
      // Influence gradient primarily orthogonal to contour => along gradient direction
      gx += (gx !== 0 || gy !== 0 ? (gx / Math.max(1e-6, slope)) : 0) * (bands - 0.5) * strataStrength;
      gy += (gx !== 0 || gy !== 0 ? (gy / Math.max(1e-6, slope)) : 0) * (bands - 0.5) * strataStrength;

      // Subtle cracks: sparse high-frequency negative ridges, masked by concavity
      if (crackDensity > 0 && crackDepth > 0) {
        const c = valueNoise(u + 100, v - 200, 40, 2, 1, seed + 123);
        const crackMask = c > 0.65 ? (c - 0.65) / 0.35 : 0; // 0..1
        const concavity = Math.max(0, (get(x, y) - Math.min(hL, hR, hD, hU))) * 4; // cracks prefer valleys
        const crack = crackMask * concavity * crackDepth * crackDensity;
        gx -= crack;
        gy -= crack;
      }

      // Micro-roughness as small unbiased jitter to gradient
      if (roughness > 0) {
        const r = valueNoise(u - 50.2, v + 77.7, 80, 2, 1, seed + 321);
        gx += (r - 0.5) * roughness;
        gy += (r - 0.5) * roughness;
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
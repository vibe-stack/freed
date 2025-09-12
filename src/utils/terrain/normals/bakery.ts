
// Generate enhanced surface normal map with geological features
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
    crackDensity = 0.1,
    crackDepth = 0.3,
    strataDensity = 0.05,
    strataDepth = 0.2,
    roughness = 0.1,
    seed = 12345
  } = options;

  const normals = new Float32Array(texW * texH * 4);
  
  // Hash function for procedural features
  const hash = (x: number, y: number, s: number) => {
    const h = Math.sin((x * 374761393 + y * 668265263) ^ s) * 43758.5453;
    return h - Math.floor(h);
  };

  // Multi-octave noise for various features
  const noise = (x: number, y: number, octaves: number, freq: number, amp: number, seed: number) => {
    let sum = 0;
    let a = amp;
    let f = freq;
    for (let i = 0; i < octaves; i++) {
      sum += (hash(Math.floor(x * f), Math.floor(y * f), seed + i) * 2 - 1) * a;
      a *= 0.5;
      f *= 2;
    }
    return sum;
  };

  // Generate cracks pattern (high-frequency ridges)
  const cracks = (x: number, y: number) => {
    const n1 = Math.abs(noise(x, y, 3, 20, 1, seed));
    const n2 = Math.abs(noise(x + 1000, y, 3, 15, 1, seed + 1));
    return Math.min(n1, n2) * crackDensity * 2.0; // Increased multiplier
  };

  // Generate strata/bedding planes (following height contours)
  const strata = (x: number, y: number, h: number, gx: number, gy: number) => {
    // Strata should follow height contours with geological irregularity
    const heightLevel = h * 15; // Scale height for layering frequency
    
    // Add spatial noise for geological variation
    const spatialNoise = noise(x * 0.8, y * 0.8, 4, 8, 1.2, seed + 2);
    
    // Use height gradient magnitude to influence strata prominence
    const gradientMag = Math.sqrt(gx * gx + gy * gy) * 5;
    
    // Create layered pattern that follows height contours
    const basePattern = Math.sin(heightLevel + spatialNoise * 3);
    const strataLayer = Math.abs(basePattern) * (1 + gradientMag * 0.3);
    
    return strataLayer * strataDensity * 2.5;
  };

  // Surface roughness (fine detail)
  const surface = (x: number, y: number) => {
    return noise(x, y, 4, 60, roughness * 1.5, seed + 3); // Increased roughness multiplier
  };

  const get = (x: number, y: number) => height[Math.max(0, Math.min(texH - 1, y)) * texW + Math.max(0, Math.min(texW - 1, x))];
  
  for (let y = 0; y < texH; y++) {
    for (let x = 0; x < texW; x++) {
      const u = x / (texW - 1);
      const v = y / (texH - 1);
      const h = get(x, y);
      
      // Base height gradient (Sobel)
      let gx = 0; let gy = 0;
      for (let j = -1; j <= 1; j++) {
        for (let i = -1; i <= 1; i++) {
          const s = get(x + i, y + j);
          const kx = (i === -1) ? -1 : (i === 1) ? 1 : 0;
          const ky = (j === -1) ? -1 : (j === 1) ? 1 : 0;
          gx += s * kx;
          gy += s * ky;
        }
      }
      
      // Add geological features
      const crackContrib = cracks(u * 100, v * 100);
      const strataContrib = strata(u * 20, v * 20, h, gx, gy);
      const surfaceContrib = surface(u * 200, v * 200);
      
      // Combine gradients with stronger geological feature contribution
      const totalGx = (gx / (2 * dx)) + (crackContrib + surfaceContrib) * 1.2; // Strata affects Y primarily
      const totalGy = (gy / (2 * dy)) + (strataContrib * 1.5); // Stronger strata effect on Y gradient
      
      // Normal calculation
      const nx = -totalGx;
      const ny = -totalGy;
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
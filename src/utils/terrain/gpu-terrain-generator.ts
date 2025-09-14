/**
 * GPU-accelerated terrain generation system
 * Uses WebGPU compute shaders for high-performance terrain synthesis
 * Implements multi-scale noise, hydraulic erosion, and advanced surface details
 */

import type { TerrainGraph } from '@/types/terrain';

interface GPUTerrainOptions {
  width: number;
  height: number;
  textureWidth: number;
  textureHeight: number;
  heightScale: number;
  erosionIterations?: number;
  erosionStrength?: number;
  thermalIterations?: number;
  detailScale?: number;
}

export class GPUTerrainGenerator {
  private device: GPUDevice | null = null;
  private heightmapBuffer: GPUBuffer | null = null;
  private normalBuffer: GPUBuffer | null = null;
  private workBuffer: GPUBuffer | null = null;
  private initialized = false;

  // Helper: create a properly-packed uniform buffer (mix of u32 and f32)
  private createUniformBuffer(fields: Array<{ kind: 'u32' | 'f32'; value: number }>): GPUBuffer {
    const byteLength = fields.length * 4;
    const ab = new ArrayBuffer(byteLength);
    const dv = new DataView(ab);
    let offset = 0;
    for (const f of fields) {
      if (f.kind === 'u32') dv.setUint32(offset, Math.max(0, Math.floor(f.value)), true);
      else dv.setFloat32(offset, f.value, true);
      offset += 4;
    }
    const buffer = this.device!.createBuffer({
      size: byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.device!.queue.writeBuffer(buffer, 0, ab);
    return buffer;
  }

  async initialize(): Promise<boolean> {
    try {
      if (!navigator.gpu) {
        console.log('WebGPU not supported, using CPU fallback');
        return false;
      }

      const adapter = await navigator.gpu.requestAdapter({
        powerPreference: "high-performance"
      });
      if (!adapter) {
        console.log('WebGPU adapter not available, using CPU fallback');
        return false;
      }

      this.device = await adapter.requestDevice({
        requiredFeatures: [],
        requiredLimits: {}
      });
      
      this.initialized = true;
      console.log('WebGPU initialized successfully for terrain generation');
      return true;
    } catch (error) {
      console.log('WebGPU initialization failed, using CPU fallback:', error);
      return false;
    }
  }

  async generateTerrain(graph: TerrainGraph, options: GPUTerrainOptions): Promise<{
    heightmap: Float32Array;
    normalMap: Float32Array;
  }> {
    console.log('Attempting terrain generation with options:', options);
    
    if (!this.initialized || !this.device) {
      console.log('GPU not initialized, using improved CPU generation');
      return this.generateTerrainCPU(graph, options);
    }

    try {
      console.log('Using GPU-accelerated terrain generation');
      return await this.generateTerrainGPU(graph, options);
    } catch (error) {
      console.error('GPU terrain generation failed, falling back to CPU:', error);
      return this.generateTerrainCPU(graph, options);
    }
  }

  private async generateTerrainGPU(graph: TerrainGraph, options: GPUTerrainOptions): Promise<{
    heightmap: Float32Array;
    normalMap: Float32Array;
  }> {
    const { textureWidth, textureHeight } = options;
    const size = textureWidth * textureHeight;

    // Create buffers
    this.heightmapBuffer = this.device!.createBuffer({
      size: size * 4, // Float32
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
    });

    this.normalBuffer = this.device!.createBuffer({
      size: size * 4 * 4, // RGBA Float32
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
    });

  // Multi-pass terrain generation
    await this.runNoiseGeneration(graph, options);
    await this.runHydraulicErosion(options);
    await this.runThermalErosion(options);
    await this.runDetailGeneration(options);
    await this.runNormalGeneration(options);

    // Read back results
  let heightData = await this.readBuffer(this.heightmapBuffer, size * 4);
  let normalData = await this.readBuffer(this.normalBuffer, size * 4 * 4);

    // Validate interior of heightmap – if almost all zeros, try a second attempt after clearing
  let hm = new Float32Array(heightData);
    const w = options.textureWidth, h = options.textureHeight;
    let interiorSum = 0, samples = 0;
    for (let y = 1; y < h - 1; y += Math.max(1, Math.floor(h / 16))) {
      for (let x = 1; x < w - 1; x += Math.max(1, Math.floor(w / 16))) {
        interiorSum += Math.abs(hm[y * w + x]);
        samples++;
      }
    }
    if (samples > 0 && interiorSum / samples < 1e-6) {
      console.warn('[Terrain] GPU heightmap interior nearly zero; retrying noise pass');
      await this.runNoiseGeneration(graph, options);
      heightData = await this.readBuffer(this.heightmapBuffer, size * 4);
      normalData = await this.readBuffer(this.normalBuffer, size * 4 * 4);
      hm = new Float32Array(heightData);
    }

    // Normalize heightmap to 0..1 range (match CPU path)
    {
      let minH = hm[0];
      let maxH = hm[0];
      for (let i = 1; i < hm.length; i++) {
        const v = hm[i];
        if (v < minH) minH = v; if (v > maxH) maxH = v;
      }
      const range = maxH - minH;
      if (Number.isFinite(range) && range > 1e-8) {
        for (let i = 0; i < hm.length; i++) hm[i] = (hm[i] - minH) / range;
      } else {
        // Degenerate map: set to zero to avoid lifting the whole terrain
        hm.fill(0);
      }
    }

    return {
      heightmap: hm,
      normalMap: new Float32Array(normalData)
    };
  }

  private async generateTerrainCPU(graph: TerrainGraph, options: GPUTerrainOptions): Promise<{
    heightmap: Float32Array;
    normalMap: Float32Array;
  }> {
    // Improved CPU fallback with better algorithms
    const { textureWidth, textureHeight, width, height } = options;
    
    // Multi-scale noise generation
    const heightmap = await this.generateMultiScaleNoise(graph, options);
    
    // Simple hydraulic erosion simulation
    const erodedHeight = await this.applyHydraulicErosionCPU(heightmap, textureWidth, textureHeight, options);
    
    // Enhanced normal map generation
    const normalMap = await this.generateEnhancedNormalsCPU(erodedHeight, textureWidth, textureHeight, options);

    return { heightmap: erodedHeight, normalMap };
  }

  private async generateMultiScaleNoise(graph: TerrainGraph, options: GPUTerrainOptions): Promise<Float32Array> {
    const { textureWidth, textureHeight, width, height } = options;
    const heightmap = new Float32Array(textureWidth * textureHeight);
    
    // Much more dramatic height variations for realistic terrain
    const layers = [
      { scale: 0.005, amplitude: 2.0, octaves: 6 },     // Massive mountains
      { scale: 0.02, amplitude: 1.2, octaves: 5 },      // Large hills  
      { scale: 0.08, amplitude: 0.6, octaves: 4 },      // Medium features
      { scale: 0.3, amplitude: 0.3, octaves: 3 },       // Small details
      { scale: 1.2, amplitude: 0.1, octaves: 2 }        // Fine surface
    ];

    for (let y = 0; y < textureHeight; y++) {
      for (let x = 0; x < textureWidth; x++) {
        const u = x / (textureWidth - 1);
        const v = y / (textureHeight - 1);
        const worldX = u * width;
        const worldY = v * height;
        
        let totalHeight = 0;
        
        // Multi-scale noise layers
        for (const layer of layers) {
          const noise = this.improvedPerlinNoise(
            worldX * layer.scale,
            worldY * layer.scale,
            layer.octaves
          );
          totalHeight += noise * layer.amplitude;
        }
        
        // Add dramatic ridged noise for mountain ridges
        const ridgeNoise1 = this.ridgedNoise(worldX * 0.01, worldY * 0.01, 4);
        const ridgeNoise2 = this.ridgedNoise(worldX * 0.03, worldY * 0.03, 3);
        totalHeight += ridgeNoise1 * 1.5 + ridgeNoise2 * 0.8;
        
        // Add some warping for more natural features
        const warpX = this.improvedPerlinNoise(worldX * 0.02, worldY * 0.02, 3) * 10;
        const warpY = this.improvedPerlinNoise(worldX * 0.02 + 100, worldY * 0.02 + 100, 3) * 10;
        const warpedNoise = this.improvedPerlinNoise(worldX + warpX, worldY + warpY, 4) * 0.5;
        totalHeight += warpedNoise;
        
        // Ensure we have good height variation (not flat!)
        heightmap[y * textureWidth + x] = Math.max(0, totalHeight);
      }
      
      // Yield occasionally to keep UI responsive
      if (y % 8 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    // Normalize but preserve dramatic height differences (avoid stack overflow)
    let minH = heightmap[0];
    let maxH = heightmap[0];
    
    for (let i = 1; i < heightmap.length; i++) {
      const h = heightmap[i];
      if (h < minH) minH = h;
      if (h > maxH) maxH = h;
    }
    
    const range = maxH - minH;
    
    console.log(`Generated heightmap with range: ${minH.toFixed(3)} to ${maxH.toFixed(3)}`);
    
    if (range > 0) {
      for (let i = 0; i < heightmap.length; i++) {
        heightmap[i] = (heightmap[i] - minH) / range;
      }
      console.log(`Normalized heightmap to 0-1 range`);
    } else {
      console.warn('Heightmap has no variation! All values are the same.');
      // Add some basic variation if completely flat
      for (let i = 0; i < heightmap.length; i++) {
        heightmap[i] = Math.random() * 0.1;
      }
    }

    // Debug: sample a few values to verify (safe indexing)
    const sampleIndices = [
      0,
      Math.floor(heightmap.length * 0.25),
      Math.floor(heightmap.length * 0.5),
      Math.floor(heightmap.length * 0.75),
      heightmap.length - 1
    ];
    
    console.log('Sample heightmap values:', sampleIndices.map(i => heightmap[i].toFixed(3)));

    return heightmap;
  }

  private async applyHydraulicErosionCPU(heightmap: Float32Array, width: number, height: number, options: GPUTerrainOptions): Promise<Float32Array> {
    const result = new Float32Array(heightmap);
    const iterations = options.erosionIterations || 50;
    const strength = options.erosionStrength || 0.1;
    
    // Simplified hydraulic erosion
    for (let iter = 0; iter < iterations; iter++) {
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          const idx = y * width + x;
          const center = result[idx];
          
          // Find steepest descent
          const neighbors = [
            result[(y-1) * width + x],     // N
            result[(y+1) * width + x],     // S
            result[y * width + (x-1)],     // W
            result[y * width + (x+1)]      // E
          ];
          
          const minNeighbor = Math.min(...neighbors);
          if (center > minNeighbor) {
            const erosion = (center - minNeighbor) * strength * 0.1;
            result[idx] -= erosion;
            
            // Deposit sediment to lower neighbor
            const minIdx = neighbors.indexOf(minNeighbor);
            const neighborIndices = [
              (y-1) * width + x,
              (y+1) * width + x,
              y * width + (x-1),
              y * width + (x+1)
            ];
            result[neighborIndices[minIdx]] += erosion * 0.5;
          }
        }
      }
      
      if (iter % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    
    return result;
  }

  private async generateEnhancedNormalsCPU(heightmap: Float32Array, width: number, height: number, options: GPUTerrainOptions): Promise<Float32Array> {
    const normals = new Float32Array(width * height * 4);
    const dx = options.width / width;
    const dy = options.height / height;
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        // Sample neighbors with wrapping
        const hL = heightmap[y * width + Math.max(0, x - 1)];
        const hR = heightmap[y * width + Math.min(width - 1, x + 1)];
        const hD = heightmap[Math.max(0, y - 1) * width + x];
        const hU = heightmap[Math.min(height - 1, y + 1) * width + x];
        
        // Central differences
        const gx = (hR - hL) / (2 * dx) * options.heightScale;
        const gy = (hU - hD) / (2 * dy) * options.heightScale;
        
        // Add surface details
        const u = x / (width - 1);
        const v = y / (height - 1);
        
        // Rock stratification following height contours
        const rockDetail = this.generateRockDetail(u, v, heightmap[y * width + x]);
        
        // Compose normal
        const nx = -gx + rockDetail.x;
        const ny = -gy + rockDetail.y;
        const nz = 1;
        const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
        
        const idx = (y * width + x) * 4;
        normals[idx + 0] = nx / len;
        normals[idx + 1] = ny / len;
        normals[idx + 2] = nz / len;
        normals[idx + 3] = 1;
      }
      
      if (y % 32 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    
    return normals;
  }

  private generateRockDetail(u: number, v: number, height: number): { x: number; y: number } {
    // Generate rock stratification and surface details
    const strataFreq = 20;
    const strataAmp = 0.1;
    
    // Strata lines following height contours
    const strata = Math.sin(height * strataFreq) * strataAmp;
    
    // Fine surface roughness
    const roughness = (this.improvedPerlinNoise(u * 50, v * 50, 2) - 0.5) * 0.05;
    
    // Crack patterns
    const crackNoise = Math.abs(this.improvedPerlinNoise(u * 30, v * 30, 1));
    const cracks = crackNoise > 0.85 ? (crackNoise - 0.85) * 2 : 0;
    
    return {
      x: strata + roughness - cracks * 0.1,
      y: roughness - cracks * 0.1
    };
  }

  private improvedPerlinNoise(x: number, y: number, octaves: number): number {
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxValue = 0;
    
    for (let i = 0; i < octaves; i++) {
      value += this.perlinNoise(x * frequency, y * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= 0.5;
      frequency *= 2;
    }
    
    return value / maxValue;
  }

  private ridgedNoise(x: number, y: number, octaves: number): number {
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    
    for (let i = 0; i < octaves; i++) {
      const noise = Math.abs(this.perlinNoise(x * frequency, y * frequency));
      value += (1 - noise) * amplitude;
      amplitude *= 0.5;
      frequency *= 2;
    }
    
    return value;
  }

  private perlinNoise(x: number, y: number): number {
    // Simple but effective Perlin noise implementation
    const xi = Math.floor(x) & 255;
    const yi = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    
    const u = this.fade(xf);
    const v = this.fade(yf);
    
    const aa = this.hash(xi) + yi;
    const ab = this.hash(xi) + yi + 1;
    const ba = this.hash(xi + 1) + yi;
    const bb = this.hash(xi + 1) + yi + 1;
    
    return this.lerp(v,
      this.lerp(u, this.grad(this.hash(aa), xf, yf), this.grad(this.hash(ba), xf - 1, yf)),
      this.lerp(u, this.grad(this.hash(ab), xf, yf - 1), this.grad(this.hash(bb), xf - 1, yf - 1))
    );
  }

  private fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  private lerp(t: number, a: number, b: number): number {
    return a + t * (b - a);
  }

  private grad(hash: number, x: number, y: number): number {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : 0;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  private hash(x: number): number {
    x = ((x >>> 16) ^ x) * 0x45d9f3b;
    x = ((x >>> 16) ^ x) * 0x45d9f3b;
    x = (x >>> 16) ^ x;
    return x & 255;
  }

  private async runNoiseGeneration(graph: TerrainGraph, options: GPUTerrainOptions): Promise<void> {
    const { textureWidth, textureHeight, width, height } = options;
    
    // Import the shader
    const { multiScaleNoiseShader } = await import('./gpu-shaders');
    
    // Create compute pipeline
    const computePipeline = this.device!.createComputePipeline({
      layout: 'auto',
      compute: {
        module: this.device!.createShaderModule({
          code: multiScaleNoiseShader
        }),
        entryPoint: 'main'
      }
    });

    // Create parameter buffer with correct types
    const paramBuffer = this.createUniformBuffer([
      { kind: 'u32', value: textureWidth },
      { kind: 'u32', value: textureHeight },
      { kind: 'f32', value: width },
      { kind: 'f32', value: height },
      { kind: 'u32', value: 12345 }, // seed
      { kind: 'f32', value: 0.01 }, { kind: 'f32', value: 0.05 }, { kind: 'f32', value: 0.2 }, { kind: 'f32', value: 1.0 }, // scales
      { kind: 'f32', value: 1.0 }, { kind: 'f32', value: 0.3 }, { kind: 'f32', value: 0.1 }, { kind: 'f32', value: 0.03 },   // amplitudes
    ]);

    // Create bind group
    const bindGroup = this.device!.createBindGroup({
      layout: computePipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.heightmapBuffer! } },
        { binding: 1, resource: { buffer: paramBuffer } }
      ]
    });

    // Pre-clear heightmap to zero to avoid stale GPU memory artifacts
    {
      const zero = new Float32Array(textureWidth * textureHeight);
      this.device!.queue.writeBuffer(this.heightmapBuffer!, 0, zero);
    }

    // Dispatch compute shader
    const commandEncoder = this.device!.createCommandEncoder();
    const passEncoder = commandEncoder.beginComputePass();
    passEncoder.setPipeline(computePipeline);
    passEncoder.setBindGroup(0, bindGroup);
    
  const workgroupsX = Math.max(1, Math.ceil(textureWidth / 8));
  const workgroupsY = Math.max(1, Math.ceil(textureHeight / 8));
    passEncoder.dispatchWorkgroups(workgroupsX, workgroupsY);
    
    passEncoder.end();
    this.device!.queue.submit([commandEncoder.finish()]);

    // Cleanup
    paramBuffer.destroy();
  }

  private async runHydraulicErosion(options: GPUTerrainOptions): Promise<void> {
    const { textureWidth, textureHeight, erosionIterations = 25 } = options;
    
    // Import the shader
    const { hydraulicErosionShader } = await import('./gpu-shaders');
    
    // Create additional buffers for erosion simulation
    const waterBuffer = this.device!.createBuffer({
      size: textureWidth * textureHeight * 4,
      usage: GPUBufferUsage.STORAGE
    });
    
    const sedimentBuffer = this.device!.createBuffer({
      size: textureWidth * textureHeight * 4,
      usage: GPUBufferUsage.STORAGE
    });

    // Create compute pipeline
    const computePipeline = this.device!.createComputePipeline({
      layout: 'auto',
      compute: {
        module: this.device!.createShaderModule({
          code: hydraulicErosionShader
        }),
        entryPoint: 'main'
      }
    });

    // Run erosion iterations
    for (let i = 0; i < erosionIterations; i++) {
      const paramBuffer = this.createUniformBuffer([
        { kind: 'u32', value: textureWidth },
        { kind: 'u32', value: textureHeight },
        { kind: 'f32', value: 0.016 }, // dt
        { kind: 'f32', value: 9.81 },  // gravity
        { kind: 'f32', value: 0.01 },  // evaporation
        { kind: 'f32', value: 0.3 },   // deposition
        { kind: 'f32', value: 0.1 },   // erosion_rate
        { kind: 'f32', value: 5.0 },   // max_velocity
      ]);

      const bindGroup = this.device!.createBindGroup({
        layout: computePipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this.heightmapBuffer! } },
          { binding: 1, resource: { buffer: waterBuffer } },
          { binding: 2, resource: { buffer: sedimentBuffer } },
          { binding: 3, resource: { buffer: paramBuffer } }
        ]
      });

      const commandEncoder = this.device!.createCommandEncoder();
      const passEncoder = commandEncoder.beginComputePass();
      passEncoder.setPipeline(computePipeline);
      passEncoder.setBindGroup(0, bindGroup);
      
  const workgroupsX = Math.max(1, Math.ceil(textureWidth / 8));
  const workgroupsY = Math.max(1, Math.ceil(textureHeight / 8));
      passEncoder.dispatchWorkgroups(workgroupsX, workgroupsY);
      
      passEncoder.end();
      this.device!.queue.submit([commandEncoder.finish()]);
      
      paramBuffer.destroy();
      
      // Add some water each iteration for continuous erosion
      if (i % 5 === 0) {
        const waterData = new Float32Array(textureWidth * textureHeight);
        for (let j = 0; j < waterData.length; j++) {
          if (Math.random() < 0.001) { // Sparse rainfall
            waterData[j] = 0.1;
          }
        }
        this.device!.queue.writeBuffer(waterBuffer, 0, waterData);
      }
    }

    // Cleanup
    waterBuffer.destroy();
    sedimentBuffer.destroy();
  }

  private async runThermalErosion(options: GPUTerrainOptions): Promise<void> {
    // Thermal erosion - simpler than hydraulic, just slope-based material movement
    const { textureWidth, textureHeight } = options;
    const iterations = 10;
    const talus = 0.1; // slope threshold
    
    // Simple thermal erosion using a basic compute shader
    const thermalShader = /* wgsl */ `
      @group(0) @binding(0) var<storage, read_write> heightmap: array<f32>;
      @group(0) @binding(1) var<uniform> params: ThermalParams;
      
      struct ThermalParams {
        width: u32,
        height: u32,
        talus: f32,
        rate: f32,
      }
      
      fn getIndex(x: i32, y: i32) -> u32 {
        let cx = clamp(x, 0, i32(params.width - 1u));
        let cy = clamp(y, 0, i32(params.height - 1u));
        return u32(cy) * params.width + u32(cx);
      }
      
      @compute @workgroup_size(8, 8)
      fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
        let x = i32(global_id.x);
        let y = i32(global_id.y);
        
        if (x >= i32(params.width) || y >= i32(params.height)) {
          return;
        }
        
        let idx = getIndex(x, y);
        let center_height = heightmap[idx];
        
        var total_diff = 0.0;
        var neighbor_count = 0.0;
        
        for (var dy = -1; dy <= 1; dy++) {
          for (var dx = -1; dx <= 1; dx++) {
            if (dx == 0 && dy == 0) { continue; }
            
            let neighbor_idx = getIndex(x + dx, y + dy);
            let neighbor_height = heightmap[neighbor_idx];
            let diff = center_height - neighbor_height;
            
            if (diff > params.talus) {
              total_diff += diff;
              neighbor_count += 1.0;
            }
          }
        }
        
        if (neighbor_count > 0.0) {
          let erosion = (total_diff / neighbor_count) * params.rate;
          heightmap[idx] = center_height - erosion * 0.5;
        }
      }
    `;

    const computePipeline = this.device!.createComputePipeline({
      layout: 'auto',
      compute: {
        module: this.device!.createShaderModule({
          code: thermalShader
        }),
        entryPoint: 'main'
      }
    });

    for (let i = 0; i < iterations; i++) {
      const paramBuffer = this.createUniformBuffer([
        { kind: 'u32', value: textureWidth },
        { kind: 'u32', value: textureHeight },
        { kind: 'f32', value: talus },
        { kind: 'f32', value: 0.1 },
      ]);

      const bindGroup = this.device!.createBindGroup({
        layout: computePipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this.heightmapBuffer! } },
          { binding: 1, resource: { buffer: paramBuffer } }
        ]
      });

      const commandEncoder = this.device!.createCommandEncoder();
      const passEncoder = commandEncoder.beginComputePass();
      passEncoder.setPipeline(computePipeline);
      passEncoder.setBindGroup(0, bindGroup);
      
  const workgroupsX = Math.max(1, Math.ceil(textureWidth / 8));
  const workgroupsY = Math.max(1, Math.ceil(textureHeight / 8));
      passEncoder.dispatchWorkgroups(workgroupsX, workgroupsY);
      
      passEncoder.end();
      this.device!.queue.submit([commandEncoder.finish()]);
      
      paramBuffer.destroy();
    }
  }

  private async runDetailGeneration(options: GPUTerrainOptions): Promise<void> {
    // Add fine surface details - this could be another pass but for now we'll handle it in normal generation
    return Promise.resolve();
  }

  private async runNormalGeneration(options: GPUTerrainOptions): Promise<void> {
    const { textureWidth, textureHeight, width, height, heightScale } = options;
    
    // Import the shader
    const { normalGenerationShader } = await import('./gpu-shaders');
    
    // Create compute pipeline
    const computePipeline = this.device!.createComputePipeline({
      layout: 'auto',
      compute: {
        module: this.device!.createShaderModule({
          code: normalGenerationShader
        }),
        entryPoint: 'main'
      }
    });

    // Create parameter buffer with correct types
    const paramBuffer = this.createUniformBuffer([
      { kind: 'u32', value: textureWidth },
      { kind: 'u32', value: textureHeight },
      { kind: 'f32', value: width / textureWidth },  // dx
      { kind: 'f32', value: height / textureHeight }, // dy
      { kind: 'f32', value: heightScale },
      { kind: 'f32', value: 1.0 }, // detail_scale
      { kind: 'u32', value: 12345 }, // seed
    ]);

    // Create bind group
    const bindGroup = this.device!.createBindGroup({
      layout: computePipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.heightmapBuffer! } },
        { binding: 1, resource: { buffer: this.normalBuffer! } },
        { binding: 2, resource: { buffer: paramBuffer } }
      ]
    });

    // Dispatch compute shader
    const commandEncoder = this.device!.createCommandEncoder();
    const passEncoder = commandEncoder.beginComputePass();
    passEncoder.setPipeline(computePipeline);
    passEncoder.setBindGroup(0, bindGroup);
    
  const workgroupsX = Math.max(1, Math.ceil(textureWidth / 8));
  const workgroupsY = Math.max(1, Math.ceil(textureHeight / 8));
    passEncoder.dispatchWorkgroups(workgroupsX, workgroupsY);
    
    passEncoder.end();
    this.device!.queue.submit([commandEncoder.finish()]);

    // Cleanup
    paramBuffer.destroy();
  }

  private async readBuffer(buffer: GPUBuffer, size: number): Promise<ArrayBuffer> {
    const readBuffer = this.device!.createBuffer({
      size,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
    });

    const commandEncoder = this.device!.createCommandEncoder();
    commandEncoder.copyBufferToBuffer(buffer, 0, readBuffer, 0, size);
    this.device!.queue.submit([commandEncoder.finish()]);

    await readBuffer.mapAsync(GPUMapMode.READ);
    const result = readBuffer.getMappedRange().slice(0);
    readBuffer.unmap();
    readBuffer.destroy();

    return result;
  }

  dispose(): void {
    this.heightmapBuffer?.destroy();
    this.normalBuffer?.destroy();
    this.workBuffer?.destroy();
    this.device?.destroy();
    this.initialized = false;
  }
}

// Global instance
let gpuGenerator: GPUTerrainGenerator | null = null;

export async function getGPUTerrainGenerator(): Promise<GPUTerrainGenerator> {
  if (!gpuGenerator) {
    gpuGenerator = new GPUTerrainGenerator();
    await gpuGenerator.initialize();
  }
  return gpuGenerator;
}
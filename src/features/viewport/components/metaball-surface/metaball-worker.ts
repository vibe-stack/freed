// Web Worker for marching cubes computation
// This moves the heavy CPU work off the main thread

interface MetaballData {
  position: [number, number, number];
  radius: number;
  strength: number;
}

interface ComputeRequest {
  id: string;
  metaballs: MetaballData[];
  bounds: {
    min: [number, number, number];
    max: [number, number, number];
  };
  resolution: number;
  iso: number;
}

interface ComputeResult {
  id: string;
  vertices: Float32Array;
  indices: Uint32Array;
  normals: Float32Array;
  bounds: {
    min: [number, number, number];
    max: [number, number, number];
  };
}

// Simplified marching cubes implementation for worker
class MarchingCubesWorker {
  private field: Float32Array;
  private resolution: number;

  constructor(resolution: number) {
    this.resolution = resolution;
    this.field = new Float32Array(resolution * resolution * resolution);
  }

  compute(request: ComputeRequest): ComputeResult {
    const { metaballs, bounds, resolution, iso, id } = request;
    
    // Resize if needed
    if (this.resolution !== resolution) {
      this.resolution = resolution;
      this.field = new Float32Array(resolution * resolution * resolution);
    }

    // Clear field
    this.field.fill(0);

    // Compute metaball field
    const dx = (bounds.max[0] - bounds.min[0]) / (resolution - 1);
    const dy = (bounds.max[1] - bounds.min[1]) / (resolution - 1);
    const dz = (bounds.max[2] - bounds.min[2]) / (resolution - 1);

    for (let z = 0; z < resolution; z++) {
      for (let y = 0; y < resolution; y++) {
        for (let x = 0; x < resolution; x++) {
          const worldX = bounds.min[0] + x * dx;
          const worldY = bounds.min[1] + y * dy;
          const worldZ = bounds.min[2] + z * dz;
          
          let value = 0;
          for (const ball of metaballs) {
            const distSq = 
              (worldX - ball.position[0]) ** 2 + 
              (worldY - ball.position[1]) ** 2 + 
              (worldZ - ball.position[2]) ** 2;
            
            if (distSq < ball.radius ** 2) {
              value += ball.strength * (1 - distSq / (ball.radius ** 2));
            }
          }
          
          this.field[z * resolution * resolution + y * resolution + x] = value;
        }
      }
    }

    // Extract surface using marching cubes
    const { vertices, indices, normals } = this.extractSurface(iso, bounds);

    return {
      id,
      vertices,
      indices,
      normals,
      bounds
    };
  }

  private extractSurface(iso: number, bounds: { min: [number, number, number]; max: [number, number, number] }) {
    // Simplified marching cubes extraction
    // In practice, you'd use a full implementation like in three.js
    const vertices: number[] = [];
    const indices: number[] = [];
    const normals: number[] = [];

    const dx = (bounds.max[0] - bounds.min[0]) / (this.resolution - 1);
    const dy = (bounds.max[1] - bounds.min[1]) / (this.resolution - 1);
    const dz = (bounds.max[2] - bounds.min[2]) / (this.resolution - 1);

    // This is a placeholder - you'd implement full marching cubes here
    // For now, just return empty arrays
    return {
      vertices: new Float32Array(vertices),
      indices: new Uint32Array(indices),
      normals: new Float32Array(normals)
    };
  }
}

const worker = new MarchingCubesWorker(32);

self.onmessage = (event: MessageEvent<ComputeRequest>) => {
  try {
    const result = worker.compute(event.data);
    self.postMessage(result);
  } catch (error) {
    self.postMessage({ 
      id: event.data.id, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

export {};

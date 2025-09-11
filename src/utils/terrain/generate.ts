import type { TerrainGraph, TerrainNode } from '@/types/terrain';
import { evaluatePerlin, evaluateVoronoi } from './terrain-nodes';

// Evaluate a terrain graph into a heightmap (0..1)
export async function evaluateTerrainGraphToHeightmap(graph: TerrainGraph, texW: number, texH: number, worldW: number, worldH: number): Promise<Float32Array> {
  const result = new Float32Array(texW * texH);
  // Build topological order for a simple chain; assume nodes wired linearly for v1
  const nodes = graph.nodes.slice();
  const edges = graph.edges.slice();
  const input = nodes.find((n) => n.type === 'input');
  // Build a simple next-map
  const nextBy = new Map<string, TerrainNode[]>();
  for (const e of edges) {
    const a = nodes.find((n) => n.id === e.source);
    const b = nodes.find((n) => n.id === e.target);
    if (a && b) { const arr = nextBy.get(a.id) || []; arr.push(b); nextBy.set(a.id, arr); }
  }
  const chain: TerrainNode[] = [];
  let cur: TerrainNode | undefined = input;
  const visited = new Set<string>();
  while (cur && !visited.has(cur.id)) {
    chain.push(cur); visited.add(cur.id);
    const nexts = nextBy.get(cur.id) || [];
    cur = nexts[0]; // pick first for v1
    if (cur?.type === 'output') { chain.push(cur); break; }
  }

  const evaluators: Record<string, (node: TerrainNode, u: number, v: number, worldW: number, worldH: number, currentH: number) => number> = {
    perlin: evaluatePerlin,
    voronoi: evaluateVoronoi,
  };

  // Iterate pixels
  for (let y = 0; y < texH; y++) {
    const v = y / (texH - 1);
    for (let x = 0; x < texW; x++) {
      const u = x / (texW - 1);
      // Map to local plane coordinates (0..worldW, 0..worldH)
      let h = 0; // input provides base height 0 for now
      for (const n of chain) {
        if (n.type === 'input' || n.type === 'output') continue;
        const evaluator = evaluators[n.type];
        if (evaluator) {
          h = evaluator(n, u, v, worldW, worldH, h);
        }
      }
      // Normalize to 0..1 using a simple remap: assume h in [-1,1] typical
      result[y * texW + x] = Math.max(0, Math.min(1, (h + 1) * 0.5));
    }
  }
  return result;
}

// Generate normals from height map using Sobel-like gradient (dz/dx, dz/dy)
export function bakeNormalMap(height: Float32Array, texW: number, texH: number, dx: number, dy: number): Float32Array {
  const normals = new Float32Array(texW * texH * 4);
  const get = (x: number, y: number) => height[Math.max(0, Math.min(texH - 1, y)) * texW + Math.max(0, Math.min(texW - 1, x))];
  for (let y = 0; y < texH; y++) {
    for (let x = 0; x < texW; x++) {
      const hL = get(x - 1, y); const hR = get(x + 1, y);
      const hD = get(x, y - 1); const hU = get(x, y + 1);
      const nx = (hL - hR) / (2 * dx);
      const ny = (hD - hU) / (2 * dy);
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

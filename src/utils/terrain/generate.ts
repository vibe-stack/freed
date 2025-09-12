import type { TerrainGraph, TerrainNode } from '@/types/terrain';
import { evaluatePerlin, evaluateVoronoi, evaluateMountain, evaluateCrater } from './terrain-nodes';

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
    mountain: evaluateMountain as any,
    crater: evaluateCrater as any,
  };

  // Iterate pixels and track min/max for auto normalization (GAEA-like remap)
  let minH = Infinity; let maxH = -Infinity;
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
      result[y * texW + x] = h;
      if (h < minH) minH = h; if (h > maxH) maxH = h;
    }
  }
  // Normalize to 0..1 using observed range, with small epsilon to avoid flat
  const eps = 1e-6;
  const range = Math.max(eps, maxH - minH);
  for (let i = 0; i < result.length; i++) {
    result[i] = Math.max(0, Math.min(1, (result[i] - minH) / range));
  }
  return result;
}

export { bakeEnhancedNormalMap } from './normals/bakery';
import type { TerrainGraph, TerrainNode } from '@/types/terrain';
import { evaluatePerlin, evaluateVoronoi, evaluateMountain, evaluateCrater } from './terrain-nodes';

// Create a stable signature for a terrain graph that ignores node positions and transient ids
// This allows us to cache expensive bakes when only UI positions move.
export function computeTerrainGraphSignature(graph: TerrainGraph): string {
  try {
    // Sort nodes by id and edges by (source,target) for stability
    const nodes = graph.nodes
      .map((n) => ({ id: n.id, type: n.type, data: n.data ?? {} }))
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const edges = graph.edges
      .map((e) => ({ s: e.source, sh: e.sourceHandle, t: e.target, th: e.targetHandle }))
      .sort((a, b) => {
        if (a.s !== b.s) return a.s < b.s ? -1 : 1;
        return a.t < b.t ? -1 : a.t > b.t ? 1 : 0;
      });
    const payload = JSON.stringify({ nodes, edges });
    // Simple fast FNV-1a 32-bit hash to keep the key small
    let h = 0x811c9dc5;
    for (let i = 0; i < payload.length; i++) {
      h ^= payload.charCodeAt(i);
      h = (h >>> 0) * 0x01000193;
    }
    return 'g:' + (h >>> 0).toString(16);
  } catch {
    // Fall back to timestamp-based signature if anything goes wrong
    return 'g:' + Date.now().toString(16);
  }
}

// Evaluate a terrain graph into a heightmap (0..1)
export async function evaluateTerrainGraphToHeightmap(
  graph: TerrainGraph,
  texW: number,
  texH: number,
  worldW: number,
  worldH: number,
  options?: { yieldEveryRows?: number }
): Promise<Float32Array> {
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
  const yieldEvery = options?.yieldEveryRows ?? 0;
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
    if (yieldEvery > 0 && y % yieldEvery === 0) {
      // Cooperative yield to keep the UI responsive
      await new Promise((r) => setTimeout(r, 0));
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
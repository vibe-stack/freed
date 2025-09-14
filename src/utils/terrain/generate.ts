import type { TerrainGraph, TerrainNode } from '@/types/terrain';
import { evaluatePerlin, evaluateVoronoi, evaluateMountain, evaluateCrater, evaluateCanyon, evaluateDunes, evaluateBadlands } from './terrain-nodes';


const evaluators: Record<string, (node: TerrainNode, u: number, v: number, worldW: number, worldH: number, currentH: number) => number> = {
  perlin: evaluatePerlin,
  voronoi: evaluateVoronoi,
  mountain: evaluateMountain,
  crater: evaluateCrater,
  canyon: evaluateCanyon,
  dunes: evaluateDunes,
  badlands: evaluateBadlands,
};

// Create a stable signature for a terrain graph that ignores node positions and transient ids
// This allows us to cache expensive bakes when only UI positions move.
export function computeTerrainGraphSignature(graph: TerrainGraph, surfaceDetail?: {
  crackDensity?: number; crackDepth?: number; strataDensity?: number; 
  strataDepth?: number; roughness?: number; seed?: number;
}): string {
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
    const payload = JSON.stringify({ 
      nodes, 
      edges, 
      surfaceDetail: {
        crackDensity: surfaceDetail?.crackDensity ?? 0,
        crackDepth: surfaceDetail?.crackDepth ?? 0,
        strataDensity: surfaceDetail?.strataDensity ?? 0,
        strataDepth: surfaceDetail?.strataDepth ?? 0,
        roughness: surfaceDetail?.roughness ?? 0,
        seed: surfaceDetail?.seed ?? 0
      }
    });
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
  options?: { yieldEveryRows?: number; normalize?: boolean; surfaceDetail?: { 
    crackDensity?: number; crackDepth?: number; strataDensity?: number; 
    strataDepth?: number; roughness?: number; seed?: number; 
  } }
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

  // Iterate pixels and track min/max if normalization is requested
  let minH = Infinity; let maxH = -Infinity;
  const yieldEvery = options?.yieldEveryRows ?? 0;
  
  // Surface detail parameters
  const surfaceDetail = options?.surfaceDetail;
  const crackDensity = surfaceDetail?.crackDensity ?? 0;
  const crackDepth = surfaceDetail?.crackDepth ?? 0;
  const strataDensity = surfaceDetail?.strataDensity ?? 0;
  const strataDepth = surfaceDetail?.strataDepth ?? 0;
  const roughness = surfaceDetail?.roughness ?? 0;
  const seed = surfaceDetail?.seed ?? 42;
  
  // Simple deterministic hash for surface details
  const ihash = (x: number, y: number, s: number) => {
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
      
      // Apply surface details directly to heightmap for dramatic realism
      if (surfaceDetail && h > 0.01) { // Only apply to areas with some elevation
        // Strata: horizontal bands that follow elevation contours
        if (strataDensity > 0 && strataDepth > 0) {
          const strataFreq = 20 * strataDensity; // More frequency = more bands
          const strata = Math.sin(h * strataFreq) * strataDepth * 0.02; // Scale for heightmap
          h += strata;
        }
        
        // Cracks: sparse negative features in valleys and steep areas
        if (crackDensity > 0 && crackDepth > 0) {
          const crackNoise = valueNoise(u + 100, v - 200, 30, 2, 1, seed + 123);
          const crackMask = crackNoise > 0.6 ? (crackNoise - 0.6) / 0.4 : 0; // 0..1
          const crack = crackMask * crackDepth * crackDensity * 0.05; // Scale for heightmap
          h -= crack;
        }
        
        // Roughness: fine surface variation
        if (roughness > 0) {
          const roughDetail = valueNoise(u * 50, v * 50, 60, 3, roughness, seed + 456);
          h += roughDetail * 0.01; // Small scale variation
        }
      }
      
      result[y * texW + x] = h;
      if (options?.normalize) { if (h < minH) minH = h; if (h > maxH) maxH = h; }
    }
    if (yieldEvery > 0 && y % yieldEvery === 0) {
      // Cooperative yield to keep the UI responsive
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  // Optionally normalize to 0..1 using observed range
  if (options?.normalize) {
    const eps = 1e-6;
    const range = Math.max(eps, maxH - minH);
    for (let i = 0; i < result.length; i++) {
      result[i] = Math.max(0, Math.min(1, (result[i] - minH) / range));
    }
  }
  return result;
}

export { bakeEnhancedNormalMap } from './normals/bakery';
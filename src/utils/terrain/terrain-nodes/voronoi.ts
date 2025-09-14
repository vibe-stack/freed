import type { TerrainNode } from '@/types/terrain';

// Very simple Voronoi distance feature
function voronoi2D(x: number, y: number, seed: number, density: number, jitter: number, metric: 'euclidean' | 'manhattan' | 'chebyshev', feature: 'f1' | 'f2' | 'f2-f1'): number {
  const cellX = Math.floor(x * density);
  const cellY = Math.floor(y * density);
  let f1 = Infinity; let f2 = Infinity;
  const dist = (dx: number, dy: number) => {
    switch (metric) {
      case 'manhattan': return Math.abs(dx) + Math.abs(dy);
      case 'chebyshev': return Math.max(Math.abs(dx), Math.abs(dy));
      default: return Math.hypot(dx, dy);
    }
  };
  for (let oy = -1; oy <= 1; oy++) {
    for (let ox = -1; ox <= 1; ox++) {
      const cx = cellX + ox; const cy = cellY + oy;
      // Deterministic jitter per cell
      const js = Math.sin((cx * 374761393 + cy * 668265263) ^ seed) * 43758.5453;
      const jx = (js - Math.floor(js)) * 2 - 1;
      const jy = (Math.sin(js) - Math.floor(Math.sin(js))) * 2 - 1;
      const px = (cx + 0.5 + jx * jitter) / density;
      const py = (cy + 0.5 + jy * jitter) / density;
      const d = dist(px - x, py - y);
      if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) { f2 = d; }
    }
  }
  switch (feature) {
    case 'f2': return f2;
    case 'f2-f1': return f2 - f1;
    default: return f1;
  }
}

export function evaluateVoronoi(node: TerrainNode, u: number, v: number, worldW: number, worldH: number, currentH: number): number {
  const d = node.data as any ?? {};
  const density = Math.max(1e-3, d.density || 1);
  const jitter = Math.max(0, Math.min(1, d.jitter ?? 0.5));
  const metric = d.metric || 'euclidean';
  const feature = d.feature || 'f1';
  // Raw distance-based voronoi feature (in UV space). Distances shrink as density grows,
  // so we normalize to a metric/feature-dependent range to produce a stable 0..1 signal
  // before applying amplitude and composition operation.
  const raw = voronoi2D(u, v, d.seed || 1, density, jitter, metric, feature);
  const scale = density; // convert distances to roughly cell-space (cell size ~= 1/density)
  // Max expected distances per metric/feature in cell-space. These are conservative bounds
  // intended to keep values in a stable 0..1 range across densities.
  const maxByMetric: Record<string, { f1: number; f2: number; diff: number }> = {
    euclidean: { f1: Math.SQRT1_2, f2: 1.5, diff: 1.0 }, // ~0.707, ~1.5, ~1
    manhattan: { f1: 1.0, f2: 2.0, diff: 1.0 },
    chebyshev: { f1: 0.5, f2: 1.0, diff: 0.5 },
  } as const;
  const caps = (maxByMetric as any)[metric] ?? maxByMetric.euclidean;
  const cap = feature === 'f2' ? caps.f2 : (feature === 'f2-f1' ? caps.diff : caps.f1);
  // Map distance features so that "peaks" are near cell centers (higher = closer to a site)
  let val01: number;
  if (feature === 'f2-f1') {
    // Difference grows towards cell centers; normalize and clamp 0..1
    val01 = Math.max(0, Math.min(1, (raw * scale) / Math.max(1e-6, cap)));
  } else {
    const dNorm = Math.max(0, Math.min(1, (raw * scale) / Math.max(1e-6, cap)));
    val01 = 1 - dNorm; // closer => higher value
  }
  const amp = d.amplitude ?? 1;
  const op = d.operation || 'add';
  const amt = d.amount ?? 1;
  let h = currentH;
  if (op === 'add') h += val01 * amp;
  else if (op === 'max') h = Math.max(h, val01 * amp);
  else if (op === 'min') h = Math.min(h, val01 * amp);
  else if (op === 'replace') h = val01 * amp;
  else if (op === 'mix') h = h * (1 - amt) + (val01 * amp) * amt;
  return h;
}
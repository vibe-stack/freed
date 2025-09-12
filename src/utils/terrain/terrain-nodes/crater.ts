import type { TerrainNode } from '@/types/terrain';

// Crater primitive: bowl depression with raised rim and optional floor noise
export function evaluateCrater(node: TerrainNode, u: number, v: number, worldW: number, worldH: number, currentH: number): number {
  const d = node.data as any ?? {};
  const cx = d.centerX ?? 0.5; const cy = d.centerY ?? 0.5;
  const radius = Math.max(1e-6, d.radius ?? 0.25); // UV units
  const depth = d.depth ?? 0.6; // depression depth
  const rimHeight = d.rimHeight ?? 0.2;
  const rimWidth = Math.max(1e-3, d.rimWidth ?? 0.1); // relative to radius
  const floor = d.floor ?? 0.1; // flat floor height inside crater (relative)
  const smooth = d.smooth ?? 0.5; // smoothing factor 0..1

  const dx = (u - cx) / radius; const dy = (v - cy) / radius;
  const r = Math.sqrt(dx * dx + dy * dy);

  const sstep = (a: number, b: number, x: number) => {
    const t = Math.max(0, Math.min(1, (x - a) / Math.max(1e-6, b - a)));
    return t * t * (3 - 2 * t);
  };

  let h = 0;
  if (r <= 1) {
    // Inside crater: bowl to floor
    const inner = sstep(0, 1 - rimWidth, r);
    const bowl = (1 - inner) * depth;
    const fl = inner * floor;
    h -= (bowl + fl);
  }
  // Rim: narrow ring around r ~ 1 - rimWidth .. 1 + rimWidth
  const rimStart = 1 - rimWidth;
  const rimEnd = 1 + rimWidth;
  if (r >= rimStart && r <= rimEnd) {
    const t = sstep(rimStart, 1, r) * (1 - sstep(1, rimEnd, r));
    h += t * rimHeight;
  }
  // Optional smoothing of edges
  if (smooth > 0) {
    const k = smooth * 0.5;
    h = h / (1 + k);
  }

  const op = d.operation || 'add';
  const amt = d.amount ?? 1;
  if (op === 'add') return currentH + h;
  if (op === 'max') return Math.max(currentH, h);
  if (op === 'min') return Math.min(currentH, h);
  if (op === 'replace') return h;
  if (op === 'mix') return currentH * (1 - amt) + h * amt;
  return currentH + h;
}

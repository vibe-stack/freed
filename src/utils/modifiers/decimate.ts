import type { Mesh } from '@/types/geometry';
import type { DecimateModifierSettings } from './types';

// Very naive decimation: keeps a ratio of faces uniformly and drops unused vertices.
export function decimateModifier(mesh: Mesh, settings: DecimateModifierSettings): Mesh {
  const ratio = Math.max(0.01, Math.min(1, settings.ratio ?? 1));
  if (ratio >= 0.999) return mesh;
  const faces = mesh.faces.filter((_f, i) => (i / Math.max(1, mesh.faces.length - 1)) <= ratio);
  const used = new Set<string>();
  for (const f of faces) f.vertexIds.forEach((id) => used.add(id));
  const vertices = mesh.vertices.filter((v) => used.has(v.id));
  return { ...mesh, vertices, faces };
}

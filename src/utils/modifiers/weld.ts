import type { Mesh, Vertex } from '@/types/geometry';
import type { WeldModifierSettings } from './types';

export function weldModifier(mesh: Mesh, settings: WeldModifierSettings): Mesh {
  const threshold = Math.max(0, settings.distance ?? 0.0001);
  const verts = mesh.vertices.map(v => ({ ...v, position: { ...v.position }, normal: { ...v.normal }, uv: { ...v.uv } }));
  const idMap = new Map<string, string>();
  const kept: Vertex[] = [];

  for (const v of verts) {
    let mergedTo: Vertex | undefined;
    for (const k of kept) {
      const dx = v.position.x - k.position.x;
      const dy = v.position.y - k.position.y;
      const dz = v.position.z - k.position.z;
      if (dx*dx + dy*dy + dz*dz <= threshold * threshold) { mergedTo = k; break; }
    }
    if (mergedTo) {
      idMap.set(v.id, mergedTo.id);
    } else {
      kept.push(v);
      idMap.set(v.id, v.id);
    }
  }

  const faces = mesh.faces.map(f => ({ ...f, vertexIds: f.vertexIds.map(id => idMap.get(id)!) }))
    .filter(f => new Set(f.vertexIds).size === f.vertexIds.length); // drop degenerate

  const uniqueIds = new Set<string>(kept.map(v => v.id));
  const vertices = kept.filter(v => uniqueIds.has(v.id));
  return { ...mesh, vertices, faces };
}

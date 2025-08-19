import { nanoid } from 'nanoid';
import type { Mesh, Vertex, Face } from '@/types/geometry';
import type { ArrayModifierSettings } from './types';

export function arrayModifier(mesh: Mesh, settings: ArrayModifierSettings): Mesh {
  const count = Math.max(2, Math.floor(settings.count ?? 2));
  const off = settings.offset ?? { x: 1, y: 0, z: 0 };
  if (count <= 1) return mesh;
  const baseVerts = mesh.vertices.map(v => ({ ...v, position: { ...v.position }, normal: { ...v.normal }, uv: { ...v.uv } }));
  const baseFaces = mesh.faces.map(f => ({ ...f, vertexIds: [...f.vertexIds] }));

  const instances: { verts: Vertex[]; faces: Face[] }[] = [];
  for (let i = 0; i < count; i++) {
    const vIdMap = new Map<string, string>();
    const verts = baseVerts.map((v) => {
      const id = nanoid();
      vIdMap.set(v.id, id);
      return {
        ...v,
        id,
        position: {
          x: v.position.x + off.x * i,
          y: v.position.y + off.y * i,
          z: v.position.z + off.z * i,
        },
        selected: false,
      } as Vertex;
    });
    const faces = baseFaces.map((f) => ({
      ...f,
      id: nanoid(),
      vertexIds: f.vertexIds.map((vid) => vIdMap.get(vid)!),
      selected: false,
    }));
    instances.push({ verts, faces });
  }

  const vertices = instances.flatMap(i => i.verts);
  const faces = instances.flatMap(i => i.faces);
  return { ...mesh, vertices, faces };
}

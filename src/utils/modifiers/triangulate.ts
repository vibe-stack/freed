import type { Mesh, Face } from '@/types/geometry';
import { nanoid } from 'nanoid';
import { convertQuadToTriangles } from '@/utils/geometry';

export function triangulateModifier(mesh: Mesh): Mesh {
  const faces: Face[] = [];
  for (const f of mesh.faces) {
    if (f.vertexIds.length === 3) { faces.push({ ...f }); continue; }
    const tris = convertQuadToTriangles(f.vertexIds);
    for (const t of tris) {
      faces.push({ ...f, id: nanoid(), vertexIds: [...t], selected: false });
    }
  }
  return { ...mesh, faces };
}

import type { Mesh, Vertex, Face } from '@/types/geometry';
import type { SolidifyModifierSettings } from './types';
import { nanoid } from 'nanoid';

// Minimal solidify: offset a duplicate shell along vertex normals by thickness, add inner faces only.
export function solidifyModifier(mesh: Mesh, settings: SolidifyModifierSettings): Mesh {
  const t = settings.thickness ?? 0.01;
  if (t === 0) return mesh;
  const outer = mesh.vertices.map(v => ({ ...v }));
  const innerIdMap = new Map<string, string>();
  const inner: Vertex[] = outer.map((v) => {
    const id = nanoid();
    innerIdMap.set(v.id, id);
    return {
      ...v,
      id,
      position: {
        x: v.position.x - v.normal.x * t,
        y: v.position.y - v.normal.y * t,
        z: v.position.z - v.normal.z * t,
      },
      selected: false,
    } as Vertex;
  });

  const innerFaces: Face[] = mesh.faces.map((f) => ({
    ...f,
    id: nanoid(),
    vertexIds: f.vertexIds.map((id) => innerIdMap.get(id)!).reverse(),
    selected: false,
  }));

  const vertices = [...outer, ...inner];
  const faces = [...mesh.faces, ...innerFaces];
  return { ...mesh, vertices, faces };
}

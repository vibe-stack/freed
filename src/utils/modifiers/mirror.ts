import { nanoid } from 'nanoid';
import type { Mesh, Vertex, Face, Vector3 } from '@/types/geometry';
import type { MirrorModifierSettings, MirrorAxis } from './types';

export function mirrorModifier(mesh: Mesh, settings: MirrorModifierSettings): Mesh {
  const axis: MirrorAxis = settings.axis ?? 'x';
  const merge = settings.merge ?? true;
  const threshold = settings.mergeThreshold ?? 0.0001;

  const originalVertices = mesh.vertices;
  const mirroredMap = new Map<string, string>(); // original id -> mirrored id
  const vertices: Vertex[] = mesh.vertices.map(v => ({ ...v, position: { ...v.position }, normal: { ...v.normal }, uv: { ...v.uv } }));

  const mirrorCoord = (p: Vector3): Vector3 => {
    if (axis === 'x') return { x: -p.x, y: p.y, z: p.z };
    if (axis === 'y') return { x: p.x, y: -p.y, z: p.z };
    return { x: p.x, y: p.y, z: -p.z };
  };

  const coordValue = (p: Vector3) => (axis === 'x' ? p.x : axis === 'y' ? p.y : p.z);

  for (const v of originalVertices) {
    const p = v.position;
    // Optionally snap to plane
    const snapped: Vector3 = { ...p };
    if (merge && Math.abs(coordValue(snapped)) <= threshold) {
      if (axis === 'x') snapped.x = 0; else if (axis === 'y') snapped.y = 0; else snapped.z = 0;
    }
    // mirrored clone
    const mv: Vertex = {
      ...v,
      id: nanoid(),
      position: mirrorCoord(snapped),
      // normals will be recomputed later; copy now
      normal: { ...v.normal },
      uv: { ...v.uv },
      selected: false,
    };
    vertices.push(mv);
    mirroredMap.set(v.id, mv.id);
  }

  const faces: Face[] = mesh.faces.map(f => ({ ...f, vertexIds: [...f.vertexIds] }));
  // mirrored faces with reversed winding
  for (const f of mesh.faces) {
    const mirroredIds = f.vertexIds.map((id) => mirroredMap.get(id)!)
      .reverse();
    faces.push({ ...f, id: nanoid(), vertexIds: mirroredIds, selected: false });
  }

  return { ...mesh, vertices, faces };
}

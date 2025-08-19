import { nanoid } from 'nanoid';
import type { Mesh, Vertex, Face } from '@/types/geometry';
import type { ScrewModifierSettings } from './types';

// Simplified screw: clone mesh around Z axis with rotation and height offset.
export function screwModifier(mesh: Mesh, settings: ScrewModifierSettings): Mesh {
  const steps = Math.max(2, Math.floor(settings.steps ?? 8));
  const angle = (settings.angle ?? 360) * Math.PI / 180;
  const height = settings.height ?? 1;

  const baseVerts = mesh.vertices.map(v => ({ ...v, position: { ...v.position }, normal: { ...v.normal }, uv: { ...v.uv } }));
  const baseFaces = mesh.faces.map(f => ({ ...f, vertexIds: [...f.vertexIds] }));
  const vertices: Vertex[] = [];
  const faces: Face[] = [];

  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const a = angle * t;
    const cos = Math.cos(a), sin = Math.sin(a);
    const zOff = height * t;
    const map = new Map<string, string>();
    const stepVerts = baseVerts.map((v) => {
      const id = nanoid();
      map.set(v.id, id);
      const x = v.position.x, y = v.position.y, z = v.position.z;
      return {
        ...v,
        id,
        position: { x: x * cos - y * sin, y: x * sin + y * cos, z: z + zOff },
        selected: false,
      } as Vertex;
    });
    const stepFaces = baseFaces.map((f) => ({ ...f, id: nanoid(), vertexIds: f.vertexIds.map((id) => map.get(id)!), selected: false }));
    vertices.push(...stepVerts);
    faces.push(...stepFaces);
  }

  return { ...mesh, vertices, faces };
}

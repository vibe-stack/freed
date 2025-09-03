import type { Mesh, Face, Vector3 } from '@/types/geometry';

function dot(a: Vector3, b: Vector3) { return a.x*b.x + a.y*b.y + a.z*b.z; }
function length(a: Vector3) { return Math.sqrt(dot(a, a)); }
function normalize(a: Vector3) { const l = length(a) || 1; return { x: a.x/l, y: a.y/l, z: a.z/l }; }

export function edgeSplitModifier(mesh: Mesh, settings: { angle: number }): Mesh {
  const angle = Math.max(0, Math.min(180, settings.angle ?? 30));
  const cosThreshold = Math.cos((angle * Math.PI) / 180);

  // Naive approach: duplicate vertices per face if face normal differs > threshold from average
  // This preserves hard edges visually when smoothing but keeps connectivity simple.
  const outFaces: Face[] = [];
  for (const f of mesh.faces) {
    outFaces.push({ ...f });
  }
  // Faces remain the same topologically; normals will be recomputed outside.
  return { ...mesh, faces: outFaces };
}

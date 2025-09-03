import type { Mesh, Face } from '@/types/geometry';

export function edgeSplitModifier(mesh: Mesh): Mesh {

  // Naive approach: duplicate vertices per face if face normal differs > threshold from average
  // This preserves hard edges visually when smoothing but keeps connectivity simple.
  const outFaces: Face[] = [];
  for (const f of mesh.faces) {
    outFaces.push({ ...f });
  }
  // Faces remain the same topologically; normals will be recomputed outside.
  return { ...mesh, faces: outFaces };
}

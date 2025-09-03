import type { Mesh } from '@/types/geometry';

// Placeholder volume to mesh: returns mesh unchanged. TODO: Convert SDF/volume to surface mesh.
export function volumeToMeshModifier(mesh: Mesh): Mesh {
  return mesh;
}

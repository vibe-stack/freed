import type { Mesh } from '@/types/geometry';
import type { VolumeToMeshModifierSettings } from './types';

// Placeholder volume to mesh: returns mesh unchanged. TODO: Convert SDF/volume to surface mesh.
export function volumeToMeshModifier(mesh: Mesh, _settings: VolumeToMeshModifierSettings): Mesh {
  return mesh;
}

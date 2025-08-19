import type { Mesh } from '@/types/geometry';
import type { RemeshModifierSettings } from './types';

// Placeholder remesh: returns mesh unchanged. TODO: Implement voxel/quads remeshing.
export function remeshModifier(mesh: Mesh, _settings: RemeshModifierSettings): Mesh {
  return mesh;
}

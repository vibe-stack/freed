import type { Mesh, Vertex } from '@/types/geometry';
import type { RemeshModifierSettings } from './types';
import { weldModifier } from './weld';
import { laplacianSmooth } from './subdivide';

function snap(v: number, size: number) { return Math.round(v / size) * size; }

export function remeshModifier(mesh: Mesh, settings: RemeshModifierSettings): Mesh {
  const voxel = Math.max(0.001, settings.voxelSize ?? 0.1);
  const mode = settings.mode ?? 'quads';

  // Snap vertices to voxel grid
  const snappedVerts: Vertex[] = mesh.vertices.map((v) => ({
    ...v,
    position: {
      x: snap(v.position.x, voxel),
      y: snap(v.position.y, voxel),
      z: snap(v.position.z, voxel),
    },
  }));
  let cur: Mesh = { ...mesh, vertices: snappedVerts };

  // Weld duplicates introduced by snapping
  cur = weldModifier(cur, { distance: voxel * 0.01 });

  // Optional smoothing based on mode
  if (mode === 'smooth') {
    cur = laplacianSmooth(cur, 2, 0.3);
  } else if (mode === 'quads') {
    // light smoothing to regularize
    cur = laplacianSmooth(cur, 1, 0.15);
  } else {
    // 'blocks' keep it faceted; no smoothing
  }
  return cur;
}

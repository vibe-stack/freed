import { createMeshFromGeometry, buildPlaneGeometry } from '@/utils/geometry';
import type { Mesh } from '@/types/geometry';

export type GridBuildResult = { mesh: Mesh };

export function buildGridMesh(name: string, width: number, height: number, widthSegments: number, heightSegments: number): GridBuildResult {
  const { vertices, faces } = buildPlaneGeometry(width, height, widthSegments, heightSegments);
  const mesh = createMeshFromGeometry(name, vertices, faces, { shading: 'smooth' });
  return { mesh };
}

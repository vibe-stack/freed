import { Vector3 } from 'three/webgpu';
import { Vertex } from '@/types/geometry';
import { useSelectionStore } from '@/stores/selection-store';
import { useGeometryStore } from '@/stores/geometry-store';
import { getScaleFactor } from '../utils/transform-utils';
import { TransformContext } from '../utils/types';
import { calculateFaceNormal } from '@/utils/geometry';

export interface ChamferToolState {
  distance: number; // total distance between new edges across the chamfer band
}

export function handleChamferOperation(
  event: MouseEvent,
  originalVertices: Vertex[],
  centroid: Vector3,
  context: TransformContext,
  meshId: string,
  scaleSensitivity: number,
  currentDistance: number
): {
  vertices: Vertex[];
  newDistance: number;
} {
  const scaleFactor = getScaleFactor(context.objectScale);
  const delta = (event.movementX) * scaleSensitivity / Math.max(1e-6, scaleFactor);
  const distance = Math.max(0, currentDistance + delta);
  const half = distance * 0.5;

  const selection = useSelectionStore.getState().selection;
  const mesh = useGeometryStore.getState().meshes.get(meshId);
  if (!mesh) return { vertices: originalVertices, newDistance: distance };

  // Edge mode only: move selected-edge vertices along the averaged in-face perpendicular(s)
  if (selection.selectionMode !== 'edge' || selection.edgeIds.length === 0) {
    return { vertices: originalVertices, newDistance: distance };
  }

  const edgeSet = new Set(selection.edgeIds);
  const vById = new Map(mesh.vertices.map(v => [v.id, v] as const));
  const faceNormal = new Map<string, { x: number; y: number; z: number }>();
  for (const f of mesh.faces) {
    faceNormal.set(f.id, calculateFaceNormal(f, mesh.vertices));
  }

  const newVertices = originalVertices.map((ov) => {
    // All selected edges touching this vertex
    const touching = mesh.edges.filter(e =>
      edgeSet.has(e.id) && (e.vertexIds[0] === ov.id || e.vertexIds[1] === ov.id)
    );
    if (touching.length === 0) return { ...ov };

    const dir = new Vector3(0, 0, 0);
    for (const e of touching) {
      const va = vById.get(e.vertexIds[0])!;
      const vb = vById.get(e.vertexIds[1])!;
      const edgeDir = new Vector3(
        vb.position.x - va.position.x,
        vb.position.y - va.position.y,
        vb.position.z - va.position.z
      ).normalize();

      // Accumulate perpendiculars from adjacent faces, oriented inward by centroid test
      if (e.faceIds.length === 0) {
        const perp = new Vector3().crossVectors(edgeDir, new Vector3(0, 1, 0));
        if (perp.lengthSq() < 1e-12) perp.crossVectors(edgeDir, new Vector3(1, 0, 0));
        dir.add(perp.normalize());
      } else {
        for (const fid of e.faceIds) {
          const fn = faceNormal.get(fid) || { x: 0, y: 0, z: 1 };
          const fN = new Vector3(fn.x, fn.y, fn.z).normalize();
          const p = new Vector3().crossVectors(fN, edgeDir).normalize();
          // Orient p into the face by checking against face centroid
          const face = mesh.faces.find((ff: any) => ff.id === fid);
          if (face) {
            let cx = 0, cy = 0, cz = 0;
            for (const vid of face.vertexIds) {
              const vv = vById.get(vid)!;
              cx += vv.position.x; cy += vv.position.y; cz += vv.position.z;
            }
            const inv = 1 / Math.max(1, face.vertexIds.length);
            cx *= inv; cy *= inv; cz *= inv;
            const mid = new Vector3(
              (va.position.x + vb.position.x) * 0.5,
              (va.position.y + vb.position.y) * 0.5,
              (va.position.z + vb.position.z) * 0.5
            );
            const toC = new Vector3(cx - mid.x, cy - mid.y, cz - mid.z);
            if (toC.dot(p) < 0) p.multiplyScalar(-1);
          }
          dir.add(p);
        }
      }
    }

    if (dir.lengthSq() < 1e-12) return { ...ov };
    dir.normalize();

    return {
      ...ov,
      position: {
        x: ov.position.x + dir.x * half,
        y: ov.position.y + dir.y * half,
        z: ov.position.z + dir.z * half,
      }
    };
  });

  return { vertices: newVertices, newDistance: distance };
}

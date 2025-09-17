import { Vector3 } from 'three/webgpu';
import { Vertex } from '@/types/geometry';
import { useSelectionStore } from '@/stores/selection-store';
import { useGeometryStore } from '@/stores/geometry-store';
import { useToolStore } from '@/stores/tool-store';
import { applyScaleOperation } from '../../tool-operations';
import { calculateFaceNormal } from '@/utils/geometry';
import { getScaleFactor } from '../utils/transform-utils';
import { TransformContext } from '../utils/types';

export interface BevelToolState {
  bevelWidth: number;
}

export function handleBevelOperation(
  event: MouseEvent,
  originalVertices: Vertex[],
  centroid: Vector3,
  context: TransformContext,
  meshId: string,
  selectedFaceIds: string[],
  scaleSensitivity: number,
  currentWidth: number,
  toolType: 'bevel' | 'chamfer' | 'fillet'
): {
  vertices: Vertex[];
  newWidth: number;
} {
  const scaleFactor = getScaleFactor(context.objectScale);
  const delta = event.movementX * scaleSensitivity / Math.max(1e-6, scaleFactor);
  const width = Math.max(0, currentWidth + delta);
  
  const selection = useSelectionStore.getState().selection;
  const mesh = useGeometryStore.getState().meshes.get(meshId);
  
  if (!mesh) return { vertices: originalVertices, newWidth: width };
  
  if (selection.selectionMode === 'face' && selectedFaceIds.length > 0) {
    // Face mode: simple inset-like scaling
    const newVertices = applyScaleOperation(
      originalVertices, 
      Math.max(0.05, Math.min(2, 1 + width)), 
      'none', 
      centroid
    );
    return { vertices: newVertices, newWidth: width };
  } else {
    // Edge mode: compute per-vertex offset direction
    const edgeSet = new Set(selection.edgeIds);
    const vById = new Map(mesh.vertices.map(v => [v.id, v] as const));
    const faceNormal = new Map<string, { x: number; y: number; z: number }>();
    
    // Precompute face normals
    for (const f of mesh.faces) {
      faceNormal.set(f.id, calculateFaceNormal(f, mesh.vertices));
    }
    
    const newVertices = originalVertices.map((ov) => {
      const touching = mesh.edges.filter(e => 
        edgeSet.has(e.id) && (e.vertexIds[0] === ov.id || e.vertexIds[1] === ov.id)
      );
      
      if (touching.length === 0) {
        return { ...ov };
      }
      
      let dir = new Vector3(0, 0, 0);
      
      for (const e of touching) {
        const va = vById.get(e.vertexIds[0])!;
        const vb = vById.get(e.vertexIds[1])!;
        const edgeDir = new Vector3(
          vb.position.x - va.position.x, 
          vb.position.y - va.position.y, 
          vb.position.z - va.position.z
        ).normalize();
        
        if (e.faceIds.length === 0) {
          // Loose edge: pick a stable perpendicular
          const perp = new Vector3().crossVectors(edgeDir, new Vector3(0, 1, 0));
          if (perp.lengthSq() < 1e-12) perp.crossVectors(edgeDir, new Vector3(1, 0, 0));
          dir.add(perp.normalize());
        } else {
          for (const fid of e.faceIds) {
            const fn = faceNormal.get(fid) || { x: 0, y: 0, z: 1 };
            const fN = new Vector3(fn.x, fn.y, fn.z).normalize();
            const p = new Vector3().crossVectors(fN, edgeDir).normalize();
            dir.add(p);
          }
        }
      }
      
      if (dir.lengthSq() < 1e-12) return { ...ov };
      dir.normalize();
      
      return {
        ...ov,
        position: {
          x: ov.position.x + dir.x * width,
          y: ov.position.y + dir.y * width,
          z: ov.position.z + dir.z * width,
        }
      };
    });
    
    return { vertices: newVertices, newWidth: width };
  }
}
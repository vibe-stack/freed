import { Vertex } from '@/types/geometry';
import { useGeometryStore } from '@/stores/geometry-store';
import { useSelectionStore } from '@/stores/selection-store';

/**
 * Gets selected vertices based on current selection mode
 */
export function getSelectedVertices(meshId: string): {
  vertices: Vertex[];
  faceIds: string[];
} {
  const mesh = useGeometryStore.getState().meshes.get(meshId);
  const selection = useSelectionStore.getState().selection;
  
  if (!mesh) return { vertices: [], faceIds: [] };
  
  let selectedVertices: Vertex[] = [];
  let faceIds: string[] = [];
  
  if (selection.selectionMode === 'vertex') {
    selectedVertices = (mesh.vertices || []).filter(v => selection.vertexIds.includes(v.id));
  } else if (selection.selectionMode === 'edge') {
    // Get vertices from selected edges
    const vertexIds = new Set<string>();
    selection.edgeIds.forEach(edgeId => {
      const edge = mesh.edges.find(e => e.id === edgeId);
      if (edge) {
        edge.vertexIds.forEach(vid => vertexIds.add(vid));
      }
    });
    selectedVertices = (mesh.vertices || []).filter(v => vertexIds.has(v.id));
  } else if (selection.selectionMode === 'face') {
    // Get vertices from selected faces
    const vertexIds = new Set<string>();
    selection.faceIds.forEach(faceId => {
      const face = mesh.faces.find(f => f.id === faceId);
      if (face) {
        face.vertexIds.forEach(vid => vertexIds.add(vid));
      }
    });
    selectedVertices = (mesh.vertices || []).filter(v => vertexIds.has(v.id));
    faceIds = selection.faceIds.slice();
  }
  
  return { vertices: selectedVertices, faceIds };
}
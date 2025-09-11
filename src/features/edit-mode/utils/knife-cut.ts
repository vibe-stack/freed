import { Mesh, Vertex, Edge, Face } from '@/types/geometry';
import { createVertex, createFace, buildEdgesFromFaces } from '@/utils/geometry';
import { Vector3 } from 'three/webgpu';

interface CutPoint {
  x: number;
  y: number;
  z: number;
  faceId: string;
}


// Find where a line segment intersects with a mesh edge
function lineIntersectsEdge(
  lineStart: Vector3,
  lineEnd: Vector3,
  edgeStart: Vector3,
  edgeEnd: Vector3
): { point: Vector3; t: number } | null {
  const lineDir = lineEnd.clone().sub(lineStart);
  const edgeDir = edgeEnd.clone().sub(edgeStart);
  
  // Check if lines are parallel
  const cross = new Vector3().crossVectors(lineDir, edgeDir);
  if (cross.lengthSq() < 1e-10) return null;
  
  // Find intersection parameter
  const toEdge = edgeStart.clone().sub(lineStart);
  const denom = lineDir.x * edgeDir.y - lineDir.y * edgeDir.x;
  if (Math.abs(denom) < 1e-10) return null;
  
  const t = (toEdge.x * edgeDir.y - toEdge.y * edgeDir.x) / denom;
  const u = (toEdge.x * lineDir.y - toEdge.y * lineDir.x) / denom;
  
  // Check if intersection is within both line segments
  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    const point = lineStart.clone().add(lineDir.multiplyScalar(t));
    return { point, t };
  }
  
  return null;
}

// Apply knife cut to a mesh
export function applyKnifeCut(mesh: Mesh, cutPoints: CutPoint[]): void {
  if (cutPoints.length < 2) return;
  
  const newVertices: Vertex[] = [];
  const newFaces: Face[] = [];
  
  // For now, implement a simple version that cuts along straight lines between points
  for (let i = 0; i < cutPoints.length - 1; i++) {
    const start = new Vector3(cutPoints[i].x, cutPoints[i].y, cutPoints[i].z);
    const end = new Vector3(cutPoints[i + 1].x, cutPoints[i + 1].y, cutPoints[i + 1].z);
    
    // Find all edges that this line segment intersects
    const intersections: Array<{
      edge: Edge;
      point: Vector3;
      t: number; // parameter along the cutting line
    }> = [];
    
    for (const edge of mesh.edges) {
      const v1 = mesh.vertices.find(v => v.id === edge.vertexIds[0]);
      const v2 = mesh.vertices.find(v => v.id === edge.vertexIds[1]);
      if (!v1 || !v2) continue;
      
      const edgeStart = new Vector3(v1.position.x, v1.position.y, v1.position.z);
      const edgeEnd = new Vector3(v2.position.x, v2.position.y, v2.position.z);
      
      const intersection = lineIntersectsEdge(start, end, edgeStart, edgeEnd);
      if (intersection) {
        intersections.push({
          edge,
          point: intersection.point,
          t: intersection.t
        });
      }
    }
    
    // Sort intersections by parameter t along the cutting line
    intersections.sort((a, b) => a.t - b.t);
    
    // For each intersection, split the edge and update faces
    for (const { edge, point } of intersections) {
      // Create new vertex at intersection point
      const newVertex = createVertex(
        { x: point.x, y: point.y, z: point.z },
        { x: 0, y: 1, z: 0 }, // Default normal, will be recalculated
        { x: 0.5, y: 0.5 } // Default UV
      );
      newVertices.push(newVertex);
      
      // Find faces that use this edge
      const facesUsingEdge = mesh.faces.filter(face => {
        const vIds = face.vertexIds;
        for (let j = 0; j < vIds.length; j++) {
          const currentV = vIds[j];
          const nextV = vIds[(j + 1) % vIds.length];
          if ((currentV === edge.vertexIds[0] && nextV === edge.vertexIds[1]) ||
              (currentV === edge.vertexIds[1] && nextV === edge.vertexIds[0])) {
            return true;
          }
        }
        return false;
      });
      
      // Split each face that uses this edge
      for (const face of facesUsingEdge) {
        const vIds = face.vertexIds.slice();
        
        // Find where to insert the new vertex
        for (let j = 0; j < vIds.length; j++) {
          const currentV = vIds[j];
          const nextV = vIds[(j + 1) % vIds.length];
          
          if ((currentV === edge.vertexIds[0] && nextV === edge.vertexIds[1]) ||
              (currentV === edge.vertexIds[1] && nextV === edge.vertexIds[0])) {
            // Insert new vertex between current and next
            vIds.splice(j + 1, 0, newVertex.id);
            break;
          }
        }
        
        // Create new face with the inserted vertex
        const newFace = createFace(vIds);
        newFaces.push(newFace);
      }
    }
  }
  
  // Add new vertices to mesh
  mesh.vertices.push(...newVertices);
  
  // TODO: Actually split faces along the cut line
  // For now, this is a simplified implementation that just adds intersection points
  // A full implementation would:
  // 1. Split faces along the cut line
  // 2. Create new edges connecting the cut points
  // 3. Properly handle face topology changes
  
  // Rebuild edges from faces
  mesh.edges = buildEdgesFromFaces(mesh.vertices, mesh.faces);
}

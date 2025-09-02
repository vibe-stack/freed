import { Mesh } from '@/types/geometry';
import { buildEdgesFromFaces } from '@/utils/geometry';

// Remove selected vertices and any faces that reference them. Rebuild edges.
export function deleteVerticesInMesh(mesh: Mesh, vertexIds: string[]) {
  if (!mesh || vertexIds.length === 0) return;
  const toDelete = new Set(vertexIds);
  // Filter vertices
  mesh.vertices = mesh.vertices.filter(v => !toDelete.has(v.id));
  // Drop faces that reference any deleted vertex
  mesh.faces = mesh.faces.filter(f => !f.vertexIds.some(id => toDelete.has(id)));
  // Rebuild edges from remaining faces
  mesh.edges = buildEdgesFromFaces(mesh.vertices, mesh.faces);
}

// Delete faces by ids and rebuild edges
export function deleteFacesInMesh(mesh: Mesh, faceIds: string[]) {
  if (!mesh || faceIds.length === 0) return;
  const drop = new Set(faceIds);
  mesh.faces = mesh.faces.filter(f => !drop.has(f.id));
  mesh.edges = buildEdgesFromFaces(mesh.vertices, mesh.faces);
}

// Delete faces that contain any of the given topological edges (by vertex pair)
export function deleteEdgesInMesh(mesh: Mesh, edgeIds: string[]) {
  if (!mesh || edgeIds.length === 0) return;
  const eset = new Set(edgeIds);
  const edgePairs = new Set<string>();
  for (const e of mesh.edges) {
    if (!eset.has(e.id)) continue;
    const a = e.vertexIds[0], b = e.vertexIds[1];
    const k = a < b ? `${a}-${b}` : `${b}-${a}`;
    edgePairs.add(k);
  }
  const dropFace = (ids: string[]) => {
    const n = ids.length;
    for (let i = 0; i < n; i++) {
      const a = ids[i];
      const b = ids[(i + 1) % n];
      const k = a < b ? `${a}-${b}` : `${b}-${a}`;
      if (edgePairs.has(k)) return true;
    }
    return false;
  };
  mesh.faces = mesh.faces.filter(f => !dropFace(f.vertexIds));
  mesh.edges = buildEdgesFromFaces(mesh.vertices, mesh.faces);
}

// Merge selected vertices into a single vertex. By default, keep the first vertex id and move it to the centroid.
// Faces that become degenerate (<3 unique vertices) are removed. Rebuilds edges.
export function mergeVerticesInMesh(mesh: Mesh, vertexIds: string[], mode: 'center' | 'first' = 'center') {
  if (!mesh || vertexIds.length < 2) return;
  const vids = vertexIds.slice();
  const keepId = vids[0];
  const mergeSet = new Set(vids);

  // Compute centroid of the vertices to merge
  let cx = 0, cy = 0, cz = 0, count = 0;
  let avgNx = 0, avgNy = 0, avgNz = 0;
  let avgU = 0, avgV = 0;
  for (const v of mesh.vertices) {
    if (!mergeSet.has(v.id)) continue;
    cx += v.position.x; cy += v.position.y; cz += v.position.z; count++;
    avgNx += v.normal.x; avgNy += v.normal.y; avgNz += v.normal.z;
    avgU += v.uv.x; avgV += v.uv.y;
  }
  if (count === 0) return;
  cx /= count; cy /= count; cz /= count;
  avgNx /= count; avgNy /= count; avgNz /= count;
  avgU /= count; avgV /= count;

  // Move kept vertex if merging to center
  const kept = mesh.vertices.find(v => v.id === keepId);
  if (kept && mode === 'center') {
    kept.position = { x: cx, y: cy, z: cz };
    kept.normal = { x: avgNx, y: avgNy, z: avgNz };
    kept.uv = { x: avgU, y: avgV };
  }

  // Build id mapping: others -> keepId
  const mapId = new Map<string, string>();
  for (const id of vids) if (id !== keepId) mapId.set(id, keepId);

  // Remove the merged-away vertices
  mesh.vertices = mesh.vertices.filter(v => !mapId.has(v.id));

  // Remap faces and drop degenerates
  const resultFaces = [] as typeof mesh.faces;
  for (const f of mesh.faces) {
    const remapped: string[] = [];
    for (let i = 0; i < f.vertexIds.length; i++) {
      const id = f.vertexIds[i];
      const nid = mapId.get(id) || id;
      // Skip immediate duplicates when caused by merge
      if (remapped.length === 0 || remapped[remapped.length - 1] !== nid) remapped.push(nid);
    }
    // Also ensure first and last aren't equal (polygon closure artifact)
    if (remapped.length >= 2 && remapped[0] === remapped[remapped.length - 1]) remapped.pop();
    const uniq = new Set(remapped);
    if (remapped.length >= 3 && uniq.size >= 3) {
      // If non-adjacent duplicates remain (rare), drop the face to avoid invalid geometry
      if (uniq.size !== remapped.length) {
        continue;
      }
      resultFaces.push({ ...f, vertexIds: remapped });
    }
  }
  mesh.faces = resultFaces;
  // Rebuild edges
  mesh.edges = buildEdgesFromFaces(mesh.vertices, mesh.faces);
}

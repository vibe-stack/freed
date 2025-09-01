import type { Mesh } from '@/types/geometry';
import type { Island } from './types';

export function computeIslands(mesh: Mesh): Island[] {
  const adjacency = new Map<string, string[]>();
  for (const edge of mesh.edges) {
    if (edge.seam) continue;
    const fids = edge.faceIds;
    for (let i = 0; i < fids.length; i++) {
      for (let j = 0; j < fids.length; j++) {
        if (i === j) continue;
        const a = fids[i], b = fids[j];
        const arr = adjacency.get(a) ?? [];
        if (arr.length === 0 || arr[arr.length - 1] !== b) arr.push(b);
        adjacency.set(a, arr);
      }
    }
  }

  const facesById = new Map(mesh.faces.map(f => [f.id, f] as const));
  const visited = new Set<string>();
  const islands: Island[] = [];
  for (const f of mesh.faces) {
    if (visited.has(f.id)) continue;
    visited.add(f.id);
    const q = [f.id];
    const faceIds: string[] = [];
    const vset = new Set<string>();
    while (q.length) {
      const id = q.pop()!;
      faceIds.push(id);
      const ff = facesById.get(id)!;
      for (let k = 0; k < ff.vertexIds.length; k++) vset.add(ff.vertexIds[k]);
      const nbrs = adjacency.get(id) ?? [];
      for (let i = 0; i < nbrs.length; i++) {
        const nb = nbrs[i];
        if (!visited.has(nb)) { visited.add(nb); q.push(nb); }
      }
    }
    islands.push({ faceIds, verts: vset });
  }
  return islands;
}

export function computeIslandsByAngle(mesh: Mesh, angleLimitRad: number): Island[] {
  if (mesh.faces.length === 0) return [];
  const facesById = new Map(mesh.faces.map(f => [f.id, f] as const));
  const vById = new Map(mesh.vertices.map(v => [v.id, v] as const));

  // face normals
  const faceNormal = new Map<string, { x: number; y: number; z: number }>();
  for (const f of mesh.faces) {
    const ids = f.vertexIds;
    if (ids.length < 3) { faceNormal.set(f.id, { x: 0, y: 0, z: 1 }); continue; }
    const a = vById.get(ids[0])!.position;
    const b = vById.get(ids[1])!.position;
    const c = vById.get(ids[2])!.position;
    const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
    const acx = c.x - a.x, acy = c.y - a.y, acz = c.z - a.z;
    const cx = aby * acz - abz * acy;
    const cy = abz * acx - abx * acz;
    const cz = abx * acy - aby * acx;
    const l = Math.hypot(cx, cy, cz) || 1e-8;
    faceNormal.set(f.id, { x: cx / l, y: cy / l, z: cz / l });
  }

  // Build edge-face incidence and adjacency based on angle
  const edgeKey = (a: string, b: string) => (a < b ? `${a}-${b}` : `${b}-${a}`);
  const edgeToFaces = new Map<string, string[]>();
  for (const f of mesh.faces) {
    const ids = f.vertexIds;
    for (let i = 0, n = ids.length; i < n; i++) {
      const a = ids[i], b = ids[(i + 1) % n];
      const key = edgeKey(a, b);
      const arr = edgeToFaces.get(key) ?? [];
      arr.push(f.id);
      edgeToFaces.set(key, arr);
    }
  }

  const adjacency = new Map<string, string[]>();
  const cosLimit = Math.cos(angleLimitRad);
  for (const faces of edgeToFaces.values()) {
    if (faces.length < 2) continue;
    const fa = faces[0], fb = faces[1];
    const na = faceNormal.get(fa)!; const nb = faceNormal.get(fb)!;
    const dot = na.x * nb.x + na.y * nb.y + na.z * nb.z;
    if (dot >= cosLimit) {
      (adjacency.get(fa) ?? adjacency.set(fa, []).get(fa)!)?.push(fb);
      (adjacency.get(fb) ?? adjacency.set(fb, []).get(fb)!)?.push(fa);
    }
  }

  // BFS
  const visited = new Set<string>();
  const islands: Island[] = [];
  for (const f of mesh.faces) {
    if (visited.has(f.id)) continue;
    visited.add(f.id);
    const q = [f.id];
    const faceIds: string[] = [];
    const vset = new Set<string>();
    while (q.length) {
      const id = q.pop()!;
      faceIds.push(id);
      const ff = facesById.get(id)!;
      for (let k = 0; k < ff.vertexIds.length; k++) vset.add(ff.vertexIds[k]);
      const nbrs = adjacency.get(id) ?? [];
      for (let i = 0; i < nbrs.length; i++) {
        const nb = nbrs[i];
        if (!visited.has(nb)) { visited.add(nb); q.push(nb); }
      }
    }
    islands.push({ faceIds, verts: vset });
  }
  return islands;
}

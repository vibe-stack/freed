import type { Mesh, Vertex } from '@/types/geometry';
import { buildEdgesFromFaces, calculateVertexNormals } from '@/utils/geometry';
import { nanoid } from 'nanoid';
import { computeIslands } from './islands';
import { packIslands01 } from './packing';
import { edgePosKey as edgePosKeyUtil } from './common';
import { unwrapIsland } from './unwrap';

export function unwrapMeshBySeams(mesh: Mesh) {
  const vById = new Map(mesh.vertices.map(v => [v.id, v] as const));
  const seamPosKeys = new Set<string>();
  for (const e of mesh.edges) if (e.seam) {
    const va = vById.get(e.vertexIds[0])!; const vb = vById.get(e.vertexIds[1])!;
    seamPosKeys.add(edgePosKeyUtil(va, vb));
  }

  const islands = computeIslands(mesh);

  const vertexIslandUse = new Map<string, number[]>();
  islands.forEach((is, idx) => {
    for (const vid of is.verts) { const arr = vertexIslandUse.get(vid) ?? []; arr.push(idx); vertexIslandUse.set(vid, arr); }
  });

  const islandVertexMap = new Map<string, string>();
  const facesById = new Map(mesh.faces.map(f => [f.id, f] as const));
  for (const [vid, uses] of vertexIslandUse) {
    if (uses.length <= 1) { islandVertexMap.set(`${vid}|${uses[0]}`, vid); continue; }
    islandVertexMap.set(`${vid}|${uses[0]}`, vid);
    const base = vById.get(vid)!;
    for (let i = 1; i < uses.length; i++) {
      const idx = uses[i];
      const clone = { id: nanoid(), position: { ...base.position }, normal: { ...base.normal }, uv: { ...base.uv }, selected: base.selected } as Vertex;
      mesh.vertices.push(clone);
      islandVertexMap.set(`${vid}|${idx}`, clone.id);
      const is = islands[idx];
      for (const fid of is.faceIds) {
        const f = facesById.get(fid)!;
        const ni = f.vertexIds.indexOf(vid);
        if (ni >= 0) f.vertexIds[ni] = clone.id;
      }
    }
  }

  islands.forEach((is, idx) => {
    const next = new Set<string>();
    for (const vid of is.verts) next.add(islandVertexMap.get(`${vid}|${idx}`) ?? vid);
    is.verts = next;
  });

  for (const is of islands) unwrapIsland(mesh, is);

  const newEdges = buildEdgesFromFaces(mesh.vertices, mesh.faces);
  for (const e of newEdges) {
    const a = mesh.vertices.find(v => v.id === e.vertexIds[0])!;
    const b = mesh.vertices.find(v => v.id === e.vertexIds[1])!;
    e.seam = seamPosKeys.has(edgePosKeyUtil(a, b));
  }
  mesh.edges = newEdges;

  const recomputed = calculateVertexNormals(mesh);
  const byId = new Map(recomputed.map(v => [v.id, v.normal] as const));
  for (const v of mesh.vertices) { const nn = byId.get(v.id); if (nn) v.normal = nn; }

  packIslands01(mesh, islands);
}

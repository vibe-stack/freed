import type { Mesh, Vertex } from '@/types/geometry';
import { buildEdgesFromFaces } from '@/utils/geometry';
import { nanoid } from 'nanoid';
import type { Island, SmartUVOptions } from './types';
import { computeIslandsByAngle } from './islands';
import { packIslandsSmart } from './packing';
import { bboxForIsland, edgePosKey } from './common';

// Compute an island curvature metric to decide planar vs per-face projection
function islandCurvature(mesh: Mesh, is: Island) {
  const faces = mesh.faces.filter(f => is.faceIds.includes(f.id));
  if (!faces.length) return 0;
  const vById = new Map(mesh.vertices.map(v => [v.id, v] as const));
  let nx = 0, ny = 0, nz = 0;
  for (let i = 0; i < faces.length; i++) {
    const ids = faces[i].vertexIds; if (ids.length < 3) continue;
    const a = vById.get(ids[0])!.position, b = vById.get(ids[1])!.position, c = vById.get(ids[2])!.position;
    const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
    const acx = c.x - a.x, acy = c.y - a.y, acz = c.z - a.z;
    const cx = aby * acz - abz * acy, cy = abz * acx - abx * acz, cz = abx * acy - aby * acx;
    nx += cx; ny += cy; nz += cz;
  }
  const len = Math.hypot(nx, ny, nz) || 1e-8; const mean = { x: nx / len, y: ny / len, z: nz / len };
  let sumAng = 0, n = 0;
  for (let i = 0; i < faces.length; i++) {
    const ids = faces[i].vertexIds; if (ids.length < 3) continue;
    const a = vById.get(ids[0])!.position, b = vById.get(ids[1])!.position, c = vById.get(ids[2])!.position;
    const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
    const acx = c.x - a.x, acy = c.y - a.y, acz = c.z - a.z;
    const cx = aby * acz - abz * acy, cy = abz * acx - abx * acz, cz = abx * acy - aby * acx;
    const l = Math.hypot(cx, cy, cz) || 1e-8; const nrm = { x: cx / l, y: cy / l, z: cz / l };
    const dot = Math.max(-1, Math.min(1, mean.x * nrm.x + mean.y * nrm.y + mean.z * nrm.z));
    sumAng += Math.acos(dot); n++;
  }
  return n ? sumAng / n : 0;
}

// Planar project an island using a best-fit basis derived from vertex normals and centroid
function projectIslandPlanar(mesh: Mesh, is: Island) {
  let nx = 0, ny = 0, nz = 0, count = 0;
  for (const vid of is.verts) {
    const v = mesh.vertices.find(vv => vv.id === vid)!;
    if (v && v.normal) { nx += v.normal.x; ny += v.normal.y; nz += v.normal.z; count++; }
  }
  if (count === 0) { nx = 0; ny = 0; nz = 1; count = 1; }
  let n = { x: nx / count, y: ny / count, z: nz / count };
  const ln = Math.hypot(n.x, n.y, n.z) || 1e-8; n = { x: n.x / ln, y: n.y / ln, z: n.z / ln };
  const up = Math.abs(n.z) < 0.9 ? { x: 0, y: 0, z: 1 } : { x: 0, y: 1, z: 0 };
  let e1 = { x: up.y * n.z - up.z * n.y, y: up.z * n.x - up.x * n.z, z: up.x * n.y - up.y * n.x };
  const le1 = Math.hypot(e1.x, e1.y, e1.z) || 1e-8; e1 = { x: e1.x / le1, y: e1.y / le1, z: e1.z / le1 };
  const e2 = { x: n.y * e1.z - n.z * e1.y, y: n.z * e1.x - n.x * e1.z, z: n.x * e1.y - n.y * e1.x };
  let ox = 0, oy = 0, oz = 0, k = 0;
  for (const vid of is.verts) { const p = mesh.vertices.find(v => v.id === vid)!.position; ox += p.x; oy += p.y; oz += p.z; k++; }
  ox /= k; oy /= k; oz /= k;
  for (const vid of is.verts) {
    const vert = mesh.vertices.find(v => v.id === vid)!; const p = vert.position;
    const vx = p.x - ox, vy = p.y - oy, vz = p.z - oz;
    vert.uv = { x: vx * e1.x + vy * e1.y + vz * e1.z, y: vx * e2.x + vy * e2.y + vz * e2.z };
  }
}

export function smartUVProject(mesh: Mesh, opts: SmartUVOptions) {
  // preserve seam flags by positions
  const vById0 = new Map(mesh.vertices.map(v => [v.id, v] as const));
  const seamPosKeys = new Set<string>();
  for (const e of mesh.edges) if (e.seam) {
    const va = vById0.get(e.vertexIds[0])!; const vb = vById0.get(e.vertexIds[1])!;
    seamPosKeys.add(edgePosKey(va, vb));
  }

  const angleLimitRad = (Math.max(0.1, opts.angleLimitDeg || 66) * Math.PI) / 180;
  const allIslands = computeIslandsByAngle(mesh, angleLimitRad);
  const hasSelection = !!(opts.selection && opts.selection.size);
  const islands = hasSelection ? allIslands.filter(is => Array.from(is.verts).some(v => opts.selection!.has(v))) : allIslands;

  const vById = new Map(mesh.vertices.map(v => [v.id, v] as const));
  const facesById = new Map(mesh.faces.map(f => [f.id, f] as const));

  // duplicate shared vertices across chosen islands
  const vertexIslandUse = new Map<string, number[]>();
  islands.forEach((is, idx) => { for (const vid of is.verts) { const arr = vertexIslandUse.get(vid) ?? []; arr.push(idx); vertexIslandUse.set(vid, arr); } });
  const islandVertexMap = new Map<string, string>();
  for (const [vid, uses] of vertexIslandUse) {
    if (uses.length <= 1) { islandVertexMap.set(`${vid}|${uses[0]}`, vid); continue; }
    islandVertexMap.set(`${vid}|${uses[0]}`, vid);
    const base = vById.get(vid)!;
    for (let i = 1; i < uses.length; i++) {
      const idx = uses[i];
      const clone: Vertex = { id: nanoid(), position: { ...base.position }, normal: { ...base.normal }, uv: { ...base.uv }, selected: base.selected };
      mesh.vertices.push(clone);
      islandVertexMap.set(`${vid}|${idx}`, clone.id);
      const is = islands[idx];
      for (const fid of is.faceIds) { const f = facesById.get(fid)!; const pos = f.vertexIds.indexOf(vid); if (pos >= 0) f.vertexIds[pos] = clone.id; }
    }
  }
  islands.forEach((is, idx) => { const next = new Set<string>(); for (const vid of is.verts) next.add(islandVertexMap.get(`${vid}|${idx}`) ?? vid); is.verts = next; });

  const curvedThreshold = Math.max(0.05, angleLimitRad * 0.5);
  const perFaceIslands: Island[] = [];
  const keepIslands: Island[] = [];
  const facesNeedingSplit = new Set<string>();
  for (const is of islands) { const curv = islandCurvature(mesh, is); if (curv > curvedThreshold) is.faceIds.forEach(fid => facesNeedingSplit.add(fid)); else keepIslands.push(is); }

  if (facesNeedingSplit.size) {
    const vUse = new Map<string, string[]>();
    for (const f of mesh.faces) if (facesNeedingSplit.has(f.id)) {
      for (const vid of f.vertexIds) { const arr = vUse.get(vid) ?? []; arr.push(f.id); vUse.set(vid, arr); }
    }
    for (const [vid, usedBy] of vUse) {
      const base = vById.get(vid)!;
      for (let i = 1; i < usedBy.length; i++) {
        const fid = usedBy[i];
        const clone: Vertex = { id: nanoid(), position: { ...base.position }, normal: { ...base.normal }, uv: { ...base.uv }, selected: base.selected };
        mesh.vertices.push(clone);
        const face = facesById.get(fid)!; const idx = face.vertexIds.indexOf(vid); if (idx >= 0) face.vertexIds[idx] = clone.id;
      }
    }

    for (const fid of facesNeedingSplit) {
      const f = facesById.get(fid)!; if (f.vertexIds.length < 3) continue;
      const a = mesh.vertices.find(v => v.id === f.vertexIds[0])!;
      const b = mesh.vertices.find(v => v.id === f.vertexIds[1])!;
      const c = mesh.vertices.find(v => v.id === f.vertexIds[2])!;
      const e1n = { x: b.position.x - a.position.x, y: b.position.y - a.position.y, z: b.position.z - a.position.z };
      const l1 = Math.hypot(e1n.x, e1n.y, e1n.z) || 1e-8; const e1 = { x: e1n.x / l1, y: e1n.y / l1, z: e1n.z / l1 };
      const ab = { x: c.position.x - a.position.x, y: c.position.y - a.position.y, z: c.position.z - a.position.z };
      let n = { x: e1.y * ab.z - e1.z * ab.y, y: e1.z * ab.x - e1.x * ab.z, z: e1.x * ab.y - e1.y * ab.x };
      const ln = Math.hypot(n.x, n.y, n.z) || 1e-8; n = { x: n.x / ln, y: n.y / ln, z: n.z / ln };
      const e2 = { x: n.y * e1.z - n.z * e1.y, y: n.z * e1.x - n.x * e1.z, z: n.x * e1.y - n.y * e1.x };
      const o = a.position;
      for (const vid of f.vertexIds) {
        const p = mesh.vertices.find(v => v.id === vid)!.position;
        const vx = p.x - o.x, vy = p.y - o.y, vz = p.z - o.z;
        const u = vx * e1.x + vy * e1.y + vz * e1.z;
        const v = vx * e2.x + vy * e2.y + vz * e2.z;
        const vert = mesh.vertices.find(vxv => vxv.id === vid)!; vert.uv = { x: u, y: v };
      }
      perFaceIslands.push({ faceIds: [fid], verts: new Set(f.vertexIds) });
    }
  }

  for (const is of keepIslands) projectIslandPlanar(mesh, is);

  if (opts.correctAspect) {
    // placeholder for future texture aspect correction
  }

  if (hasSelection) {
    const selectionIslands: Island[] = [];
    for (const is of perFaceIslands) { if (Array.from(is.verts).some(v => opts.selection!.has(v))) selectionIslands.push(is); }
    for (const is of keepIslands) selectionIslands.push(is);
    packIslandsSmart(mesh, selectionIslands, opts);
  } else {
    const whole: Island[] = [];
    for (const is of keepIslands) whole.push(is);
    for (const is of perFaceIslands) whole.push(is);
    packIslandsSmart(mesh, whole, opts);
  }

  const newEdges = buildEdgesFromFaces(mesh.vertices, mesh.faces);
  for (const e of newEdges) {
    const a = mesh.vertices.find(v => v.id === e.vertexIds[0])!;
    const b = mesh.vertices.find(v => v.id === e.vertexIds[1])!;
    e.seam = seamPosKeys.has(edgePosKey(a, b));
  }
  mesh.edges = newEdges;
}

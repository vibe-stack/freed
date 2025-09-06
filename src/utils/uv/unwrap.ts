import type { Mesh, Face, Vertex } from '@/types/geometry';
import type { Island } from './types';

// Local helpers
const edgeKey = (a: string, b: string) => (a < b ? `${a}-${b}` : `${b}-${a}`);

function unwrapQuadIsland(mesh: Mesh, island: Island, faces: Face[], vmap: Map<string, Vertex>) {
  if (faces.length === 0) return;

  if (faces.length === 1) {
    const face = faces[0];
  face.uvs = face.vertexIds.map((_, i) => ({ x: (i === 1 || i === 2) ? 1 : 0, y: (i === 2 || i === 3) ? 1 : 0 }));
    return;
  }

  let offsetX = 0;
  for (let fi = 0; fi < faces.length; fi++) {
    const face = faces[fi];
  face.uvs = face.vertexIds.map((_, i) => ({ x: ((i === 1 || i === 2) ? 1 : 0) + offsetX, y: (i === 2 || i === 3) ? 1 : 0 }));
    offsetX += 1.1;
  }
}

export function unwrapIsland(mesh: Mesh, island: Island) {
  const vmap = new Map(mesh.vertices.map(v => [v.id, v] as const));
  const faces = mesh.faces.filter(f => island.faceIds.includes(f.id));
  if (!faces.length) return;

  if (faces.every(f => f.vertexIds.length === 4)) {
    unwrapQuadIsland(mesh, island, faces, vmap);
    return;
  }

  // Triangulate
  const tris: Array<[string, string, string]> = [];
  for (let fi = 0; fi < faces.length; fi++) {
    const ids = faces[fi].vertexIds;
    if (ids.length === 3) tris.push([ids[0], ids[1], ids[2]]);
    else if (ids.length > 3) {
      for (let i = 1; i < ids.length - 1; i++) tris.push([ids[0], ids[i], ids[i + 1]]);
    }
  }
  if (!tris.length) return;

  // geometry utilities
  const dist3 = (a: string, b: string) => {
    const pa = vmap.get(a)!.position, pb = vmap.get(b)!.position;
    return Math.hypot(pa.x - pb.x, pa.y - pb.y, pa.z - pb.z);
  };
  const triArea3 = (t: [string, string, string]) => {
    const a = vmap.get(t[0])!.position, b = vmap.get(t[1])!.position, c = vmap.get(t[2])!.position;
    const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
    const acx = c.x - a.x, acy = c.y - a.y, acz = c.z - a.z;
    const cx = aby * acz - abz * acy;
    const cy = abz * acx - abx * acz;
    const cz = abx * acy - aby * acx;
    return 0.5 * Math.hypot(cx, cy, cz);
  };

  // edge->tri adjacency
  const edgeToTris = new Map<string, number[]>();
  for (let ti = 0; ti < tris.length; ti++) {
    const t = tris[ti];
    const e0 = edgeKey(t[0], t[1]);
    const e1 = edgeKey(t[1], t[2]);
    const e2 = edgeKey(t[2], t[0]);
    let arr = edgeToTris.get(e0); if (!arr) edgeToTris.set(e0, (arr = [])); arr.push(ti);
    arr = edgeToTris.get(e1); if (!arr) edgeToTris.set(e1, (arr = [])); arr.push(ti);
    arr = edgeToTris.get(e2); if (!arr) edgeToTris.set(e2, (arr = [])); arr.push(ti);
  }

  // seed = largest area
  let seedIndex = 0, bestArea = -1;
  for (let i = 0; i < tris.length; i++) {
    const a = triArea3(tris[i]);
    if (a > bestArea) { bestArea = a; seedIndex = i; }
  }

  const uvs = new Map<string, { x: number; y: number }>();
  const placedTri = new Uint8Array(tris.length); // 0/1 flags, more compact

  const placeSeed = (ti: number) => {
    const [a, b, c] = tris[ti];
    const pa = vmap.get(a)!.position, pb = vmap.get(b)!.position, pc = vmap.get(c)!.position;
    const cx = (pa.x + pb.x + pc.x) / 3;
    const cy = (pa.y + pb.y + pc.y) / 3;
    const cz = (pa.z + pb.z + pc.z) / 3;
    const dA = Math.hypot(pa.x - cx, pa.y - cy, pa.z - cz);
    const dB = Math.hypot(pb.x - cx, pb.y - cy, pb.z - cz);
    const dC = Math.hypot(pc.x - cx, pc.y - cy, pc.z - cz);
    if (dA <= dB && dA <= dC) {
      uvs.set(a, { x: 0, y: 0 });
      const lab = dist3(a, b); const lac = dist3(a, c);
      uvs.set(b, { x: lab, y: 0 });
      const bc = dist3(b, c);
      const x = (lac * lac - bc * bc + lab * lab) / (2 * lab);
      const h2 = Math.max(0, lac * lac - x * x);
      uvs.set(c, { x, y: Math.sqrt(h2) });
    } else if (dB <= dA && dB <= dC) {
      uvs.set(b, { x: 0, y: 0 });
      const lba = dist3(b, a); const lbc = dist3(b, c);
      uvs.set(a, { x: lba, y: 0 });
      const ac = dist3(a, c);
      const x = (lbc * lbc - ac * ac + lba * lba) / (2 * lba);
      const h2 = Math.max(0, lbc * lbc - x * x);
      uvs.set(c, { x, y: Math.sqrt(h2) });
    } else {
      uvs.set(c, { x: 0, y: 0 });
      const lca = dist3(c, a); const lcb = dist3(c, b);
      uvs.set(a, { x: lca, y: 0 });
      const ab = dist3(a, b);
      const x = (lcb * lcb - ab * ab + lca * lca) / (2 * lca);
      const h2 = Math.max(0, lcb * lcb - x * x);
      uvs.set(b, { x, y: Math.sqrt(h2) });
    }
    placedTri[ti] = 1;
  };

  placeSeed(seedIndex);

  const orient2 = (p: { x: number; y: number }, q: { x: number; y: number }, r: { x: number; y: number }) =>
    (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);

  const q: number[] = [seedIndex];
  const inQueue = new Uint8Array(tris.length); inQueue[seedIndex] = 1;
  const pushNeighbors = (ti: number) => {
    const [a, b, c] = tris[ti];
    const edges: Array<[string, string]> = [[a, b], [b, c], [c, a]];
    for (let i = 0; i < 3; i++) {
      const u = edges[i][0], v = edges[i][1];
      const neigh = edgeToTris.get(edgeKey(u, v));
      if (!neigh) continue;
      for (let k = 0; k < neigh.length; k++) {
        const ni = neigh[k];
        if (!placedTri[ni] && !inQueue[ni]) { q.push(ni); inQueue[ni] = 1; }
      }
    }
  };
  pushNeighbors(seedIndex);

  while (q.length) {
    const ti = q.shift()!;
    const t = tris[ti];
    const candidates: Array<{ u: string; v: string; w: string }> = [
      { u: t[0], v: t[1], w: t[2] },
      { u: t[1], v: t[2], w: t[0] },
      { u: t[2], v: t[0], w: t[1] },
    ];
    let placed = false;
    for (let ci = 0; ci < 3 && !placed; ci++) {
      const ed = candidates[ci];
      const U = uvs.get(ed.u); const V = uvs.get(ed.v);
      if (!U || !V) continue;
      const dx = V.x - U.x, dy = V.y - U.y;
      const L = Math.hypot(dx, dy) || 1e-8;
      const dUw = dist3(ed.u, ed.w);
      const dVw = dist3(ed.v, ed.w);
      const a = (dUw * dUw - dVw * dVw + L * L) / (2 * L);
      const h2 = Math.max(0, dUw * dUw - a * a);
      const h = Math.sqrt(h2);
      const ex = dx / L, ey = dy / L;
      const px = -ey, py = ex;
      const cand1 = { x: U.x + a * ex + h * px, y: U.y + a * ey + h * py };
      const cand2 = { x: U.x + a * ex - h * px, y: U.y + a * ey - h * py };

      const Pu = vmap.get(ed.u)!.position; const Pv = vmap.get(ed.v)!.position; const Pw = vmap.get(ed.w)!.position;
      const e3x = Pv.x - Pu.x, e3y = Pv.y - Pu.y, e3z = Pv.z - Pu.z;
      const w3x = Pw.x - Pu.x, w3y = Pw.y - Pu.y, w3z = Pw.z - Pu.z;
      const cx = e3y * w3z - e3z * w3y;
      const cy = e3z * w3x - e3x * w3z;
      const cz = e3x * w3y - e3y * w3x;
      const s3 = Math.sign(cx + cy + cz) || 1;
      const s2_1 = Math.sign(orient2(U, V, cand1)) || 1;
      const pick = (s3 === s2_1) ? cand1 : cand2;
      uvs.set(ed.w, pick);
      placedTri[ti] = 1; placed = true;
    }
    if (placed) pushNeighbors(ti);
    else if (!inQueue[ti]) { q.push(ti); inQueue[ti] = 1; }
  }

  // Fallback: planar projection approximated by dominant normal (cheap)
  if (uvs.size < island.verts.size) {
    let nx = 0, ny = 0, nz = 0;
    for (let fi = 0; fi < faces.length; fi++) {
      const ids = faces[fi].vertexIds; if (ids.length < 3) continue;
      const a = vmap.get(ids[0])!.position, b = vmap.get(ids[1])!.position, c = vmap.get(ids[2])!.position;
      const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
      const acx = c.x - a.x, acy = c.y - a.y, acz = c.z - a.z;
      nx += aby * acz - abz * acy;
      ny += abz * acx - abx * acz;
      nz += abx * acy - aby * acx;
    }
    const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz);
    const useZ = az >= ax && az >= ay, useY = !useZ && ay >= ax;
    for (const vid of island.verts) if (!uvs.has(vid)) {
      const p = vmap.get(vid)!.position;
      const uv = useZ ? { x: p.x, y: p.y } : useY ? { x: p.x, y: p.z } : { x: p.z, y: p.y };
      uvs.set(vid, uv);
    }
  }

  // Assign per-face loop UVs duplicating vertex UV per loop
  for (const face of faces) {
    face.uvs = face.vertexIds.map(vid => {
      const uv = uvs.get(vid)!; return { x: uv.x, y: uv.y };
    });
  }
}

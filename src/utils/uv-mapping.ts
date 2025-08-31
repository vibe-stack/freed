import { Mesh, Vector2, Face, Vertex } from '@/types/geometry';
import { buildEdgesFromFaces, calculateVertexNormals } from '@/utils/geometry';
import { nanoid } from 'nanoid';

export type Axis = 'x' | 'y' | 'z';

export function fitUVs01(mesh: Mesh, vertexIds?: Set<string>) {
  const verts = mesh.vertices.filter(v => !vertexIds || vertexIds.has(v.id));
  if (verts.length === 0) return;
  let minU = Infinity, minV = Infinity, maxU = -Infinity, maxV = -Infinity;
  for (const v of verts) {
    minU = Math.min(minU, v.uv.x); minV = Math.min(minV, v.uv.y);
    maxU = Math.max(maxU, v.uv.x); maxV = Math.max(maxV, v.uv.y);
  }
  const w = Math.max(1e-6, maxU - minU);
  const h = Math.max(1e-6, maxV - minV);
  for (const v of verts) {
    v.uv = { x: (v.uv.x - minU) / w, y: (v.uv.y - minV) / h };
  }
}

export function scaleOffsetUVs(mesh: Mesh, scale: Vector2, offset: Vector2 = { x: 0, y: 0 }, vertexIds?: Set<string>) {
  const verts = mesh.vertices.filter(v => !vertexIds || vertexIds.has(v.id));
  for (const v of verts) {
    v.uv = { x: v.uv.x * scale.x + offset.x, y: v.uv.y * scale.y + offset.y };
  }
}

export function planarProject(mesh: Mesh, axis: Axis = 'z', vertexIds?: Set<string>) {
  // Project positions to an axis-aligned plane to form UVs
  const verts = mesh.vertices.filter(v => !vertexIds || vertexIds.has(v.id));
  for (const v of verts) {
    const p = v.position;
    if (axis === 'z') {
      // Project to XY
      v.uv = { x: p.x, y: p.y };
    } else if (axis === 'y') {
      // Project to XZ
      v.uv = { x: p.x, y: p.z };
    } else {
      // axis === 'x' -> project to YZ
      v.uv = { x: p.z, y: p.y };
    }
  }
  // Normalize the affected set to 0..1
  fitUVs01(mesh, vertexIds);
}

export function sphereProject(mesh: Mesh, vertexIds?: Set<string>) {
  const verts = mesh.vertices.filter(v => !vertexIds || vertexIds.has(v.id));
  for (const v of verts) {
    const p = v.position;
    const r = Math.max(1e-6, Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z));
    const theta = Math.atan2(p.z, p.x); // -pi..pi
    const phi = Math.acos(Math.max(-1, Math.min(1, p.y / r))); // 0..pi
    v.uv = { x: (theta + Math.PI) / (2 * Math.PI), y: 1 - (phi / Math.PI) };
  }
}

export function cubeProject(mesh: Mesh, vertexIds?: Set<string>) {
  // Project each vertex onto the plane most aligned with its normal.
  // Then normalize the affected set to 0..1 to keep a single island.
  const verts = mesh.vertices.filter(v => !vertexIds || vertexIds.has(v.id));
  for (const v of verts) {
    const p = v.position;
    const n = v.normal || { x: 0, y: 0, z: 1 };
    const an = { x: Math.abs(n.x), y: Math.abs(n.y), z: Math.abs(n.z) };
    if (an.x >= an.y && an.x >= an.z) {
      // Project to YZ; flip U for consistent orientation if normal points negative X
      const u = n.x >= 0 ? p.z : -p.z;
      const w = p.y;
      v.uv = { x: u, y: w };
    } else if (an.y >= an.x && an.y >= an.z) {
      // Project to XZ; flip V for consistent orientation if normal points negative Y
      const u = p.x;
      const w = n.y >= 0 ? p.z : -p.z;
      v.uv = { x: u, y: w };
    } else {
      // Project to XY; flip U for consistent orientation if normal points negative Z
      const u = n.z >= 0 ? p.x : -p.x;
      const w = p.y;
      v.uv = { x: u, y: w };
    }
  }
  fitUVs01(mesh, vertexIds);
}

// --- Seam-based unwrap (simple professional baseline) ---

type Island = { faceIds: string[]; verts: Set<string> };

function buildEdgeKey(a: string, b: string) { return a < b ? `${a}-${b}` : `${b}-${a}`; }

// Quad-optimized unwrapping for simple cases like cubes
function unwrapQuadIsland(mesh: Mesh, island: Island, faces: Face[], vmap: Map<string, Vertex>) {
  if (faces.length === 0) return;
  
  // For single face, just fit to 0-1
  if (faces.length === 1) {
    const face = faces[0];
    const verts = face.vertexIds.map(id => vmap.get(id)!);
    // Simple planar projection then fit to 0-1
    for (let i = 0; i < verts.length; i++) {
      const u = i === 1 || i === 2 ? 1 : 0;
      const v = i === 2 || i === 3 ? 1 : 0;
      verts[i].uv = { x: u, y: v };
    }
    return;
  }
  
  // For multiple faces, place them in a row
  let offsetX = 0;
  for (const face of faces) {
    const verts = face.vertexIds.map(id => vmap.get(id)!);
    for (let i = 0; i < verts.length; i++) {
      const u = (i === 1 || i === 2 ? 1 : 0) + offsetX;
      const v = i === 2 || i === 3 ? 1 : 0;
      verts[i].uv = { x: u, y: v };
    }
    offsetX += 1.1; // Add spacing between faces
  }
}

// Split faces into islands by cutting where edge.seam === true
function computeIslands(mesh: Mesh): Island[] {
  const adjacency = new Map<string, string[]>(); // faceId -> neighboring faceIds across non-seam edges
  
  // Build face-to-face adjacency: faces are connected if they share a non-seam edge
  for (const edge of mesh.edges) {
    if (edge.seam) continue; // Skip seam edges; boundary edges should not split islands by themselves
    // Connect these faces
    for (let i = 0; i < edge.faceIds.length; i++) {
      for (let j = 0; j < edge.faceIds.length; j++) {
        if (i === j) continue;
        const a = edge.faceIds[i], b = edge.faceIds[j];
        const arr = adjacency.get(a) ?? [];
        if (!arr.includes(b)) arr.push(b);
        adjacency.set(a, arr);
      }
    }
  }

  const visited = new Set<string>();
  const islands: Island[] = [];
  const facesById = new Map(mesh.faces.map(f => [f.id, f] as const));
  for (const face of mesh.faces) {
    if (visited.has(face.id)) continue;
    const queue = [face.id];
    visited.add(face.id);
    const islandFaces: string[] = [];
    const vset = new Set<string>();
    while (queue.length) {
      const f = queue.shift()!;
      islandFaces.push(f);
      const ff = facesById.get(f)!;
      ff.vertexIds.forEach(v => vset.add(v));
      const nbrs = adjacency.get(f) ?? [];
      for (const n of nbrs) if (!visited.has(n)) { visited.add(n); queue.push(n); }
    }
    islands.push({ faceIds: islandFaces, verts: vset });
  }
  return islands;
}

// For each island, flatten by unfolding faces (preserve quads, don't triangulate unnecessarily)
function unwrapIsland(mesh: Mesh, island: Island) {
  const vmap = new Map(mesh.vertices.map(v => [v.id, v] as const));
  const faces = mesh.faces.filter(f => island.faceIds.includes(f.id));
  
  if (faces.length === 0) return;
  
  // For simple cases like cube faces, use a more direct approach
  if (faces.every(f => f.vertexIds.length === 4)) {
    unwrapQuadIsland(mesh, island, faces, vmap);
    return;
  }

  // Triangulate faces into a list of triangles (vid triplets) preserving winding
  const tris: Array<[string, string, string]> = [];
  for (const f of faces) {
    const ids = f.vertexIds;
    if (ids.length === 3) tris.push([ids[0], ids[1], ids[2]]);
    else if (ids.length >= 4) {
      for (let i = 1; i < ids.length - 1; i++) tris.push([ids[0], ids[i], ids[i + 1]]);
    }
  }
  if (tris.length === 0) return;  // Helper: 3D distance and area
  const dist3 = (a: string, b: string) => {
    const pa = vmap.get(a)!.position, pb = vmap.get(b)!.position;
    return Math.hypot(pa.x - pb.x, pa.y - pb.y, pa.z - pb.z);
  };
  const triArea3 = (t: [string, string, string]) => {
    const a = vmap.get(t[0])!.position, b = vmap.get(t[1])!.position, c = vmap.get(t[2])!.position;
    const ab = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
    const ac = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z };
    const cx = ab.y * ac.z - ab.z * ac.y;
    const cy = ab.z * ac.x - ab.x * ac.z;
    const cz = ab.x * ac.y - ab.y * ac.x;
    return 0.5 * Math.hypot(cx, cy, cz);
  };

  // Build adjacency: edge key -> triangle indices
  const edgeKey = (a: string, b: string) => a < b ? `${a}-${b}` : `${b}-${a}`;
  const edgeToTris = new Map<string, number[]>();
  tris.forEach((t, ti) => {
    const e0 = edgeKey(t[0], t[1]);
    const e1 = edgeKey(t[1], t[2]);
    const e2 = edgeKey(t[2], t[0]);
    [e0, e1, e2].forEach(k => {
      const arr = edgeToTris.get(k) ?? [];
      arr.push(ti); edgeToTris.set(k, arr);
    });
  });

  // Seed triangle: largest area with centroid-based orientation
  let seedIndex = 0; let bestArea = -1;
  for (let i = 0; i < tris.length; i++) {
    const a = triArea3(tris[i]);
    if (a > bestArea) { bestArea = a; seedIndex = i; }
  }

  const uvs = new Map<string, { x: number; y: number }>();
  const placedTri = new Array<boolean>(tris.length).fill(false);

  const placeSeed = (ti: number) => {
    const [a, b, c] = tris[ti];
    const pa = vmap.get(a)!.position, pb = vmap.get(b)!.position, pc = vmap.get(c)!.position;
    const cx = (pa.x + pb.x + pc.x) / 3;
    const cy = (pa.y + pb.y + pc.y) / 3;
    const cz = (pa.z + pb.z + pc.z) / 3;
    const distA = Math.hypot(pa.x - cx, pa.y - cy, pa.z - cz);
    const distB = Math.hypot(pb.x - cx, pb.y - cy, pb.z - cz);
    const distC = Math.hypot(pc.x - cx, pc.y - cy, pc.z - cz);
    // Place vertex closest to centroid at origin
    if (distA <= distB && distA <= distC) {
      uvs.set(a, { x: 0, y: 0 });
      const lab = dist3(a, b); const lac = dist3(a, c);
      uvs.set(b, { x: lab, y: 0 });
      const x = (lac * lac - dist3(b, c) * dist3(b, c) + lab * lab) / (2 * lab);
      const h2 = Math.max(0, lac * lac - x * x);
      uvs.set(c, { x, y: Math.sqrt(h2) });
    } else if (distB <= distA && distB <= distC) {
      uvs.set(b, { x: 0, y: 0 });
      const lba = dist3(b, a); const lbc = dist3(b, c);
      uvs.set(a, { x: lba, y: 0 });
      const x = (lbc * lbc - dist3(a, c) * dist3(a, c) + lba * lba) / (2 * lba);
      const h2 = Math.max(0, lbc * lbc - x * x);
      uvs.set(c, { x, y: Math.sqrt(h2) });
    } else {
      uvs.set(c, { x: 0, y: 0 });
      const lca = dist3(c, a); const lcb = dist3(c, b);
      uvs.set(a, { x: lca, y: 0 });
      const x = (lcb * lcb - dist3(a, b) * dist3(a, b) + lca * lca) / (2 * lca);
      const h2 = Math.max(0, lcb * lcb - x * x);
      uvs.set(b, { x, y: Math.sqrt(h2) });
    }
    placedTri[ti] = true;
  };

  placeSeed(seedIndex);

  // BFS propagate (unchanged)
  const q: number[] = [seedIndex];
  const inQueue = new Array<boolean>(tris.length).fill(false);
  inQueue[seedIndex] = true;
  const pushNeighbors = (ti: number) => {
    const [a, b, c] = tris[ti];
    const edges: Array<[string, string]> = [[a, b], [b, c], [c, a]];
    for (const [u, v] of edges) {
      const neigh = edgeToTris.get(edgeKey(u, v)) || [];
  for (const ni of neigh) if (!placedTri[ni] && !inQueue[ni]) { q.push(ni); inQueue[ni] = true; }
    }
  };
  pushNeighbors(seedIndex);

  const orient2 = (p: {x: number; y: number}, q: {x: number; y: number}, r: {x: number; y: number}) => 
    (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);

  while (q.length) {
    const ti = q.shift()!;
    const [a, b, c] = tris[ti];
    const candidates: Array<[{u: string; v: string; w: string}, number]> = [
      [{ u: a, v: b, w: c }, 0],
      [{ u: b, v: c, w: a }, 1],
      [{ u: c, v: a, w: b }, 2],
    ];
    let placed = false;
    for (const [ed, _] of candidates) {
      const U = uvs.get(ed.u); const V = uvs.get(ed.v);
      if (!U || !V) continue;
      const L = Math.hypot(V.x - U.x, V.y - U.y) || 1e-8;
      const dUw = dist3(ed.u, ed.w);
      const dVw = dist3(ed.v, ed.w);
      const a = (dUw * dUw - dVw * dVw + L * L) / (2 * L);
      const h2 = Math.max(0, dUw * dUw - a * a);
      const h = Math.sqrt(h2);
      const ex = (V.x - U.x) / L, ey = (V.y - U.y) / L;
      const px = -ey, py = ex;
      const cand1 = { x: U.x + a * ex + h * px, y: U.y + a * ey + h * py };
      const cand2 = { x: U.x + a * ex - h * px, y: U.y + a * ey - h * py };
      const Pu = vmap.get(ed.u)!.position; const Pv = vmap.get(ed.v)!.position; const Pw = vmap.get(ed.w)!.position;
      const e3 = { x: Pv.x - Pu.x, y: Pv.y - Pu.y, z: Pv.z - Pu.z };
      const w3 = { x: Pw.x - Pu.x, y: Pw.y - Pu.y, z: Pw.z - Pu.z };
      const cx = e3.y * w3.z - e3.z * w3.y;
      const cy = e3.z * w3.x - e3.x * w3.z;
      const cz = e3.x * w3.y - e3.y * w3.x;
      const s3 = Math.sign(cx + cy + cz) || 1;
      const s2_1 = Math.sign(orient2(U, V, cand1)) || 1;
      const pick = (s3 === s2_1) ? cand1 : cand2;
      uvs.set(ed.w, pick);
      placedTri[ti] = true; placed = true; break;
    }
    if (placed) pushNeighbors(ti);
    else if (!inQueue[ti]) { q.push(ti); inQueue[ti] = true; }
  }

  // Fallback (unchanged)
  const fallback = () => {
    let nx = 0, ny = 0, nz = 0;
    for (const f of faces) {
      if (f.vertexIds.length < 3) continue;
      const a = vmap.get(f.vertexIds[0])!.position;
      const b = vmap.get(f.vertexIds[1])!.position;
      const c = vmap.get(f.vertexIds[2])!.position;
      const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
      const acx = c.x - a.x, acy = c.y - a.y, acz = c.z - a.z;
      const cx = aby * acz - abz * acy;
      const cy = abz * acx - abx * acz;
      const cz = abx * acy - aby * acx;
      nx += cx; ny += cy; nz += cz;
    }
    const an = { x: Math.abs(nx), y: Math.abs(ny), z: Math.abs(nz) };
    const axis: Axis = (an.z >= an.x && an.z >= an.y) ? 'z' : (an.y >= an.x ? 'y' : 'x');
  for (const vid of island.verts) if (!uvs.has(vid)) {
      const p = vmap.get(vid)!.position;
      if (axis === 'z') uvs.set(vid, { x: p.x, y: p.y });
      else if (axis === 'y') uvs.set(vid, { x: p.x, y: p.z });
      else uvs.set(vid, { x: p.z, y: p.y });
    }
  };
  fallback();

  // Write back UVs
  for (const vid of island.verts) {
    const uv = uvs.get(vid)!;
    vmap.get(vid)!.uv = { x: uv.x, y: uv.y };
  }
}

function packIslands01(mesh: Mesh, islands: Island[], padding = 0.02) {
  // Normalize each island's UVs to its own 0-1 box before packing
  for (const is of islands) {
    fitUVs01(mesh, is.verts);
  }

  // Now pack these normalized islands
  packShelfLayout(mesh, islands, padding);
}

function packShelfLayout(mesh: Mesh, islands: Island[], padding = 0.02) {
  // Compute bbox per island
  type BBox = { island: Island; min: Vector2; max: Vector2; size: Vector2 };
  const bbox: BBox[] = [];
  for (const is of islands) {
    let minU = Infinity, minV = Infinity, maxU = -Infinity, maxV = -Infinity;
    for (const vid of is.verts) {
      const uv = mesh.vertices.find(v => v.id === vid)!.uv;
      if (uv.x < minU) minU = uv.x; if (uv.y < minV) minV = uv.y;
      if (uv.x > maxU) maxU = uv.x; if (uv.y > maxV) maxV = uv.y;
    }
    bbox.push({ island: is, min: { x: minU, y: minV }, max: { x: maxU, y: maxV }, size: { x: Math.max(1e-6, maxU - minU), y: Math.max(1e-6, maxV - minV) } });
  }

  if (bbox.length === 0) return;

  // Binary search for the largest scale that fits with padding
  const canPack = (s: number, bboxes: BBox[]) => {
    const sorted = [...bboxes].sort((a, b) => b.size.y * s - a.size.y * s);
    let y = padding;
    let rowH = 0;
    let rowX = padding;
    for (const b of sorted) {
      const w = b.size.x * s;
      const h = b.size.y * s;
      if (rowX + w > 1 - padding) {
        y += rowH + padding;
        if (y + h > 1 - padding) return false;
        rowX = padding;
        rowH = h;
      } else {
        rowH = Math.max(rowH, h);
      }
      rowX += w + padding;
    }
    y += rowH + padding;
    return y <= 1;
  };

  let low = 0, high = 100;
  for (let it = 0; it < 50; it++) {
    const mid = (low + high) / 2;
    if (canPack(mid, bbox)) low = mid;
    else high = mid;
  }
  const scale = low;

  // Now apply the packing with this scale
  bbox.sort((a, b) => b.size.y * scale - a.size.y * scale);
  let y = padding;
  let rowH = 0;
  let rowX = padding;
  for (const b of bbox) {
    const w = b.size.x * scale;
    const h = b.size.y * scale;
    if (rowX + w > 1 - padding) {
      y += rowH + padding;
      rowX = padding;
      rowH = h;
    }
    const dx = rowX - b.min.x * scale;
    const dy = y - b.min.y * scale;
    for (const vid of b.island.verts) {
      const v = mesh.vertices.find(vv => vv.id === vid)!;
      v.uv = { x: v.uv.x * scale + dx, y: v.uv.y * scale + dy };
    }
    rowX += w + padding;
    rowH = Math.max(rowH, h);
  }
}

export function unwrapMeshBySeams(mesh: Mesh) {
  // Preserve existing seam flags keyed by endpoint positions
  const posKey = (v: Vertex) => `${v.position.x.toFixed(6)},${v.position.y.toFixed(6)},${v.position.z.toFixed(6)}`;
  const edgePosKey = (a: Vertex, b: Vertex) => {
    const ka = posKey(a), kb = posKey(b);
    return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
  };
  const vById = new Map(mesh.vertices.map(v => [v.id, v] as const));
  const seamPosKeys = new Set<string>();
  for (const e of mesh.edges) if (e.seam) {
    const va = vById.get(e.vertexIds[0])!; const vb = vById.get(e.vertexIds[1])!;
    seamPosKeys.add(edgePosKey(va, vb));
  }

  // Compute islands
  const islands = computeIslands(mesh);

  // Duplicate vertices used across multiple islands so each island has independent UVs
  const vertexIslandUse = new Map<string, number[]>(); // vid -> [islandIndex...]
  islands.forEach((is, idx) => {
    for (const vid of is.verts) {
      const arr = vertexIslandUse.get(vid) ?? [];
      arr.push(idx);
      vertexIslandUse.set(vid, arr);
    }
  });
  // Map of (vid, islandIndex) -> vid' (possibly original)
  const islandVertexMap = new Map<string, string>();
  const facesById = new Map(mesh.faces.map(f => [f.id, f] as const));
  for (const [vid, uses] of vertexIslandUse) {
    if (uses.length <= 1) {
      islandVertexMap.set(`${vid}|${uses[0]}`, vid);
      continue;
    }
    // Keep original for first, clone for others
    islandVertexMap.set(`${vid}|${uses[0]}`, vid);
    for (let i = 1; i < uses.length; i++) {
      const idx = uses[i];
      const base = vById.get(vid)!;
  const clone: Vertex = { id: nanoid(), position: { ...base.position }, normal: { ...base.normal }, uv: { ...base.uv }, selected: base.selected };
      mesh.vertices.push(clone);
      islandVertexMap.set(`${vid}|${idx}`, clone.id);
      // Update faces in island idx replacing vid by clone.id
      const is = islands[idx];
      for (const fid of is.faceIds) {
        const f = facesById.get(fid)!;
        const ni = f.vertexIds.indexOf(vid);
        if (ni >= 0) f.vertexIds[ni] = clone.id;
      }
    }
  }

  // Refresh each island's vertex set to reflect cloned vertices
  islands.forEach((is, idx) => {
    const next = new Set<string>();
    for (const vid of is.verts) {
  const mapped = islandVertexMap.get(`${vid}|${idx}`) ?? vid;
      next.add(mapped);
    }
    is.verts = next;
  });

  // Now unwrap each island independently (unique vertex ids per island)
  for (const is of islands) unwrapIsland(mesh, is);

  // Rebuild edges from faces and preserve seam flags by matching position key
  const newEdges = buildEdgesFromFaces(mesh.vertices, mesh.faces);
  for (const e of newEdges) {
    const a = mesh.vertices.find(v => v.id === e.vertexIds[0])!;
    const b = mesh.vertices.find(v => v.id === e.vertexIds[1])!;
    const key = edgePosKey(a, b);
    e.seam = seamPosKeys.has(key);
  }
  mesh.edges = newEdges;
  // Recompute vertex normals in-place to avoid swapping the array reference (which can break views)
  const recomputed = calculateVertexNormals(mesh);
  const byId = new Map(recomputed.map(v => [v.id, v.normal] as const));
  for (const v of mesh.vertices) {
    const nn = byId.get(v.id);
    if (nn) v.normal = nn;
  }

  // Pack resulting islands into 0..1
  packIslands01(mesh, islands);
}

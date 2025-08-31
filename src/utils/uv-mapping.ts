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

// Split faces into islands by cutting where edge.seam === true
function computeIslands(mesh: Mesh): Island[] {
  const adjacency = new Map<string, string[]>(); // faceId -> neighboring faceIds across non-seam edges
  const edgeByKey = new Map(mesh.edges.map(e => [buildEdgeKey(e.vertexIds[0], e.vertexIds[1]), e] as const));
  // Build adjacency via shared edges that are not seams
  const facesByVertexPair = new Map<string, string[]>();
  for (const face of mesh.faces) {
    const ids = face.vertexIds;
    for (let i = 0; i < ids.length; i++) {
      const a = ids[i]; const b = ids[(i + 1) % ids.length];
      const key = buildEdgeKey(a, b);
      const arr = facesByVertexPair.get(key) ?? [];
      arr.push(face.id);
      facesByVertexPair.set(key, arr);
    }
  }
  // Record neighbors across non-seam edges
  for (const [key, fids] of facesByVertexPair) {
    const e = edgeByKey.get(key);
    const isSeam = !!e?.seam;
    if (isSeam) continue;
    if (fids.length >= 2) {
      for (let i = 0; i < fids.length; i++) {
        for (let j = 0; j < fids.length; j++) {
          if (i === j) continue;
          const a = fids[i], b = fids[j];
          const arr = adjacency.get(a) ?? [];
          arr.push(b);
          adjacency.set(a, arr);
        }
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

// For each island, project via a best-fit plane using face normals average and PCA-ish axis
function unwrapIsland(mesh: Mesh, island: Island) {
  // Compute average normal from faces in island using geometry
  const faces = mesh.faces.filter(f => island.faceIds.includes(f.id));
  const vmap = new Map(mesh.vertices.map(v => [v.id, v] as const));
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
  const nl = Math.max(1e-6, Math.hypot(nx, ny, nz));
  const n = { x: nx / nl, y: ny / nl, z: nz / nl };
  // Build a tangent basis (u,v,n). Choose u as projection of world X unless degenerate, else Y
  const pick = (ax: {x:number;y:number;z:number}) => {
    // u = normalize(ax - dot(ax,n)*n)
    const dot = ax.x * n.x + ax.y * n.y + ax.z * n.z;
    let ux = ax.x - dot * n.x, uy = ax.y - dot * n.y, uz = ax.z - dot * n.z;
    const len = Math.hypot(ux, uy, uz) || 1;
    ux /= len; uy /= len; uz /= len;
    const vx = n.y * uz - n.z * uy;
    const vy = n.z * ux - n.x * uz;
    const vz = n.x * uy - n.y * ux;
    return { u: {x: ux, y: uy, z: uz}, v: {x: vx, y: vy, z: vz} };
  };
  let basis = pick({ x: 1, y: 0, z: 0 });
  if (!isFinite(basis.u.x)) basis = pick({ x: 0, y: 1, z: 0 });

  // Project all vertices in island to UVs using this basis; preserve relative positions only within island
  for (const vid of island.verts) {
    const p = vmap.get(vid)!.position;
    const u = p.x * basis.u.x + p.y * basis.u.y + p.z * basis.u.z;
    const v = p.x * basis.v.x + p.y * basis.v.y + p.z * basis.v.z;
    vmap.get(vid)!.uv = { x: u, y: v };
  }
  // Normalize island to local 0..1 for packing step later
  fitUVs01(mesh, island.verts);
}

// Pack islands into 0..1 with simple row packing
function packIslands01(mesh: Mesh, islands: Island[], padding = 0.02) {
  // Compute bbox per island
  const bbox: Array<{ island: Island; min: Vector2; max: Vector2; size: Vector2 }> = [];
  for (const is of islands) {
    let minU = Infinity, minV = Infinity, maxU = -Infinity, maxV = -Infinity;
    for (const vid of is.verts) {
      const uv = mesh.vertices.find(v => v.id === vid)!.uv;
      if (uv.x < minU) minU = uv.x; if (uv.y < minV) minV = uv.y;
      if (uv.x > maxU) maxU = uv.x; if (uv.y > maxV) maxV = uv.y;
    }
    bbox.push({ island: is, min: { x: minU, y: minV }, max: { x: maxU, y: maxV }, size: { x: Math.max(1e-6, maxU - minU), y: Math.max(1e-6, maxV - minV) } });
  }
  // Sort by height desc for better shelf packing
  bbox.sort((a, b) => b.size.y - a.size.y);
  const shelfHeightPad = (h: number) => h * (1 + padding) + padding;
  const scale = 1; // all islands pre-normalized to 0..1 individually
  let x = padding, y = padding, rowH = 0;
  for (const b of bbox) {
    const w = b.size.x * scale, h = b.size.y * scale;
    if (x + w + padding > 1) { x = padding; y += shelfHeightPad(rowH); rowH = 0; }
    // If overflow vertically, scale all down (fallback)
    if (y + h + padding > 1) {
      // Uniformly scale all UVs by 0.5 and restart simple pack once; avoid loops for now
      for (const v of mesh.vertices) v.uv = { x: v.uv.x * 0.5, y: v.uv.y * 0.5 };
      return packIslands01(mesh, islands, padding);
    }
    const dx = x - b.min.x;
    const dy = y - b.min.y;
    for (const vid of b.island.verts) {
      const v = mesh.vertices.find(vv => vv.id === vid)!;
      v.uv = { x: v.uv.x + dx, y: v.uv.y + dy };
    }
    x += w * (1 + padding) + padding;
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
  // Optionally refresh normals if topology changed at seams (positions unchanged; keep existing)
  mesh.vertices = calculateVertexNormals(mesh);

  // Pack resulting islands into 0..1
  packIslands01(mesh, islands);
}

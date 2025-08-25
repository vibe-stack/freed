import type { Mesh, Vertex } from '@/types/geometry';
import { Vector3 } from 'three/webgpu';

export type Falloff = 'smooth' | 'linear' | 'sharp';

export const falloffFn = (t: number, kind: Falloff) => {
  const x = Math.max(0, Math.min(1, 1 - t));
  if (kind === 'linear') return x;
  if (kind === 'sharp') return x * x;
  // smooth (ease in-out)
  return x * x * (3 - 2 * x);
};

export interface BrushContext {
  mesh: Mesh;
  hitLocal: Vector3; // local-space hit point
  radius: number; // world radius approximated to local by avg scale already
  strength: number; // 0..1 per sample
  falloff: Falloff;
  perVertexWorldScale: number; // avg |scale| used to scale world radius into local
  spatial?: SpatialIndex | null; // optional acceleration structure for radius queries
}

export function collectVerticesInRadius(mesh: Mesh, centerLocal: Vector3, radiusLocal: number, spatial?: SpatialIndex | null) {
  // If spatial index available, use it for near-O(k) queries
  if (spatial) return queryRadius(spatial, centerLocal, radiusLocal, mesh);
  const r2 = radiusLocal * radiusLocal;
  const within: Vertex[] = [];
  for (const v of mesh.vertices) {
    const dx = v.position.x - centerLocal.x;
    const dy = v.position.y - centerLocal.y;
    const dz = v.position.z - centerLocal.z;
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 <= r2) within.push(v);
  }
  return within;
}

// Spatial index: uniform grid for quick radius queries (built per stroke)
export interface SpatialIndex {
  cellSize: number;
  map: Map<string, number[]>; // key -> vertex indices
  positions: Vector3[];
}

export function buildSpatialIndex(mesh: Mesh, cellSize: number): SpatialIndex {
  const map = new Map<string, number[]>();
  const positions = mesh.vertices.map((v) => new Vector3(v.position.x, v.position.y, v.position.z));
  const keyFor = (p: Vector3) => `${Math.floor(p.x / cellSize)},${Math.floor(p.y / cellSize)},${Math.floor(p.z / cellSize)}`;
  positions.forEach((p, i) => {
    const k = keyFor(p);
    const arr = map.get(k) || [];
    arr.push(i);
    map.set(k, arr);
  });
  return { cellSize, map, positions };
}

export function queryRadius(index: SpatialIndex, center: Vector3, radius: number, mesh: Mesh): Vertex[] {
  const r = radius;
  const r2 = r * r;
  const min = new Vector3(center.x - r, center.y - r, center.z - r);
  const max = new Vector3(center.x + r, center.y + r, center.z + r);
  const minK = new Vector3(Math.floor(min.x / index.cellSize), Math.floor(min.y / index.cellSize), Math.floor(min.z / index.cellSize));
  const maxK = new Vector3(Math.floor(max.x / index.cellSize), Math.floor(max.y / index.cellSize), Math.floor(max.z / index.cellSize));
  const out: Vertex[] = [];
  for (let x = minK.x; x <= maxK.x; x++)
    for (let y = minK.y; y <= maxK.y; y++)
      for (let z = minK.z; z <= maxK.z; z++) {
        const key = `${x},${y},${z}`;
        const list = index.map.get(key);
        if (!list) continue;
        for (const i of list) {
          const v = mesh.vertices[i];
          const p = index.positions[i];
          const d2 = p.distanceToSquared(center);
          if (d2 <= r2) out.push(v);
        }
      }
  return out;
}

export function applySymmetry(p: Vector3, axis: 'x' | 'y' | 'z'): Vector3 {
  const q = p.clone();
  if (axis === 'x') q.x = -q.x; else if (axis === 'y') q.y = -q.y; else q.z = -q.z;
  return q;
}

export function brushDraw(ctx: BrushContext, out: Map<string, Vertex>) {
  // Displace along average normal of affected region
  const verts = collectVerticesInRadius(ctx.mesh, ctx.hitLocal, ctx.radius, ctx.spatial);
  if (verts.length === 0) return;
  let nx = 0, ny = 0, nz = 0;
  for (const v of verts) { nx += v.normal.x; ny += v.normal.y; nz += v.normal.z; }
  const n = new Vector3(nx, ny, nz).normalize();
  for (const v of verts) {
    const d = new Vector3(v.position.x - ctx.hitLocal.x, v.position.y - ctx.hitLocal.y, v.position.z - ctx.hitLocal.z).length();
  const w = falloffFn(d / ctx.radius, ctx.falloff) * ctx.strength;
  const delta = n.clone().multiplyScalar(w * 0.06);
    const prev = out.get(v.id) ?? v;
    out.set(v.id, { ...prev, position: { x: prev.position.x + delta.x, y: prev.position.y + delta.y, z: prev.position.z + delta.z } });
  }
}

export function brushInflate(ctx: BrushContext, out: Map<string, Vertex>, invert = false) {
  const verts = collectVerticesInRadius(ctx.mesh, ctx.hitLocal, ctx.radius, ctx.spatial);
  for (const v of verts) {
    const d = new Vector3(v.position.x - ctx.hitLocal.x, v.position.y - ctx.hitLocal.y, v.position.z - ctx.hitLocal.z).length();
    const w = falloffFn(d / ctx.radius, ctx.falloff) * ctx.strength * (invert ? -1 : 1);
    const n = new Vector3(v.normal.x, v.normal.y, v.normal.z).normalize();
  const delta = n.multiplyScalar(w * 0.08);
    const prev = out.get(v.id) ?? v;
    out.set(v.id, { ...prev, position: { x: prev.position.x + delta.x, y: prev.position.y + delta.y, z: prev.position.z + delta.z } });
  }
}

export function brushSmooth(ctx: BrushContext, out: Map<string, Vertex>) {
  // Simple Laplacian-like: move vertex towards average of neighbors within radius
  const verts = collectVerticesInRadius(ctx.mesh, ctx.hitLocal, ctx.radius, ctx.spatial);
  const neighborMap = new Map<string, Vector3>();
  const adj = new Map<string, Set<string>>();
  for (const e of ctx.mesh.edges) {
    const a = e.vertexIds[0], b = e.vertexIds[1];
    if (!adj.has(a)) adj.set(a, new Set());
    if (!adj.has(b)) adj.set(b, new Set());
    adj.get(a)!.add(b); adj.get(b)!.add(a);
  }
  const withinSet = new Set(verts.map(v => v.id));
  for (const v of verts) {
    const nbrs = adj.get(v.id);
    if (!nbrs || nbrs.size === 0) continue;
    let cx = 0, cy = 0, cz = 0; let count = 0;
    for (const nid of nbrs) {
      if (!withinSet.has(nid)) continue;
      const nv = ctx.mesh.vertices.find(vv => vv.id === nid)!;
      cx += nv.position.x; cy += nv.position.y; cz += nv.position.z; count++;
    }
    if (count > 0) neighborMap.set(v.id, new Vector3(cx / count, cy / count, cz / count));
  }
  for (const v of verts) {
    const avg = neighborMap.get(v.id);
    if (!avg) continue;
    const d = new Vector3(v.position.x - ctx.hitLocal.x, v.position.y - ctx.hitLocal.y, v.position.z - ctx.hitLocal.z).length();
    const w = falloffFn(d / ctx.radius, ctx.falloff) * ctx.strength;
    const target = avg;
  const delta = target.sub(new Vector3(v.position.x, v.position.y, v.position.z)).multiplyScalar(w * 0.35);
    const prev = out.get(v.id) ?? v;
    out.set(v.id, { ...prev, position: { x: prev.position.x + delta.x, y: prev.position.y + delta.y, z: prev.position.z + delta.z } });
  }
}

export function brushPinch(ctx: BrushContext, out: Map<string, Vertex>, invert = false) {
  const verts = collectVerticesInRadius(ctx.mesh, ctx.hitLocal, ctx.radius, ctx.spatial);
  for (const v of verts) {
    const p = new Vector3(v.position.x, v.position.y, v.position.z);
    const d = p.distanceTo(ctx.hitLocal);
    const w = falloffFn(d / ctx.radius, ctx.falloff) * ctx.strength;
    const dir = ctx.hitLocal.clone().sub(p).normalize().multiplyScalar(invert ? -1 : 1);
  const delta = dir.multiplyScalar(w * 0.12);
    const prev = out.get(v.id) ?? v;
    out.set(v.id, { ...prev, position: { x: prev.position.x + delta.x, y: prev.position.y + delta.y, z: prev.position.z + delta.z } });
  }
}

export function brushGrab(ctx: BrushContext, out: Map<string, Vertex>, grabDeltaLocal: Vector3) {
  const verts = collectVerticesInRadius(ctx.mesh, ctx.hitLocal, ctx.radius, ctx.spatial);
  for (const v of verts) {
    const p = new Vector3(v.position.x, v.position.y, v.position.z);
    const d = p.distanceTo(ctx.hitLocal);
    const w = falloffFn(d / ctx.radius, ctx.falloff) * ctx.strength;
  const delta = grabDeltaLocal.clone().multiplyScalar(w);
    const prev = out.get(v.id) ?? v;
    out.set(v.id, { ...prev, position: { x: prev.position.x + delta.x, y: prev.position.y + delta.y, z: prev.position.z + delta.z } });
  }
}

// Plane helpers
function fitPlane(points: Vector3[]) {
  // Simple PCA-based plane along points: compute centroid and normal by covariance eigenvector (approx via cross sums)
  if (points.length < 3) return { center: new Vector3(), normal: new Vector3(0, 1, 0) };
  const c = points.reduce((a, p) => a.add(p), new Vector3()).multiplyScalar(1 / points.length);
  let xx = 0, xy = 0, xz = 0, yy = 0, yz = 0, zz = 0;
  for (const p of points) {
    const x = p.x - c.x, y = p.y - c.y, z = p.z - c.z;
    xx += x * x; xy += x * y; xz += x * z; yy += y * y; yz += y * z; zz += z * z;
  }
  // Normal is eigenvector of smallest eigenvalue; approximate with cross of principal directions using covariance
  // Use heuristic: cross of (1, a, b) and (a, 1, c) derived from off-diagonals
  const v1 = new Vector3(1, xy / (yy + 1e-8), xz / (zz + 1e-8));
  const v2 = new Vector3(xy / (xx + 1e-8), 1, yz / (zz + 1e-8));
  const n = new Vector3().crossVectors(v1, v2).normalize();
  if (!isFinite(n.lengthSq()) || n.lengthSq() < 1e-8) n.set(0, 1, 0);
  return { center: c, normal: n.normalize() };
}

export function brushFlatten(ctx: BrushContext, out: Map<string, Vertex>, inverse = false, planeOffset = 0) {
  const verts = collectVerticesInRadius(ctx.mesh, ctx.hitLocal, ctx.radius, ctx.spatial);
  const pts = verts.map(v => new Vector3(v.position.x, v.position.y, v.position.z));
  const { center, normal } = fitPlane(pts);
  const planePoint = center.clone().addScaledVector(normal, planeOffset * ctx.radius * 0.15);
  for (const v of verts) {
    const p = new Vector3(v.position.x, v.position.y, v.position.z);
    const d = p.distanceTo(ctx.hitLocal);
    const w = falloffFn(d / ctx.radius, ctx.falloff) * ctx.strength;
    // distance to plane signed
    const toP = p.clone().sub(planePoint);
    const dist = toP.dot(normal);
    const target = inverse ? p.clone().addScaledVector(normal, Math.sign(dist) * Math.abs(dist)) : p.clone().addScaledVector(normal, -dist);
  const delta = target.sub(p).multiplyScalar(w * 0.8);
    const prev = out.get(v.id) ?? v;
    out.set(v.id, { ...prev, position: { x: prev.position.x + delta.x, y: prev.position.y + delta.y, z: prev.position.z + delta.z } });
  }
}

export function brushFillDeepen(ctx: BrushContext, out: Map<string, Vertex>, deepen = false, planeOffset = 0) {
  const verts = collectVerticesInRadius(ctx.mesh, ctx.hitLocal, ctx.radius, ctx.spatial);
  const pts = verts.map(v => new Vector3(v.position.x, v.position.y, v.position.z));
  const { center, normal } = fitPlane(pts);
  const planePoint = center.clone().addScaledVector(normal, planeOffset * ctx.radius * 0.15);
  for (const v of verts) {
    const p = new Vector3(v.position.x, v.position.y, v.position.z);
    const d = p.distanceTo(ctx.hitLocal);
    const w = falloffFn(d / ctx.radius, ctx.falloff) * ctx.strength;
    const dist = p.clone().sub(planePoint).dot(normal);
    if (!deepen && dist < 0) {
      // below plane -> bring up
      const target = p.clone().addScaledVector(normal, -dist);
  const delta = target.sub(p).multiplyScalar(w * 0.8);
      const prev = out.get(v.id) ?? v;
      out.set(v.id, { ...prev, position: { x: prev.position.x + delta.x, y: prev.position.y + delta.y, z: prev.position.z + delta.z } });
    } else if (deepen && dist < 0) {
      // push further down
  const delta = normal.clone().multiplyScalar(-Math.abs(dist) * w * 0.6);
      const prev = out.get(v.id) ?? v;
      out.set(v.id, { ...prev, position: { x: prev.position.x + delta.x, y: prev.position.y + delta.y, z: prev.position.z + delta.z } });
    }
  }
}

export function brushScrapePeaks(ctx: BrushContext, out: Map<string, Vertex>, peaks = false, planeOffset = 0) {
  const verts = collectVerticesInRadius(ctx.mesh, ctx.hitLocal, ctx.radius, ctx.spatial);
  const pts = verts.map(v => new Vector3(v.position.x, v.position.y, v.position.z));
  const { center, normal } = fitPlane(pts);
  const planePoint = center.clone().addScaledVector(normal, planeOffset * ctx.radius * 0.15);
  for (const v of verts) {
    const p = new Vector3(v.position.x, v.position.y, v.position.z);
    const d = p.distanceTo(ctx.hitLocal);
    const w = falloffFn(d / ctx.radius, ctx.falloff) * ctx.strength;
    const dist = p.clone().sub(planePoint).dot(normal);
    if (!peaks && dist > 0) {
      // above plane -> bring down
      const target = p.clone().addScaledVector(normal, -dist);
  const delta = target.sub(p).multiplyScalar(w * 0.8);
      const prev = out.get(v.id) ?? v;
      out.set(v.id, { ...prev, position: { x: prev.position.x + delta.x, y: prev.position.y + delta.y, z: prev.position.z + delta.z } });
    } else if (peaks && dist > 0) {
      // push further up
  const delta = normal.clone().multiplyScalar(Math.abs(dist) * w * 0.6);
      const prev = out.get(v.id) ?? v;
      out.set(v.id, { ...prev, position: { x: prev.position.x + delta.x, y: prev.position.y + delta.y, z: prev.position.z + delta.z } });
    }
  }
}

export function brushBlob(ctx: BrushContext, out: Map<string, Vertex>, pinchAtEdge = 0.5) {
  const verts = collectVerticesInRadius(ctx.mesh, ctx.hitLocal, ctx.radius, ctx.spatial);
  for (const v of verts) {
    const p = new Vector3(v.position.x, v.position.y, v.position.z);
    const r = p.distanceTo(ctx.hitLocal) / ctx.radius;
    const pinch = Math.pow(Math.max(0, 1 - r), pinchAtEdge * 2);
    const w = falloffFn(r, ctx.falloff) * ctx.strength * pinch;
    const dir = p.clone().sub(ctx.hitLocal).normalize();
  const delta = dir.multiplyScalar(w * 0.18);
    const prev = out.get(v.id) ?? v;
    out.set(v.id, { ...prev, position: { x: prev.position.x + delta.x, y: prev.position.y + delta.y, z: prev.position.z + delta.z } });
  }
}

export function brushSnakeHook(ctx: BrushContext, out: Map<string, Vertex>, strokeDirLocal: Vector3, pinch = 0.5, rake = 0) {
  const verts = collectVerticesInRadius(ctx.mesh, ctx.hitLocal, ctx.radius, ctx.spatial);
  // Move along stroke and pinch to maintain volume, with optional rake (rotate normals following stroke)
  for (const v of verts) {
    const p = new Vector3(v.position.x, v.position.y, v.position.z);
    const r = p.distanceTo(ctx.hitLocal) / ctx.radius;
    const w = falloffFn(r, ctx.falloff) * ctx.strength;
    const pin = Math.pow(Math.max(0, 1 - r), pinch * 2);
  const move = strokeDirLocal.clone().multiplyScalar(w * 0.35);
  const toward = ctx.hitLocal.clone().sub(p).normalize().multiplyScalar(w * pin * 0.18);
    const delta = move.add(toward);
    const prev = out.get(v.id) ?? v;
    out.set(v.id, { ...prev, position: { x: prev.position.x + delta.x, y: prev.position.y + delta.y, z: prev.position.z + delta.z } });
  }
}

export function brushNudge(ctx: BrushContext, out: Map<string, Vertex>, strokeDirLocal: Vector3) {
  const verts = collectVerticesInRadius(ctx.mesh, ctx.hitLocal, ctx.radius, ctx.spatial);
  for (const v of verts) {
    const p = new Vector3(v.position.x, v.position.y, v.position.z);
    const d = p.distanceTo(ctx.hitLocal);
    const w = falloffFn(d / ctx.radius, ctx.falloff) * ctx.strength;
  const delta = strokeDirLocal.clone().multiplyScalar(w * 0.16);
    const prev = out.get(v.id) ?? v;
    out.set(v.id, { ...prev, position: { x: prev.position.x + delta.x, y: prev.position.y + delta.y, z: prev.position.z + delta.z } });
  }
}

export function brushRotate(ctx: BrushContext, out: Map<string, Vertex>, angle: number) {
  const verts = collectVerticesInRadius(ctx.mesh, ctx.hitLocal, ctx.radius, ctx.spatial);
  // rotate around brush center along camera-facing axis approximated by avg normal
  let nx = 0, ny = 0, nz = 0;
  for (const v of verts) { nx += v.normal.x; ny += v.normal.y; nz += v.normal.z; }
  const axis = new Vector3(nx, ny, nz).normalize();
  const s = Math.sin(angle), c = Math.cos(angle);
  for (const v of verts) {
    const p = new Vector3(v.position.x, v.position.y, v.position.z).sub(ctx.hitLocal);
    const d = p.length() / ctx.radius;
    const w = falloffFn(d, ctx.falloff) * ctx.strength;
    // Rodrigues rotation
    const rotated = p.clone().multiplyScalar(c).add(axis.clone().cross(p).multiplyScalar(s)).add(axis.clone().multiplyScalar(axis.dot(p) * (1 - c)));
  const delta = rotated.sub(p).multiplyScalar(w * 0.8);
    const prev = out.get(v.id) ?? v;
    out.set(v.id, { ...prev, position: { x: prev.position.x + delta.x, y: prev.position.y + delta.y, z: prev.position.z + delta.z } });
  }
}

export function brushSimplify(_ctx: BrushContext, _out: Map<string, Vertex>) {
  // Placeholder: requires dynamic topology; left as a no-op for now.
}

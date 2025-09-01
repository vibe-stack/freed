import type { Mesh, Vector2, Vertex, Face } from '@/types/geometry';
import type { Island } from './types';

export function fitUVs01(mesh: Mesh, vertexIds?: Set<string>) {
  const verts = vertexIds ? mesh.vertices.filter(v => vertexIds.has(v.id)) : mesh.vertices;
  if (!verts.length) return;
  let minU = Infinity, minV = Infinity, maxU = -Infinity, maxV = -Infinity;
  for (let i = 0; i < verts.length; i++) {
    const uv = verts[i].uv;
    if (uv.x < minU) minU = uv.x; if (uv.y < minV) minV = uv.y;
    if (uv.x > maxU) maxU = uv.x; if (uv.y > maxV) maxV = uv.y;
  }
  const w = Math.max(1e-6, maxU - minU);
  const h = Math.max(1e-6, maxV - minV);
  const invW = 1 / w, invH = 1 / h;
  for (let i = 0; i < verts.length; i++) {
    const v = verts[i];
    v.uv = { x: (v.uv.x - minU) * invW, y: (v.uv.y - minV) * invH };
  }
}

export function scaleOffsetUVs(mesh: Mesh, scale: Vector2, offset: Vector2 = { x: 0, y: 0 }, vertexIds?: Set<string>) {
  const verts = vertexIds ? mesh.vertices.filter(v => vertexIds.has(v.id)) : mesh.vertices;
  const sx = scale.x, sy = scale.y, ox = offset.x, oy = offset.y;
  for (let i = 0; i < verts.length; i++) {
    const v = verts[i];
    v.uv = { x: v.uv.x * sx + ox, y: v.uv.y * sy + oy };
  }
}

export function bboxForIsland(mesh: Mesh, island: Island) {
  let minU = Infinity, minV = Infinity, maxU = -Infinity, maxV = -Infinity;
  for (const vid of island.verts) {
    const v = mesh.vertices.find(x => x.id === vid)!;
    const uv = v.uv;
    if (uv.x < minU) minU = uv.x; if (uv.y < minV) minV = uv.y;
    if (uv.x > maxU) maxU = uv.x; if (uv.y > maxV) maxV = uv.y;
  }
  return { min: { x: minU, y: minV }, max: { x: maxU, y: maxV }, size: { x: Math.max(1e-6, maxU - minU), y: Math.max(1e-6, maxV - minV) } };
}

export function islandArea3D(mesh: Mesh, island: Island) {
  const vById = new Map(mesh.vertices.map(v => [v.id, v] as const));
  const faces = mesh.faces.filter(f => island.faceIds.includes(f.id));
  let area = 0;
  for (let fi = 0; fi < faces.length; fi++) {
    const ids = faces[fi].vertexIds;
    const n = ids.length;
    if (n < 3) continue;
    const a = vById.get(ids[0])!.position;
    for (let i = 1; i < n - 1; i++) {
      const b = vById.get(ids[i])!.position;
      const c = vById.get(ids[i + 1])!.position;
      const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
      const acx = c.x - a.x, acy = c.y - a.y, acz = c.z - a.z;
      const cx = aby * acz - abz * acy;
      const cy = abz * acx - abx * acz;
      const cz = abx * acy - aby * acx;
      area += 0.5 * Math.hypot(cx, cy, cz);
    }
  }
  return area;
}

export const posKey = (v: Vertex) => `${v.position.x.toFixed(6)},${v.position.y.toFixed(6)},${v.position.z.toFixed(6)}`;
export const edgePosKey = (a: Vertex, b: Vertex) => {
  const ka = posKey(a), kb = posKey(b);
  return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
};

export const buildEdgeKey = (a: string, b: string) => (a < b ? `${a}-${b}` : `${b}-${a}`);

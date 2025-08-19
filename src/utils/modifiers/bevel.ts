import { nanoid } from 'nanoid';
import type { Mesh, Vertex, Face, Vector3 } from '@/types/geometry';
import type { BevelModifierSettings } from './types';

type V3 = Vector3;
const sub = (a: V3, b: V3): V3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const add = (a: V3, b: V3): V3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const mul = (a: V3, s: number): V3 => ({ x: a.x * s, y: a.y * s, z: a.z * s });
const dot = (a: V3, b: V3): number => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: V3, b: V3): V3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const len = (a: V3): number => Math.sqrt(Math.max(0, dot(a, a)));
const norm = (a: V3): V3 => { const l = len(a) || 1; return { x: a.x / l, y: a.y / l, z: a.z / l }; };

function bevelOnce(
  mesh: Mesh,
  distance: number,
  angleDeg: number,
  miter: 'sharp'|'chamfer'|'arc',
  clampWidth: boolean,
  cullDegenerate: boolean,
): Mesh {
  if (distance <= 0) return mesh;
  const vMap = new Map(mesh.vertices.map(v => [v.id, v] as const));
  // Edge -> list of faces it belongs to
  const edgeFaces = new Map<string, string[]>();
  const edgeKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

  // For each face, compute inset vertices
  const insetId: Record<string, Record<string, string>> = {};
  // Track inset positions for ordering corner caps later
  const insetPos = new Map<string, V3>();
  // Per original vertex, collect the inset vertex produced by each adjacent face
  const vertexCorners = new Map<string, Array<{ faceId: string; insetId: string; pos: V3; fn: V3 }>>();
  // Track face normals for orientation decisions
  const faceNormal = new Map<string, V3>();
  const newVerts: Vertex[] = [];
  const facesInset: Face[] = [];

  for (const f of mesh.faces) {
    const n = f.vertexIds.length;
    if (n < 3) continue;
    const ids = f.vertexIds;
    const p0 = vMap.get(ids[0])!.position, p1 = vMap.get(ids[1])!.position, p2 = vMap.get(ids[2])!.position;
  const fn = norm(cross(sub(p1, p0), sub(p2, p0)));
  faceNormal.set(f.id, fn);
    const faceInsetIds: string[] = [];
    insetId[f.id] = insetId[f.id] ?? {};
    for (let i = 0; i < n; i++) {
      const prev = ids[(i - 1 + n) % n];
      const cur = ids[i];
      const next = ids[(i + 1) % n];
      const pv = vMap.get(prev)!.position;
      const cv = vMap.get(cur)!.position;
      const nv = vMap.get(next)!.position;
      const ePrev = norm(sub(cv, pv));
      const eNext = norm(sub(nv, cv));
      const pPrev = norm(cross(fn, ePrev));
      const pNext = norm(cross(fn, eNext));
      // Angle threshold: compute interior angle between -ePrev and eNext
      const cosA = Math.max(-1, Math.min(1, dot(mul(ePrev, -1), eNext)));
      const angleRad = Math.acos(cosA);
      const angle = angleRad * 180 / Math.PI;
      const bevelThisCorner = angle >= angleDeg;
      let newPos = { ...cv };
      if (bevelThisCorner) {
        // Compute local clamp based on adjacent edge lengths and interior angle
        const lenPrev = len(sub(cv, pv));
        const lenNext = len(sub(nv, cv));
        const sinHalf = Math.sin(Math.max(1e-6, angleRad / 2));
        const tMax = 0.49 * Math.min(lenPrev, lenNext) * sinHalf; // conservative safe inset
        const d = clampWidth ? Math.min(distance, tMax) : distance;
        let dir = norm(add(pPrev, pNext));
        if (miter === 'sharp') {
          // favor pPrev direction to keep a sharp corner bias
          dir = norm(add(mul(pPrev, 0.7), mul(pNext, 0.3)));
        } else if (miter === 'arc') {
          // move slightly further to mimic arc rounding
          dir = norm(add(pPrev, pNext));
          newPos = add(cv, mul(dir, d * 1.1));
        }
        if (miter !== 'arc') newPos = add(cv, mul(dir, d));
      }
      const id = nanoid();
      newVerts.push({ id, position: newPos, normal: { x: 0, y: 0, z: 0 }, uv: { ...vMap.get(cur)!.uv }, selected: false });
      insetId[f.id][cur] = id;
      insetPos.set(id, newPos);
      const arr = vertexCorners.get(cur) ?? [];
      arr.push({ faceId: f.id, insetId: id, pos: newPos, fn });
      vertexCorners.set(cur, arr);
      faceInsetIds.push(id);
    }
    facesInset.push({ id: nanoid(), vertexIds: faceInsetIds, normal: { x: 0, y: 0, z: 0 }, selected: false });

    // collect edge -> face
    for (let i = 0; i < n; i++) {
      const a = ids[i];
      const b = ids[(i + 1) % n];
      const key = edgeKey(a, b);
      const arr = edgeFaces.get(key) ?? [];
      arr.push(f.id);
      edgeFaces.set(key, arr);
    }
  }

  // Create edge strip quads between adjacent faces using their inset vertices
  const edgeStripFaces: Face[] = [];
  for (const [key, faces] of edgeFaces.entries()) {
    const [a, b] = key.split('|');
    if (faces.length === 2) {
      const f1 = faces[0], f2 = faces[1];
      const a1 = insetId[f1]?.[a];
      const b1 = insetId[f1]?.[b];
      const a2 = insetId[f2]?.[a];
      const b2 = insetId[f2]?.[b];
      if (a1 && b1 && a2 && b2) {
        // Choose winding to align with outward (avg) normal of the two faces
        const quad = [a1, b1, b2, a2];
        const pA1 = insetPos.get(a1)!, pB1 = insetPos.get(b1)!, pB2 = insetPos.get(b2)!;
        const nQuad = norm(cross(sub(pB1, pA1), sub(pB2, pB1)));
        const avg = norm(add(faceNormal.get(f1)!, faceNormal.get(f2)!));
        const ordered = dot(nQuad, avg) >= 0 ? quad : [...quad].reverse();
        edgeStripFaces.push({ id: nanoid(), vertexIds: ordered, normal: { x: 0, y: 0, z: 0 }, selected: false });
      }
    } else if (faces.length === 1) {
      // Boundary edge: connect inset edge to original edge to keep manifold
      const f1 = faces[0];
      const a1 = insetId[f1]?.[a];
      const b1 = insetId[f1]?.[b];
      if (a1 && b1) {
        edgeStripFaces.push({ id: nanoid(), vertexIds: [a1, b1, b, a], normal: { x: 0, y: 0, z: 0 }, selected: false });
      }
    }
  }

  // Corner caps: for each original vertex, stitch the adjacent inset vertices into a polygon
  const cornerFaces: Face[] = [];
  for (const [vid, items] of vertexCorners.entries()) {
    if (items.length < 3) continue; // no corner needed on boundaries or poles with <3 faces
    const vOrig = vMap.get(vid)!;
    // Average face normal to define local plane
    const avgN = norm(items.reduce((acc, it) => add(acc, it.fn), { x: 0, y: 0, z: 0 }));
    // Build tangent basis
    const refVecRaw = sub(items[0].pos, vOrig.position);
    const refProj = sub(refVecRaw, mul(avgN, dot(refVecRaw, avgN)));
    let t1 = len(refProj) > 1e-6 ? norm(refProj) : norm(cross(avgN, { x: 1, y: 0, z: 0 }));
    if (len(t1) < 1e-6) t1 = norm(cross(avgN, { x: 0, y: 1, z: 0 }));
    const t2 = norm(cross(avgN, t1));
    // Sort inset points around the vertex in CCW order relative to avgN
    const sorted = [...items].sort((ia, ib) => {
      const ra = sub(ia.pos, vOrig.position);
      const rb = sub(ib.pos, vOrig.position);
      const a = Math.atan2(dot(ra, t2), dot(ra, t1));
      const b = Math.atan2(dot(rb, t2), dot(rb, t1));
      return a - b;
    });
    let ids = sorted.map(s => s.insetId);
    if (ids.length >= 3) {
      const p0 = insetPos.get(ids[0])!, p1 = insetPos.get(ids[1])!, p2 = insetPos.get(ids[2])!;
      const nPoly = norm(cross(sub(p1, p0), sub(p2, p1)));
      if (dot(nPoly, avgN) < 0) ids = ids.reverse();
    }
    cornerFaces.push({ id: nanoid(), vertexIds: ids, normal: { x: 0, y: 0, z: 0 }, selected: false });
  }

  // Assemble mesh: include original vertices plus new inset vertices
  const vertices = [
    ...mesh.vertices.map(v => ({ ...v, position: { ...v.position }, normal: { ...v.normal }, uv: { ...v.uv } })),
    ...newVerts,
  ];
  let faces = [...facesInset, ...edgeStripFaces, ...cornerFaces];
  if (cullDegenerate) {
    const area = (ids: string[]): number => {
      if (ids.length < 3) return 0;
      const p0 = vMap.get(ids[0])!.position;
      let a = 0;
      for (let i = 1; i + 1 < ids.length; i++) {
        const p1 = vMap.get(ids[i])!.position;
        const p2 = vMap.get(ids[i + 1])!.position;
        const tri = cross(sub(p1, p0), sub(p2, p0));
        a += 0.5 * len(tri);
      }
      return a;
    };
    const EPS = 1e-9;
    faces = faces.filter(f => area(f.vertexIds) > EPS && new Set(f.vertexIds).size === f.vertexIds.length);
  }
  return { ...mesh, vertices, faces };
}

export function bevelModifier(mesh: Mesh, settings: BevelModifierSettings): Mesh {
  const segments = Math.max(1, Math.min(5, Math.floor(settings.segments ?? 1)));
  const width = Math.max(0, settings.width ?? 0.02);
  const miter = (settings.miter ?? 'chamfer') as 'sharp'|'chamfer'|'arc';
  const angleThreshold = Math.max(0, Math.min(180, settings.angleThreshold ?? 30));
  const clampWidth = settings.clampWidth !== false; // default true
  const cullDegenerate = settings.cullDegenerate !== false; // default true
  if (width === 0) return mesh;
  let cur = mesh;
  const step = width / segments;
  for (let i = 0; i < segments; i++) {
    cur = bevelOnce(cur, step, angleThreshold, miter, clampWidth, cullDegenerate);
  }
  return cur;
}

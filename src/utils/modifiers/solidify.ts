import type { Mesh, Vertex, Face, Vector3 } from '@/types/geometry';
import type { SolidifyModifierSettings } from './types';
import { nanoid } from 'nanoid';

type V3 = Vector3;
const sub = (a: V3, b: V3): V3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const cross = (a: V3, b: V3): V3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const dot = (a: V3, b: V3): number => a.x * b.x + a.y * b.y + a.z * b.z;
const len = (a: V3): number => Math.sqrt(Math.max(0, dot(a, a)));
const norm = (a: V3): V3 => { const l = len(a) || 1; return { x: a.x / l, y: a.y / l, z: a.z / l }; };

// Solidify: duplicate shell offset along vertex normals, flip inner faces, and stitch side walls along edges.
export function solidifyModifier(mesh: Mesh, settings: SolidifyModifierSettings): Mesh {
  const t = settings.thickness ?? 0.01;
  if (t === 0) return mesh;
  const outer = mesh.vertices.map(v => ({ ...v }));
  const innerIdMap = new Map<string, string>();
  const inner: Vertex[] = outer.map((v) => {
    const id = nanoid();
    innerIdMap.set(v.id, id);
    return {
      ...v,
      id,
      position: {
        x: v.position.x - v.normal.x * t,
        y: v.position.y - v.normal.y * t,
        z: v.position.z - v.normal.z * t,
      },
      selected: false,
    } as Vertex;
  });

  const innerFaces: Face[] = mesh.faces.map((f) => ({
    ...f,
    id: nanoid(),
    vertexIds: f.vertexIds.map((id) => innerIdMap.get(id)!).reverse(),
    selected: false,
  }));

  // Build unique edges and remember adjacent face normals
  const edgeKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const edgeFaces = new Map<string, { a: string; b: string; faceIds: string[] }>();
  const faceNormal = new Map<string, V3>();

  for (const f of mesh.faces) {
    const ids = f.vertexIds;
    const n = ids.length;
    if (n < 3) continue;
    // compute and cache face normal from geometry
    const p0 = mesh.vertices.find(v => v.id === ids[0])!.position;
    const p1 = mesh.vertices.find(v => v.id === ids[1])!.position;
    const p2 = mesh.vertices.find(v => v.id === ids[2])!.position;
    const fn = norm(cross(sub(p1, p0), sub(p2, p0)));
    faceNormal.set(f.id, fn);
    for (let i = 0; i < n; i++) {
      const a = ids[i];
      const b = ids[(i + 1) % n];
      const key = edgeKey(a, b);
      const rec = edgeFaces.get(key) ?? { a, b, faceIds: [] };
      rec.faceIds.push(f.id);
      edgeFaces.set(key, rec);
    }
  }

  // Create side wall quads between outer and inner along each unique edge
  const sideFaces: Face[] = [];
  const vById = new Map(mesh.vertices.map(v => [v.id, v] as const));
  const innerById = new Map(inner.map(v => [v.id, v] as const));
  const EPS = 1e-10;
  const getPos = (id: string) => (vById.get(id)?.position ?? innerById.get(id)!.position);
  for (const { a, b, faceIds } of edgeFaces.values()) {
    const aOut = a;
    const bOut = b;
    const aIn = innerIdMap.get(a)!;
    const bIn = innerIdMap.get(b)!;
    const quad = [aOut, bOut, bIn, aIn];
    // choose winding based on average adjacent face normal
    const pA = vById.get(aOut)!.position;
    const pB = vById.get(bOut)!.position;
    const pBI = innerById.get(bIn)!.position;
    const nQuad = norm(cross(sub(pB, pA), sub(pBI, pB)));
    const avg = norm(faceIds.reduce((acc, fid) => {
      const n = faceNormal.get(fid)!; return { x: acc.x + n.x, y: acc.y + n.y, z: acc.z + n.z };
    }, { x: 0, y: 0, z: 0 } as V3));
    const verts = dot(nQuad, avg) >= 0 ? quad : [...quad].reverse();
    // cull degenerate walls
    const area = (() => {
      const p0 = getPos(verts[0]);
      const p1b = getPos(verts[1]);
      const p2b = getPos(verts[2]);
      const p3b = getPos(verts[3]);
      // split into two tris
      const a1 = 0.5 * len(cross(sub(p1b, p0), sub(p2b, p0)));
      const a2 = 0.5 * len(cross(sub(p3b, p0), sub(p2b, p0)));
      return a1 + a2;
    })();
    if (area > EPS) {
      sideFaces.push({ id: nanoid(), vertexIds: verts, normal: { x: 0, y: 0, z: 0 }, selected: false });
    }
  }

  const vertices = [...outer, ...inner];
  const faces = [...mesh.faces, ...innerFaces, ...sideFaces];
  return { ...mesh, vertices, faces };
}

import { nanoid } from 'nanoid';
import type { Mesh, Vertex, Face, Vector3 } from '@/types/geometry';
import { buildEdgesFromFaces, calculateVertexNormals, convertQuadToTriangles } from '@/utils/geometry';

export type ModifierType = 'mirror' | 'subdivide';

export type MirrorAxis = 'x' | 'y' | 'z';

export interface MirrorModifierSettings {
  axis: MirrorAxis;
  merge?: boolean;
  mergeThreshold?: number; // world units
}

export interface SubdivideModifierSettings {
  level: number; // 1..3 typical
  smooth?: boolean; // apply Laplacian smoothing after subdivision
  smoothIterations?: number; // 0..5
  smoothStrength?: number; // 0..1 (lambda)
}

export type ModifierSettings =
  | { type: 'mirror'; value: MirrorModifierSettings }
  | { type: 'subdivide'; value: SubdivideModifierSettings };

export interface ModifierStackItem {
  id: string;
  type: ModifierType;
  enabled: boolean;
  // settings stored as simple object per type
  settings: any;
}

export const createDefaultSettings = (type: ModifierType): any => {
  switch (type) {
    case 'mirror':
      return { axis: 'x', merge: true, mergeThreshold: 0.0001 } as MirrorModifierSettings;
    case 'subdivide':
  return { level: 1, smooth: true, smoothIterations: 1, smoothStrength: 0.2 } as SubdivideModifierSettings;
    default:
      return {};
  }
};

export function applyModifiersToMesh(base: Mesh, stack: ModifierStackItem[]): Mesh {
  // Start from a shallow copy of base but with cloned topology arrays
  let cur: Mesh = {
    ...base,
    vertices: base.vertices.map(v => ({ ...v, position: { ...v.position }, normal: { ...v.normal }, uv: { ...v.uv } })),
    faces: base.faces.map(f => ({ ...f, vertexIds: [...f.vertexIds] })),
    edges: base.edges.slice(),
  };

  for (const item of stack) {
    if (!item.enabled) continue;
    switch (item.type) {
      case 'mirror':
        cur = mirrorModifier(cur, item.settings as MirrorModifierSettings);
        break;
      case 'subdivide':
        cur = subdivideModifier(cur, item.settings as SubdivideModifierSettings);
        break;
      default:
        break;
    }
  }

  // Rebuild edges and normals once at end for stability
  const edges = buildEdgesFromFaces(cur.vertices, cur.faces);
  const vertices = calculateVertexNormals({ ...cur, edges } as Mesh);
  return { ...cur, edges, vertices };
}

function mirrorModifier(mesh: Mesh, settings: MirrorModifierSettings): Mesh {
  const axis = settings.axis ?? 'x';
  const merge = settings.merge ?? true;
  const threshold = settings.mergeThreshold ?? 0.0001;

  const originalVertices = mesh.vertices;
  const mirroredMap = new Map<string, string>(); // original id -> mirrored id
  const vertices: Vertex[] = mesh.vertices.map(v => ({ ...v, position: { ...v.position }, normal: { ...v.normal }, uv: { ...v.uv } }));

  const mirrorCoord = (p: Vector3): Vector3 => {
    if (axis === 'x') return { x: -p.x, y: p.y, z: p.z };
    if (axis === 'y') return { x: p.x, y: -p.y, z: p.z };
    return { x: p.x, y: p.y, z: -p.z };
  };

  const coordValue = (p: Vector3) => (axis === 'x' ? p.x : axis === 'y' ? p.y : p.z);

  for (const v of originalVertices) {
    const p = v.position;
    // Optionally snap to plane
    const snapped: Vector3 = { ...p };
    if (merge && Math.abs(coordValue(snapped)) <= threshold) {
      if (axis === 'x') snapped.x = 0; else if (axis === 'y') snapped.y = 0; else snapped.z = 0;
    }
    // mirrored clone
    const mv: Vertex = {
      ...v,
      id: nanoid(),
      position: mirrorCoord(snapped),
      // normals will be recomputed later; copy now
      normal: { ...v.normal },
      uv: { ...v.uv },
      selected: false,
    };
    vertices.push(mv);
    mirroredMap.set(v.id, mv.id);
  }

  const faces: Face[] = mesh.faces.map(f => ({ ...f, vertexIds: [...f.vertexIds] }));
  // mirrored faces with reversed winding
  for (const f of mesh.faces) {
    const mirroredIds = f.vertexIds.map((id) => mirroredMap.get(id)!)
      .reverse();
    faces.push({ ...f, id: nanoid(), vertexIds: mirroredIds, selected: false });
  }

  return { ...mesh, vertices, faces };
}

function subdivideModifier(mesh: Mesh, settings: SubdivideModifierSettings): Mesh {
  const level = Math.min(Math.max(Math.floor(settings.level ?? 1), 1), 3);
  let cur: Mesh = mesh;
  for (let i = 0; i < level; i++) {
    cur = subdivideOnce(cur);
  }
  if (settings.smooth) {
    const iters = Math.min(Math.max(Math.floor(settings.smoothIterations ?? 1), 0), 5);
    const lambda = Math.min(Math.max(settings.smoothStrength ?? 0.2, 0), 1);
    if (iters > 0 && lambda > 0) {
      cur = laplacianSmooth(cur, iters, lambda);
    }
  }
  return cur;
}

function subdivideOnce(mesh: Mesh): Mesh {
  // Triangulate all faces first (supports quads)
  const triangles: { verts: string[] }[] = [];
  for (const f of mesh.faces) {
    const tris = convertQuadToTriangles(f.vertexIds);
    tris.forEach((tri) => triangles.push({ verts: tri }));
  }

  const vMap = new Map(mesh.vertices.map((v) => [v.id, v] as const));
  const newVertices: Vertex[] = mesh.vertices.map(v => ({ ...v, position: { ...v.position }, normal: { ...v.normal }, uv: { ...v.uv } }));
  const midpointCache = new Map<string, string>(); // key of pair -> vertexId

  const midpoint = (aId: string, bId: string): string => {
    const key = aId < bId ? `${aId}|${bId}` : `${bId}|${aId}`;
    const cached = midpointCache.get(key);
    if (cached) return cached;
    const a = vMap.get(aId)!; const b = vMap.get(bId)!;
    const id = nanoid();
    const v: Vertex = {
      id,
      position: {
        x: (a.position.x + b.position.x) / 2,
        y: (a.position.y + b.position.y) / 2,
        z: (a.position.z + b.position.z) / 2,
      },
      normal: { x: 0, y: 0, z: 0 },
      uv: { x: (a.uv.x + b.uv.x) / 2, y: (a.uv.y + b.uv.y) / 2 },
      selected: false,
    };
    newVertices.push(v);
    midpointCache.set(key, id);
    return id;
  };

  const newFaces: Face[] = [];
  for (const tri of triangles) {
    const [a, b, c] = tri.verts;
    const ab = midpoint(a, b);
    const bc = midpoint(b, c);
    const ca = midpoint(c, a);
    // 4 new tris
    newFaces.push(
      { id: nanoid(), vertexIds: [a, ab, ca], normal: { x: 0, y: 0, z: 0 }, selected: false },
      { id: nanoid(), vertexIds: [ab, b, bc], normal: { x: 0, y: 0, z: 0 }, selected: false },
      { id: nanoid(), vertexIds: [ca, bc, c], normal: { x: 0, y: 0, z: 0 }, selected: false },
      { id: nanoid(), vertexIds: [ab, bc, ca], normal: { x: 0, y: 0, z: 0 }, selected: false },
    );
  }

  return { ...mesh, vertices: newVertices, faces: newFaces };
}

function laplacianSmooth(mesh: Mesh, iterations: number, lambda: number): Mesh {
  // Build neighbor map (vertex id -> set of neighbor vertex ids)
  const neighbors = new Map<string, Set<string>>();
  const ensure = (id: string) => { if (!neighbors.has(id)) neighbors.set(id, new Set()); return neighbors.get(id)!; };
  for (const f of mesh.faces) {
    const ids = f.vertexIds;
    const n = ids.length;
    for (let i = 0; i < n; i++) {
      const a = ids[i];
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        ensure(a).add(ids[j]);
      }
    }
  }
  let curVerts = mesh.vertices.map(v => ({ ...v, position: { ...v.position }, normal: { ...v.normal }, uv: { ...v.uv } }));
  const vMapIndex = new Map(curVerts.map((v, idx) => [v.id, idx] as const));

  for (let it = 0; it < iterations; it++) {
    const nextPositions: { [id: string]: Vector3 } = {};
    for (const v of curVerts) {
      const nbrs = neighbors.get(v.id);
      if (!nbrs || nbrs.size === 0) { nextPositions[v.id] = { ...v.position }; continue; }
      let ax = 0, ay = 0, az = 0; let count = 0;
      for (const nid of nbrs) {
        const idx = vMapIndex.get(nid);
        if (idx === undefined) continue;
        const nv = curVerts[idx];
        ax += nv.position.x; ay += nv.position.y; az += nv.position.z; count++;
      }
      const inv = 1 / Math.max(1, count);
      const cx = ax * inv, cy = ay * inv, cz = az * inv;
      nextPositions[v.id] = {
        x: v.position.x + lambda * (cx - v.position.x),
        y: v.position.y + lambda * (cy - v.position.y),
        z: v.position.z + lambda * (cz - v.position.z),
      };
    }
    curVerts = curVerts.map(v => ({ ...v, position: nextPositions[v.id] }));
  }
  return { ...mesh, vertices: curVerts };
}

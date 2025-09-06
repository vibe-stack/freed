import { Vector3, Vector2, Vertex, Edge, Face, Mesh } from '../types/geometry';
import { nanoid } from 'nanoid';

// Vector utilities
export const vec3 = (x: number = 0, y: number = 0, z: number = 0): Vector3 => ({ x, y, z });
export const vec2 = (x: number = 0, y: number = 0): Vector2 => ({ x, y });

export const addVec3 = (a: Vector3, b: Vector3): Vector3 => ({
  x: a.x + b.x,
  y: a.y + b.y,
  z: a.z + b.z,
});

export const subtractVec3 = (a: Vector3, b: Vector3): Vector3 => ({
  x: a.x - b.x,
  y: a.y - b.y,
  z: a.z - b.z,
});

export const multiplyVec3 = (a: Vector3, scalar: number): Vector3 => ({
  x: a.x * scalar,
  y: a.y * scalar,
  z: a.z * scalar,
});

export const dotVec3 = (a: Vector3, b: Vector3): number => {
  return a.x * b.x + a.y * b.y + a.z * b.z;
};

export const crossVec3 = (a: Vector3, b: Vector3): Vector3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});

export const normalizeVec3 = (v: Vector3): Vector3 => {
  const length = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  if (length === 0) return { x: 0, y: 0, z: 0 };
  return multiplyVec3(v, 1 / length);
};

export const lengthVec3 = (v: Vector3): number => {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
};

// UV helpers for handling seam wrapping when duplicating pole/corner loops
const wrap01 = (u: number) => {
  u = u % 1; if (u < 0) u += 1; return u;
};
const adjustWrap = (uv: Vector2): Vector2 => ({ x: wrap01(uv.x), y: uv.y });

// Geometry creation utilities
export const createVertex = (
  position: Vector3,
  normal: Vector3 = vec3(0, 1, 0),
  uv: Vector2 = vec2(0, 0)
): Vertex => ({
  id: nanoid(),
  position,
  normal,
  uv,
  selected: false,
});

export const createEdge = (vertexId1: string, vertexId2: string): Edge => ({
  id: nanoid(),
  vertexIds: [vertexId1, vertexId2],
  faceIds: [],
  selected: false,
  seam: false,
});

export const createFace = (vertexIds: string[], uvs?: Vector2[]): Face => {
  if (vertexIds.length < 3) throw new Error('Face must have at least 3 vertices');
  if (uvs && uvs.length !== vertexIds.length) throw new Error('Face uvs length mismatch');
  return { id: nanoid(), vertexIds, normal: vec3(0, 1, 0), selected: false, uvs: uvs ? uvs.slice() : undefined };
};

// Geometry computation utilities
export const calculateFaceNormal = (face: Face, vertices: Vertex[]): Vector3 => {
  if (face.vertexIds.length < 3) return vec3(0, 1, 0);
  
  const vertexMap = new Map(vertices.map(v => [v.id, v]));
  const v0 = vertexMap.get(face.vertexIds[0]);
  const v1 = vertexMap.get(face.vertexIds[1]);
  const v2 = vertexMap.get(face.vertexIds[2]);
  
  if (!v0 || !v1 || !v2) return vec3(0, 1, 0);
  
  const edge1 = subtractVec3(v1.position, v0.position);
  const edge2 = subtractVec3(v2.position, v0.position);
  
  return normalizeVec3(crossVec3(edge1, edge2));
};

export const calculateVertexNormals = (mesh: Mesh): Vertex[] => {
  // Angle-weighted vertex normals for better smoothing at poles and valence anomalies
  const vertexNormals = new Map<string, Vector3>();
  mesh.vertices.forEach(v => vertexNormals.set(v.id, vec3(0, 0, 0)));

  const vmap = new Map(mesh.vertices.map(v => [v.id, v] as const));

  const addWeighted = (vid: string, n: Vector3, w: number) => {
    const cur = vertexNormals.get(vid)!;
    vertexNormals.set(vid, {
      x: cur.x + n.x * w,
      y: cur.y + n.y * w,
      z: cur.z + n.z * w,
    });
  };

  for (const face of mesh.faces) {
    if (face.vertexIds.length < 3) continue;
    // Triangulate polygon for angle computation
    const tris = (() => {
      const ids = face.vertexIds;
      if (ids.length === 3) return [ids as [string, string, string]];
      const res: [string, string, string][] = [];
      for (let i = 1; i < ids.length - 1; i++) res.push([ids[0], ids[i], ids[i + 1]]);
      return res;
    })();

    for (const [aId, bId, cId] of tris) {
      const a = vmap.get(aId)!; const b = vmap.get(bId)!; const c = vmap.get(cId)!;
      const ab = subtractVec3(b.position, a.position);
      const ac = subtractVec3(c.position, a.position);
      const bc = subtractVec3(c.position, b.position);
      const ba = subtractVec3(a.position, b.position);
      const ca = subtractVec3(a.position, c.position);
      const cb = subtractVec3(b.position, c.position);

  // Face normal (area-weighted by triangle area via unnormalized cross product)
  const fn = crossVec3(ab, ac);

      const angle = (u: Vector3, v: Vector3) => {
        const lu = Math.max(1e-12, lengthVec3(u));
        const lv = Math.max(1e-12, lengthVec3(v));
        const d = Math.max(-1, Math.min(1, dotVec3(u, v) / (lu * lv)));
        return Math.acos(d);
      };

      const wa = angle(ab, ac);
      const wb = angle(bc, ba);
      const wc = angle(ca, cb);

      addWeighted(aId, fn, wa);
      addWeighted(bId, fn, wb);
      addWeighted(cId, fn, wc);
    }
  }

  return mesh.vertices.map(v => ({ ...v, normal: normalizeVec3(vertexNormals.get(v.id) || vec3(0, 1, 0)) }));
};

// Edge generation from faces
export const buildEdgesFromFaces = (vertices: Vertex[], faces: Face[]): Edge[] => {
  const edges: Edge[] = [];
  const edgeMap = new Map<string, Edge>();
  faces.forEach(face => {
    const n = face.vertexIds.length;
    for (let i = 0; i < n; i++) {
      const v1 = face.vertexIds[i];
      const v2 = face.vertexIds[(i + 1) % n];
      const key = [v1, v2].sort().join('-');
      if (!edgeMap.has(key)) {
        const e = createEdge(v1, v2);
        e.faceIds.push(face.id);
        edges.push(e);
        edgeMap.set(key, e);
      } else {
        edgeMap.get(key)!.faceIds.push(face.id);
      }
    }
  });
  return edges;
};

// Primitive creation functions
export const buildCubeGeometry = (size: number = 1): BuiltGeometry => {
  const h = size / 2;
  // 8 shared corner vertices to keep topology connected
  const corners: Vector3[] = [
    vec3(-h, -h, -h), // 0
    vec3( h, -h, -h), // 1
    vec3( h,  h, -h), // 2
    vec3(-h,  h, -h), // 3
    vec3(-h, -h,  h), // 4
    vec3( h, -h,  h), // 5
    vec3( h,  h,  h), // 6
    vec3(-h,  h,  h), // 7
  ];
  const vertices: Vertex[] = corners.map(p => createVertex(p, vec3(0, 0, 0), vec2(0, 0)));
  const id = (i: number) => vertices[i].id;
  // 6 quad faces (CCW from outside)
  // Cube 3x2 atlas layout: columns (-X, +Z, +X) on top row; columns (-Y, -Z, +Y) bottom row
  const cw = 1/3; const ch = 1/2;
  const cell = (cx: number, cy: number) => (u: number, v: number) => vec2(cx*cw + u*cw, cy*ch + v*ch);
  const cNX = cell(0,1), cPZ = cell(1,1), cPX = cell(2,1), cNY = cell(0,0), cNZ = cell(1,0), cPY = cell(2,0);
  const faces: Face[] = [
    createFace([id(4), id(5), id(6), id(7)], [cPZ(0,0), cPZ(1,0), cPZ(1,1), cPZ(0,1)]), // +Z
    createFace([id(1), id(0), id(3), id(2)], [cNZ(0,0), cNZ(1,0), cNZ(1,1), cNZ(0,1)]), // -Z
    createFace([id(7), id(6), id(2), id(3)], [cPY(0,0), cPY(1,0), cPY(1,1), cPY(0,1)]), // +Y
    createFace([id(0), id(1), id(5), id(4)], [cNY(0,0), cNY(1,0), cNY(1,1), cNY(0,1)]), // -Y
    createFace([id(0), id(4), id(7), id(3)], [cNX(0,0), cNX(1,0), cNX(1,1), cNX(0,1)]), // -X
    createFace([id(5), id(1), id(2), id(6)], [cPX(0,0), cPX(1,0), cPX(1,1), cPX(0,1)]), // +X
  ];
  return { vertices, faces };
};

export const createCubeMesh = (size: number = 1): Mesh => {
  const { vertices, faces } = buildCubeGeometry(size);
  return createMeshFromGeometry('Cube', vertices, faces);
};

// Generic mesh creation from geometry
export const createMeshFromGeometry = (name: string, vertices: Vertex[], faces: Face[]): Mesh => {
  const mesh: Mesh = {
    id: nanoid(),
    name,
    vertices,
    edges: buildEdgesFromFaces(vertices, faces),
    faces,
    transform: {
      position: vec3(0, 0, 0),
      rotation: vec3(0, 0, 0),
      scale: vec3(1, 1, 1),
    },
    visible: true,
    locked: false,
  castShadow: true,
  receiveShadow: true,
  shading: 'flat',
  };
  mesh.vertices = calculateVertexNormals(mesh);
  return mesh;
};

// Geometry builders (return vertices and faces only)
export interface BuiltGeometry { vertices: Vertex[]; faces: Face[] }

export const buildPlaneGeometry = (
  width: number = 1,
  height: number = 1,
  widthSegments: number = 1,
  heightSegments: number = 1
): BuiltGeometry => {
  const ws = Math.max(1, Math.floor(widthSegments));
  const hs = Math.max(1, Math.floor(heightSegments));
  const vertices: Vertex[] = [];
  const faces: Face[] = [];
  for (let iy = 0; iy <= hs; iy++) {
    const v = iy / hs;
    for (let ix = 0; ix <= ws; ix++) {
      const u = ix / ws;
      const x = (u - 0.5) * width;
      const z = (v - 0.5) * height;
      vertices.push(createVertex(vec3(x, 0, z), vec3(0, 1, 0), vec2(u, v)));
    }
  }
  const row = ws + 1;
  for (let iy = 0; iy < hs; iy++) {
    for (let ix = 0; ix < ws; ix++) {
      const a = iy * row + ix;
      const b = a + 1;
      const c = a + 1 + row;
      const d = a + row;
      faces.push(createFace([vertices[a].id, vertices[b].id, vertices[c].id, vertices[d].id]));
    }
  }
  return { vertices, faces };
};

export const buildCylinderGeometry = (
  radiusTop: number = 0.5,
  radiusBottom: number = 0.5,
  height: number = 1.5,
  radialSegments: number = 16,
  heightSegments: number = 1,
  capped: boolean = true
): BuiltGeometry => {
  const rs = Math.max(3, Math.floor(radialSegments));
  const hs = Math.max(1, Math.floor(heightSegments));
  const vertices: Vertex[] = [];
  const faces: Face[] = [];

  // Side vertices
  const rings: number[][] = [];
  for (let iy = 0; iy <= hs; iy++) {
  const v = iy / hs; // 0..1 height fraction
    const y = (v - 0.5) * height;
    // v = 0 -> bottom, v = 1 -> top
    const radius = radiusBottom + (radiusTop - radiusBottom) * v;
    // If radius nearly zero, create a single apex vertex
    if (radius <= 1e-8) {
      // Apex (cone side) use center U, V linear
      const apex = createVertex(vec3(0, y, 0), vec3(0, 0, 0), vec2(0.5, v));
      rings.push([vertices.push(apex) - 1]);
    } else {
      const ring: number[] = [];
      for (let ix = 0; ix < rs; ix++) {
        const u = ix / rs;
  const theta = u * Math.PI * 2;
        const x = Math.cos(theta) * radius;
        const z = Math.sin(theta) * radius;
        const vert = createVertex(vec3(x, y, z), vec3(0, 0, 0), vec2(u, v)); // side strip full height
        ring.push(vertices.push(vert) - 1);
      }
      rings.push(ring);
    }
  }
  // Side faces: connect ring iy to iy+1
  for (let iy = 0; iy < hs; iy++) {
    const ringA = rings[iy];
    const ringB = rings[iy + 1];
    if (ringA.length === 1 && ringB.length === 1) {
      // Degenerate (both apex) - skip
      continue;
  } else if (ringA.length === 1 && ringB.length > 1) {
      // Bottom apex -> triangles [apex, next, current]
      const apex = ringA[0];
      for (let i = 0; i < rs; i++) {
        const cur = ringB[i % rs]; const next = ringB[(i + 1) % rs];
        const uA = vertices[apex].uv; const uN = vertices[next].uv; const uC = vertices[cur].uv;
        faces.push(createFace(
          [vertices[apex].id, vertices[next].id, vertices[cur].id],
          [vec2(uA.x, 0.5 + uA.y * 0.5), vec2(uN.x, 0.5 + uN.y * 0.5), vec2(uC.x, 0.5 + uC.y * 0.5)]
        ));
      }
    } else if (ringA.length > 1 && ringB.length === 1) {
      // Top apex -> triangles [current, next, apex]
      const apex = ringB[0];
      for (let i = 0; i < rs; i++) {
        const cur = ringA[i % rs]; const next = ringA[(i + 1) % rs];
        const uC = vertices[cur].uv; const uN = vertices[next].uv; const uA = vertices[apex].uv;
        faces.push(createFace(
          [vertices[cur].id, vertices[next].id, vertices[apex].id],
          [vec2(uC.x, 0.5 + uC.y * 0.5), vec2(uN.x, 0.5 + uN.y * 0.5), vec2(uA.x, 0.5 + uA.y * 0.5)]
        ));
      }
    } else {
      // Regular quads
      for (let i = 0; i < rs; i++) {
        const a = ringA[i];
        const b = ringA[(i + 1) % rs];
        const c = ringB[(i + 1) % rs];
        const d = ringB[i];
        const ua = vertices[a].uv, ub = vertices[b].uv, uc = vertices[c].uv, ud = vertices[d].uv;
        faces.push(createFace(
          [vertices[a].id, vertices[b].id, vertices[c].id, vertices[d].id],
          [
            vec2(ua.x, 0.5 + ua.y * 0.5),
            vec2(ub.x, 0.5 + ub.y * 0.5),
            vec2(uc.x, 0.5 + uc.y * 0.5),
            vec2(ud.x, 0.5 + ud.y * 0.5),
          ]
        ));
      }
    }
  }

  // Caps (reuse side ring vertices to keep topology connected)
  if (capped) {
    // Top cap (y = +height/2)
    const topRing = rings[hs];
    if (topRing.length > 1 && radiusTop > 0) {
      const topCenter = createVertex(vec3(0, height / 2, 0), vec3(0, 1, 0), vec2(0.5, 0.5));
      const topCenterIndex = vertices.push(topCenter) - 1;
      // Disk in bottom half left: center (0.25,0.25)
      const cx = 0.25, cy = 0.25, scale = 0.23, invR = radiusTop ? 1 / radiusTop : 0;
      for (let i = 0; i < rs; i++) {
        const a = topRing[i]; const b = topRing[(i + 1) % rs];
        const pa = vertices[a].position; const pb = vertices[b].position;
        const ua = vec2(cx + pa.x * invR * scale, cy + pa.z * invR * scale);
        const ub = vec2(cx + pb.x * invR * scale, cy + pb.z * invR * scale);
        const uc = vec2(cx, cy);
        faces.push(createFace([vertices[a].id, vertices[b].id, vertices[topCenterIndex].id], [ua, ub, uc]));
      }
    }
    // Bottom cap (y = -height/2)
    const bottomRing = rings[0];
    if (bottomRing.length > 1 && radiusBottom > 0) {
      const bottomCenter = createVertex(vec3(0, -height / 2, 0), vec3(0, -1, 0), vec2(0.5, 0.5));
      const bottomCenterIndex = vertices.push(bottomCenter) - 1;
      // Disk in bottom half right: center (0.75,0.25)
      const cx = 0.75, cy = 0.25, scale = 0.23, invR = radiusBottom ? 1 / radiusBottom : 0;
      for (let i = 0; i < rs; i++) {
        const a = bottomRing[(i + 1) % rs]; const b = bottomRing[i];
        const pa = vertices[a].position; const pb = vertices[b].position;
        const ua = vec2(cx + pa.x * invR * scale, cy + pa.z * invR * scale);
        const ub = vec2(cx + pb.x * invR * scale, cy + pb.z * invR * scale);
        const uc = vec2(cx, cy);
        faces.push(createFace([vertices[a].id, vertices[b].id, vertices[bottomCenterIndex].id], [ua, ub, uc]));
      }
    }
  }

  return { vertices, faces };
};

export const buildConeGeometry = (
  radius: number = 0.5,
  height: number = 1.5,
  radialSegments: number = 16,
  heightSegments: number = 1,
  capped: boolean = true
): BuiltGeometry => buildCylinderGeometry(0, radius, height, radialSegments, heightSegments, capped);

export const buildUVSphereGeometry = (
  radius: number = 0.75,
  widthSegments: number = 16,
  heightSegments: number = 12
): BuiltGeometry => {
  const ws = Math.max(3, Math.floor(widthSegments));
  const hs = Math.max(2, Math.floor(heightSegments));
  const vertices: Vertex[] = [];
  const faces: Face[] = [];

  // Top and bottom center vertices
  const top = createVertex(vec3(0, radius, 0), vec3(0, 1, 0), vec2(0.5, 1));
  const bottom = createVertex(vec3(0, -radius, 0), vec3(0, -1, 0), vec2(0.5, 0));
  const topIndex = vertices.push(top) - 1;
  const rings: number[][] = [];

  // Rings between poles: 1..hs-1
  for (let iy = 1; iy < hs; iy++) {
    const v = iy / hs;
    const phi = v * Math.PI;
    const y = Math.cos(phi) * radius;
    const r = Math.sin(phi) * radius;
    const ring: number[] = [];
    for (let ix = 0; ix < ws; ix++) {
      const u = ix / ws;
      const theta = u * Math.PI * 2;
      const x = Math.cos(theta) * r;
      const z = Math.sin(theta) * r;
      const vert = createVertex(vec3(x, y, z), vec3(0, 0, 0), vec2(u, 1 - v));
      ring.push(vertices.push(vert) - 1);
    }
    rings.push(ring);
  }
  const bottomIndex = vertices.push(bottom) - 1;

  // Top cap fan
  if (rings.length > 0) {
    const firstRing = rings[0];
    for (let i = 0; i < ws; i++) {
  const a = firstRing[i]; const b = firstRing[(i + 1) % ws];
  const ua = vertices[a].uv.x; let ub = vertices[b].uv.x;
      const vRing = vertices[a].uv.y;
      if (ub < ua) ub += 1; // seam correction
      const poleU = (ua + ub) * 0.5;
      faces.push(createFace([
        vertices[a].id, vertices[topIndex].id, vertices[b].id
      ], [vec2(ua, vRing), vec2(poleU, 1), vec2(ub, vRing)]));
    }
  }

  // Middle quads
  for (let iy = 0; iy < rings.length - 1; iy++) {
    const r1 = rings[iy];
    const r2 = rings[iy + 1];
    for (let i = 0; i < ws; i++) {
      const a = r1[i];
      const b = r1[(i + 1) % ws];
      const c = r2[(i + 1) % ws];
      const d = r2[i];
        const ua = vertices[a].uv.x; let ub = vertices[b].uv.x; let uc = vertices[c].uv.x; let ud = vertices[d].uv.x;
      const v1 = vertices[a].uv.y; const v2 = vertices[d].uv.y;
      // seam fix: ensure monotonic wrap (compare against first)
      if (ub < ua) ub += 1; if (uc < ua) uc += 1; if (ud < ua) ud += 1;
      faces.push(createFace([vertices[a].id, vertices[b].id, vertices[c].id, vertices[d].id], [
        vec2(ua, v1), vec2(ub, v1), vec2(uc, v2), vec2(ud, v2)
      ]));
    }
  }

  // Bottom cap fan
  if (rings.length > 0) {
    const lastRing = rings[rings.length - 1];
    for (let i = 0; i < ws; i++) {
  const a = lastRing[i]; const b = lastRing[(i + 1) % ws];
  const ua = vertices[a].uv.x; let ub = vertices[b].uv.x;
      const vRing = vertices[a].uv.y;
      if (ub < ua) ub += 1;
      const poleU = (ua + ub) * 0.5;
      faces.push(createFace([
        vertices[a].id, vertices[b].id, vertices[bottomIndex].id
      ], [vec2(ua, vRing), vec2(ub, vRing), vec2(poleU, 0)]));
    }
  }

  return { vertices, faces };
};

// Icosphere builder
const t = (1 + Math.sqrt(5)) / 2;
const normalize = (v: Vector3, radius: number): Vector3 => {
  const n = normalizeVec3(v);
  return multiplyVec3(n, radius);
};

export const buildIcoSphereGeometry = (
  radius: number = 0.75,
  subdivisions: number = 1
): BuiltGeometry => {
  // Initial icosahedron vertices
  const base: Vector3[] = [
    vec3(-1,  t,  0), vec3( 1,  t,  0), vec3(-1, -t,  0), vec3( 1, -t,  0),
    vec3( 0, -1,  t), vec3( 0,  1,  t), vec3( 0, -1, -t), vec3( 0,  1, -t),
    vec3( t,  0, -1), vec3( t,  0,  1), vec3(-t,  0, -1), vec3(-t,  0,  1),
  ].map(v => normalize(v, radius));

  const verts: Vector3[] = base.slice();
  let facesIdx: [number, number, number][] = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ];

  const midpointCache = new Map<string, number>();
  const getMidpoint = (a: number, b: number): number => {
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    const cached = midpointCache.get(key);
    if (cached !== undefined) return cached;
    const p = normalize(vec3(
      (verts[a].x + verts[b].x) / 2,
      (verts[a].y + verts[b].y) / 2,
      (verts[a].z + verts[b].z) / 2,
    ), radius);
    const idx = verts.push(p) - 1;
    midpointCache.set(key, idx);
    return idx;
  };

  for (let i = 0; i < Math.max(0, Math.floor(subdivisions)); i++) {
    const newFaces: [number, number, number][] = [];
    for (const [a, b, c] of facesIdx) {
      const ab = getMidpoint(a, b);
      const bc = getMidpoint(b, c);
      const ca = getMidpoint(c, a);
      newFaces.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
    }
    facesIdx = newFaces;
  }

  // Convert to Vertex/Face with spherical (equirectangular) UVs
  const vertices: Vertex[] = verts.map((p) => {
    const n = normalizeVec3(p);
    // u in [0,1): atan2(z, x) -> [-pi, pi]
    const u = (Math.atan2(n.z, n.x) / (2 * Math.PI) + 1) % 1;
    // v in [0,1]: y -> [-1,1] -> polar angle
    const v = 0.5 - Math.asin(Math.max(-1, Math.min(1, n.y))) / Math.PI;
    return createVertex(p, vec3(0, 0, 0), vec2(u, v));
  });
  const faces: Face[] = facesIdx.map((tri) => {
    const loops = tri.map(i => ({ ...vertices[i].uv }));
  const minU = Math.min(loops[0].x, loops[1].x, loops[2].x);
  const maxU = Math.max(loops[0].x, loops[1].x, loops[2].x);
    if (maxU - minU > 0.5) {
      // seam: push smaller ones +1
      for (const l of loops) if (l.x < 0.5) l.x += 1;
    }
    return createFace(tri.map(i => vertices[i].id), loops.map(l => vec2(l.x, l.y)));
  });
  return { vertices, faces };
};

export const buildTorusGeometry = (
  ringRadius: number = 1,
  tubeRadius: number = 0.3,
  radialSegments: number = 16, // around tube
  tubularSegments: number = 24 // around ring
): BuiltGeometry => {
  const rs = Math.max(3, Math.floor(radialSegments));
  const ts = Math.max(3, Math.floor(tubularSegments));
  const vertices: Vertex[] = [];
  const faces: Face[] = [];

  for (let j = 0; j <= ts; j++) {
    const v = j / ts;
    const phi = v * Math.PI * 2;
    const cosPhi = Math.cos(phi);
    const sinPhi = Math.sin(phi);

    for (let i = 0; i <= rs; i++) {
      const u = i / rs;
      const theta = u * Math.PI * 2;
      const cosTheta = Math.cos(theta);
      const sinTheta = Math.sin(theta);

      const x = (ringRadius + tubeRadius * cosTheta) * cosPhi;
      const y = tubeRadius * sinTheta;
      const z = (ringRadius + tubeRadius * cosTheta) * sinPhi;
      vertices.push(createVertex(vec3(x, y, z), vec3(0, 0, 0), vec2(u, v)));
    }
  }

  const row = rs + 1;
  for (let j = 0; j < ts; j++) {
    for (let i = 0; i < rs; i++) {
      const a = j * row + i;
      const b = a + 1;
      const c = a + 1 + row;
      const d = a + row;
      faces.push(createFace([vertices[a].id, vertices[b].id, vertices[c].id, vertices[d].id]));
    }
  }
  return { vertices, faces };
};

// Mesh wrappers for new primitives
export const createPlaneMesh = (width = 1, height = 1, wSeg = 1, hSeg = 1): Mesh => {
  const { vertices, faces } = buildPlaneGeometry(width, height, wSeg, hSeg);
  return createMeshFromGeometry('Plane', vertices, faces);
};

export const createCylinderMesh = (radiusTop = 0.5, radiusBottom = 0.5, height = 1.5, radialSegments = 16, heightSegments = 1, capped = true): Mesh => {
  const { vertices, faces } = buildCylinderGeometry(radiusTop, radiusBottom, height, radialSegments, heightSegments, capped);
  return createMeshFromGeometry('Cylinder', vertices, faces);
};

export const createConeMesh = (radius = 0.5, height = 1.5, radialSegments = 16, heightSegments = 1, capped = true): Mesh => {
  const { vertices, faces } = buildConeGeometry(radius, height, radialSegments, heightSegments, capped);
  return createMeshFromGeometry('Cone', vertices, faces);
};

export const createUVSphereMesh = (radius = 0.75, widthSegments = 16, heightSegments = 12): Mesh => {
  const { vertices, faces } = buildUVSphereGeometry(radius, widthSegments, heightSegments);
  return createMeshFromGeometry('UV Sphere', vertices, faces);
};

export const createIcoSphereMesh = (radius = 0.75, subdivisions = 1): Mesh => {
  const { vertices, faces } = buildIcoSphereGeometry(radius, subdivisions);
  return createMeshFromGeometry('Sphere', vertices, faces);
};

export const createTorusMesh = (ringRadius = 1, tubeRadius = 0.3, radialSegments = 16, tubularSegments = 24): Mesh => {
  const { vertices, faces } = buildTorusGeometry(ringRadius, tubeRadius, radialSegments, tubularSegments);
  return createMeshFromGeometry('Torus', vertices, faces);
};

// Conversion utilities for Three.js integration
export const convertQuadToTriangles = (vertexIds: string[]): string[][] => {
  if (vertexIds.length === 3) {
    return [vertexIds];
  } else if (vertexIds.length === 4) {
    // Convert quad to two triangles
    return [
      [vertexIds[0], vertexIds[1], vertexIds[2]],
      [vertexIds[0], vertexIds[2], vertexIds[3]],
    ];
  } else {
    // For n-gons, fan triangulation from first vertex
    const triangles: string[][] = [];
    for (let i = 1; i < vertexIds.length - 1; i++) {
      triangles.push([vertexIds[0], vertexIds[i], vertexIds[i + 1]]);
    }
    return triangles;
  }
};

import { Mesh, Face, Vertex } from '@/types/geometry';

export type EdgeKey = string;
const keyFor = (a: string, b: string): EdgeKey => (a < b ? `${a}-${b}` : `${b}-${a}`);

export interface FaceSpan {
  faceId: string;
  // The two edges PARALLEL to the hovered edge inside this face (came and opposite),
  // oriented so their first vertex is the corner adjacent to the chosen side (consistently iRight).
  parallelA: [string, string];
  parallelB: [string, string];
}

export const isQuad = (face: Face) => face.vertexIds.length === 4;

const faceEdges = (face: Face): [string, string][] => {
  const ids = face.vertexIds;
  const n = ids.length;
  const edges: [string, string][] = [];
  for (let i = 0; i < n; i++) {
    const a = ids[i];
    const b = ids[(i + 1) % n];
    edges.push([a, b]);
  }
  return edges;
};

const edgeIndexInFace = (face: Face, a: string, b: string): number => {
  const edges = faceEdges(face);
  for (let i = 0; i < edges.length; i++) {
    const [x, y] = edges[i];
    if ((x === a && y === b) || (x === b && y === a)) return i;
  }
  return -1;
};

export interface MeshAdjacency {
  edgeByKey: Map<EdgeKey, { id: string; v: [string, string]; faceIds: string[] }>;
  facesById: Map<string, Face>;
}

export const buildAdjacency = (mesh: Mesh): MeshAdjacency => {
  const edgeByKey = new Map<EdgeKey, { id: string; v: [string, string]; faceIds: string[] }>();
  for (const e of mesh.edges) {
    edgeByKey.set(keyFor(e.vertexIds[0], e.vertexIds[1]), { id: e.id, v: [e.vertexIds[0], e.vertexIds[1]], faceIds: [...e.faceIds] });
  }
  const facesById = new Map(mesh.faces.map((f) => [f.id, f] as const));
  return { edgeByKey, facesById };
};

// Given a hovered edge id, compute the edge loop as a sequence of FaceSpan entries across connected quads.
export const computeEdgeLoopFaceSpans = (mesh: Mesh, startEdgeId: string): FaceSpan[] => {
  const adj = buildAdjacency(mesh);
  const startEdge = mesh.edges.find((e) => e.id === startEdgeId);
  if (!startEdge) return [];
  const startKey = keyFor(startEdge.vertexIds[0], startEdge.vertexIds[1]);
  const spans: FaceSpan[] = [];
  const visited = new Set<string>();

  const expand = (faceId: string, cameKey: EdgeKey) => {
    let current = faceId;
    let throughKey = cameKey;
    while (true) {
      if (visited.has(current)) break;
      const face = adj.facesById.get(current);
      if (!face || !isQuad(face)) break;
      const edges = faceEdges(face); // order around face
      // Find index of came edge within this face (ignore direction)
      let idx = -1;
      for (let i = 0; i < 4; i++) {
        const k = keyFor(edges[i][0], edges[i][1]);
        if (k === throughKey) { idx = i; break; }
      }
      if (idx === -1) break;
      // Determine indices for opposite and a consistent side (we pick iRight = idx+1)
      const iOpp = (idx + 2) % 4;
      const iRight = (idx + 1) % 4;
      // Orient helper: ensure the first vertex is the one shared with edges[iRight]
      const orient = (edge: [string, string], neighbor: [string, string]): [string, string] => {
        const [a, b] = edge;
        const [n0, n1] = neighbor;
        if (a === n0 || a === n1) return [a, b];
        if (b === n0 || b === n1) return [b, a];
        return edge; // fallback (shouldn't happen on well-formed quads)
      };
      const parallelA = orient(edges[idx], edges[iRight]);
      const parallelB = orient(edges[iOpp], edges[iRight]);
      spans.push({ faceId: face.id, parallelA, parallelB });
      visited.add(face.id);
      // Traverse across the opposite (parallel) edge to continue the ring
      const nextKey = keyFor(edges[iOpp][0], edges[iOpp][1]);
      const e = adj.edgeByKey.get(nextKey);
      if (!e || e.faceIds.length !== 2) break;
      const nextFace: string = e.faceIds[0] === current ? e.faceIds[1] : e.faceIds[0];
      // Prepare for next iteration: in next face, we are entering via nextKey
      throughKey = nextKey;
      current = nextFace;
    }
  };

  // Expand from both adjacent faces of the start edge
  for (const fid of startEdge.faceIds) {
    expand(fid, startKey);
  }

  return spans;
};

export const evalEdgePoint = (vmap: Map<string, Vertex>, edge: [string, string], t: number) => {
  const a = vmap.get(edge[0])!;
  const b = vmap.get(edge[1])!;
  return {
    x: a.position.x + (b.position.x - a.position.x) * t,
    y: a.position.y + (b.position.y - a.position.y) * t,
    z: a.position.z + (b.position.z - a.position.z) * t,
  };
};

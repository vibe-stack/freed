import { Mesh, Edge, Face, Vertex } from '@/types/geometry';

// Core helpers --------------------------------------------------------------

interface Adjacency {
  edgeById: Map<string, Edge>;
  edgeByKey: Map<string, Edge>;
  faceById: Map<string, Face>;
  vertexById: Map<string, Vertex>;
  edgesByVertex: Map<string, Edge[]>;
  facesByEdge: Map<string, Face[]>; // direct reference objects (not only ids) for convenience
  edgesInFace: Map<string, [string, string][]>; // ordered edge vertex pairs around each face
}

export const buildAdjacency = (mesh: Mesh): Adjacency => {
  const edgeById = new Map<string, Edge>();
  const edgeByKey = new Map<string, Edge>();
  const faceById = new Map<string, Face>();
  const vertexById = new Map<string, Vertex>();
  const edgesByVertex = new Map<string, Edge[]>();
  const facesByEdge = new Map<string, Face[]>();
  const edgesInFace = new Map<string, [string, string][]>();

  mesh.vertices.forEach(v => vertexById.set(v.id, v));
  mesh.edges.forEach(e => {
    edgeById.set(e.id, e);
    const a = e.vertexIds[0]; const b = e.vertexIds[1];
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    edgeByKey.set(key, e);
    e.vertexIds.forEach(vId => {
      let arr = edgesByVertex.get(vId); if (!arr) { arr = []; edgesByVertex.set(vId, arr); }
      arr.push(e);
    });
  });
  mesh.faces.forEach(f => {
    faceById.set(f.id, f);
    const ids = f.vertexIds; const n = ids.length; const edges: [string, string][] = [];
    for (let i = 0; i < n; i++) edges.push([ids[i], ids[(i+1)%n]]);
    edgesInFace.set(f.id, edges);
    edges.forEach(([a,b]) => {
      // find edge id via edge list (inefficient fallback) - we could map vertex-pair -> edge id.
      // Build lookup lazily.
      const edge = mesh.edges.find(ed => (ed.vertexIds[0] === a && ed.vertexIds[1] === b) || (ed.vertexIds[0] === b && ed.vertexIds[1] === a));
      if (edge) {
        let arr = facesByEdge.get(edge.id); if (!arr) { arr = []; facesByEdge.set(edge.id, arr); }
        arr.push(f);
      }
    });
  });
  return { edgeById, edgeByKey, faceById, vertexById, edgesByVertex, facesByEdge, edgesInFace };
};

const isQuad = (f: Face) => f.vertexIds.length === 4;

// Edge Loop (consecutive edges share a vertex) --------------------------------
// Approximation of Blender behaviour: traverses picking the straightest continuing edge at each vertex
export const computeEdgeLoop = (mesh: Mesh, startEdgeId: string): string[] => {
  const adj = buildAdjacency(mesh);
  const start = adj.edgeById.get(startEdgeId); if (!start) return [];
  const loop = new Set<string>();
  loop.add(startEdgeId);

  const traverseFromVertex = (initialEdge: Edge, fromVertex: string) => {
    let currentEdge = initialEdge;
    let currentVertex = fromVertex; // we stand at this vertex and came from currentEdge (which does NOT include currentVertex as destination? we define below)
    // Determine direction vector for current edge relative to currentVertex
    for (let steps = 0; steps < 10000; steps++) { // safety cap
      const otherVertex = currentEdge.vertexIds[0] === currentVertex ? currentEdge.vertexIds[1] : currentEdge.vertexIds[0];
      const vA = adj.vertexById.get(currentVertex); const vB = adj.vertexById.get(otherVertex); if (!vA || !vB) break;
      const dirX = vB.position.x - vA.position.x;
      const dirY = vB.position.y - vA.position.y;
      const dirZ = vB.position.z - vA.position.z;
      const mag = Math.hypot(dirX, dirY, dirZ) || 1;
      const nx = dirX / mag, ny = dirY / mag, nz = dirZ / mag;

      // Candidate edges incident to otherVertex excluding currentEdge
      const candidates = adj.edgesByVertex.get(otherVertex)?.filter(e => e.id !== currentEdge.id) || [];
      if (candidates.length === 0) break;
      // Pick candidate with max dot product (straightest continuation)
      let best: Edge | null = null; let bestDot = -Infinity;
      for (const c of candidates) {
        const ov = c.vertexIds[0] === otherVertex ? c.vertexIds[1] : c.vertexIds[0];
        const vC = adj.vertexById.get(ov); if (!vC) continue;
        const cx = vC.position.x - vB.position.x;
        const cy = vC.position.y - vB.position.y;
        const cz = vC.position.z - vB.position.z;
        const cmag = Math.hypot(cx, cy, cz) || 1;
        const dot = (nx* (cx/cmag) + ny* (cy/cmag) + nz* (cz/cmag));
        if (dot > bestDot) { bestDot = dot; best = c; }
      }
      if (!best) break;
      // Termination: ensure we are not turning more than ~120 degrees (dot > -0.5)
      if (bestDot < -0.5) break;
      if (loop.has(best.id)) break; // closed
      loop.add(best.id);
      // advance
      currentVertex = otherVertex;
      currentEdge = best;
    }
  };

  // Explore both directions
  traverseFromVertex(start, start.vertexIds[0]);
  traverseFromVertex(start, start.vertexIds[1]);

  return Array.from(loop);
};

// Strict Blender-like edge loop: traverse through quads choosing the single continuation edge at each vertex
export const computeEdgeLoopBlender = (mesh: Mesh, startEdgeId: string): string[] => {
  const adj = buildAdjacency(mesh);
  const start = adj.edgeById.get(startEdgeId); if (!start) return [];
  const collected = new Set<string>();
  collected.add(startEdgeId);

  const keyFor = (a: string, b: string) => (a < b ? `${a}-${b}` : `${b}-${a}`);

  const traverse = (edge: Edge, fromVertex: string) => {
    let currentEdge = edge;
    let prevEdge: Edge | null = null;
    let currentVertex = fromVertex; // we move away from this vertex along currentEdge
    for (let steps = 0; steps < 10000; steps++) {
      // Determine the other vertex of currentEdge
      const nextVertex = currentEdge.vertexIds[0] === currentVertex ? currentEdge.vertexIds[1] : currentEdge.vertexIds[0];
      // Build candidate continuation edges at nextVertex via faces that include currentEdge
      const faceIds = currentEdge.faceIds;
      const candidateEdgeIds = new Set<string>();
      for (const fid of faceIds) {
        const face = adj.faceById.get(fid); if (!face || !isQuad(face)) continue;
        const edgesPairs = adj.edgesInFace.get(fid)!; // ordered pairs
        // Collect the two edges at nextVertex inside this face
        const touching = edgesPairs.filter(([a,b]) => a === nextVertex || b === nextVertex);
        // touching will include currentEdge pair plus one adjacent pair (or two if valence abnormal)
        for (const pair of touching) {
          const k = keyFor(pair[0], pair[1]);
          const eObj = adj.edgeByKey.get(k);
          if (eObj && eObj.id !== currentEdge.id) candidateEdgeIds.add(eObj.id);
        }
      }
      if (prevEdge) candidateEdgeIds.delete(prevEdge.id);
      if (candidateEdgeIds.size !== 1) break; // stop on branch, end, or ambiguity
      const nextEdgeId = Array.from(candidateEdgeIds)[0];
      if (collected.has(nextEdgeId)) break; // loop closed
      collected.add(nextEdgeId);
      prevEdge = currentEdge;
      currentEdge = adj.edgeById.get(nextEdgeId)!;
      currentVertex = nextVertex;
    }
  };

  // Traverse both directions
  traverse(start, start.vertexIds[0]);
  traverse(start, start.vertexIds[1]);
  return Array.from(collected);
};

// Topological face-loop aligned edge loop: consecutive edges share a vertex and exactly one face.
export const computeEdgeLoopTopological = (mesh: Mesh, startEdgeId: string): string[] => {
  const adj = buildAdjacency(mesh);
  const start = adj.edgeById.get(startEdgeId); if (!start) return [];
  const loop = new Set<string>();
  loop.add(startEdgeId);

  const extend = (edge: Edge, fromVertex: string) => {
    let currentEdge = edge;
    let currentVertex = fromVertex;
    for (let steps = 0; steps < 10000; steps++) {
      const forwardVertex = currentEdge.vertexIds[0] === currentVertex ? currentEdge.vertexIds[1] : currentEdge.vertexIds[0];
      const candidates = (adj.edgesByVertex.get(forwardVertex) || []).filter(e => e.id !== currentEdge.id);
      // Pick edges that share exactly one face with currentEdge
      const currentFaces = currentEdge.faceIds;
      const filtered = candidates.filter(c => {
        const inter = c.faceIds.filter(fid => currentFaces.includes(fid));
        return inter.length === 1; // share exactly one face (quad strip continuation)
      });
      if (filtered.length !== 1) break; // ambiguity or dead end
      const nextEdge = filtered[0];
      if (loop.has(nextEdge.id)) break; // closed
      loop.add(nextEdge.id);
      currentVertex = forwardVertex;
      currentEdge = nextEdge;
    }
  };

  extend(start, start.vertexIds[0]);
  extend(start, start.vertexIds[1]);
  return Array.from(loop);
};

// Edge Ring (sequence of opposite edges across quads, edges do not share vertices) ---------
export const computeEdgeRing = (mesh: Mesh, startEdgeId: string): string[] => {
  const adj = buildAdjacency(mesh);
  const start = adj.edgeById.get(startEdgeId); if (!start) return [];
  const ring = new Set<string>(); ring.add(start.id);

  const oppositeInFace = (face: Face, edge: Edge): Edge | null => {
    if (!isQuad(face)) return null;
    const edges = adj.edgesInFace.get(face.id)!;
    let idx = -1;
    for (let i = 0; i < 4; i++) {
      const [a,b] = edges[i];
      if ((a === edge.vertexIds[0] && b === edge.vertexIds[1]) || (a === edge.vertexIds[1] && b === edge.vertexIds[0])) { idx = i; break; }
    }
    if (idx === -1) return null;
    const opp = edges[(idx+2)%4];
    // find actual edge object
    const found = Array.from(adj.edgeById.values()).find(e => (e.vertexIds[0] === opp[0] && e.vertexIds[1] === opp[1]) || (e.vertexIds[0] === opp[1] && e.vertexIds[1] === opp[0]));
    return found || null;
  };

  const traverse = (edge: Edge, face: Face) => {
    let currentEdge = edge; let currentFace = face;
    for (let steps = 0; steps < 10000; steps++) {
      const opp = oppositeInFace(currentFace, currentEdge); if (!opp) break;
      if (ring.has(opp.id)) break;
      ring.add(opp.id);
      // Move to adjacent face across opp (the face that's not currentFace)
      const nextFaces = opp.faceIds.filter(fid => fid !== currentFace.id);
      if (nextFaces.length !== 1) break; // boundary or branching stops ring
      const nextFaceObj = adj.faceById.get(nextFaces[0]); if (!nextFaceObj || !isQuad(nextFaceObj)) break;
      currentEdge = opp; currentFace = nextFaceObj;
    }
  };

  const startFaces = adj.facesByEdge.get(start.id) || [];
  for (const f of startFaces) {
    if (isQuad(f)) traverse(start, f);
  }

  return Array.from(ring);
};

// Face Loop (sequence of faces across opposite edges) --------------------------------------
export const computeFaceLoop = (mesh: Mesh, startEdgeId: string): string[] => {
  const adj = buildAdjacency(mesh);
  const start = adj.edgeById.get(startEdgeId); if (!start) return [];
  const faces = new Set<string>();

  const traverse = (face: Face, enteringEdge: Edge) => {
    let currentFace = face; let viaEdge = enteringEdge;
    for (let steps = 0; steps < 10000; steps++) {
      if (!isQuad(currentFace)) break;
      faces.add(currentFace.id);
      // Find edge opposite entering edge; then move through its adjacent face
      const edges = adj.edgesInFace.get(currentFace.id)!;
      let idx = -1; for (let i=0;i<4;i++){ const [a,b]=edges[i]; if ((a===viaEdge.vertexIds[0]&&b===viaEdge.vertexIds[1])||(a===viaEdge.vertexIds[1]&&b===viaEdge.vertexIds[0])) { idx=i; break;} }
      if (idx === -1) break;
      const oppPair = edges[(idx+2)%4];
      const oppEdge = Array.from(adj.edgeById.values()).find(e => (e.vertexIds[0]===oppPair[0]&&e.vertexIds[1]===oppPair[1])||(e.vertexIds[0]===oppPair[1]&&e.vertexIds[1]===oppPair[0]));
      if (!oppEdge) break;
      const nextFaces = oppEdge.faceIds.filter(fid => fid !== currentFace.id);
      if (nextFaces.length !== 1) break; // boundary or branch
      const nf = adj.faceById.get(nextFaces[0]); if (!nf) break;
      viaEdge = oppEdge; currentFace = nf;
      if (faces.has(currentFace.id)) break; // closed
    }
  };

  const startFaces = adj.facesByEdge.get(start.id) || [];
  for (const f of startFaces) traverse(f, start);

  return Array.from(faces);
};

// Boundary helpers -------------------------------------------------------------------------
export const getBoundaryEdges = (mesh: Mesh): string[] => mesh.edges.filter(e => e.faceIds.length < 2).map(e => e.id);

// Loop Inner Region (returns smaller region of faces bounded by a closed set of edges) -----
export const selectLoopInnerRegion = (mesh: Mesh, loopEdgeIds: string[]): string[] => {
  if (!loopEdgeIds.length) return [];
  const barrier = new Set(loopEdgeIds);
  const edgeObj = new Map(mesh.edges.map(e => [e.id, e] as const));
  const faces = mesh.faces;
  // Build adjacency (face -> neighboring faces across non-barrier edges)
  const neighbors = new Map<string, string[]>();
  for (const face of faces) neighbors.set(face.id, []);
  const edgeToFaces = new Map<string, string[]>();
  for (const e of mesh.edges) edgeToFaces.set(e.id, [...e.faceIds]);
  for (const e of mesh.edges) {
    if (barrier.has(e.id)) continue;
    const ids = e.faceIds; if (ids.length === 2) {
      neighbors.get(ids[0])!.push(ids[1]);
      neighbors.get(ids[1])!.push(ids[0]);
    }
  }
  // Pick seed: a face adjacent to any barrier edge
  let seed: string | null = null;
  for (const eid of loopEdgeIds) {
    const e = edgeObj.get(eid); if (!e) continue;
    for (const fid of e.faceIds) { seed = fid; break; }
    if (seed) break;
  }
  if (!seed) return [];
  // Flood fill region A
  const regionA = new Set<string>();
  const stack = [seed];
  while (stack.length) {
    const f = stack.pop()!; if (regionA.has(f)) continue; regionA.add(f);
    for (const n of neighbors.get(f) || []) if (!regionA.has(n)) stack.push(n);
  }
  // Region B = remaining faces
  const regionB = faces.filter(f => !regionA.has(f.id)).map(f => f.id);
  const regionASize = regionA.size; const regionBSize = regionB.length;
  return regionASize <= regionBSize ? Array.from(regionA) : regionB;
};

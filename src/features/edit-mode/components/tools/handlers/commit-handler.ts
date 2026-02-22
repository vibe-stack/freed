import { Vector3 } from 'three/webgpu';
import { Vertex } from '@/types/geometry';
import { useGeometryStore } from '@/stores/geometry-store';
import { useSelectionStore } from '@/stores/selection-store';
import { useToolStore } from '@/stores/tool-store';
import { createVertex, createFace, buildEdgesFromFaces, calculateFaceNormal } from '@/utils/geometry';

interface CommitHandlerParams {
    localVertices: Vertex[];
    selectedFaceIds: string[];
    meshId: string;
    moveAccumRef: React.MutableRefObject<Vector3>;
    geometryStore: any;
    onEndOperation: (commit: boolean) => void;
}

export function createCommitHandler({
    localVertices,
    selectedFaceIds,
    meshId,
    moveAccumRef,
    geometryStore,
    onEndOperation
}: CommitHandlerParams) {
    return (event: MouseEvent) => {
        if (event.button !== 0) return; // Only left mouse button

        const toolStore = useToolStore.getState();

        if (localVertices.length > 0) {
            if (toolStore.tool === 'extrude') {
                commitExtrudeOperation(localVertices, selectedFaceIds, meshId, geometryStore);
            } else if (toolStore.tool === 'inset') {
                commitInsetOperation(localVertices, selectedFaceIds, meshId, geometryStore);
            } else if (toolStore.tool === 'bevel') {
                commitBevelOperation(localVertices, selectedFaceIds, meshId, geometryStore, toolStore);
            } else if (toolStore.tool === 'chamfer') {
                const distance = (toolStore.localData as any)?.distance ?? (toolStore as any).accumulator?.scale ?? 0;
                commitChamferOperation(meshId, geometryStore, distance || 0);
            } else if (toolStore.tool === 'fillet') {
                const radius = (toolStore.localData as any)?.radius ?? (toolStore as any).accumulator?.scale ?? 0;
                const divisions = (toolStore.localData as any)?.divisions ?? 1;
                commitFilletOperation(meshId, geometryStore, radius || 0, divisions);
            } else {
                // Simple vertex position update
                commitVertexUpdate(localVertices, meshId, geometryStore);
            }
        }

        onEndOperation(true);
        moveAccumRef.current.set(0, 0, 0);
    };
}

export function commitVertexUpdate(localVertices: Vertex[], meshId: string, geometryStore: any) {
    geometryStore.updateMesh(meshId, (mesh: any) => {
        const vertexMap = new Map(localVertices.map(v => [v.id, v]));
        mesh.vertices.forEach((vertex: any) => {
            const updatedVertex = vertexMap.get(vertex.id);
            if (updatedVertex) {
                vertex.position = updatedVertex.position;
            }
        });
    });
    geometryStore.recalculateNormals(meshId);
}

export function commitExtrudeOperation(
    localVertices: Vertex[],
    selectedFaceIds: string[],
    meshId: string,
    geometryStore: any
) {
    const movedMap = new Map(localVertices.map(v => [v.id, v]));

    geometryStore.updateMesh(meshId, (mesh: any) => {
        if (selectedFaceIds.length === 0) return;

        // Compute boundary edges among selected faces
        const selectedFaceSet = new Set(selectedFaceIds);
        const boundaryEdges: Array<{ a: string; b: string }> = [];
        const edgeCount = new Map<string, number>();
        const edgeOrder = new Map<string, { a: string; b: string }>();

        const facesCopy = mesh.faces.slice();
        for (const f of facesCopy) {
            if (!selectedFaceSet.has(f.id)) continue;
            const n = f.vertexIds.length;
            for (let i = 0; i < n; i++) {
                const a = f.vertexIds[i];
                const b = f.vertexIds[(i + 1) % n];
                const key = [a, b].slice().sort().join('-');
                edgeOrder.set(key, { a, b });
                edgeCount.set(key, (edgeCount.get(key) || 0) + 1);
            }
        }

        edgeCount.forEach((count, key) => {
            if (count === 1) {
                const ord = edgeOrder.get(key)!;
                boundaryEdges.push({ a: ord.a, b: ord.b });
            }
        });

        // Duplicate vertices at preview positions
        const dupMap = new Map<string, string>();
        const vertsToDup = new Set<string>();
        for (const fid of selectedFaceIds) {
            const face = mesh.faces.find((f: any) => f.id === fid);
            if (!face) continue;
            face.vertexIds.forEach((id: string) => vertsToDup.add(id));
        }

        for (const vid of vertsToDup) {
            const vOrig = mesh.vertices.find((v: any) => v.id === vid)!;
            const moved = movedMap.get(vid);
            const pos = moved ? moved.position : vOrig.position;
            const dup = createVertex({ ...pos }, { ...vOrig.normal }, { ...vOrig.uv });
            mesh.vertices.push(dup);
            dupMap.set(vid, dup.id);
        }

        // Create cap faces from duplicates
        const newCaps = selectedFaceIds.map(fid => {
            const f = mesh.faces.find((ff: any) => ff.id === fid);
            if (!f) return null;
            const ids = f.vertexIds.map((id: string) => dupMap.get(id) || id);
            return createFace(ids);
        }).filter(Boolean);

        mesh.faces.push(...newCaps);

        // Create side quads
        for (const { a, b } of boundaryEdges) {
            const da = dupMap.get(a)!;
            const db = dupMap.get(b)!;
            if (!da || !db || a === b) continue;
            mesh.faces.push(createFace([a, b, db, da]));
        }

        mesh.edges = buildEdgesFromFaces(mesh.vertices, mesh.faces);
    });

    geometryStore.recalculateNormals(meshId);
}

export function commitInsetOperation(
    localVertices: Vertex[],
    selectedFaceIds: string[],
    meshId: string,
    geometryStore: any
) {
    const movedMap = new Map(localVertices.map(v => [v.id, v]));

    geometryStore.updateMesh(meshId, (mesh: any) => {
        if (selectedFaceIds.length === 0) return;

        const selected = new Set(selectedFaceIds);
        const facesToInset = mesh.faces.filter((f: any) => selected.has(f.id));

        // Remove original selected faces
        mesh.faces = mesh.faces.filter((f: any) => !selected.has(f.id));

        for (const f of facesToInset) {
            const outer = f.vertexIds;
            const dupIds: string[] = [];

            for (const vid of outer) {
                const vOrig = mesh.vertices.find((v: any) => v.id === vid)!;
                const moved = movedMap.get(vid);
                const pos = moved ? moved.position : vOrig.position;
                const dup = createVertex({ ...pos }, { ...vOrig.normal }, { ...vOrig.uv });
                mesh.vertices.push(dup);
                dupIds.push(dup.id);
            }

            // New inner cap face
            const innerFace = createFace([...dupIds]);
            mesh.faces.push(innerFace);

            // Ring quads between outer and inner
            const n = outer.length;
            for (let i = 0; i < n; i++) {
                const a = outer[i];
                const b = outer[(i + 1) % n];
                const da = dupIds[i];
                const db = dupIds[(i + 1) % n];
                mesh.faces.push(createFace([a, b, db, da]));
            }
        }

        mesh.edges = buildEdgesFromFaces(mesh.vertices, mesh.faces);
    });

    geometryStore.recalculateNormals(meshId);
}

export function commitBevelOperation(
    localVertices: Vertex[],
    selectedFaceIds: string[],
    meshId: string,
    geometryStore: any,
    toolStore: any
) {
    const movedMap = new Map(localVertices.map(v => [v.id, v]));

    geometryStore.updateMesh(meshId, (mesh: any) => {
        const selection = useSelectionStore.getState().selection;
        const hasFaces = selection.faceIds.length > 0;
        const hasEdges = selection.edgeIds.length > 0;

        if (!hasFaces && !hasEdges) return;

        if (hasFaces) {
            // Same as inset for face bevel
            const selected = new Set(selection.faceIds);
            const facesToBevel = mesh.faces.filter((f: any) => selected.has(f.id));
            mesh.faces = mesh.faces.filter((f: any) => !selected.has(f.id));

            for (const f of facesToBevel) {
                const outer = f.vertexIds;
                const dupIds: string[] = [];

                for (const vid of outer) {
                    const vOrig = mesh.vertices.find((v: any) => v.id === vid)!;
                    const moved = movedMap.get(vid);
                    const pos = moved ? moved.position : vOrig.position;
                    const dup = createVertex({ ...pos }, { ...vOrig.normal }, { ...vOrig.uv });
                    mesh.vertices.push(dup);
                    dupIds.push(dup.id);
                }

                mesh.faces.push(createFace([...dupIds]));

                const n = outer.length;
                for (let i = 0; i < n; i++) {
                    const a = outer[i];
                    const b = outer[(i + 1) % n];
                    const da = dupIds[i];
                    const db = dupIds[(i + 1) % n];
                    mesh.faces.push(createFace([a, b, db, da]));
                }
            }
        }

        if (hasEdges) {
            // Edge bevel/chamfer/fillet implementation
            // This is a simplified version - the full implementation would be quite complex
            console.log('Edge bevel/chamfer/fillet commit - simplified implementation');
        }

        mesh.edges = buildEdgesFromFaces(mesh.vertices, mesh.faces);
    });

    geometryStore.recalculateNormals(meshId);
}

// Utilities for chamfer/fillet
function replaceEdgeInFace(face: any, v1: string, v2: string, n1: string, n2: string) {
    const ids = face.vertexIds.slice();
    const n = ids.length;
    const i1 = ids.indexOf(v1);
    const i2 = ids.indexOf(v2);
    if (i1 === -1 || i2 === -1) return; // not in this face
    // Check adjacency
    const isAdj = (i2 === (i1 + 1) % n) || (i1 === (i2 + 1) % n);
    if (!isAdj) return; // edge should be adjacent
    // Determine order
    let a = i1, b = i2;
    let na = n1, nb = n2;
    // If the order in face is v2 -> v1, swap to maintain winding
    if ((i2 + n - i1) % n !== 1) {
        a = i2; b = i1; na = n2; nb = n1;
    }
    const out = ids.slice();
    out[a] = na; out[b] = nb;
    face.vertexIds = out;
}

function computeEdgeDir(mesh: any, e: any) {
    const va = mesh.vertices.find((v: any) => v.id === e.vertexIds[0]);
    const vb = mesh.vertices.find((v: any) => v.id === e.vertexIds[1]);
    const dir = new Vector3(
        (vb.position.x - va.position.x),
        (vb.position.y - va.position.y),
        (vb.position.z - va.position.z)
    );
    return dir.normalize();
}

function getFaceNormalMap(mesh: any) {
    const map = new Map<string, { x: number; y: number; z: number }>();
    for (const f of mesh.faces) map.set(f.id, calculateFaceNormal(f, mesh.vertices));
    return map;
}

export function commitChamferOperation(
    meshId: string,
    geometryStore: any,
    distance: number
) {
    // Chamfer: half distance on each side of edge inside adjacent faces; creates a quad band replacing the edge
    const half = Math.max(0, distance) * 0.5;
    geometryStore.updateMesh(meshId, (mesh: any) => {
        const selection = useSelectionStore.getState().selection;
        if (selection.selectionMode !== 'edge' || selection.edgeIds.length === 0) return;
        const faceNormal = getFaceNormalMap(mesh);

        const newBandFaces: any[] = [];

        for (const edgeId of selection.edgeIds) {
            const e = mesh.edges.find((ee: any) => ee.id === edgeId);
            if (!e) continue;
            const v1 = mesh.vertices.find((v: any) => v.id === e.vertexIds[0]);
            const v2 = mesh.vertices.find((v: any) => v.id === e.vertexIds[1]);
            if (!v1 || !v2) continue;
            const edgeDir = computeEdgeDir(mesh, e);

            const faceIds = e.faceIds.slice();
            const dupIdsPerFace: Array<[string, string]> = []; // [newV1, newV2] per face
            for (const fid of faceIds) {
                const fn = faceNormal.get(fid) || { x: 0, y: 0, z: 1 };
                const fN = new Vector3(fn.x, fn.y, fn.z).normalize();
                let perp = new Vector3().crossVectors(fN, edgeDir).normalize();
                // Orient inward via centroid
                const mid = new Vector3(
                    (v1.position.x + v2.position.x) * 0.5,
                    (v1.position.y + v2.position.y) * 0.5,
                    (v1.position.z + v2.position.z) * 0.5,
                );
                const face = mesh.faces.find((ff: any) => ff.id === fid);
                if (face) {
                    let cx = 0, cy = 0, cz = 0;
                    for (const vid of face.vertexIds) {
                        const vv = mesh.vertices.find((x: any) => x.id === vid)!;
                        cx += vv.position.x; cy += vv.position.y; cz += vv.position.z;
                    }
                    const inv = 1 / Math.max(1, face.vertexIds.length);
                    cx *= inv; cy *= inv; cz *= inv;
                    const toC = new Vector3(cx - mid.x, cy - mid.y, cz - mid.z);
                    if (toC.dot(perp) < 0) perp.multiplyScalar(-1);
                }
                const v1n = createVertex({
                    x: v1.position.x + perp.x * half,
                    y: v1.position.y + perp.y * half,
                    z: v1.position.z + perp.z * half,
                }, { ...v1.normal }, { ...v1.uv });
                const v2n = createVertex({
                    x: v2.position.x + perp.x * half,
                    y: v2.position.y + perp.y * half,
                    z: v2.position.z + perp.z * half,
                }, { ...v2.normal }, { ...v2.uv });
                mesh.vertices.push(v1n, v2n);
                dupIdsPerFace.push([v1n.id, v2n.id]);
                const f = mesh.faces.find((f: any) => f.id === fid);
                if (f) replaceEdgeInFace(f, v1.id, v2.id, v1n.id, v2n.id);
            }
            if (dupIdsPerFace.length === 2) {
                const [a1, a2] = dupIdsPerFace[0];
                const [b1, b2] = dupIdsPerFace[1];
                newBandFaces.push(createFace([a1, a2, b2, b1]));
                // Add small caps at endpoints to connect to original topology
                newBandFaces.push(createFace([v1.id, a1, b1]));
                newBandFaces.push(createFace([v2.id, b2, a2]));
            } else if (dupIdsPerFace.length === 1) {
                const [a1, a2] = dupIdsPerFace[0];
                newBandFaces.push(createFace([a1, a2, v2.id, v1.id]));
            }
        }

        mesh.faces.push(...newBandFaces);
        mesh.edges = buildEdgesFromFaces(mesh.vertices, mesh.faces);
    });
    geometryStore.recalculateNormals(meshId);
}

export function commitFilletOperation(
  meshId: string,
  geometryStore: any,
  radius: number,
  divisions: number
) {
  const r = Math.max(0, radius);
  const segs = Math.max(1, divisions);
  geometryStore.updateMesh(meshId, (mesh: any) => {
    const selection = useSelectionStore.getState().selection;
    if (selection.selectionMode !== 'edge' || selection.edgeIds.length === 0) return;
    const faceNormal = getFaceNormalMap(mesh);

    const bandFaces: any[] = [];

    for (const edgeId of selection.edgeIds) {
      const e = mesh.edges.find((ee: any) => ee.id === edgeId);
      if (!e) continue;
      const v1 = mesh.vertices.find((v: any) => v.id === e.vertexIds[0]);
      const v2 = mesh.vertices.find((v: any) => v.id === e.vertexIds[1]);
      if (!v1 || !v2) continue;
      const edgeDir = computeEdgeDir(mesh, e);
      if (e.faceIds.length === 0) continue; // skip loose

      const fidA = e.faceIds[0];
      const fidB = e.faceIds[1] ?? null;
      const nAraw = faceNormal.get(fidA) || { x: 0, y: 0, z: 1 };
      const nA = new Vector3(nAraw.x, nAraw.y, nAraw.z).normalize();
      const pA = new Vector3().crossVectors(nA, edgeDir).normalize();
      let pB = pA.clone().multiplyScalar(-1);
      if (fidB) {
        const nBraw = faceNormal.get(fidB) || { x: 0, y: 0, z: 1 };
        const nB = new Vector3(nBraw.x, nBraw.y, nBraw.z).normalize();
        pB = new Vector3().crossVectors(nB, edgeDir).normalize();
      }
      // Orient into faces via centroid heuristic
      const centerAlong = (va: any, vb: any) => new Vector3(
        (va.position.x + vb.position.x) * 0.5,
        (va.position.y + vb.position.y) * 0.5,
        (va.position.z + vb.position.z) * 0.5
      );
      const mid = centerAlong(v1, v2);
      const orientInward = (fid: string | null, perp: Vector3) => {
        if (!fid) return perp;
        const face = mesh.faces.find((f: any) => f.id === fid);
        if (!face) return perp;
        let cx = 0, cy = 0, cz = 0;
        for (const vid of face.vertexIds) {
          const vv = mesh.vertices.find((x: any) => x.id === vid)!;
          cx += vv.position.x; cy += vv.position.y; cz += vv.position.z;
        }
        const inv = 1 / Math.max(1, face.vertexIds.length);
        cx *= inv; cy *= inv; cz *= inv;
        const toC = new Vector3(cx - mid.x, cy - mid.y, cz - mid.z);
        if (toC.dot(perp) < 0) perp.multiplyScalar(-1);
        return perp;
      };
      orientInward(fidA, pA);
      if (fidB) orientInward(fidB, pB);

      if (!fidB) continue;

      // Compute outward normals consistent with inward pA, pB
      let nA_out = new Vector3().crossVectors(edgeDir, pA).normalize();
      let nB_out = new Vector3().crossVectors(edgeDir, pB).normalize();
      if (nA_out.dot(pB) > 0) nA_out.multiplyScalar(-1);
      if (nB_out.dot(pA) > 0) nB_out.multiplyScalar(-1);

      // Compute arc center to center the arc on the edge
      const cosb = nA_out.dot(nB_out);
      const angleBetween = Math.acos(Math.max(-1, Math.min(1, cosb)));
      const halfAngle = angleBetween / 2;
      const sinHalfAngle = Math.sin(halfAngle);
      const centerDist = r / (sinHalfAngle > 0.0001 ? sinHalfAngle : 0.0001); // Avoid division by zero
      // Use the negative bisector to place center inside the angle
      const bisector = new Vector3().addVectors(nA_out, nB_out).normalize();
      const local_c = bisector.multiplyScalar(-centerDist);

      // Compute start and end points of the arc
      const local_s = new Vector3().addVectors(local_c, nA_out.clone().multiplyScalar(r));
      const local_e = new Vector3().addVectors(local_c, nB_out.clone().multiplyScalar(r));

      // NO ADJUSTMENT NEEDED - the arc is correctly positioned without forcing the midpoint to the edge

      // Compute the arc parameters directly
      const vec_start = new Vector3().subVectors(local_s, local_c).normalize();
      const vec_end = new Vector3().subVectors(local_e, local_c).normalize();
      const cross_v = new Vector3().crossVectors(vec_start, vec_end);
      const dot_v = Math.max(-1, Math.min(1, vec_start.dot(vec_end)));
      const sign_a = Math.sign(cross_v.dot(edgeDir));
      const theta_a = Math.acos(dot_v) * (sign_a === 0 ? 1 : sign_a);

      const k = edgeDir.clone().normalize();

      // Build rings with arc points
      const ring1: string[] = [];
      const ring2: string[] = [];
      for (let i = 0; i <= segs; i++) {
        const t = i / segs;
        const angle = theta_a * t;
        let dir_i = vec_start.clone();
        const cos = Math.cos(angle), sin = Math.sin(angle);
        const term1 = dir_i.multiplyScalar(cos);
        const term2 = new Vector3().crossVectors(k, dir_i).multiplyScalar(sin);
        const term3 = k.clone().multiplyScalar(k.dot(dir_i) * (1 - cos));
        dir_i = new Vector3().addVectors(term1, term2).add(term3).normalize();
        
        const local_point = new Vector3().addVectors(local_c, dir_i.multiplyScalar(r));
        const v1i = createVertex({
          x: v1.position.x + local_point.x,
          y: v1.position.y + local_point.y,
          z: v1.position.z + local_point.z,
        }, { ...v1.normal }, { ...v1.uv });
        const v2i = createVertex({
          x: v2.position.x + local_point.x,
          y: v2.position.y + local_point.y,
          z: v2.position.z + local_point.z,
        }, { ...v2.normal }, { ...v2.uv });
        mesh.vertices.push(v1i, v2i);
        ring1.push(v1i.id);
        ring2.push(v2i.id);
      }

      // Replace in adjacent faces: first ring for A, last ring for B
      const faceA = mesh.faces.find((f: any) => f.id === fidA);
      if (faceA) replaceEdgeInFace(faceA, v1.id, v2.id, ring1[0], ring2[0]);
      if (fidB) {
        const faceB = mesh.faces.find((f: any) => f.id === fidB);
        if (faceB) replaceEdgeInFace(faceB, v1.id, v2.id, ring1[ring1.length - 1], ring2[ring2.length - 1]);
      }

      // Create band quads between successive rings
      for (let i = 0; i < segs; i++) {
        const a1 = ring1[i];
        const a2 = ring2[i];
        const b2 = ring2[i + 1];
        const b1 = ring1[i + 1];
        bandFaces.push(createFace([a1, a2, b2, b1]));
      }
    }

    mesh.faces.push(...bandFaces);
    mesh.edges = buildEdgesFromFaces(mesh.vertices, mesh.faces);
  });
  geometryStore.recalculateNormals(meshId);
}
import { Vector3 } from 'three/webgpu';
import { Vertex } from '@/types/geometry';
import { useGeometryStore } from '@/stores/geometry-store';
import { useSelectionStore } from '@/stores/selection-store';
import { useToolStore } from '@/stores/tool-store';
import { createVertex, createFace, buildEdgesFromFaces, calculateFaceNormal } from '@/utils/geometry';
import { repairMeshTopology } from '@/utils/edit-ops';

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

        const selectedFaceSet = new Set(selectedFaceIds);
        const selectedFaces = mesh.faces.filter((f: any) => selectedFaceSet.has(f.id));
        if (selectedFaces.length === 0) return;

        const edgeCount = new Map<string, number>();
        const edgeOrder = new Map<string, { a: string; b: string }>();
        const keyFor = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

        for (const face of selectedFaces) {
            const n = face.vertexIds.length;
            for (let i = 0; i < n; i++) {
                const a = face.vertexIds[i];
                const b = face.vertexIds[(i + 1) % n];
                const key = keyFor(a, b);
                edgeCount.set(key, (edgeCount.get(key) || 0) + 1);
                if (!edgeOrder.has(key)) edgeOrder.set(key, { a, b });
            }
        }

        const boundaryEdges: Array<{ a: string; b: string }> = [];
        for (const [key, count] of edgeCount.entries()) {
            if (count === 1) {
                const ord = edgeOrder.get(key)!;
                boundaryEdges.push({ a: ord.a, b: ord.b });
            }
        }

        const dupMap = new Map<string, string>();
        const selectedVertexIds = new Set<string>();
        for (const face of selectedFaces) {
            for (const vid of face.vertexIds) selectedVertexIds.add(vid);
        }

        for (const vid of selectedVertexIds) {
            const vOrig = mesh.vertices.find((v: any) => v.id === vid);
            if (!vOrig) continue;
            const moved = movedMap.get(vid);
            const pos = moved ? moved.position : vOrig.position;
            const dup = createVertex({ ...pos }, { ...vOrig.normal }, { ...vOrig.uv });
            mesh.vertices.push(dup);
            dupMap.set(vid, dup.id);
        }

        // Remove original region faces, then add inset cap region from duplicated vertices
        mesh.faces = mesh.faces.filter((f: any) => !selectedFaceSet.has(f.id));

        for (const face of selectedFaces) {
            const insetIds = face.vertexIds.map((id: string) => dupMap.get(id) || id);
            mesh.faces.push(createFace(insetIds));
        }

        // Bridge only boundary edges
        for (const { a, b } of boundaryEdges) {
            const da = dupMap.get(a);
            const db = dupMap.get(b);
            if (!da || !db) continue;
            mesh.faces.push(createFace([a, b, db, da]));
        }

        cleanupEdgeRoundingTopology(mesh);
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
    const selection = useSelectionStore.getState().selection;
    const hasFaces = selection.faceIds.length > 0;
    const hasEdges = selection.edgeIds.length > 0;

    if (!hasFaces && !hasEdges) return;

    if (hasEdges) {
        const mesh = useGeometryStore.getState().meshes.get(meshId);
        if (!mesh) return;

        let totalDisp = 0;
        let count = 0;
        const edgeSet = new Set(selection.edgeIds);
        const edgeVertexIds = new Set<string>();
        for (const edge of mesh.edges) {
            if (!edgeSet.has(edge.id)) continue;
            edge.vertexIds.forEach((id: string) => edgeVertexIds.add(id));
        }
        for (const vid of edgeVertexIds) {
            const orig = mesh.vertices.find((v: any) => v.id === vid);
            const moved = movedMap.get(vid);
            if (!orig || !moved) continue;
            const dx = moved.position.x - orig.position.x;
            const dy = moved.position.y - orig.position.y;
            const dz = moved.position.z - orig.position.z;
            totalDisp += Math.hypot(dx, dy, dz);
            count++;
        }
        const width = count > 0 ? totalDisp / count : 0;
        const divisions = Math.max(1, Math.floor((toolStore?.localData as any)?.divisions ?? 1));

        if (divisions <= 1) {
            commitChamferOperation(meshId, geometryStore, width * 2);
        } else {
            commitFilletOperation(meshId, geometryStore, width, divisions);
        }
        return;
    }

    geometryStore.updateMesh(meshId, (mesh: any) => {
        const selectedFaceSet = new Set(selection.faceIds);
        const selectedFaces = mesh.faces.filter((f: any) => selectedFaceSet.has(f.id));
        if (selectedFaces.length === 0) return;

        const edgeCount = new Map<string, number>();
        const edgeOrder = new Map<string, { a: string; b: string }>();
        const keyFor = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

        for (const face of selectedFaces) {
            const n = face.vertexIds.length;
            for (let i = 0; i < n; i++) {
                const a = face.vertexIds[i];
                const b = face.vertexIds[(i + 1) % n];
                const key = keyFor(a, b);
                edgeCount.set(key, (edgeCount.get(key) || 0) + 1);
                if (!edgeOrder.has(key)) edgeOrder.set(key, { a, b });
            }
        }

        const boundaryEdges: Array<{ a: string; b: string }> = [];
        for (const [key, count] of edgeCount.entries()) {
            if (count === 1) {
                const ord = edgeOrder.get(key)!;
                boundaryEdges.push({ a: ord.a, b: ord.b });
            }
        }

        const dupMap = new Map<string, string>();
        const selectedVertexIds = new Set<string>();
        for (const face of selectedFaces) {
            for (const vid of face.vertexIds) selectedVertexIds.add(vid);
        }

        for (const vid of selectedVertexIds) {
            const vOrig = mesh.vertices.find((v: any) => v.id === vid);
            if (!vOrig) continue;
            const moved = movedMap.get(vid);
            const pos = moved ? moved.position : vOrig.position;
            const dup = createVertex({ ...pos }, { ...vOrig.normal }, { ...vOrig.uv });
            mesh.vertices.push(dup);
            dupMap.set(vid, dup.id);
        }

        mesh.faces = mesh.faces.filter((f: any) => !selectedFaceSet.has(f.id));

        for (const face of selectedFaces) {
            const bevelIds = face.vertexIds.map((id: string) => dupMap.get(id) || id);
            mesh.faces.push(createFace(bevelIds));
        }

        for (const { a, b } of boundaryEdges) {
            const da = dupMap.get(a);
            const db = dupMap.get(b);
            if (!da || !db) continue;
            mesh.faces.push(createFace([a, b, db, da]));
        }

        cleanupEdgeRoundingTopology(mesh);
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

function faceVertexKey(faceId: string, vertexId: string) {
    return `${faceId}::${vertexId}`;
}

function cleanupEdgeRoundingTopology(mesh: any) {
    mesh.faces = mesh.faces.filter((face: any) => {
        if (!face?.vertexIds || face.vertexIds.length < 3) return false;
        return new Set(face.vertexIds).size >= 3;
    });

    const seen = new Set<string>();
    mesh.faces = mesh.faces.filter((face: any) => {
        const key = [...face.vertexIds].sort().join('|');
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    repairMeshTopology(mesh);
    mesh.edges = buildEdgesFromFaces(mesh.vertices, mesh.faces);
}

function faceHasEdge(face: any, a: string, b: string) {
    const ids = face?.vertexIds || [];
    const n = ids.length;
    for (let i = 0; i < n; i++) {
        const x = ids[i];
        const y = ids[(i + 1) % n];
        if ((x === a && y === b) || (x === b && y === a)) return true;
    }
    return false;
}

function splitEndpointInSideFaces(
    mesh: any,
    originalFaceById: Map<string, any>,
    edgeInfos: Array<{ edge: any; v1: any; v2: any; faceIds: string[] }>,
    endpointChains: Map<string, string[]>,
) {
    const processed = new Set<string>();
    const liveFaceById = new Map(mesh.faces.map((f: any) => [f.id, f] as const));

    const processVertex = (vertexId: string, faceA: string, faceB: string) => {
        const chainKey = `${faceA}|${faceB}|${vertexId}`;
        const chainForward = endpointChains.get(chainKey);
        if (!chainForward || chainForward.length < 2) return;

        for (const originalFace of originalFaceById.values()) {
            if (originalFace.id === faceA || originalFace.id === faceB) continue;
            if (!originalFace.vertexIds.includes(vertexId)) continue;

            const liveFace = liveFaceById.get(originalFace.id) as { id: string; vertexIds: string[],  } | undefined;
            if (!liveFace) continue;
            const key = `${(liveFace as any).id}::${vertexId}`;
            if (processed.has(key)) continue;
            const iLive = (liveFace as any).vertexIds.indexOf(vertexId);
            if (iLive === -1) continue;

            const idsOrig = originalFace.vertexIds as string[];
            const n = idsOrig.length;
            const iOrig = idsOrig.indexOf(vertexId);
            if (iOrig === -1) continue;
            const prev = idsOrig[(iOrig - 1 + n) % n];
            const next = idsOrig[(iOrig + 1) % n];

            const faceAOrig = originalFaceById.get(faceA);
            const faceBOrig = originalFaceById.get(faceB);
            const prevUsesA = faceAOrig ? faceHasEdge(faceAOrig, vertexId, prev) : false;
            const prevUsesB = faceBOrig ? faceHasEdge(faceBOrig, vertexId, prev) : false;
            const nextUsesA = faceAOrig ? faceHasEdge(faceAOrig, vertexId, next) : false;
            const nextUsesB = faceBOrig ? faceHasEdge(faceBOrig, vertexId, next) : false;

            let insert = chainForward;
            if (prevUsesB && nextUsesA) {
                insert = [...chainForward].reverse();
            } else if (prevUsesA && nextUsesB) {
                insert = chainForward;
            } else if (prevUsesA || nextUsesB) {
                insert = chainForward;
            } else if (prevUsesB || nextUsesA) {
                insert = [...chainForward].reverse();
            }

            liveFace.vertexIds.splice(iLive, 1, ...insert);
            processed.add(key);
        }
    };

    for (const info of edgeInfos) {
        const [faceA, faceB] = info.faceIds;
        if (!faceA || !faceB) continue;
        processVertex(info.v1.id, faceA, faceB);
        processVertex(info.v2.id, faceA, faceB);
    }
}

export function commitChamferOperation(
    meshId: string,
    geometryStore: any,
    distance: number
) {
    const half = Math.max(0, distance) * 0.5;
    geometryStore.updateMesh(meshId, (mesh: any) => {
        const selection = useSelectionStore.getState().selection;
        if (selection.selectionMode !== 'edge' || selection.edgeIds.length === 0) return;
        if (half <= 0) return;
        const originalFaceById = new Map(mesh.faces.map((f: any) => [f.id, { ...f, vertexIds: [...f.vertexIds] }] as const)) as Map<string, { id: string; vertexIds: string[] }>;

        const faceNormal = getFaceNormalMap(mesh);
        const edgeById = new Map(mesh.edges.map((e: any) => [e.id, e] as const)) as Map<string, { id: string; vertexIds: string[]; faceIds: string[] }>;
        const faceById = new Map(mesh.faces.map((f: any) => [f.id, f] as const)) as Map<string, { id: string; vertexIds: string[] }>;
        const vertexById = new Map(mesh.vertices.map((v: any) => [v.id, v] as const)) as Map<string, { id: string; position: { x: number; y: number; z: number }; normal: { x: number; y: number; z: number }; uv?: { u: number; v: number } }>;

        const offsetSum = new Map<string, Vector3>();
        const offsetCount = new Map<string, number>();
        const edgeInfos: Array<{ edge: any; v1: any; v2: any; faceIds: string[] }> = [];

        const addOffset = (faceId: string, vertexId: string, offset: Vector3) => {
            const key = faceVertexKey(faceId, vertexId);
            const current = offsetSum.get(key) || new Vector3(0, 0, 0);
            current.add(offset);
            offsetSum.set(key, current);
            offsetCount.set(key, (offsetCount.get(key) || 0) + 1);
        };

        for (const edgeId of selection.edgeIds) {
            const edge = edgeById.get(edgeId);
            if (!edge) continue;
            const v1 = vertexById.get(edge.vertexIds[0]);
            const v2 = vertexById.get(edge.vertexIds[1]);
            if (!v1 || !v2) continue;
            const edgeDir = computeEdgeDir(mesh, edge);
            const faceIds = edge.faceIds.filter((fid: string) => faceById.has(fid));
            if (faceIds.length === 0) continue;
            edgeInfos.push({ edge, v1, v2, faceIds });

            for (const faceId of faceIds) {
                const face = faceById.get(faceId);
                if (!face) continue;
                const fn = faceNormal.get(faceId) || { x: 0, y: 0, z: 1 };
                const fN = new Vector3(fn.x, fn.y, fn.z).normalize();
                const perp = new Vector3().crossVectors(fN, edgeDir).normalize();
                if (perp.lengthSq() < 1e-12) continue;

                let cx = 0, cy = 0, cz = 0;
                for (const vid of face.vertexIds) {
                    const vv = vertexById.get(vid);
                    if (!vv) continue;
                    cx += vv.position.x;
                    cy += vv.position.y;
                    cz += vv.position.z;
                }
                const inv = 1 / Math.max(1, face.vertexIds.length);
                cx *= inv;
                cy *= inv;
                cz *= inv;

                const mid = new Vector3(
                    (v1.position.x + v2.position.x) * 0.5,
                    (v1.position.y + v2.position.y) * 0.5,
                    (v1.position.z + v2.position.z) * 0.5,
                );
                const toCentroid = new Vector3(cx - mid.x, cy - mid.y, cz - mid.z);
                if (toCentroid.dot(perp) < 0) perp.multiplyScalar(-1);

                const offset = perp.multiplyScalar(half);
                addOffset(faceId, v1.id, offset);
                addOffset(faceId, v2.id, offset);
            }
        }

        const duplicateByFaceVertex = new Map<string, string>();
        for (const [key, sum] of offsetSum.entries()) {
            const [faceId, vertexId] = key.split('::');
            const original = vertexById.get(vertexId);
            if (!original) continue;
            const count = Math.max(1, offsetCount.get(key) || 1);
            const avgOffset = sum.clone().multiplyScalar(1 / count);
            if (avgOffset.lengthSq() < 1e-12) continue;

            const created = createVertex({
                x: original.position.x + avgOffset.x,
                y: original.position.y + avgOffset.y,
                z: original.position.z + avgOffset.z,
            }, { ...original.normal }, { ...(original as any).uv });
            mesh.vertices.push(created);
            duplicateByFaceVertex.set(faceVertexKey(faceId, vertexId), created.id);
        }

        for (const face of mesh.faces) {
            let changed = false;
            const replaced = face.vertexIds.map((vertexId: string) => {
                const mapped = duplicateByFaceVertex.get(faceVertexKey(face.id, vertexId));
                if (mapped) {
                    changed = true;
                    return mapped;
                }
                return vertexId;
            });
            if (changed) face.vertexIds = replaced;
        }

        const endpointChains = new Map<string, string[]>();
        for (const info of edgeInfos) {
            const [faceA, faceB] = info.faceIds;
            if (!faceA || !faceB) continue;
            const a1 = duplicateByFaceVertex.get(faceVertexKey(faceA, info.v1.id));
            const a2 = duplicateByFaceVertex.get(faceVertexKey(faceB, info.v1.id));
            const b1 = duplicateByFaceVertex.get(faceVertexKey(faceA, info.v2.id));
            const b2 = duplicateByFaceVertex.get(faceVertexKey(faceB, info.v2.id));
            if (a1 && a2) {
                endpointChains.set(`${faceA}|${faceB}|${info.v1.id}`, [a1, a2]);
            }
            if (b1 && b2) {
                endpointChains.set(`${faceA}|${faceB}|${info.v2.id}`, [b1, b2]);
            }
        }

        splitEndpointInSideFaces(mesh, originalFaceById, edgeInfos, endpointChains);

        const newBandFaces: any[] = [];
        for (const info of edgeInfos) {
            const [faceA, faceB] = info.faceIds;
            if (faceA && faceB) {
                const a1 = duplicateByFaceVertex.get(faceVertexKey(faceA, info.v1.id));
                const b1 = duplicateByFaceVertex.get(faceVertexKey(faceA, info.v2.id));
                const a2 = duplicateByFaceVertex.get(faceVertexKey(faceB, info.v1.id));
                const b2 = duplicateByFaceVertex.get(faceVertexKey(faceB, info.v2.id));
                if (a1 && b1 && a2 && b2) {
                    newBandFaces.push(createFace([a1, b1, b2, a2]));
                }
            } else if (faceA) {
                const a1 = duplicateByFaceVertex.get(faceVertexKey(faceA, info.v1.id));
                const b1 = duplicateByFaceVertex.get(faceVertexKey(faceA, info.v2.id));
                if (a1 && b1) {
                    newBandFaces.push(createFace([a1, b1, info.v2.id, info.v1.id]));
                }
            }
        }

        mesh.faces.push(...newBandFaces);
        cleanupEdgeRoundingTopology(mesh);
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
        const segs = Math.max(1, Math.floor(divisions));
        geometryStore.updateMesh(meshId, (mesh: any) => {
                const selection = useSelectionStore.getState().selection;
                if (selection.selectionMode !== 'edge' || selection.edgeIds.length === 0) return;
                if (r <= 0) return;
            const originalFaceById = new Map(mesh.faces.map((f: any) => [f.id, { ...f, vertexIds: [...f.vertexIds] }] as const)) as Map<string, { id: string; vertexIds: string[] }>;

                const faceNormal = getFaceNormalMap(mesh);
                const edgeById = new Map(mesh.edges.map((e: any) => [e.id, e] as const)) as Map<string, { id: string; vertexIds: string[]; faceIds: string[] }>;
                const faceById = new Map(mesh.faces.map((f: any) => [f.id, f] as const)) as Map<string, { id: string; vertexIds: string[] }>;
                const vertexById = new Map(mesh.vertices.map((v: any) => [v.id, v] as const)) as Map<string, { id: string; position: { x: number; y: number; z: number }; normal: { x: number; y: number; z: number }; uv?: { u: number; v: number } }>;

                const offsetSum = new Map<string, Vector3>();
                const offsetCount = new Map<string, number>();
                const edgeInfos: Array<{ edge: any; v1: any; v2: any; faceIds: string[] }> = [];

                const addOffset = (faceId: string, vertexId: string, offset: Vector3) => {
                        const key = faceVertexKey(faceId, vertexId);
                        const current = offsetSum.get(key) || new Vector3(0, 0, 0);
                        current.add(offset);
                        offsetSum.set(key, current);
                        offsetCount.set(key, (offsetCount.get(key) || 0) + 1);
                };

                for (const edgeId of selection.edgeIds) {
                        const edge = edgeById.get(edgeId);
                        if (!edge) continue;
                        const v1 = vertexById.get(edge.vertexIds[0]);
                        const v2 = vertexById.get(edge.vertexIds[1]);
                        if (!v1 || !v2) continue;
                        const edgeDir = computeEdgeDir(mesh, edge);
                        const faceIds = edge.faceIds.filter((fid: string) => faceById.has(fid));
                        if (faceIds.length === 0) continue;
                        edgeInfos.push({ edge, v1, v2, faceIds });

                        for (const faceId of faceIds) {
                                const face = faceById.get(faceId);
                                if (!face) continue;
                                const fn = faceNormal.get(faceId) || { x: 0, y: 0, z: 1 };
                                const fN = new Vector3(fn.x, fn.y, fn.z).normalize();
                                const perp = new Vector3().crossVectors(fN, edgeDir).normalize();
                                if (perp.lengthSq() < 1e-12) continue;

                                let cx = 0, cy = 0, cz = 0;
                                for (const vid of face.vertexIds) {
                                        const vv = vertexById.get(vid);
                                        if (!vv) continue;
                                        cx += vv.position.x;
                                        cy += vv.position.y;
                                        cz += vv.position.z;
                                }
                                const inv = 1 / Math.max(1, face.vertexIds.length);
                                cx *= inv;
                                cy *= inv;
                                cz *= inv;

                                const mid = new Vector3(
                                        (v1.position.x + v2.position.x) * 0.5,
                                        (v1.position.y + v2.position.y) * 0.5,
                                        (v1.position.z + v2.position.z) * 0.5,
                                );
                                const toCentroid = new Vector3(cx - mid.x, cy - mid.y, cz - mid.z);
                                if (toCentroid.dot(perp) < 0) perp.multiplyScalar(-1);

                                const offset = perp.multiplyScalar(r);
                                addOffset(faceId, v1.id, offset);
                                addOffset(faceId, v2.id, offset);
                        }
                }

                const duplicateByFaceVertex = new Map<string, string>();
                for (const [key, sum] of offsetSum.entries()) {
                        const [faceId, vertexId] = key.split('::');
                        const original = vertexById.get(vertexId);
                        if (!original) continue;
                        const count = Math.max(1, offsetCount.get(key) || 1);
                        const avgOffset = sum.clone().multiplyScalar(1 / count);
                        if (avgOffset.lengthSq() < 1e-12) continue;

                        const created = createVertex({
                                x: original.position.x + avgOffset.x,
                                y: original.position.y + avgOffset.y,
                                z: original.position.z + avgOffset.z,
                        }, { ...original.normal }, { ...(original as any).uv });
                        mesh.vertices.push(created);
                        duplicateByFaceVertex.set(faceVertexKey(faceId, vertexId), created.id);
                }

                for (const face of mesh.faces) {
                        let changed = false;
                        const replaced = face.vertexIds.map((vertexId: string) => {
                                const mapped = duplicateByFaceVertex.get(faceVertexKey(face.id, vertexId));
                                if (mapped) {
                                        changed = true;
                                        return mapped;
                                }
                                return vertexId;
                        });
                        if (changed) face.vertexIds = replaced;
                }

                    const endpointChains = new Map<string, string[]>();

                const currentVertexById = () => new Map(mesh.vertices.map((v: any) => [v.id, v] as const)) as Map<string, { id: string; position: { x: number; y: number; z: number }; normal: { x: number; y: number; z: number }; uv?: { u: number; v: number } }>;

                const bowedOffsetTowardCorner = (start: Vector3, end: Vector3, t: number) => {
                    const a = (1 - t) * (1 - t);
                    const b = t * t;
                    return start.clone().multiplyScalar(a).add(end.clone().multiplyScalar(b));
                };

                const bandFaces: any[] = [];

                for (const info of edgeInfos) {
                        const [faceA, faceB] = info.faceIds;
                        if (!faceA) continue;

                        const aStart = duplicateByFaceVertex.get(faceVertexKey(faceA, info.v1.id));
                        const bStart = duplicateByFaceVertex.get(faceVertexKey(faceA, info.v2.id));
                        if (!aStart || !bStart) continue;

                        if (!faceB) {
                                bandFaces.push(createFace([aStart, bStart, info.v2.id, info.v1.id]));
                                continue;
                        }

                        const aEnd = duplicateByFaceVertex.get(faceVertexKey(faceB, info.v1.id));
                        const bEnd = duplicateByFaceVertex.get(faceVertexKey(faceB, info.v2.id));
                        if (!aEnd || !bEnd) continue;

                        const vNow = currentVertexById();
                        const startV1 = vNow.get(aStart);
                        const endV1 = vNow.get(aEnd);
                        const startV2 = vNow.get(bStart);
                        const endV2 = vNow.get(bEnd);
                        if (!startV1 || !endV1 || !startV2 || !endV2) continue;

                        const base1 = new Vector3(info.v1.position.x, info.v1.position.y, info.v1.position.z);
                        const base2 = new Vector3(info.v2.position.x, info.v2.position.y, info.v2.position.z);
                        const off1Start = new Vector3(
                                startV1.position.x - info.v1.position.x,
                                startV1.position.y - info.v1.position.y,
                                startV1.position.z - info.v1.position.z,
                        );
                        const off1End = new Vector3(
                                endV1.position.x - info.v1.position.x,
                                endV1.position.y - info.v1.position.y,
                                endV1.position.z - info.v1.position.z,
                        );
                        const off2Start = new Vector3(
                                startV2.position.x - info.v2.position.x,
                                startV2.position.y - info.v2.position.y,
                                startV2.position.z - info.v2.position.z,
                        );
                        const off2End = new Vector3(
                                endV2.position.x - info.v2.position.x,
                                endV2.position.y - info.v2.position.y,
                                endV2.position.z - info.v2.position.z,
                        );

                        const rings: Array<[string, string]> = [[aStart, bStart]];
                        for (let i = 1; i < segs; i++) {
                                const t = i / segs;
                            const off1 = bowedOffsetTowardCorner(off1Start, off1End, t);
                            const off2 = bowedOffsetTowardCorner(off2Start, off2End, t);

                                const v1i = createVertex({
                                        x: base1.x + off1.x,
                                        y: base1.y + off1.y,
                                        z: base1.z + off1.z,
                                }, { ...info.v1.normal }, { ...info.v1.uv });
                                const v2i = createVertex({
                                        x: base2.x + off2.x,
                                        y: base2.y + off2.y,
                                        z: base2.z + off2.z,
                                }, { ...info.v2.normal }, { ...info.v2.uv });
                                mesh.vertices.push(v1i, v2i);
                                rings.push([v1i.id, v2i.id]);
                        }
                        rings.push([aEnd, bEnd]);

                        endpointChains.set(
                            `${faceA}|${faceB}|${info.v1.id}`,
                            rings.map((r) => r[0])
                        );
                        endpointChains.set(
                            `${faceA}|${faceB}|${info.v2.id}`,
                            rings.map((r) => r[1])
                        );

                        for (let i = 0; i < rings.length - 1; i++) {
                                const [ra1, ra2] = rings[i];
                                const [rb1, rb2] = rings[i + 1];
                                bandFaces.push(createFace([ra1, ra2, rb2, rb1]));
                        }
                }

                mesh.faces.push(...bandFaces);
                splitEndpointInSideFaces(mesh, originalFaceById, edgeInfos, endpointChains);
                cleanupEdgeRoundingTopology(mesh);
        });
  geometryStore.recalculateNormals(meshId);
}
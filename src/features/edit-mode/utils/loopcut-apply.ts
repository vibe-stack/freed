import { computeEdgeLoopFaceSpans, type FaceSpan } from '@/utils/loopcut';
import { buildEdgesFromFaces, createFace, createVertex } from '@/utils/geometry';
import type { Mesh } from '@/types/geometry';

// Applies a loop cut to the mesh, fixing canonical edge handling and preserving winding.
export const applyLoopCut = (
    updateMesh: (meshId: string, updater: (mesh: Mesh) => void) => void,
    recalculateNormals: (meshId: string) => void,
    meshId: string,
    hoverEdgeId: string,
    segments: number,
    slideT: number,
    precomputedSpans?: FaceSpan[] | null
) => {
    const N = Math.max(1, Math.floor(segments));
    updateMesh(meshId, (m: Mesh) => {
        const spans = (precomputedSpans && precomputedSpans.length > 0)
            ? precomputedSpans
            : computeEdgeLoopFaceSpans(m, hoverEdgeId);
        if (spans.length === 0) return;

        const vmap = new Map(m.vertices.map((v) => [v.id, v] as const));
        const keyFor = (a: string, b: string) => (a < b ? `${a}-${b}` : `${b}-${a}`);
        const edgeSplit = new Map<string, string>(); // key: canonicalEdge|segIndex -> vertexId

    const base = (i: number) => i / (N + 1);
    // The average of i/(N+1) for i=1..N is exactly 0.5
    const avgBase = 0.5;
        const delta = slideT - avgBase;
        const tPositions = Array.from({ length: N }, (_v, i) => Math.max(0.001, Math.min(0.999, base(i + 1) + delta)));

        const getOrCreateOnEdge = (edge: [string, string], t: number, segIndex: number) => {
            const va = vmap.get(edge[0])!;
            const vb = vmap.get(edge[1])!;
            const da = va.position;
            const db = vb.position;

            // Find dominant axis
            const dx = Math.abs(da.x - db.x);
            const dy = Math.abs(da.y - db.y);
            const dz = Math.abs(da.z - db.z);
            const maxD = Math.max(dx, dy, dz);
            let axis: 'x' | 'y' | 'z' = 'y';
            if (maxD === dx) axis = 'x';
            else if (maxD === dz) axis = 'z';

            // Determine low and high based on axis
            let low = va;
            let high = vb;
            if (da[axis] > db[axis]) {
                low = vb;
                high = va;
            }

            // Fallback if equal on axis
            if (da[axis] === db[axis]) {
                const minId = edge[0] < edge[1] ? edge[0] : edge[1];
                const maxId = edge[0] < edge[1] ? edge[1] : edge[0];
                low = vmap.get(minId)!;
                high = vmap.get(maxId)!;
            }

            // Canonical key (undirected, ID-sorted)
            let a = edge[0], b = edge[1];
            if (a > b) { const tmp = a; a = b; b = tmp; }
            const k = `${a}-${b}|${segIndex}`;

            const found = edgeSplit.get(k);
            if (found) return found;

            // Compute pos at t from low to high
            const pos = {
                x: low.position.x + t * (high.position.x - low.position.x),
                y: low.position.y + t * (high.position.y - low.position.y),
                z: low.position.z + t * (high.position.z - low.position.z),
            };

            // Interpolate normal and uv
            const normal = {
                x: low.normal.x + t * (high.normal.x - low.normal.x),
                y: low.normal.y + t * (high.normal.y - low.normal.y),
                z: low.normal.z + t * (high.normal.z - low.normal.z),
            };
            const uv = {
                x: low.uv.x + t * (high.uv.x - low.uv.x),
                y: low.uv.y + t * (high.uv.y - low.uv.y),
            };

            const dup = createVertex(pos, normal, uv);
            m.vertices.push(dup);
            vmap.set(dup.id, dup);
            edgeSplit.set(k, dup.id);
            return dup.id;
        };

        // Build replacement faces for all spans; use span.parallelA/B orientation directly
        const facesToRemove = new Set(spans.map((s) => s.faceId));
        const newFaces: ReturnType<typeof createFace>[] = [];

        for (const span of spans) {
            const face = m.faces.find((f) => f.id === span.faceId);
            if (!face || face.vertexIds.length !== 4) continue; // only quads supported for now

            const [a0, a1] = span.parallelA;
            const [b0, b1] = span.parallelB;

            const Aseq: string[] = [a0];
            const Bseq: string[] = [b0];
            tPositions.forEach((t, i) => {
                Aseq.push(getOrCreateOnEdge([a0, a1], t, i));
                Bseq.push(getOrCreateOnEdge([b0, b1], t, i));
            });
            Aseq.push(a1); Bseq.push(b1);

            // Maintain CCW: [Ak, Ak+1, Bk+1, Bk]
            for (let k = 0; k < Aseq.length - 1; k++) {
                newFaces.push(createFace([Aseq[k], Aseq[k + 1], Bseq[k + 1], Bseq[k]]));
            }
        }

        m.faces = m.faces.filter((f) => !facesToRemove.has(f.id));
        m.faces.push(...newFaces);
        m.edges = buildEdgesFromFaces(m.vertices, m.faces);
    });
    recalculateNormals(meshId);
};

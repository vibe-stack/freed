import { useEffect, useState } from 'react';
import { Vector3 } from 'three/webgpu';
import { useToolStore } from '@/stores/tool-store';
import { useSelectionStore } from '@/stores/selection-store';
import { useGeometryStore } from '@/stores/geometry-store';
import type { Mesh } from '@/types/geometry';
import { calculateFaceNormal } from '@/utils/geometry';

export interface FilletLine { a: Vector3; b: Vector3 }

export function useFilletPreview(mesh: Mesh | null) {
    const isActive = useToolStore((s) => s.isActive);
    const tool = useToolStore((s) => s.tool);
    const localData = useToolStore((s) => s.localData);
    const geometryStore = useGeometryStore();
    const selection = useSelectionStore((s) => s.selection);

    const [lines, setLines] = useState<FilletLine[]>([]);

    useEffect(() => {
        if (!isActive || tool !== 'fillet' || !mesh) {
            setLines([]);
            return;
        }
        const radius = Math.max(0, (localData as any)?.radius ?? 0);
        const divisions = Math.max(1, (localData as any)?.divisions ?? 1);
        if (radius <= 0) { setLines([]); return; }

        const vmap = new Map(mesh.vertices.map(v => [v.id, v] as const));
        const faceNormal = new Map<string, { x: number; y: number; z: number }>();
        for (const f of mesh.faces) faceNormal.set(f.id, calculateFaceNormal(f, mesh.vertices));

        const out: FilletLine[] = [];

        for (const edgeId of selection.edgeIds) {
            const e = mesh.edges.find(ee => ee.id === edgeId);
            if (!e) continue;
            const v1 = vmap.get(e.vertexIds[0])!;
            const v2 = vmap.get(e.vertexIds[1])!;
            const edgeDir = new Vector3(
                v2.position.x - v1.position.x,
                v2.position.y - v1.position.y,
                v2.position.z - v1.position.z
            ).normalize();
            if (e.faceIds.length === 0) continue;
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
            // Inward orientation via centroid heuristic
            const mid = new Vector3(
                (v1.position.x + v2.position.x) * 0.5,
                (v1.position.y + v2.position.y) * 0.5,
                (v1.position.z + v2.position.z) * 0.5,
            );
            const orientInward = (fid: string | null, perp: Vector3) => {
                if (!fid) return perp;
                const face = mesh.faces.find(f => f.id === fid);
                if (!face) return perp;
                let cx = 0, cy = 0, cz = 0;
                for (const vid of face.vertexIds) {
                    const vv = vmap.get(vid)!;
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
            const centerDist = radius / (sinHalfAngle > 0.0001 ? sinHalfAngle : 0.0001); // Avoid division by zero
            const bisector = new Vector3().addVectors(nA_out, nB_out).normalize();
            const local_c = bisector.multiplyScalar(-centerDist);

            // Compute start and end points of the arc
            const local_s = new Vector3().addVectors(local_c, nA_out.clone().multiplyScalar(radius));
            const local_e = new Vector3().addVectors(local_c, nB_out.clone().multiplyScalar(radius));

            // Compute the arc parameters directly
            const vec_start = new Vector3().subVectors(local_s, local_c).normalize();
            const vec_end = new Vector3().subVectors(local_e, local_c).normalize();
            const cross_v = new Vector3().crossVectors(vec_start, vec_end);
            const dot_v = Math.max(-1, Math.min(1, vec_start.dot(vec_end)));
            const sign_a = Math.sign(cross_v.dot(edgeDir));
            const theta_a = Math.acos(dot_v) * (sign_a === 0 ? 1 : sign_a);

            const k = edgeDir.clone().normalize();

            // Build rings with arc points
            const r1: Vector3[] = [];
            const r2: Vector3[] = [];
            for (let i = 0; i <= divisions; i++) {
                const t = i / divisions;
                const angle = theta_a * t;
                let dir_i = vec_start.clone();
                const cos = Math.cos(angle), sin = Math.sin(angle);
                const term1 = dir_i.multiplyScalar(cos);
                const term2 = new Vector3().crossVectors(k, dir_i).multiplyScalar(sin);
                const term3 = k.clone().multiplyScalar(k.dot(dir_i) * (1 - cos));
                dir_i = new Vector3().addVectors(term1, term2).add(term3).normalize();

                const local_point = new Vector3().addVectors(local_c, dir_i.multiplyScalar(radius));
                const a = new Vector3().addVectors(v1.position, local_point);
                const b = new Vector3().addVectors(v2.position, local_point);
                r1.push(a);
                r2.push(b);
            }

            // Connect as preview lines
            for (let i = 0; i < divisions; i++) {
                out.push({ a: r1[i], b: r1[i + 1] }); // Boundary along v1 side
                out.push({ a: r2[i], b: r2[i + 1] }); // Boundary along v2 side
            }
            for (let i = 0; i <= divisions; i++) {
                out.push({ a: r1[i], b: r2[i] }); // Generatrix along edge
            }
        }

        setLines(out);
    }, [isActive, tool, (localData as any)?.radius, (localData as any)?.divisions, mesh?.id, selection.edgeIds.join('|')]);

    return { lines };
}
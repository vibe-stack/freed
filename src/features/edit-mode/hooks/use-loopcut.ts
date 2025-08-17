import { useEffect, useMemo, useRef, useState } from 'react';
import { BufferGeometry, Float32BufferAttribute, Mesh as ThreeMesh, Raycaster, Vector2 as ThreeVector2, Vector3 } from 'three';
import { useThree } from '@react-three/fiber';
import { useToolStore } from '@/stores/tool-store';
import { useGeometryStore } from '@/stores/geometry-store';
import { convertQuadToTriangles } from '@/utils/geometry';
import { computeEdgeLoopFaceSpans, evalEdgePoint, type FaceSpan } from '@/utils/loopcut';
import type { Mesh } from '@/types/geometry';
import { applyLoopCut } from '../utils/loopcut-apply';

export interface LoopcutLine { a: Vector3; b: Vector3 }

export interface ObjectTransform {
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    scale: { x: number; y: number; z: number };
}

// Hook that owns loopcut preview, events, and commit. Returns preview lines in LOCAL mesh space.
export function useLoopcut(mesh: Mesh | null, meshId: string | null, objTransform: ObjectTransform) {
    const toolStore = useToolStore();
    const geometryStore = useGeometryStore();
    const { camera, gl } = useThree();

    const [segments, setSegments] = useState(1);
    const [lines, setLines] = useState<LoopcutLine[]>([]);
    const [hoverEdgeId, setHoverEdgeId] = useState<string | null>(null);
    const [lockedEdgeId, setLockedEdgeId] = useState<string | null>(null);
    const [lockedSpans, setLockedSpans] = useState<FaceSpan[] | null>(null);
    const [phase, setPhase] = useState<'choose' | 'slide'>('choose');
    const [slideT, setSlideT] = useState(0.5);
    const lastMouseRef = useRef<{ x: number; y: number } | null>(null);
    const slideAxisRef = useRef<{ x: number; y: number } | null>(null); // screen-space axis for sliding

    // Helper: apply object transform (local -> world)
    const toWorld = useMemo(() => {
        const sx = objTransform.scale.x || 1e-6;
        const sy = objTransform.scale.y || 1e-6;
        const sz = objTransform.scale.z || 1e-6;
        const rx = objTransform.rotation.x, ry = objTransform.rotation.y, rz = objTransform.rotation.z;
        return (p: Vector3) => {
            const s = new Vector3(p.x * sx, p.y * sy, p.z * sz);
            // Z
            let x = s.x * Math.cos(rz) - s.y * Math.sin(rz);
            let y = s.x * Math.sin(rz) + s.y * Math.cos(rz);
            let z = s.z;
            // Y
            const x2 = x * Math.cos(ry) + z * Math.sin(ry);
            const z2 = -x * Math.sin(ry) + z * Math.cos(ry);
            x = x2; z = z2;
            // X
            const y2 = y * Math.cos(rx) - z * Math.sin(rx);
            const z3 = y * Math.sin(rx) + z * Math.cos(rx);
            y = y2; z = z3;
            return new Vector3(
                x + objTransform.position.x,
                y + objTransform.position.y,
                z + objTransform.position.z,
            );
        };
    }, [objTransform]);

    useEffect(() => {
        if (!toolStore.isActive || toolStore.tool !== 'loopcut') {
            setLines([]);
            setPhase('choose');
            setSlideT(0.5);
            setHoverEdgeId(null);
            setLockedEdgeId(null);
            setLockedSpans(null);
            return;
        }

        const recomputePreviewFromLocked = (segOverride?: number) => {
            if (!mesh || !lockedSpans) { setLines([]); return; }
            const out: LoopcutLine[] = [];
            const vmapLocal = new Map(mesh.vertices.map((v) => [v.id, v] as const));
            const segs = segOverride ?? segments;
            const canonPoint = (edge: [string, string], t: number) => {
                const va = vmapLocal.get(edge[0])!;
                const vb = vmapLocal.get(edge[1])!;
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
                    low = vmapLocal.get(minId)!;
                    high = vmapLocal.get(maxId)!;
                }

                // Compute point at t from low to high
                const p = {
                    x: low.position.x + t * (high.position.x - low.position.x),
                    y: low.position.y + t * (high.position.y - low.position.y),
                    z: low.position.z + t * (high.position.z - low.position.z),
                };
                return new Vector3(p.x, p.y, p.z);
            };
            const base = (i: number) => i / (segs + 1);
            if (phase === 'choose') return; // shouldn't happen
            // Center baseline should be 0.5 regardless of segment count
            const avgBase = 0.5;
            const delta = slideT - avgBase;
            for (let i = 1; i <= segs; i++) {
                const t = Math.min(0.999, Math.max(0.001, base(i) + delta));
                for (const span of lockedSpans) {
                    const pa = canonPoint(span.parallelA, t);
                    const pb = canonPoint(span.parallelB, t);
                    out.push({ a: pa, b: pb });
                }
            }
            setLines(out);
        };

        const recomputePreviewAt = (clientX: number, clientY: number, segOverride?: number) => {
            if (!mesh) { setLines([]); setHoverEdgeId(null); return; }
            const rect = gl.domElement.getBoundingClientRect();
            const ndc = new ThreeVector2(
                ((clientX - rect.left) / rect.width) * 2 - 1,
                -(((clientY - rect.top) / rect.height) * 2 - 1)
            );
            const raycaster = new Raycaster();
            raycaster.setFromCamera(ndc, camera);
            // Build temp tri mesh in world space
            const positions: number[] = [];
            const triFace: string[] = [];
            const vmap = new Map(mesh.vertices.map((v) => [v.id, v] as const));
            for (const f of mesh.faces) {
                const tris = convertQuadToTriangles(f.vertexIds);
                for (const tri of tris) {
                    const p0 = vmap.get(tri[0])!.position;
                    const p1 = vmap.get(tri[1])!.position;
                    const p2 = vmap.get(tri[2])!.position;
                    positions.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
                    triFace.push(f.id);
                }
            }
            const tmp = new BufferGeometry();
            tmp.setAttribute('position', new Float32BufferAttribute(new Float32Array(positions), 3));
            const tmpMesh = new ThreeMesh(tmp);
            tmpMesh.position.set(objTransform.position.x, objTransform.position.y, objTransform.position.z);
            tmpMesh.rotation.set(objTransform.rotation.x, objTransform.rotation.y, objTransform.rotation.z);
            tmpMesh.scale.set(objTransform.scale.x, objTransform.scale.y, objTransform.scale.z);
            tmpMesh.updateMatrixWorld(true);
            const intersects = raycaster.intersectObject(tmpMesh, false);
            tmp.dispose();
            if (intersects.length === 0) { setLines([]); setHoverEdgeId(null); return; }
            const hit = intersects[0];
            const faceIndex = hit.faceIndex ?? -1;
            if (faceIndex < 0) { setLines([]); setHoverEdgeId(null); return; }
            const faceId = triFace[faceIndex];
            const face = mesh.faces.find((f) => f.id === faceId);
            if (!face) { setLines([]); setHoverEdgeId(null); return; }
            // Find closest boundary edge (in world space)
            const P = hit.point.clone();
            const faceVIds = face.vertexIds;
            let bestEdge: [string, string] | null = null;
            let bestD2 = Infinity;
            const segDist = (a: Vector3, b: Vector3, p: Vector3) => {
                const ab = new Vector3().subVectors(b, a);
                const ap = new Vector3().subVectors(p, a);
                const t = Math.max(0, Math.min(1, ap.dot(ab) / Math.max(1e-6, ab.lengthSq())));
                const closest = new Vector3().addVectors(a, ab.multiplyScalar(t));
                return { d2: closest.distanceToSquared(p), t };
            };
            for (let i = 0; i < faceVIds.length; i++) {
                const va = vmap.get(faceVIds[i])!.position;
                const vb = vmap.get(faceVIds[(i + 1) % faceVIds.length])!.position;
                const A = toWorld(new Vector3(va.x, va.y, va.z));
                const B = toWorld(new Vector3(vb.x, vb.y, vb.z));
                const r = segDist(A, B, P);
                if (r.d2 < bestD2) { bestD2 = r.d2; bestEdge = [faceVIds[i], faceVIds[(i + 1) % faceVIds.length]]; }
            }
            if (!bestEdge) { setLines([]); setHoverEdgeId(null); return; }
            const hoveredEdge = mesh.edges.find((ed) => {
                const [a, b] = ed.vertexIds;
                return (a === bestEdge![0] && b === bestEdge![1]) || (a === bestEdge![1] && b === bestEdge![0]);
            });
            if (!hoveredEdge) { setLines([]); setHoverEdgeId(null); return; }
            setHoverEdgeId(hoveredEdge.id);
            // Build preview lines (LOCAL coordinates)
            const spans = computeEdgeLoopFaceSpans(mesh, hoveredEdge.id);
            const out: LoopcutLine[] = [];
            const vmapLocal = new Map(mesh.vertices.map((v) => [v.id, v] as const));
            const segs = segOverride ?? segments;
            const canonPoint = (edge: [string, string], t: number) => {
                let a = edge[0], b = edge[1], tc = t;
                if (b < a) { const tmp = a; a = b; b = tmp; tc = 1 - t; }
                const p = evalEdgePoint(vmapLocal, [a, b], tc);
                return new Vector3(p.x, p.y, p.z);
            };
            const base = (i: number) => i / (segs + 1);
            // In choose phase, show evenly spaced lines
            for (let i = 1; i <= segs; i++) {
                const t = base(i);
                for (const span of spans) {
                    const pa = canonPoint(span.parallelA, t);
                    const pb = canonPoint(span.parallelB, t);
                    out.push({ a: pa, b: pb });
                }
            }
            setLines(out);
        };

        const onWheel = (e: WheelEvent) => {
            if (e.ctrlKey) {
                e.preventDefault();
                e.stopPropagation();
                const delta = Math.sign(e.deltaY);
                const next = Math.max(1, Math.min(64, segments - delta));
                setSegments(next);
                if (phase === 'slide') {
                    // keep locked
                    queueMicrotask(() => recomputePreviewFromLocked(next));
                } else {
                    const lp = lastMouseRef.current;
                    if (lp) recomputePreviewAt(lp.x, lp.y, next);
                }
            }
        };

        const onMouseDown = (e: MouseEvent) => {
            if (e.button !== 0) return;
            if (phase === 'choose') {
                // Lock current loop and enter slide
                if (!mesh || !hoverEdgeId) return;
                const spans = computeEdgeLoopFaceSpans(mesh, hoverEdgeId);
                setLockedEdgeId(hoverEdgeId);
                setLockedSpans(spans);
                setPhase('slide');
                // Initialize preview for slide
                recomputePreviewFromLocked();
                // Establish a slide axis in screen space based on the first span
                try {
                    if (spans.length > 0) {
                        const vmapLocal = new Map(mesh.vertices.map((v) => [v.id, v] as const));
                        const span = spans[0];
                        // take midpoint of one edge in local space
                        const evalMid = (edge: [string, string]) => {
                            const a = vmapLocal.get(edge[0])!.position;
                            const b = vmapLocal.get(edge[1])!.position;
                            return new Vector3((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
                        };
                        const A = evalMid(span.parallelA);
                        const B = evalMid(span.parallelB);
                        // project A and B to screen space to get axis direction
                        const toScreen = (p: Vector3) => {
                            const world = toWorld(p.clone());
                            const clip = world.clone().project(camera);
                            // convert NDC to pixels for stable scale
                            const rect = gl.domElement.getBoundingClientRect();
                            return new Vector3(
                                ((clip.x + 1) / 2) * rect.width,
                                ((-clip.y + 1) / 2) * rect.height,
                                0
                            );
                        };
                        const As = toScreen(A);
                        const Bs = toScreen(B);
                        const axis = new Vector3().subVectors(Bs, As);
                        if (axis.lengthSq() > 1e-6) {
                            axis.normalize();
                            slideAxisRef.current = { x: axis.x, y: axis.y };
                        } else {
                            slideAxisRef.current = { x: 1, y: 0 };
                        }
                    } else {
                        slideAxisRef.current = { x: 1, y: 0 };
                    }
                } catch {
                    slideAxisRef.current = { x: 1, y: 0 };
                }
            } else {
                if (!mesh || !meshId || !lockedEdgeId) { toolStore.endOperation(false); return; }
                // Commit using locked loop
                applyLoopCut(geometryStore.updateMesh, geometryStore.recalculateNormals, meshId, lockedEdgeId, segments, slideT);
                toolStore.endOperation(true);
            }
        };

        const onMouseMove = (e: MouseEvent) => {
            lastMouseRef.current = { x: e.clientX, y: e.clientY };
            if (phase === 'slide') {
                setSlideT((t) => {
                    // Project mouse movement onto precomputed slide axis in screen space
                    const ax = slideAxisRef.current?.x ?? 1;
                    const ay = slideAxisRef.current?.y ?? 0;
                    // normalize just in case
                    const len = Math.max(1e-6, Math.hypot(ax, ay));
                    const nx = ax / len;
                    const ny = ay / len;
                    const dot = e.movementX * nx + e.movementY * ny; // pixels along axis
                    // Convert pixels to t-space: heuristic scale relative to viewport size
                    const rect = gl.domElement.getBoundingClientRect();
                    const ref = Math.max(300, Math.min(rect.width, rect.height));
                    const dt = dot / ref; // roughly move full width by moving across ~ref px
                    const next = Math.max(0, Math.min(1, t + dt));
                    queueMicrotask(() => recomputePreviewFromLocked());
                    return next;
                });
            } else {
                recomputePreviewAt(e.clientX, e.clientY);
            }
        };

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key.toLowerCase() === 'escape') toolStore.endOperation(false);
        };

        document.addEventListener('mousemove', onMouseMove, { passive: true });
        document.addEventListener('wheel', onWheel, { passive: false, capture: true });
        document.addEventListener('mousedown', onMouseDown);
        document.addEventListener('keydown', onKeyDown);

        return () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('wheel', onWheel, { capture: true } as AddEventListenerOptions);
            document.removeEventListener('mousedown', onMouseDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [toolStore, toolStore.isActive, toolStore.tool, mesh, meshId, camera, gl.domElement, segments, objTransform, phase, slideT, toWorld, hoverEdgeId, lockedEdgeId, lockedSpans, geometryStore.updateMesh, geometryStore.recalculateNormals]);

    return { lines, segments, setSegments, phase, slideT, setSlideT };
}

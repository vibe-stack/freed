'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { useThree } from '@react-three/fiber';
import { useSelectionStore } from '@/stores/selection-store';
import { useToolStore } from '@/stores/tool-store';
import { useGeometryStore } from '@/stores/geometry-store';
import { Vertex } from '@/types/geometry';
import { VertexRenderer } from '@/features/edit-mode/components/vertex-renderer';
import { EdgeRenderer } from '@/features/edit-mode/components/edge-renderer';
import { FaceRenderer } from '@/features/edit-mode/components/face-renderer';
import { ToolHandler } from '@/features/edit-mode/components/tool-handler';
import { Color, Vector3, Raycaster, Vector2 as ThreeVector2, BufferGeometry, Float32BufferAttribute, Mesh as ThreeMesh } from 'three';
import { convertQuadToTriangles, createVertex, createFace, buildEdgesFromFaces } from '@/utils/geometry';
import { computeEdgeLoopFaceSpans, evalEdgePoint } from '@/utils/loopcut';
import { useSelectionVertices } from '@/features/edit-mode/hooks/use-selection-vertices';
import { useSceneStore } from '@/stores/scene-store';

const EditModeOverlay: React.FC = () => {
	const selectionStore = useSelectionStore();
	const toolStore = useToolStore();
	const geometryStore = useGeometryStore();
	const { camera, gl, scene: threeScene } = useThree();

	const [localVertices, setLocalVertices] = useState<Vertex[] | null>(null);

	const selection = selectionStore.selection;
	const meshId = selection.meshId;
	const mesh = meshId ? geometryStore.meshes.get(meshId) : null;

	// Loop Cut preview state (local to overlay)
	const [loopcutSegments, setLoopcutSegments] = useState<number>(1);
			const [loopcutLines, setLoopcutLines] = useState<Array<{ a: Vector3; b: Vector3 }>>([]);
				const [hoverEdgeId, setHoverEdgeId] = useState<string | null>(null);
			const [phase, setPhase] = useState<'choose' | 'slide'>('choose');
			const [slideT, setSlideT] = useState<number>(0.5);
			const lastMouseRef = React.useRef<{ x: number; y: number } | null>(null);

	const handleVertexClick = (vertexId: string, event: ThreeEvent<PointerEvent>) => {
		if (toolStore.isActive) return;
		const isShiftPressed = event.shiftKey;
		if (isShiftPressed) {
			if (meshId) selectionStore.toggleVertexSelection(meshId, vertexId);
		} else {
			if (meshId) selectionStore.selectVertices(meshId, [vertexId]);
		}
	};

	const handleEdgeClick = (edgeId: string, event: ThreeEvent<PointerEvent>) => {
		if (toolStore.isActive) return;
		const isShiftPressed = event.shiftKey;
		if (isShiftPressed) {
			if (meshId) selectionStore.toggleEdgeSelection(meshId, edgeId);
		} else {
			if (meshId) selectionStore.selectEdges(meshId, [edgeId]);
		}
	};

	const handleFaceClick = (faceId: string, event: ThreeEvent<PointerEvent>) => {
		if (toolStore.isActive) return;
		const isShiftPressed = event.shiftKey;
		if (isShiftPressed) {
			if (meshId) selectionStore.toggleFaceSelection(meshId, faceId);
		} else {
			if (meshId) selectionStore.selectFaces(meshId, [faceId]);
		}
	};

	const handleLocalDataChange = useCallback((vertices: Vertex[]) => {
		setLocalVertices(vertices);
	}, []);

	useEffect(() => {
		if (!toolStore.isActive) {
			setLocalVertices(null);
		}
	}, [toolStore.isActive]);

	const { centroid } = useSelectionVertices(meshId || '', localVertices);

	// Find the scene object that references this mesh so we can apply its transform in Edit Mode
	const sceneStore = useSceneStore();
	const objTransform = useMemo(() => {
		if (!meshId) return { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } };
		const obj = Object.values(sceneStore.objects).find((o) => o.meshId === meshId);
		return obj?.transform ?? { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } };
	}, [sceneStore.objects, meshId]);

	if (!meshId || !mesh) return null;

	// Basic plane-based loop cut approximation: hover shows mesh-local face ring and N evenly spaced segment lines
		useEffect(() => {
			if (!toolStore.isActive || toolStore.tool !== 'loopcut') {
				setLoopcutLines([]);
				return;
			}
				// Helper: apply object transform to a local point to world space
				const toWorld = (p: Vector3) => {
					const sx = objTransform.scale.x || 1e-6;
					const sy = objTransform.scale.y || 1e-6;
					const sz = objTransform.scale.z || 1e-6;
					const s = new Vector3(p.x * sx, p.y * sy, p.z * sz);
					const rx = objTransform.rotation.x, ry = objTransform.rotation.y, rz = objTransform.rotation.z;
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

				// Core preview computation for a given client mouse position
				const recomputePreviewAt = (clientX: number, clientY: number, segOverride?: number) => {
					if (!mesh) return;
					// Raycast against a temporary mesh built from current faces
					const rect = gl.domElement.getBoundingClientRect();
					const ndc = new ThreeVector2(
						((clientX - rect.left) / rect.width) * 2 - 1,
						-(((clientY - rect.top) / rect.height) * 2 - 1)
					);
					const raycaster = new Raycaster();
					raycaster.setFromCamera(ndc, camera);
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
					if (intersects.length === 0) {
						setLoopcutLines([]);
						setHoverEdgeId(null);
						return;
					}
					const hit = intersects[0];
					const faceIndex = hit.faceIndex ?? -1;
					if (faceIndex < 0) {
						setLoopcutLines([]);
						setHoverEdgeId(null);
						return;
					}
					const faceId = triFace[faceIndex];
					const face = mesh.faces.find((f) => f.id === faceId);
					if (!face) {
						setLoopcutLines([]);
						setHoverEdgeId(null);
						return;
					}
					// Pick closest FACE boundary edge to the hit point in WORLD space
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
					if (!bestEdge) {
						setLoopcutLines([]);
						setHoverEdgeId(null);
						return;
					}
					const hoveredEdgeIds: [string, string] = bestEdge;
					const hoveredEdge = mesh.edges.find((ed) => {
						const [a, b] = ed.vertexIds;
						return (a === hoveredEdgeIds[0] && b === hoveredEdgeIds[1]) || (a === hoveredEdgeIds[1] && b === hoveredEdgeIds[0]);
					});
					if (!hoveredEdge) {
						setLoopcutLines([]);
						setHoverEdgeId(null);
						return;
					}
					setHoverEdgeId(hoveredEdge.id);
					// Build edge loop across quads starting from hovered edge
					const spans = computeEdgeLoopFaceSpans(mesh, hoveredEdge.id);
					const lines: Array<{ a: Vector3; b: Vector3 }> = [];
					const vmapLocal = new Map(mesh.vertices.map((v) => [v.id, v] as const));
					const segs = segOverride ?? loopcutSegments;
					const canonPoint = (edge: [string, string], t: number) => {
						let a = edge[0], b = edge[1], tc = t;
						if (b < a) { const tmp = a; a = b; b = tmp; tc = 1 - t; }
						const p = evalEdgePoint(vmapLocal, [a, b], tc);
						return new Vector3(p.x, p.y, p.z);
					};
					const base = (i: number) => i / (segs + 1);
					if (phase === 'choose') {
						for (let i = 1; i <= segs; i++) {
							const t = base(i);
							for (const span of spans) {
								const pa = canonPoint(span.parallelA, t);
								const pb = canonPoint(span.parallelB, t);
								lines.push({ a: pa, b: pb });
							}
						}
					} else {
						const avgBase = segs / (2 * (segs + 1));
						const delta = slideT - avgBase;
						for (let i = 1; i <= segs; i++) {
							const t = Math.min(0.999, Math.max(0.001, base(i) + delta));
							for (const span of spans) {
								const pa = canonPoint(span.parallelA, t);
								const pb = canonPoint(span.parallelB, t);
								lines.push({ a: pa, b: pb });
							}
						}
					}
					setLoopcutLines(lines);
				};

				const onWheel = (e: WheelEvent) => {
					// Only adjust segments when Ctrl is held; always block zoom when Ctrl is held
					if (e.ctrlKey) {
						e.preventDefault();
						e.stopPropagation();
						const delta = Math.sign(e.deltaY);
					const next = Math.max(1, Math.min(64, loopcutSegments - delta));
					setLoopcutSegments(next);
					// Recompute immediately at last mouse position to refresh preview without moving with updated segment count
					const lp = lastMouseRef.current;
					if (lp) {
						recomputePreviewAt(lp.x, lp.y, next);
					}
						return;
					}
				};
				const onMouseDown = (e: MouseEvent) => {
							if (e.button !== 0) return;
							if (phase === 'choose') {
						// Lock in the loop and switch to slide phase
						setPhase('slide');
					} else {
								// Finish slide phase; commit topology
								if (!mesh || !hoverEdgeId) { toolStore.endOperation(false); return; }
								const spans = computeEdgeLoopFaceSpans(mesh, hoverEdgeId);
								if (spans.length === 0) { toolStore.endOperation(false); return; }
								const N = Math.max(1, loopcutSegments);
								const base = (i: number) => i / (N + 1);
								// Slide keeps equal spacing; offset so average equals slideT
								const avgBase = N / (2 * (N + 1));
								const delta = slideT - avgBase;
								const tPositions = Array.from({ length: N }, (_v, i) => Math.max(0.001, Math.min(0.999, base(i + 1) + delta)));
								// Commit changes
										geometryStore.updateMesh(meshId, (m) => {
									const vmap = new Map(m.vertices.map((v) => [v.id, v] as const));
									const edgeSplit = new Map<string, string>(); // key: edgeKey|segIndex -> vertexId
									const keyFor = (a: string, b: string) => (a < b ? `${a}-${b}` : `${b}-${a}`);
											const getOrCreateOnEdge = (edge: [string, string], t: number, segIndex: number) => {
												// Canonicalize edge orientation to maintain consistent t across adjacent faces
												let a = edge[0], b = edge[1], tc = t;
												if (b < a) { const tmp = a; a = b; b = tmp; tc = 1 - t; }
												const k = `${keyFor(a, b)}|${segIndex}`;
										const found = edgeSplit.get(k);
										if (found) return found;
												const va = vmap.get(a)!; const vb = vmap.get(b)!;
										const pos = {
													x: va.position.x + (vb.position.x - va.position.x) * tc,
													y: va.position.y + (vb.position.y - va.position.y) * tc,
													z: va.position.z + (vb.position.z - va.position.z) * tc,
										};
										const dup = createVertex(pos, { ...va.normal }, { ...va.uv });
										m.vertices.push(dup);
										vmap.set(dup.id, dup);
										edgeSplit.set(k, dup.id);
										return dup.id;
									};
									const facesToRemove = new Set(spans.map(s => s.faceId));
									const newFaces: ReturnType<typeof createFace>[] = [];
									for (const span of spans) {
										const face = m.faces.find(f => f.id === span.faceId);
										if (!face || face.vertexIds.length !== 4) continue;
										// Build edge array to identify perpendicular edges e1 and e3 relative order
										const ids = face.vertexIds;
										const edges: [string, string][] = [[ids[0], ids[1]], [ids[1], ids[2]], [ids[2], ids[3]], [ids[3], ids[0]]];
										// Find indices of parallelA and parallelB within edges
										const idxA = edges.findIndex(e => (e[0] === span.parallelA[0] && e[1] === span.parallelA[1]) || (e[0] === span.parallelA[1] && e[1] === span.parallelA[0]));
										const idxB = edges.findIndex(e => (e[0] === span.parallelB[0] && e[1] === span.parallelB[1]) || (e[0] === span.parallelB[1] && e[1] === span.parallelB[0]));
										if (idxA === -1 || idxB === -1) continue;
										// Perpendicular edges are the remaining ones
										const idxPerp1 = (idxA + 1) % 4; // shares first corner with parallelA[1st]
										const idxPerp2 = (idxA + 3) % 4; // shares second corner
										const a0 = span.parallelA[0]; const a1 = span.parallelA[1];
										const b0 = span.parallelB[0]; const b1 = span.parallelB[1];
										// Create ordered boundary points along A and B: A0, A_i..., A1 / B0, B_i..., B1
										const Aseq: string[] = [a0];
										const Bseq: string[] = [b0];
										tPositions.forEach((t, i) => {
											Aseq.push(getOrCreateOnEdge([a0, a1], t, i));
											Bseq.push(getOrCreateOnEdge([b0, b1], t, i));
										});
										Aseq.push(a1); Bseq.push(b1);
										// Now create N+1 quads between successive A and B points: [Ak, Ak+1, Bk+1, Bk]
										for (let k = 0; k < Aseq.length - 1; k++) {
											newFaces.push(createFace([Aseq[k], Aseq[k + 1], Bseq[k + 1], Bseq[k]]));
										}
									}
									// Replace faces
									m.faces = m.faces.filter(f => !facesToRemove.has(f.id));
									m.faces.push(...newFaces);
									// Rebuild edges
									m.edges = buildEdgesFromFaces(m.vertices, m.faces);
								});
								geometryStore.recalculateNormals(meshId);
								toolStore.endOperation(true);
					}
				};
				const onMouseMove = (e: MouseEvent) => {
					lastMouseRef.current = { x: e.clientX, y: e.clientY };
					if (phase === 'slide') {
						setSlideT((t) => Math.max(0, Math.min(1, t - e.movementX * 0.002)));
					}
					recomputePreviewAt(e.clientX, e.clientY);
				};
		document.addEventListener('mousemove', onMouseMove, { passive: true });
		document.addEventListener('wheel', onWheel, { passive: false, capture: true });
			document.addEventListener('mousedown', onMouseDown);
			const onKeyDown = (e: KeyboardEvent) => {
				if (e.key.toLowerCase() === 'escape') {
					toolStore.endOperation(false);
				}
			};
			document.addEventListener('keydown', onKeyDown);
		return () => {
			document.removeEventListener('mousemove', onMouseMove as any);
			document.removeEventListener('wheel', onWheel as any, { capture: true } as any);
				document.removeEventListener('mousedown', onMouseDown as any);
				document.removeEventListener('keydown', onKeyDown as any);
		};
				}, [toolStore.isActive, toolStore.tool, mesh, camera, gl.domElement, loopcutSegments, objTransform, phase, slideT]);

	return (
		<>
			{/* Loop Cut handler: preview only + wheel segments; LMB to commit later */}
			{toolStore.isActive && toolStore.tool === 'loopcut' && (
				<group>
					{loopcutLines.map((ln, idx) => {
						const positions = new Float32Array([
							ln.a.x, ln.a.y, ln.a.z,
							ln.b.x, ln.b.y, ln.b.z,
						]);
						return (
							<line key={idx}>
								<bufferGeometry>
									<bufferAttribute attach="attributes-position" args={[positions, 3]} />
								</bufferGeometry>
								<lineBasicMaterial color={new Color(1, 1, 0)} depthTest={false} depthWrite={false} transparent opacity={0.9} />
							</line>
						);
					})}
            {/* Simple hint for phases could be added via ToolIndicator later */}
				</group>
			)}
			<ToolHandler
				meshId={meshId}
				onLocalDataChange={handleLocalDataChange}
				objectRotation={objTransform.rotation}
				objectScale={objTransform.scale}
			/>

			{/* Render all edit-mode visuals under the object's transform so object-space vertices appear in the right world position */}
			<group
				position={[objTransform.position.x, objTransform.position.y, objTransform.position.z]}
				rotation={[objTransform.rotation.x, objTransform.rotation.y, objTransform.rotation.z]}
				scale={[objTransform.scale.x, objTransform.scale.y, objTransform.scale.z]}
			>
				{selection.selectionMode === 'vertex' && (
					<VertexRenderer
						meshId={meshId}
						selectedVertexIds={selection.vertexIds}
						onVertexClick={handleVertexClick}
						selectionMode={selection.selectionMode}
						localVertices={localVertices || undefined}
						objectScale={objTransform.scale}
						objectRotation={objTransform.rotation}
						objectPosition={objTransform.position}
					/>
				)}

				<EdgeRenderer
					meshId={meshId}
					selectedEdgeIds={selection.edgeIds}
					onEdgeClick={handleEdgeClick}
					selectionMode={selection.selectionMode}
					localVertices={localVertices || undefined}
				/>

				{selection.selectionMode === 'face' && (
					<FaceRenderer
						meshId={meshId}
						selectedFaceIds={selection.faceIds}
						onFaceClick={handleFaceClick}
						selectionMode={selection.selectionMode}
						localVertices={localVertices || undefined}
					/>
				)}

				{toolStore.isActive && ['move','rotate','scale','extrude','inset','bevel'].includes(toolStore.tool) && centroid && (
					<group>
						{[{ key: 'x', dir: new Vector3(1, 0, 0), color: new Color(1, 0, 0) },
						{ key: 'y', dir: new Vector3(0, 1, 0), color: new Color(0, 1, 0) },
						{ key: 'z', dir: new Vector3(0, 0, 1), color: new Color(0, 0, 1) }].map(({ key, dir, color }) => {
							const len = 1000;
							const positions = new Float32Array([
								centroid.x - dir.x * len, centroid.y - dir.y * len, centroid.z - dir.z * len,
								centroid.x + dir.x * len, centroid.y + dir.y * len, centroid.z + dir.z * len,
							]);
							const opacity = toolStore.axisLock === key ? 1 : 0.2;
							return (
								<line key={key as string}>
									<bufferGeometry>
										<bufferAttribute attach="attributes-position" args={[positions, 3]} />
									</bufferGeometry>
									<lineBasicMaterial color={color} depthTest={false} depthWrite={false} transparent opacity={opacity} />
								</line>
							);
						})}
					</group>
				)}
			</group>
		</>
	);
};

export default EditModeOverlay;

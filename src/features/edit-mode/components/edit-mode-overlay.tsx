'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { useThree } from '@react-three/fiber';
import { ContextMenu } from '@base-ui-components/react/context-menu';
import { useSelectionStore } from '@/stores/selection-store';
import { useToolStore } from '@/stores/tool-store';
import { useGeometryStore } from '@/stores/geometry-store';
import { Vertex } from '@/types/geometry';
import { VertexRenderer } from '@/features/edit-mode/components/vertex-renderer';
import { EdgeRenderer } from '@/features/edit-mode/components/edge-renderer';
import { FaceRenderer } from '@/features/edit-mode/components/face-renderer';
import { ToolHandler } from '@/features/edit-mode/components/tool-handler';
import { Color, Vector3, Matrix4, Quaternion, Euler } from 'three/webgpu';
import { Html } from '@react-three/drei';
import { useSelectionVertices } from '@/features/edit-mode/hooks/use-selection-vertices';
import { useSceneStore } from '@/stores/scene-store';
import { useLoopcut } from '@/features/edit-mode/hooks/use-loopcut';
import { computeEdgeLoopFaceSpans } from '@/utils/loopcut';
import { SculptHandler } from '@/features/edit-mode/components/sculpt-handler';
import { unwrapMeshBySeams } from '@/utils/uv-mapping';

const EditModeOverlay: React.FC = () => {
	const selectionStore = useSelectionStore();
	const toolStore = useToolStore();
	const geometryStore = useGeometryStore();
	const { gl, camera, size } = useThree();

	const [localVertices, setLocalVertices] = useState<Vertex[] | null>(null);

	const selection = selectionStore.selection;
	const meshId = selection.meshId;
	const mesh = meshId ? geometryStore.meshes.get(meshId) : null;

	// Loop Cut managed by hook (initialized after objTransform)

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
		const isAltPressed = (event as any).altKey === true;
		const isCtrlPressed = (event as any).ctrlKey === true || (event as any).metaKey === true; // allow Cmd as Ctrl on macOS
		if (!meshId) return;
		if (isAltPressed && mesh) {
			// Blender-like feel, adjusted for request:
			// Alt+Click => edge RING (perpendicular side edges along spans)
			// Ctrl+Alt (or Cmd+Alt on mac) => edge LOOP (chain across quads)
			const spans = computeEdgeLoopFaceSpans(mesh, edgeId);
			const keyFor = (a: string, b: string) => (a < b ? `${a}-${b}` : `${b}-${a}`);
			const edgeIdByKey = new Map(mesh.edges.map(e => [keyFor(e.vertexIds[0], e.vertexIds[1]), e.id] as const));
			const set = new Set<string>();
			if (isCtrlPressed) {
				// LOOP: include starting edge and across-faces parallels
				set.add(edgeId);
				for (const span of spans) {
					const kA = keyFor(span.parallelA[0], span.parallelA[1]);
					const kB = keyFor(span.parallelB[0], span.parallelB[1]);
					const idA = edgeIdByKey.get(kA);
					const idB = edgeIdByKey.get(kB);
					if (idA) set.add(idA);
					if (idB) set.add(idB);
				}
			} else {
				// RING: choose the consistent "right" side edge per span, which connects the first vertices
				for (const span of spans) {
					const kSide = keyFor(span.parallelA[0], span.parallelB[0]);
					const idSide = edgeIdByKey.get(kSide);
					if (idSide) set.add(idSide);
				}
			}
			selectionStore.selectEdges(meshId, Array.from(set), isShiftPressed);
			return;
		}
		// Regular edge selection
		if (isShiftPressed) selectionStore.toggleEdgeSelection(meshId, edgeId);
		else selectionStore.selectEdges(meshId, [edgeId]);
	};

	// Seam ops
	const markSeams = (seam: boolean) => {
		if (!meshId) return;
		if (selection.selectionMode !== 'edge') return;
		if (selection.edgeIds.length === 0) return;
		geometryStore.setEdgeSeams(meshId, selection.edgeIds, seam);
	};
	const clearSeams = () => {
		if (!meshId) return;
		geometryStore.clearAllSeams(meshId);
	};
	const unwrapBySeams = () => {
		if (!meshId) return;
		const m = geometryStore.meshes.get(meshId);
		if (!m) return;
		geometryStore.updateMesh(meshId, (mesh) => {
			unwrapMeshBySeams(mesh);
		});
	};

	// Context menu state and wiring to canvas right-click
	const [cmOpen, setCmOpen] = useState(false);
	const [cmPos, setCmPos] = useState<{ x: number; y: number } | null>(null);
	const [cmFlipX, setCmFlipX] = useState(false);
	const [cmFlipY, setCmFlipY] = useState(false);
	useEffect(() => {
		const el = gl?.domElement as HTMLElement | undefined;
		if (!el) return;
		const onCM = (e: MouseEvent) => {
			// Only in edit mode
			if (useSelectionStore.getState().selection.viewMode !== 'edit') return;
			// Allow RMB drag in tools: open only on contextmenu event (no drag)
			e.preventDefault();
			e.stopPropagation();
			const x = e.clientX, y = e.clientY;
			setCmPos({ x, y });
			const vw = window.innerWidth, vh = window.innerHeight;
			setCmFlipX(vw - x < 240);
			setCmFlipY(vh - y < 200);
			setCmOpen(true);
		};
		el.addEventListener('contextmenu', onCM, { passive: false });
		return () => el.removeEventListener('contextmenu', onCM as any);
	}, [gl]);

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

	// Loop Cut managed by hook
	const { lines: loopcutLines } = useLoopcut(mesh || null, meshId || null, objTransform);

	// Alt+Shift marquee selection (screen-space rectangle)
	const [marquee, setMarquee] = useState<
	  null | {
	    start: { x: number; y: number };
	    current: { x: number; y: number };
	    additive: boolean;
	  }
	>(null);

	useEffect(() => {
		const el = gl?.domElement as HTMLCanvasElement | undefined;
		if (!el) return;
		
		let currentMarquee: typeof marquee = null;
		
		const onDown = (e: PointerEvent) => {
			// Only in edit mode, only LMB, require Alt+Shift, and no active tool/sculpt
			if (useSelectionStore.getState().selection.viewMode !== 'edit') return;
			if ((e.buttons & 1) !== 1 || e.button !== 0) return;
			if (!e.altKey || !e.shiftKey) return;
			if (useToolStore.getState().isActive || useToolStore.getState().sculptStrokeActive) return;
			
			// Prevent camera controls
			e.preventDefault();
			e.stopPropagation();
			
			const r = el.getBoundingClientRect();
			const lx = e.clientX - r.left;
			const ly = e.clientY - r.top;
			
			useToolStore.getState().setMarqueeActive(true);
			currentMarquee = { start: { x: lx, y: ly }, current: { x: lx, y: ly }, additive: false };
			setMarquee(currentMarquee);
			
			// Use local refs to avoid closure issues
			window.addEventListener('pointermove', onMove, { capture: true });
			window.addEventListener('pointerup', onUp, { capture: true });
		};
		
		const onMove = (e: PointerEvent) => {
			if (!currentMarquee) return;
			e.preventDefault();
			e.stopPropagation();
			
			const r = el.getBoundingClientRect();
			currentMarquee = { ...currentMarquee, current: { x: e.clientX - r.left, y: e.clientY - r.top } };
			setMarquee(currentMarquee);
		};
		
		const onUp = (e: PointerEvent) => {
			e.preventDefault();
			e.stopPropagation();
			
			// Clean up listeners immediately
			window.removeEventListener('pointermove', onMove, true);
			window.removeEventListener('pointerup', onUp, true);
			
			if (!currentMarquee) { 
				useToolStore.getState().setMarqueeActive(false); 
				return; 
			}
			
			try {
				const sx = currentMarquee.start.x, sy = currentMarquee.start.y;
				const cx = currentMarquee.current.x, cy = currentMarquee.current.y;
				const minX = Math.min(sx, cx), maxX = Math.max(sx, cx);
				const minY = Math.min(sy, cy), maxY = Math.max(sy, cy);
				
				// Ignore tiny drags (treat like click-through)
				if (Math.abs(maxX - minX) < 2 && Math.abs(maxY - minY) < 2) return;
				
				const sel = useSelectionStore.getState().selection;
				if (!sel.meshId) return;
				
				const geo = useGeometryStore.getState();
				const m = geo.meshes.get(sel.meshId);
				if (!m) return;
				
				// Build object world matrix from objTransform
				const pos = new Vector3(objTransform.position.x, objTransform.position.y, objTransform.position.z);
				const scl = new Vector3(objTransform.scale.x, objTransform.scale.y, objTransform.scale.z);
				const quat = new Quaternion().setFromEuler(new Euler(objTransform.rotation.x, objTransform.rotation.y, objTransform.rotation.z));
				const objMat = new Matrix4().compose(pos, quat, scl);
				
				const toScreen = (p: { x: number; y: number; z: number }) => {
					const wp = new Vector3(p.x, p.y, p.z).applyMatrix4(objMat);
					const sp = wp.project(camera as any);
					// Convert NDC to canvas-local px
					const sx = (sp.x * 0.5 + 0.5) * size.width;
					const sy = (-sp.y * 0.5 + 0.5) * size.height;
					return { x: sx, y: sy, z: sp.z };
				};
				
				const inside = (x: number, y: number) => x >= minX && x <= maxX && y >= minY && y <= maxY;
				
				if (sel.selectionMode === 'vertex') {
					const picked: string[] = [];
					for (const v of m.vertices) {
						const sp = toScreen(v.position);
						if (inside(sp.x, sp.y)) picked.push(v.id);
					}
					// For marquee selection, don't use additive - just select the picked vertices
					// This matches typical marquee behavior where you drag to select a group
					useSelectionStore.getState().selectVertices(m.id, picked);
				} else if (sel.selectionMode === 'edge') {
					const vmap = new Map(m.vertices.map(v => [v.id, v] as const));
					const picked: string[] = [];
					for (const e of m.edges) {
						const v0 = vmap.get(e.vertexIds[0]);
						const v1 = vmap.get(e.vertexIds[1]);
						if (!v0 || !v1) continue;
						const a = toScreen(v0.position); const b = toScreen(v1.position);
						if (inside(a.x, a.y) && inside(b.x, b.y)) picked.push(e.id);
					}
					useSelectionStore.getState().selectEdges(m.id, picked);
				} else if (sel.selectionMode === 'face') {
					const vmap = new Map(m.vertices.map(v => [v.id, v] as const));
					const picked: string[] = [];
					for (const f of m.faces) {
						let allIn = true;
						for (const vid of f.vertexIds) {
							const v = vmap.get(vid); if (!v) { allIn = false; break; }
							const sp = toScreen(v.position);
							if (!inside(sp.x, sp.y)) { allIn = false; break; }
						}
						if (allIn) picked.push(f.id);
					}
					useSelectionStore.getState().selectFaces(m.id, picked);
				}
			} finally {
				currentMarquee = null;
				setMarquee(null);
				useToolStore.getState().setMarqueeActive(false);
			}
		};
		
		el.addEventListener('pointerdown', onDown, { passive: false, capture: true });
		
		return () => {
			el.removeEventListener('pointerdown', onDown, true);
			window.removeEventListener('pointermove', onMove, true);
			window.removeEventListener('pointerup', onUp, true);
			// Ensure marquee is cleaned up on unmount
			currentMarquee = null;
			setMarquee(null);
			useToolStore.getState().setMarqueeActive(false);
		};
	}, [gl, objTransform.position.x, objTransform.position.y, objTransform.position.z, objTransform.rotation.x, objTransform.rotation.y, objTransform.rotation.z, objTransform.scale.x, objTransform.scale.y, objTransform.scale.z, size.width, size.height, camera]);

	// Marquee visual overlay using portal to document.body
	useEffect(() => {
		if (!marquee) return;
		
		const el = gl?.domElement as HTMLCanvasElement | undefined;
		if (!el) return;
		
		// Create overlay div
		const overlay = document.createElement('div');
		overlay.style.position = 'fixed';
		overlay.style.border = '1px solid rgba(255,255,255,0.8)';
		overlay.style.background = 'rgba(255,255,255,0.1)';
		overlay.style.pointerEvents = 'none';
		overlay.style.zIndex = '10000';
		
		// Position relative to canvas
		const rect = el.getBoundingClientRect();
		const left = Math.min(marquee.start.x, marquee.current.x) + rect.left;
		const top = Math.min(marquee.start.y, marquee.current.y) + rect.top;
		const width = Math.abs(marquee.current.x - marquee.start.x);
		const height = Math.abs(marquee.current.y - marquee.start.y);
		
		overlay.style.left = `${left}px`;
		overlay.style.top = `${top}px`;
		overlay.style.width = `${width}px`;
		overlay.style.height = `${height}px`;
		
		document.body.appendChild(overlay);
		
		return () => {
			document.body.removeChild(overlay);
		};
	}, [marquee, gl]);

	// Note: Avoid returning early before hooks; instead, short-circuit rendering below.

	// Loopcut events and commit are handled in the hook

	return (
		<>
			{(!meshId || !mesh) ? null : (
				<>
					{/* Context menu for seams */}
					<Html>
						<ContextMenu.Root open={cmOpen} onOpenChange={setCmOpen}>
							<ContextMenu.Portal>
								<ContextMenu.Positioner className="z-90">
									<ContextMenu.Popup
										className="z-[9999] min-w-48 rounded-md border border-white/10 bg-zinc-900/90 text-sm text-gray-200 shadow-lg shadow-black/40 relative overflow-hidden"
										style={{
											position: 'fixed',
											zIndex: 9999,
											left: (cmPos?.x ?? 0) + (cmFlipX ? -8 : 8),
											top: (cmPos?.y ?? 0) + (cmFlipY ? -8 : 8),
											transform: `translate(${cmFlipX ? '-100%' : '0'}, ${cmFlipY ? '-100%' : '0'})`
										}}
									>
										<div className="p-1 max-h-72 overflow-y-auto overscroll-contain">
											<div className="px-2 py-1.5 cursor-default select-none opacity-70">UV</div>
											<ContextMenu.Item onClick={() => { markSeams(true); setCmOpen(false); }} disabled={selection.selectionMode !== 'edge' || selection.edgeIds.length === 0}>
												<div className={`px-2 py-1.5 rounded ${selection.selectionMode !== 'edge' || selection.edgeIds.length === 0 ? 'text-gray-500' : 'hover:bg-white/10 cursor-default'}`}>Mark Seam (selected)</div>
											</ContextMenu.Item>
											<ContextMenu.Item onClick={() => { markSeams(false); setCmOpen(false); }} disabled={selection.selectionMode !== 'edge' || selection.edgeIds.length === 0}>
												<div className={`px-2 py-1.5 rounded ${selection.selectionMode !== 'edge' || selection.edgeIds.length === 0 ? 'text-gray-500' : 'hover:bg-white/10 cursor-default'}`}>Clear Seam (selected)</div>
											</ContextMenu.Item>
											<ContextMenu.Separator />
											<ContextMenu.Item onClick={() => { clearSeams(); setCmOpen(false); }}>
												<div className="px-2 py-1.5 rounded hover:bg-white/10 cursor-default">Clear All Seams</div>
											</ContextMenu.Item>
											<ContextMenu.Item onClick={() => { unwrapBySeams(); setCmOpen(false); }}>
												<div className="px-2 py-1.5 rounded hover:bg-white/10 cursor-default">Unwrap (Seams)</div>
											</ContextMenu.Item>
													<ContextMenu.Separator />
													<div className="px-2 py-1.5 cursor-default select-none opacity-70">Edit</div>
													<ContextMenu.Item onClick={() => {
														if (!meshId) return; const sel = selection;
														const geo = useGeometryStore.getState();
														const { deleteVerticesInMesh, deleteEdgesInMesh, deleteFacesInMesh } = require('@/utils/edit-ops');
														if (sel.selectionMode === 'vertex' && sel.vertexIds.length) {
															geo.updateMesh(meshId, (m) => deleteVerticesInMesh(m, sel.vertexIds));
															geo.recalculateNormals(meshId);
															useSelectionStore.getState().selectVertices(meshId, []);
														} else if (sel.selectionMode === 'edge' && sel.edgeIds.length) {
															geo.updateMesh(meshId, (m) => deleteEdgesInMesh(m, sel.edgeIds));
															geo.recalculateNormals(meshId);
															useSelectionStore.getState().selectEdges(meshId, []);
														} else if (sel.selectionMode === 'face' && sel.faceIds.length) {
															geo.updateMesh(meshId, (m) => deleteFacesInMesh(m, sel.faceIds));
															geo.recalculateNormals(meshId);
															useSelectionStore.getState().selectFaces(meshId, []);
														}
														setCmOpen(false);
													}} disabled={!meshId || (selection.selectionMode === 'vertex' ? selection.vertexIds.length === 0 : selection.selectionMode === 'edge' ? selection.edgeIds.length === 0 : selection.faceIds.length === 0)}>
														<div className={`px-2 py-1.5 rounded ${!meshId ? 'text-gray-500' : 'hover:bg-white/10 cursor-default'}`}>Delete Selected</div>
													</ContextMenu.Item>
													<ContextMenu.Item onClick={() => {
														if (!meshId) return; const sel = selection; if (sel.selectionMode !== 'vertex' || sel.vertexIds.length < 2) return;
														const geo = useGeometryStore.getState();
														const { mergeVerticesInMesh } = require('@/utils/edit-ops');
														geo.updateMesh(meshId, (m) => mergeVerticesInMesh(m, sel.vertexIds, 'center'));
														geo.recalculateNormals(meshId);
														const kept = sel.vertexIds[0];
														const m = useGeometryStore.getState().meshes.get(meshId);
														const still = m?.vertices.some(v => v.id === kept) ? [kept] : [];
														useSelectionStore.getState().selectVertices(meshId, still);
														setCmOpen(false);
													}} disabled={!meshId || selection.selectionMode !== 'vertex' || selection.vertexIds.length < 2}>
														<div className={`px-2 py-1.5 rounded ${!meshId || selection.selectionMode !== 'vertex' || selection.vertexIds.length < 2 ? 'text-gray-500' : 'hover:bg-white/10 cursor-default'}`}>Merge Vertices (Center)</div>
													</ContextMenu.Item>
										</div>
									</ContextMenu.Popup>
								</ContextMenu.Positioner>
							</ContextMenu.Portal>
						</ContextMenu.Root>
					</Html>
					{/* Loop Cut handler: preview only + wheel segments; LMB to commit later */}
					<ToolHandler
						meshId={meshId!}
						onLocalDataChange={handleLocalDataChange}
						objectRotation={objTransform.rotation}
						objectScale={objTransform.scale}
					/>

					{/* Sculpt handler overlays brush and applies strokes when a sculpt tool is active */}
					{toolStore.isActive && String(toolStore.tool).startsWith('sculpt-') && (
						<SculptHandler
							meshId={meshId!}
							objectRotation={objTransform.rotation}
							objectScale={objTransform.scale}
							objectPosition={objTransform.position}
						/>
					)}

					{/* Render all edit-mode visuals under the object's transform so object-space vertices appear in the right world position */}
					<group
						position={[objTransform.position.x, objTransform.position.y, objTransform.position.z]}
						rotation={[objTransform.rotation.x, objTransform.rotation.y, objTransform.rotation.z]}
						scale={[objTransform.scale.x, objTransform.scale.y, objTransform.scale.z]}
					>
						{toolStore.isActive && toolStore.tool === 'loopcut' && loopcutLines.length > 0 && (
							<lineSegments>
								<bufferGeometry>
									<bufferAttribute
										attach="attributes-position"
										args={[
											new Float32Array(
												loopcutLines.flatMap((ln) => [
													ln.a.x, ln.a.y, ln.a.z,
													ln.b.x, ln.b.y, ln.b.z,
												])
											),
											3,
										]}
									/>
								</bufferGeometry>
								<lineBasicMaterial color={new Color(1, 1, 0)} depthTest={false} depthWrite={false} transparent opacity={0.9} />
							</lineSegments>
						)}
						{selection.selectionMode === 'vertex' && !(toolStore.isActive && String(toolStore.tool).startsWith('sculpt-')) && (
							<VertexRenderer
								meshId={meshId!}
								selectedVertexIds={selection.vertexIds}
								onVertexClick={handleVertexClick}
								selectionMode={selection.selectionMode}
								localVertices={localVertices || undefined}
								objectScale={objTransform.scale}
								objectRotation={objTransform.rotation}
								objectPosition={objTransform.position}
							/>
						)}

						{!(toolStore.isActive && String(toolStore.tool).startsWith('sculpt-')) && (
							<EdgeRenderer
								meshId={meshId!}
								selectedEdgeIds={selection.edgeIds}
								onEdgeClick={handleEdgeClick}
								selectionMode={selection.selectionMode}
								localVertices={localVertices || undefined}
							/>
						)}

						{selection.selectionMode === 'face' && !(toolStore.isActive && String(toolStore.tool).startsWith('sculpt-')) && (
							<FaceRenderer
								meshId={meshId!}
								selectedFaceIds={selection.faceIds}
								onFaceClick={handleFaceClick}
								selectionMode={selection.selectionMode}
								localVertices={localVertices || undefined}
							/>
						)}

						{toolStore.isActive && ['move', 'rotate', 'scale', 'extrude', 'inset', 'bevel'].includes(toolStore.tool) && centroid && (
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
			)}
		</>
	);
};

export default EditModeOverlay;

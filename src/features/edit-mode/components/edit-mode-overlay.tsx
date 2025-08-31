'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { Color, Vector3 } from 'three/webgpu';
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
	const { gl } = useThree();

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
		console.log("click")
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

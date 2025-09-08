'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { Color, Vector3 } from 'three';
import { Html } from '@react-three/drei';
import { useSelectionVertices } from '@/features/edit-mode/hooks/use-selection-vertices';
import { useSceneStore } from '@/stores/scene-store';
import { useLoopcut } from '@/features/edit-mode/hooks/use-loopcut';
// loopcut spans retained indirectly via existing hook usage (removed direct usage)
import { SculptHandler } from '@/features/edit-mode/components/sculpt-handler';
import { unwrapMeshBySeams } from '@/utils/uv-mapping';
import { deleteVerticesInMesh, deleteEdgesInMesh, deleteFacesInMesh, mergeVerticesInMesh } from '@/utils/edit-ops';
import { useEditModeContextMenu } from '@/features/edit-mode/hooks/use-edit-mode-context-menu';
import { useMarqueeSelection } from '@/features/edit-mode/hooks/use-marquee-selection';
import { useMarqueeOverlay } from '@/features/edit-mode/hooks/use-marquee-overlay';
import { useEditModeSelection } from '@/features/edit-mode/hooks/use-edit-mode-selection';

// Loop / ring / face-loop selection logic moved to dedicated hooks & utils

const EditModeOverlay: React.FC = () => {
	const selectionStore = useSelectionStore();
	const toolStore = useToolStore();
	const geometryStore = useGeometryStore();
	const { gl } = useThree();

	const [localVertices, setLocalVertices] = useState<Vertex[] | null>(null);

	const selection = selectionStore.selection;
	const meshId = selection.meshId;
	const mesh = meshId ? geometryStore.meshes.get(meshId) : null;

	const { handleVertexClick, handleEdgeClick, handleFaceClick } = useEditModeSelection({ meshId: meshId || null, toolActive: toolStore.isActive });

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
	const { cmOpen, setCmOpen, cmPos, cmFlipX, cmFlipY } = useEditModeContextMenu(gl);

	// Face click handled in hook

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
	const marquee = useMarqueeSelection(objTransform);



	// Marquee visual overlay using portal to document.body
	useMarqueeOverlay(marquee, gl);

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

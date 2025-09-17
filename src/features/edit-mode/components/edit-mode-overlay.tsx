'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { useSelectionStore } from '@/stores/selection-store';
import { useToolStore } from '@/stores/tool-store';
import { useGeometryStore } from '@/stores/geometry-store';
import { Vertex } from '@/types/geometry';
import { VertexRenderer } from '@/features/edit-mode/components/vertex-renderer';
import { EdgeRenderer } from '@/features/edit-mode/components/edge-renderer';
import { FaceRenderer } from '@/features/edit-mode/components/face-renderer';
import { ToolHandler } from '@/features/edit-mode/components/tool-handler';
import { Color, Vector3 } from 'three/webgpu';
import { useSelectionVertices } from '@/features/edit-mode/hooks/use-selection-vertices';
import { useSceneStore } from '@/stores/scene-store';
import { useLoopcut } from '@/features/edit-mode/hooks/use-loopcut';
// loopcut spans retained indirectly via existing hook usage (removed direct usage)
import { SculptHandler } from '@/features/edit-mode/components/sculpt-handler';
import { KnifeHandler } from '@/features/edit-mode/components/knife-handler';
import { unwrapMeshBySeams } from '@/utils/uv-mapping';
import { useEditModeContextMenu } from '@/features/edit-mode/hooks/use-edit-mode-context-menu';
import { useMarqueeSelection } from '@/features/edit-mode/hooks/use-marquee-selection';
import { useMarqueeOverlay } from '@/features/edit-mode/hooks/use-marquee-overlay';
import { useEditModeSelection } from '@/features/edit-mode/hooks/use-edit-mode-selection';
import EditModeContextMenu from '@/features/edit-mode/components/edit-mode-context-menu';

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
					<EditModeContextMenu
						cmOpen={cmOpen}
						setCmOpen={setCmOpen}
						cmPos={cmPos}
						cmFlipX={cmFlipX}
						cmFlipY={cmFlipY}
						selection={selection}
						meshId={meshId}
						markSeams={markSeams}
						clearSeams={clearSeams}
						unwrapBySeams={unwrapBySeams}
					/>
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

					{/* Knife handler for knife tool */}
					{toolStore.isActive && toolStore.tool === 'knife' && (
						<KnifeHandler
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

						{/* Knife cut lines */}
						{toolStore.isActive && toolStore.tool === 'knife' && toolStore.localData?.kind === 'knife' && (
							<>
								{/* Existing cut lines */}
								{toolStore.localData.previewPath.length > 0 && (
									<lineSegments>
										<bufferGeometry>
											<bufferAttribute
												attach="attributes-position"
												args={[
													new Float32Array(
														toolStore.localData.previewPath.flatMap((line) => [
															line.a.x, line.a.y, line.a.z,
															line.b.x, line.b.y, line.b.z,
														])
													),
													3,
												]}
											/>
										</bufferGeometry>
										<lineBasicMaterial color={new Color(1, 1, 0)} depthTest={false} depthWrite={false} transparent opacity={0.8} />
									</lineSegments>
								)}

								{/* Hover preview line from last point to cursor */}
								{toolStore.localData.hoverLine && (
									<lineSegments>
										<bufferGeometry>
											<bufferAttribute
												attach="attributes-position"
												args={[
													new Float32Array([
														toolStore.localData.hoverLine.a.x, toolStore.localData.hoverLine.a.y, toolStore.localData.hoverLine.a.z,
														toolStore.localData.hoverLine.b.x, toolStore.localData.hoverLine.b.y, toolStore.localData.hoverLine.b.z,
													]),
													3,
												]}
											/>
										</bufferGeometry>
										<lineBasicMaterial color={new Color(1, 1, 0)} depthTest={false} depthWrite={false} transparent opacity={0.6} />
									</lineSegments>
								)}

								{/* Cut points */}
								{toolStore.localData.cutPoints.map((point, index) => (
									<mesh key={index} position={[point.x, point.y, point.z]}>
										<sphereGeometry args={[0.02, 8, 8]} />
										<meshBasicMaterial color={new Color(1, 1, 0)} depthTest={false} depthWrite={false} transparent opacity={0.9} />
									</mesh>
								))}
							</>
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

						{toolStore.isActive && ['move', 'rotate', 'scale', 'extrude', 'inset', 'bevel', 'chamfer', 'fillet'].includes(toolStore.tool) && centroid && (
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

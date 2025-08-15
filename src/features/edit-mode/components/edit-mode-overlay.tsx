'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useSelectionStore } from '@/stores/selection-store';
import { useToolStore } from '@/stores/tool-store';
import { useGeometryStore } from '@/stores/geometry-store';
import { Vertex } from '@/types/geometry';
import { VertexRenderer } from '@/features/edit-mode/components/vertex-renderer';
import { EdgeRenderer } from '@/features/edit-mode/components/edge-renderer';
import { FaceRenderer } from '@/features/edit-mode/components/face-renderer';
import { ToolHandler } from '@/features/edit-mode/components/tool-handler';
import { Color, Vector3 } from 'three';
import { useSelectionVertices } from '@/features/edit-mode/hooks/use-selection-vertices';

const EditModeOverlay: React.FC = () => {
	const selectionStore = useSelectionStore();
	const toolStore = useToolStore();
	const geometryStore = useGeometryStore();

	const [localVertices, setLocalVertices] = useState<Vertex[] | null>(null);

	const selection = selectionStore.selection;
	const meshId = selection.meshId;

	if (!meshId) return null;

	const mesh = geometryStore.meshes.get(meshId);
	if (!mesh) return null;

	const handleVertexClick = (vertexId: string, event: React.MouseEvent) => {
		if (toolStore.isActive) return;
		const isShiftPressed = event.shiftKey;
		if (isShiftPressed) {
			selectionStore.toggleVertexSelection(meshId, vertexId);
		} else {
			selectionStore.selectVertices(meshId, [vertexId]);
		}
	};

	const handleEdgeClick = (edgeId: string, event: React.MouseEvent) => {
		if (toolStore.isActive) return;
		const isShiftPressed = event.shiftKey;
		if (isShiftPressed) {
			selectionStore.toggleEdgeSelection(meshId, edgeId);
		} else {
			selectionStore.selectEdges(meshId, [edgeId]);
		}
	};

	const handleFaceClick = (faceId: string, event: React.MouseEvent) => {
		if (toolStore.isActive) return;
		const isShiftPressed = event.shiftKey;
		if (isShiftPressed) {
			selectionStore.toggleFaceSelection(meshId, faceId);
		} else {
			selectionStore.selectFaces(meshId, [faceId]);
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

	const { vertices: currentSelectionVertices, centroid } = useSelectionVertices(meshId, localVertices);

	return (
		<>
			<ToolHandler meshId={meshId} onLocalDataChange={handleLocalDataChange} />

			{ selection.selectionMode === 'vertex' && (
				<VertexRenderer
					meshId={meshId}
					selectedVertexIds={selection.vertexIds}
					onVertexClick={handleVertexClick}
					selectionMode={selection.selectionMode}
					localVertices={localVertices || undefined}
				/>
			)}

			<EdgeRenderer
				meshId={meshId}
				selectedEdgeIds={selection.edgeIds}
				onEdgeClick={handleEdgeClick}
				selectionMode={selection.selectionMode}
				localVertices={localVertices || undefined}
			/>

			{ selection.selectionMode === 'face' && (
				<FaceRenderer
					meshId={meshId}
					selectedFaceIds={selection.faceIds}
					onFaceClick={handleFaceClick}
					selectionMode={selection.selectionMode}
					localVertices={localVertices || undefined}
				/>
			)}

			{toolStore.isActive && centroid && (
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
							<line key={key as string} ref={(n: any) => { if (n) (n as any).renderOrder = 2550; }}>
												<bufferGeometry>
													<bufferAttribute attach="attributes-position" args={[positions, 3]} />
												</bufferGeometry>
								<lineBasicMaterial color={color} depthTest={false} depthWrite={false} transparent opacity={opacity} />
							</line>
						);
					})}
				</group>
			)}
		</>
	);
};

export default EditModeOverlay;

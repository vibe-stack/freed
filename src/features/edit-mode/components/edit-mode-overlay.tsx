'use client';

import React, { useCallback, useEffect, useState } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
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
	const mesh = meshId ? geometryStore.meshes.get(meshId) : null;

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

	const { vertices: currentSelectionVertices, centroid } = useSelectionVertices(meshId || '', localVertices);

	if (!meshId || !mesh) return null;

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
		</>
	);
};

export default EditModeOverlay;

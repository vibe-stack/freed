import React from 'react';
import { ContextMenu } from '@base-ui-components/react/context-menu';
import { Html } from '@react-three/drei';
import { useGeometryStore } from '@/stores/geometry-store';
import { mergeVerticesByDistance } from '@/utils/edit-ops';
import { useSelectionStore } from '@/stores/selection-store';
import { deleteVerticesInMesh, deleteEdgesInMesh, deleteFacesInMesh, mergeVerticesInMesh } from '@/utils/edit-ops';

interface EditModeContextMenuProps {
	cmOpen: boolean;
	setCmOpen: (open: boolean) => void;
	cmPos: { x: number; y: number } | null;
	cmFlipX: boolean;
	cmFlipY: boolean;
	selection: any;
	meshId: string | null;
	markSeams: (seam: boolean) => void;
	clearSeams: () => void;
	unwrapBySeams: () => void;
}

const EditModeContextMenu: React.FC<EditModeContextMenuProps> = ({
	cmOpen,
	setCmOpen,
	cmPos,
	cmFlipX,
	cmFlipY,
	selection,
	meshId,
	markSeams,
	clearSeams,
	unwrapBySeams,
}) => {
	// geometryStore intentionally unused here; operations use the geometry store singleton via getState()

	const handleDeleteSelected = () => {
		if (!meshId) return;
		const sel = selection;
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
	};

	const handleMergeVertices = () => {
		if (!meshId) return;
		const sel = selection;
		if (sel.selectionMode !== 'vertex' || sel.vertexIds.length < 2) return;
		const geo = useGeometryStore.getState();
		geo.updateMesh(meshId, (m) => mergeVerticesInMesh(m, sel.vertexIds, 'center'));
		geo.recalculateNormals(meshId);
		const kept = sel.vertexIds[0];
		const m = useGeometryStore.getState().meshes.get(meshId);
		const still = m?.vertices.some(v => v.id === kept) ? [kept] : [];
		useSelectionStore.getState().selectVertices(meshId, still);
		setCmOpen(false);
	};

	const handleMergeByDistance = async () => {
		if (!meshId) return;
		const sel = selection;
		if (sel.selectionMode !== 'vertex' || sel.vertexIds.length < 2) return;
		// Ask user for distance via prompt (simple, non-blocking)
		const input = window.prompt('Merge distance (units):', '0.001');
		if (!input) return;
		const val = parseFloat(input);
		if (Number.isNaN(val) || val <= 0) return;
		const geo = useGeometryStore.getState();
		geo.updateMesh(meshId, (m) => {
			mergeVerticesByDistance(m, sel.vertexIds, val, 'center');
		});
		geo.recalculateNormals(meshId);
		// After merge, clear selection
		useSelectionStore.getState().selectVertices(meshId, []);
		setCmOpen(false);
	};

	return (
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
								<ContextMenu.Item onClick={handleDeleteSelected} disabled={!meshId || (selection.selectionMode === 'vertex' ? selection.vertexIds.length === 0 : selection.selectionMode === 'edge' ? selection.edgeIds.length === 0 : selection.faceIds.length === 0)}>
									<div className={`px-2 py-1.5 rounded ${!meshId ? 'text-gray-500' : 'hover:bg-white/10 cursor-default'}`}>Delete Selected</div>
								</ContextMenu.Item>
								<ContextMenu.Item onClick={handleMergeVertices} disabled={!meshId || selection.selectionMode !== 'vertex' || selection.vertexIds.length < 2}>
									<div className={`px-2 py-1.5 rounded ${!meshId || selection.selectionMode !== 'vertex' || selection.vertexIds.length < 2 ? 'text-gray-500' : 'hover:bg-white/10 cursor-default'}`}>Merge Vertices (Center)</div>
								</ContextMenu.Item>
								<ContextMenu.Item onClick={handleMergeByDistance} disabled={!meshId || selection.selectionMode !== 'vertex' || selection.vertexIds.length < 2}>
									<div className={`px-2 py-1.5 rounded ${!meshId || selection.selectionMode !== 'vertex' || selection.vertexIds.length < 2 ? 'text-gray-500' : 'hover:bg-white/10 cursor-default'}`}>Merge Vertices (By Distance)</div>
								</ContextMenu.Item>
							</div>
						</ContextMenu.Popup>
					</ContextMenu.Positioner>
				</ContextMenu.Portal>
			</ContextMenu.Root>
		</Html>
	);
};

export default EditModeContextMenu;

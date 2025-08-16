'use client';

import React, { useCallback, useState } from 'react';
import { Menu } from '@base-ui-components/react/menu';
import { useGeometryStore } from '@/stores/geometry-store';
import { useSceneStore } from '@/stores/scene-store';
import { useViewportStore } from '@/stores/viewport-store';
import { useSelectionStore } from '@/stores/selection-store';
import { useToolStore } from '@/stores/tool-store';
import { useShapeCreationStore } from '@/stores/shape-creation-store';
import { exportAndDownload, WorkspaceData } from '@/utils/t3d-exporter';
import { openImportDialog } from '@/utils/t3d-importer';
import { Box, FileDown, FileUp, Heart } from 'lucide-react';
import DonateDialog from '@/components/donate-dialog';

const MenuBar: React.FC = () => {
	const [donateOpen, setDonateOpen] = useState(false);
	const geometryStore = useGeometryStore();
	const sceneStore = useSceneStore();
	const viewportStore = useViewportStore();
	const selectionStore = useSelectionStore();
	const toolStore = useToolStore();
	const shapeCreationStore = useShapeCreationStore();

	const handleExport = useCallback(async () => {
		const workspaceData: WorkspaceData = {
			meshes: Array.from(geometryStore.meshes.values()),
			materials: Array.from(geometryStore.materials.values()),
			objects: Object.values(sceneStore.objects),
			rootObjects: sceneStore.rootObjects,
			viewport: {
				camera: viewportStore.camera,
				shadingMode: viewportStore.shadingMode,
				showGrid: viewportStore.showGrid,
				showAxes: viewportStore.showAxes,
				gridSize: viewportStore.gridSize,
				backgroundColor: viewportStore.backgroundColor,
			},
			selectedObjectId: sceneStore.selectedObjectId,
		};
		const timestamp = new Date().toISOString().split('T')[0];
		await exportAndDownload(workspaceData, `scene_${timestamp}.t3d`);
	}, [geometryStore, sceneStore, viewportStore]);

	const handleImport = useCallback(() => {
		openImportDialog(
			(data) => {
				Array.from(geometryStore.meshes.keys()).forEach(id => geometryStore.removeMesh(id));
				data.meshes.forEach(m => geometryStore.addMesh(m));
				Array.from(geometryStore.materials.keys()).forEach(id => geometryStore.removeMaterial(id));
				data.materials.forEach(m => geometryStore.addMaterial(m));
				Object.keys(sceneStore.objects).forEach(id => sceneStore.removeObject(id));
				data.objects.forEach(o => sceneStore.addObject(o));
				sceneStore.rootObjects.splice(0, sceneStore.rootObjects.length, ...data.rootObjects);
				sceneStore.selectObject(data.selectedObjectId);
				viewportStore.setCamera(data.viewport.camera);
				viewportStore.setShadingMode(data.viewport.shadingMode);
				viewportStore.setGridSize(data.viewport.gridSize);
				viewportStore.setBackgroundColor([
					data.viewport.backgroundColor.x,
					data.viewport.backgroundColor.y,
					data.viewport.backgroundColor.z,
				]);
				if (data.viewport.showGrid !== viewportStore.showGrid) viewportStore.toggleGrid();
				if (data.viewport.showAxes !== viewportStore.showAxes) viewportStore.toggleAxes();
			},
			(err) => console.error(err)
		);
	}, [geometryStore, sceneStore, viewportStore]);

	const handleNewScene = useCallback(() => {
		geometryStore.reset();
		sceneStore.reset();
		selectionStore.reset();
		viewportStore.reset();
		toolStore.reset();
		shapeCreationStore.reset();
	}, [geometryStore, sceneStore, selectionStore, viewportStore, toolStore, shapeCreationStore]);

	return (
		<div className="h-8 w-full border-b border-white/10 bg-[#0b0e13]/80 backdrop-blur supports-[backdrop-filter]:bg-[#0b0e13]/60 flex items-center px-3 select-none z-30">
			<div className="flex items-center gap-2 text-sm text-gray-300 font-medium">
				<Box className="w-4 h-4 text-gray-400" aria-hidden />
				<span className="tracking-wide">Freed</span>
			</div>
			<div className="mx-2 h-4 w-px bg-white/10" />

			<div className="flex items-center gap-1">
				{/* File */}
				<Menu.Root modal={false} openOnHover>
					<Menu.Trigger className="px-2 py-1 text-xs rounded text-gray-300 hover:text-white hover:bg-white/5 data-[open]:bg-white/10 data-[open]:text-white">
						File
					</Menu.Trigger>
					<Menu.Portal>
						<Menu.Positioner side="bottom" align="start" sideOffset={4}>
							<Menu.Popup className="mt-0 w-44 rounded border border-white/10 bg-[#0b0e13]/95 shadow-lg py-1 text-xs z-40">
								<Menu.Item className="w-full text-left px-3 py-1.5 hover:bg-white/10 text-gray-200" onClick={handleNewScene}>Create New</Menu.Item>
								<Menu.Separator className="my-1 h-px bg-white/10" />
								<Menu.Item className="w-full text-left px-3 py-1.5 hover:bg-white/10 text-gray-200" onClick={handleImport}>
									<span className="inline-flex items-center gap-2"><FileUp className="w-4 h-4" /> Import…</span>
								</Menu.Item>
								<Menu.Item className="w-full text-left px-3 py-1.5 hover:bg-white/10 text-gray-200" onClick={handleExport}>
									<span className="inline-flex items-center gap-2"><FileDown className="w-4 h-4" /> Export…</span>
								</Menu.Item>
							</Menu.Popup>
						</Menu.Positioner>
					</Menu.Portal>
				</Menu.Root>

				{/* Edit (placeholders) */}
				<Menu.Root modal={false} openOnHover>
					<Menu.Trigger className="px-2 py-1 text-xs rounded text-gray-300 hover:text-white hover:bg-white/5 data-[open]:bg-white/10 data-[open]:text-white">
						Edit
					</Menu.Trigger>
					<Menu.Portal>
						<Menu.Positioner side="bottom" align="start" sideOffset={4}>
							<Menu.Popup className="mt-0 w-44 rounded border border-white/10 bg-[#0b0e13]/95 shadow-lg py-1 text-xs z-40">
								<Menu.Item className="px-3 py-1.5 text-gray-500">Undo</Menu.Item>
								<Menu.Item className="px-3 py-1.5 text-gray-500">Redo</Menu.Item>
								<Menu.Separator className="my-1 h-px bg-white/10" />
								<Menu.Item className="px-3 py-1.5 text-gray-500">Cut</Menu.Item>
								<Menu.Item className="px-3 py-1.5 text-gray-500">Copy</Menu.Item>
								<Menu.Item className="px-3 py-1.5 text-gray-500">Paste</Menu.Item>
								<Menu.Separator className="my-1 h-px bg-white/10" />
								<Menu.Item className="px-3 py-1.5 text-gray-500">Delete</Menu.Item>
								<Menu.Item className="px-3 py-1.5 text-gray-500">Select All</Menu.Item>
							</Menu.Popup>
						</Menu.Positioner>
					</Menu.Portal>
				</Menu.Root>

				{/* View (placeholders) */}
				<Menu.Root modal={false} openOnHover>
					<Menu.Trigger className="px-2 py-1 text-xs rounded text-gray-300 hover:text-white hover:bg-white/5 data-[open]:bg-white/10 data-[open]:text-white">
						View
					</Menu.Trigger>
					<Menu.Portal>
						<Menu.Positioner side="bottom" align="start" sideOffset={4}>
							<Menu.Popup className="mt-0 w-48 rounded border border-white/10 bg-[#0b0e13]/95 shadow-lg py-1 text-xs z-40">
								<Menu.Item className="px-3 py-1.5 text-gray-500">Zoom In</Menu.Item>
								<Menu.Item className="px-3 py-1.5 text-gray-500">Zoom Out</Menu.Item>
								<Menu.Item className="px-3 py-1.5 text-gray-500">Fit to Screen</Menu.Item>
								<Menu.Separator className="my-1 h-px bg-white/10" />
								<Menu.Item className="px-3 py-1.5 text-gray-500">Toggle Grid</Menu.Item>
								<Menu.Item className="px-3 py-1.5 text-gray-500">Toggle Axes</Menu.Item>
								<Menu.Item className="px-3 py-1.5 text-gray-500">Shading Mode</Menu.Item>
							</Menu.Popup>
						</Menu.Positioner>
					</Menu.Portal>
				</Menu.Root>
			</div>

			<div className="ml-auto flex items-center gap-2 text-[11px] text-gray-400">
				{/* SPONSORING AREA */}
				<button
					className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-rose-300 hover:text-white hover:bg-rose-500/20 border border-rose-500/30"
					onClick={() => setDonateOpen(true)}
				>
					<Heart className="w-3.5 h-3.5" /> Donate
				</button>
				<DonateDialog open={donateOpen} onOpenChange={setDonateOpen} />
			</div>
		</div>
	);
};

export default MenuBar;

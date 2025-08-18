'use client';

import React, { useCallback, useState } from 'react';
import { Menu } from '@base-ui-components/react/menu';
import { useGeometryStore } from '@/stores/geometry-store';
import { useSceneStore } from '@/stores/scene-store';
import { useViewportStore } from '@/stores/viewport-store';
import { useSelectionStore } from '@/stores/selection-store';
import { useToolStore } from '@/stores/tool-store';
import { useShapeCreationStore } from '@/stores/shape-creation-store';
import { WorkspaceData, exportToT3D } from '@/utils/t3d-exporter';
import { openImportDialog } from '@/utils/t3d-importer';
import { Box, Download, FolderOpen, Save, Heart } from 'lucide-react';
import DonateDialog from '@/components/donate-dialog';
import ExportDialog from '@/features/export/components/export-dialog';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { saveAs, saveWithHandle } from '@/utils/file-access';
import { useClipboardStore } from '@/stores/clipboard-store';
import { geometryRedo, geometryUndo } from '@/stores/geometry-store';
import { useRegisterShortcuts } from '@/components/shortcut-provider';

const MenuBar: React.FC = () => {
	const [donateOpen, setDonateOpen] = useState(false);
	const [exportOpen, setExportOpen] = useState(false);
	const geometryStore = useGeometryStore();
	const sceneStore = useSceneStore();
	const viewportStore = useViewportStore();
	const selectionStore = useSelectionStore();
	const toolStore = useToolStore();
	const shapeCreationStore = useShapeCreationStore();
	const workspace = useWorkspaceStore();
	const clipboard = useClipboardStore();

	const buildWorkspaceData = useCallback((): WorkspaceData => ({
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
	}), [geometryStore, sceneStore, viewportStore]);

	// Save (T3D) with existing handle when possible
	const handleSave = useCallback(async () => {
		const data = buildWorkspaceData();
		const blob = await exportToT3D(data);
		if (workspace.fileHandle) {
			const ok = await saveWithHandle(workspace.fileHandle, blob);
			if (!ok) {
				const timestamp = new Date().toISOString().split('T')[0];
				const name = workspace.currentFileName ?? `scene_${timestamp}.t3d`;
				const res = await saveAs(blob, name, 'application/zip');
				if (res) workspace.setFileInfo(res.fileName, res.handle);
			}
		} else {
			const timestamp = new Date().toISOString().split('T')[0];
			const name = workspace.currentFileName ?? `scene_${timestamp}.t3d`;
			const res = await saveAs(blob, name, 'application/zip');
			if (res) workspace.setFileInfo(res.fileName, res.handle);
		}
	}, [buildWorkspaceData, workspace]);

	// Save As (T3D)
	const handleSaveAs = useCallback(async () => {
		const data = buildWorkspaceData();
		const blob = await exportToT3D(data);
		const timestamp = new Date().toISOString().split('T')[0];
		const name = `scene_${timestamp}.t3d`;
		const res = await saveAs(blob, name, 'application/zip');
		if (res) workspace.setFileInfo(res.fileName, res.handle);
	}, [buildWorkspaceData, workspace]);

	// Export (other formats) -> open dialog
	const handleExport = useCallback(async () => {
		setExportOpen(true);
	}, []);

	const handleOpen = useCallback(() => {
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
				// update workspace current file (cannot get real name without FS handle)
				workspace.setFileInfo('scene.t3d', null);
			},
			(err) => console.error(err)
		);
	}, [geometryStore, sceneStore, viewportStore, workspace]);

	const handleNewScene = useCallback(() => {
		geometryStore.reset();
		sceneStore.reset();
		selectionStore.reset();
		viewportStore.reset();
		toolStore.reset();
		shapeCreationStore.reset();
	}, [geometryStore, sceneStore, selectionStore, viewportStore, toolStore, shapeCreationStore]);

	// Keyboard shortcuts: Open/Save/Save As/Export, Undo/Redo, Select All
	useRegisterShortcuts([
		{ key: 'o', meta: true, action: () => handleOpen(), description: 'Open (Cmd/Ctrl+O)', preventDefault: true },
		{ key: 'o', ctrl: true, action: () => handleOpen(), description: 'Open (Ctrl+O)', preventDefault: true },
		{ key: 's', meta: true, action: () => handleSave(), description: 'Save (Cmd/Ctrl+S)', preventDefault: true },
		{ key: 's', ctrl: true, action: () => handleSave(), description: 'Save (Ctrl+S)', preventDefault: true },
		{ key: 's', meta: true, shift: true, action: () => handleSaveAs(), description: 'Save As (Cmd/Ctrl+Shift+S)', preventDefault: true },
		{ key: 's', ctrl: true, shift: true, action: () => handleSaveAs(), description: 'Save As (Ctrl+Shift+S)', preventDefault: true },
		{ key: 'e', meta: true, action: () => setExportOpen(true), description: 'Export (Cmd/Ctrl+E)', preventDefault: true },
		{ key: 'e', ctrl: true, action: () => setExportOpen(true), description: 'Export (Ctrl+E)', preventDefault: true },
		// Undo/Redo handling (geometry-only per request)
		{ key: 'z', meta: true, action: () => geometryUndo(), description: 'Undo (Cmd+Z)', preventDefault: true },
		{ key: 'z', ctrl: true, action: () => geometryUndo(), description: 'Undo (Ctrl+Z)', preventDefault: true },
		{ key: 'z', meta: true, shift: true, action: () => geometryRedo(), description: 'Redo (Cmd+Shift+Z)', preventDefault: true },
		{ key: 'y', ctrl: true, action: () => geometryRedo(), description: 'Redo (Ctrl+Y)', preventDefault: true },
		// Select All
		{ key: 'a', meta: true, action: () => useSelectionStore.getState().selectAll(), description: 'Select All (Cmd/Ctrl+A)', preventDefault: true },
		{ key: 'a', ctrl: true, action: () => useSelectionStore.getState().selectAll(), description: 'Select All (Ctrl+A)', preventDefault: true },
	]);

	return (
		<div className="h-8 w-full border-b border-white/10 bg-[#0b0e13]/80 backdrop-blur supports-[backdrop-filter]:bg-[#0b0e13]/60 flex items-center px-3 select-none z-30">
			<div className="flex items-center gap-2 text-sm text-gray-300 font-medium">
				<Box className="w-4 h-4 text-gray-400" aria-hidden />
				<span className="tracking-wide">Gestalt</span>
			</div>
			<div className="mx-2 h-4 w-px bg-white/10" />

			<div className="flex items-center gap-1">
				{/* File */}
				<Menu.Root modal={false} openOnHover>
					<Menu.Trigger className="px-2 py-1 text-xs rounded text-gray-300 hover:text-white hover:bg-white/5 data-[open]:bg-white/10 data-[open]:text-white">
						File
					</Menu.Trigger>
					<Menu.Portal>
						<Menu.Positioner side="bottom" align="start" sideOffset={4} className="z-90">
							<Menu.Popup className="mt-0 w-44 rounded border border-white/10 bg-[#0b0e13]/95 shadow-lg py-1 text-xs z-40">
								<Menu.Item className="w-full text-left px-3 py-1.5 hover:bg-white/10 text-gray-200" onClick={handleNewScene}>New</Menu.Item>
								<Menu.Separator className="my-1 h-px bg-white/10" />
								<Menu.Item className="w-full text-left px-3 py-1.5 hover:bg-white/10 text-gray-200" onClick={handleOpen}>
									<span className="inline-flex items-center gap-2"><FolderOpen className="w-4 h-4" /> Open…</span>
								</Menu.Item>
								<Menu.Item className="w-full text-left px-3 py-1.5 hover:bg-white/10 text-gray-200" onClick={handleSave}>
									<span className="inline-flex items-center gap-2"><Save className="w-4 h-4" /> Save</span>
								</Menu.Item>
								<Menu.Item className="w-full text-left px-3 py-1.5 hover:bg-white/10 text-gray-200" onClick={handleSaveAs}>
									<span className="inline-flex items-center gap-2"><Save className="w-4 h-4" /> Save As…</span>
								</Menu.Item>
								<Menu.Separator className="my-1 h-px bg-white/10" />
								<Menu.Item className="w-full text-left px-3 py-1.5 hover:bg-white/10 text-gray-200" onClick={() => setExportOpen(true)}>
									<span className="inline-flex items-center gap-2"><Download className="w-4 h-4" /> Export…</span>
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
						<Menu.Positioner side="bottom" align="start" sideOffset={4} className="z-90">
							<Menu.Popup className="mt-0 w-44 rounded border border-white/10 bg-[#0b0e13]/95 shadow-lg py-1 text-xs z-40">
								<Menu.Item className="w-full text-left px-3 py-1.5 hover:bg-white/10 text-gray-200" onClick={() => geometryUndo()}>Undo</Menu.Item>
								<Menu.Item className="w-full text-left px-3 py-1.5 hover:bg-white/10 text-gray-200" onClick={() => geometryRedo()}>Redo</Menu.Item>
								<Menu.Separator className="my-1 h-px bg-white/10" />
								<Menu.Item className="w-full text-left px-3 py-1.5 hover:bg-white/10 text-gray-200" onClick={() => clipboard.cutSelection()}>Cut</Menu.Item>
								<Menu.Item className="w-full text-left px-3 py-1.5 hover:bg-white/10 text-gray-200" onClick={() => clipboard.copySelection()}>Copy</Menu.Item>
								<Menu.Item className="w-full text-left px-3 py-1.5 hover:bg-white/10 text-gray-200" onClick={() => clipboard.paste()}>Paste</Menu.Item>
								<Menu.Separator className="my-1 h-px bg-white/10" />
								<Menu.Item className="w-full text-left px-3 py-1.5 hover:bg-white/10 text-gray-200" onClick={() => {
									const sel = useSelectionStore.getState().selection;
									if (sel.viewMode === 'object' && sel.objectIds.length > 0) {
										sel.objectIds.forEach((id) => useSceneStore.getState().removeObject(id));
										useSelectionStore.getState().clearSelection();
									}
								}}>Delete</Menu.Item>
								<Menu.Item className="w-full text-left px-3 py-1.5 hover:bg-white/10 text-gray-200" onClick={() => useSelectionStore.getState().selectAll()}>Select All</Menu.Item>
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
						<Menu.Positioner side="bottom" align="start" sideOffset={4} className="z-90">
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
				<ExportDialog open={exportOpen} onOpenChange={setExportOpen} />
			</div>
		</div>
	);
};

export default MenuBar;

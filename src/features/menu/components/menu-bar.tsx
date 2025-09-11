'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Menu } from '@base-ui-components/react/menu';
import { useGeometryStore } from '@/stores/geometry-store';
import { useSceneStore } from '@/stores/scene-store';
import { useViewportStore } from '@/stores/viewport-store';
import { useSelectionStore } from '@/stores/selection-store';
import { useToolStore } from '@/stores/tool-store';
import { useShapeCreationStore } from '@/stores/shape-creation-store';
import { WorkspaceData, exportToT3D } from '@/utils/t3d-exporter';
import { openImportDialog } from '@/utils/t3d-importer';
import { openGLTFImportDialog, type ImportSummary } from '@/utils/gltf-importer';
import { openOBJImportDialog, type OBJImportSummary } from '@/utils/obj-importer';
import { Box, Download, FolderOpen, Save, Heart, Check, Minimize2 } from 'lucide-react';
import DonateDialog from '@/components/donate-dialog';
import { useUVEditorStore } from '@/stores/uv-editor-store';
import ExportDialog from '@/features/export/components/export-dialog';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { saveAs, saveWithHandle } from '@/utils/file-access';
import { useClipboardStore } from '@/stores/clipboard-store';
import { geometryRedo, geometryUndo } from '@/stores/geometry-store';
import { useRegisterShortcuts } from '@/components/shortcut-provider';
import { Euler, Matrix4, Quaternion, Vector3 } from 'three/webgpu';
import AddObjectMenu from '@/features/shared/add-object-menu';
import { useTextStore } from '@/stores/text-store';
import { useTerrainStore } from '@/stores/terrain-store';

type Props = { onOpenShaderEditor?: () => void };
const MenuBar: React.FC<Props> = ({ onOpenShaderEditor }) => {
	const [donateOpen, setDonateOpen] = useState(false);
	const [exportOpen, setExportOpen] = useState(false);
	const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
	useEffect(() => { setPortalContainer(document.body); }, []);
	const geometryStore = useGeometryStore();
	const sceneStore = useSceneStore();
	const viewportStore = useViewportStore();
	const selectionStore = useSelectionStore();
	const toolStore = useToolStore();
	const shapeCreationStore = useShapeCreationStore();
	const workspace = useWorkspaceStore();
	const clipboard = useClipboardStore();
	const setUVOpen = useUVEditorStore((s) => s.setOpen);

	// Track undo/redo availability from zundo temporal API
	const [canUndo, setCanUndo] = useState(false);
	const [canRedo, setCanRedo] = useState(false);
	useEffect(() => {
		const temporalStore: any = (useGeometryStore as any).temporal;
		if (!temporalStore?.getState) return;
		const update = () => {
			try {
				const st = temporalStore.getState?.();
				setCanUndo(Boolean(st?.pastStates?.length));
				setCanRedo(Boolean(st?.futureStates?.length));
			} catch { }
		};
		update();
		const unsub = temporalStore.subscribe ? temporalStore.subscribe(update) : undefined;
		return () => {
			if (typeof unsub === 'function') unsub();
		};
	}, []);

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
		lights: sceneStore.lights,
		cameras: geometryStore.cameras,
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

	const handleOpen = useCallback(() => {
			openImportDialog(
				(data) => {
					// Geometry: replace maps in a controlled way
					Array.from(geometryStore.meshes.keys()).forEach(id => geometryStore.removeMesh(id));
					data.meshes.forEach(m => geometryStore.addMesh(m));
					Array.from(geometryStore.materials.keys()).forEach(id => geometryStore.removeMaterial(id));
					data.materials.forEach(m => geometryStore.addMaterial(m));

							// Scene: atomic rebuild to maintain proper parent-child links
					sceneStore.setScene(data.objects, data.rootObjects);
					sceneStore.selectObject(data.selectedObjectId);

					// Viewport state
					viewportStore.setCamera(data.viewport.camera);
					viewportStore.setShadingMode(data.viewport.shadingMode);
					viewportStore.setGridSize(data.viewport.gridSize);
					viewportStore.setBackgroundColor([
						data.viewport.backgroundColor.x,
						data.viewport.backgroundColor.y,
						data.viewport.backgroundColor.z,
					]);
							if ((data.viewport as any).activeCameraObjectId !== undefined) {
								viewportStore.setActiveCamera((data.viewport as any).activeCameraObjectId ?? null);
							}
							// Lights and Cameras (optional payloads)
							if (data.lights) {
								// sceneStore has a lights map keyed by lightId; objects reference them by lightId
								useSceneStore.setState((s) => { s.lights = {} as any; });
								Object.entries(data.lights).forEach(([id, l]) => {
									useSceneStore.setState((s) => { (s.lights as any)[id] = l as any; });
								});
							}
							if (data.cameras) {
								// geometry-store holds camera resources
								Object.keys(useGeometryStore.getState().cameras).forEach((id) => useGeometryStore.getState().removeCamera(id));
								Object.values(data.cameras).forEach((c: any) => useGeometryStore.getState().addCamera(c));
							}
					if (data.viewport.showGrid !== viewportStore.showGrid) viewportStore.toggleGrid();
					if (data.viewport.showAxes !== viewportStore.showAxes) viewportStore.toggleAxes();
					// update workspace current file (cannot get real name without FS handle)
					workspace.setFileInfo('scene.t3d', null);
				},
				(err) => console.error(err)
			);
	}, [geometryStore, sceneStore, viewportStore, workspace]);

	const handleImportGLB = useCallback(() => {
		openGLTFImportDialog(
			(summary: ImportSummary) => {
				// Optionally focus the newly imported group
				useSceneStore.getState().selectObject(summary.rootGroupId);
			},
			(err: Error) => console.error('GLB import failed', err)
		);
	}, []);

	const handleImportOBJ = useCallback(() => {
		openOBJImportDialog(
			(summary: OBJImportSummary) => {
				// Focus the newly imported group
				useSceneStore.getState().selectObject(summary.rootGroupId);
				// Select objects if in object mode
				if (useSelectionStore.getState().selection.viewMode === 'object') {
					useSelectionStore.getState().selectObjects(summary.createdObjectIds);
				}
			},
			(err: Error) => console.error('OBJ import failed', err)
		);
	}, []);
	const handleNewScene = useCallback(() => {
		geometryStore.reset();
		sceneStore.reset();
		selectionStore.reset();
		viewportStore.reset();
		toolStore.reset();
		shapeCreationStore.reset();
	}, [geometryStore, sceneStore, selectionStore, viewportStore, toolStore, shapeCreationStore]);

	const handleCreateParticleSystem = useCallback(() => {
		const id = sceneStore.createParticleSystemObject('Particle System');
		sceneStore.selectObject(id);
	}, [sceneStore]);

	const handleCreateFluidSystem = useCallback(() => {
		const id = sceneStore.createFluidSystemObject('Fluid System');
		sceneStore.selectObject(id);
	}, [sceneStore]);

	const beginShape = useCallback((shape: 'cube' | 'plane' | 'cylinder' | 'cone' | 'uvsphere' | 'icosphere' | 'torus') => {
		let id = '';
		let name = '';
		switch (shape) {
			case 'cube': id = geometryStore.createCube(1.5); name = 'Cube'; break;
			case 'plane': id = geometryStore.createPlane(2, 2, 1, 1); name = 'Plane'; break;
			case 'cylinder': id = geometryStore.createCylinder(0.75, 0.75, 2, 24, 1); name = 'Cylinder'; break;
			case 'cone': id = geometryStore.createCone(0.9, 2, 24, 1); name = 'Cone'; break;
			case 'uvsphere': id = geometryStore.createUVSphere(1, 24, 16); name = 'UV Sphere'; break;
			case 'icosphere': id = geometryStore.createIcoSphere(1, 1); name = 'Ico Sphere'; break;
			case 'torus': id = geometryStore.createTorus(1.2, 0.35, 16, 24); name = 'Torus'; break;
		}
		const objId = sceneStore.createMeshObject(`${name} ${id.slice(-4)}`, id);
		sceneStore.selectObject(objId);
		if (useSelectionStore.getState().selection.viewMode === 'object') {
			useSelectionStore.getState().selectObjects([objId]);
		}
		useShapeCreationStore.getState().start(shape, id);
	}, [geometryStore, sceneStore]);

	const addLight = useCallback((type: 'directional' | 'spot' | 'point' | 'ambient') => {
		const id = sceneStore.createLightObject(`${type.charAt(0).toUpperCase() + type.slice(1)} Light`, type);
		sceneStore.selectObject(id);
		if (useSelectionStore.getState().selection.viewMode === 'object') useSelectionStore.getState().selectObjects([id]);
	}, [sceneStore]);

	const addCamera = useCallback((type: 'perspective' | 'orthographic') => {
		const id = sceneStore.createCameraObject(type === 'perspective' ? 'Perspective Camera' : 'Orthographic Camera', type);
		sceneStore.selectObject(id);
		if (useSelectionStore.getState().selection.viewMode === 'object') useSelectionStore.getState().selectObjects([id]);
	}, [sceneStore]);

	const addForce = useCallback((type: 'attractor'|'repulsor'|'vortex') => {
		const pretty = type.charAt(0).toUpperCase() + type.slice(1);
		const id = sceneStore.createForceFieldObject(pretty, type);
		sceneStore.selectObject(id);
		if (useSelectionStore.getState().selection.viewMode === 'object') useSelectionStore.getState().selectObjects([id]);
	}, [sceneStore]);

	// View actions
	const handleZoom = useCallback((scale: number) => {
		const cam = viewportStore.camera;
		const pos = new Vector3(cam.position.x, cam.position.y, cam.position.z);
		const target = new Vector3(cam.target.x, cam.target.y, cam.target.z);
		const dir = pos.clone().sub(target);
		const dist = dir.length();
		const newDist = Math.max(0.1, dist * scale);
		const newPos = target.clone().add(dir.normalize().multiplyScalar(newDist));
		viewportStore.setCamera({ position: { x: newPos.x, y: newPos.y, z: newPos.z } });
	}, [viewportStore]);

	const handleZoomIn = useCallback(() => handleZoom(0.8), [handleZoom]);
	const handleZoomOut = useCallback(() => handleZoom(1.25), [handleZoom]);

	const computeBoundsForObjects = useCallback((objectIds: string[]) => {
		const min = new Vector3(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
		const max = new Vector3(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY);
		let any = false;

		for (const oid of objectIds) {
			const obj = sceneStore.objects[oid];
			if (!obj || !obj.render || obj.type !== 'mesh' || !obj.meshId) continue;
			const mesh = geometryStore.meshes.get(obj.meshId);
			if (!mesh) continue;
			const euler = new Euler(obj.transform.rotation.x, obj.transform.rotation.y, obj.transform.rotation.z);
			const quat = new Quaternion().setFromEuler(euler);
			const scale = new Vector3(obj.transform.scale.x, obj.transform.scale.y, obj.transform.scale.z);
			const pos = new Vector3(obj.transform.position.x, obj.transform.position.y, obj.transform.position.z);
			const mat = new Matrix4().compose(pos, quat, scale);
			for (const v of mesh.vertices) {
				const p = new Vector3(v.position.x, v.position.y, v.position.z).applyMatrix4(mat);
				min.min(p); max.max(p); any = true;
			}
		}
		if (!any) return null;
		const center = min.clone().add(max).multiplyScalar(0.5);
		const sizeVec = max.clone().sub(min);
		const size = Math.max(sizeVec.x, sizeVec.y, sizeVec.z);
		return { center: [center.x, center.y, center.z] as [number, number, number], size: size || 1 };
	}, [geometryStore.meshes, sceneStore.objects]);

	const handleFitToScreen = useCallback(() => {
		const sel = selectionStore.selection;
		let ids: string[] = [];
		if (sel.viewMode === 'object' && sel.objectIds.length > 0) ids = sel.objectIds;
		else ids = Object.keys(sceneStore.objects);
		const bounds = computeBoundsForObjects(ids);
		if (bounds) viewportStore.focusOnObject(bounds.center, bounds.size);
	}, [selectionStore.selection, sceneStore.objects, computeBoundsForObjects, viewportStore]);

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
		// Open UV Editor (Shift+U)
		{ key: 'u', shift: true, action: () => setUVOpen(true), description: 'Open UV Editor (Shift+U)', preventDefault: true },
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
					<Menu.Portal container={portalContainer}>
						<Menu.Positioner side="bottom" align="start" sideOffset={4} className="z-90">
							<Menu.Popup className="mt-0 w-52 rounded border border-white/10 bg-[#0b0e13]/95 shadow-lg py-1 text-xs z-90" style={{ zIndex: 10050 }}>
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

				{/* Import */}
				<Menu.Root modal={false} openOnHover>
					<Menu.Trigger className="px-2 py-1 text-xs rounded text-gray-300 hover:text-white hover:bg-white/5 data-[open]:bg-white/10 data-[open]:text-white">
						Import
					</Menu.Trigger>
					<Menu.Portal container={portalContainer}>
						<Menu.Positioner side="bottom" align="start" sideOffset={4} className="z-90">
							<Menu.Popup className="mt-0 w-44 rounded border border-white/10 bg-[#0b0e13]/95 shadow-lg py-1 text-xs z-90" style={{ zIndex: 10050 }}>
								<Menu.Item className="w-full text-left px-3 py-1.5 hover:bg-white/10 text-gray-200" onClick={handleImportGLB}>
									<span className="inline-flex items-center gap-2"><FolderOpen className="w-4 h-4" /> GLB/GLTF…</span>
								</Menu.Item>
								<Menu.Item className="w-full text-left px-3 py-1.5 hover:bg-white/10 text-gray-200" onClick={handleImportOBJ}>
									<span className="inline-flex items-center gap-2"><FolderOpen className="w-4 h-4" /> OBJ…</span>
								</Menu.Item>
								<Menu.Item disabled className="w-full text-left px-3 py-1.5 text-gray-500">FBX… (soon)</Menu.Item>
							</Menu.Popup>
						</Menu.Positioner>
					</Menu.Portal>
				</Menu.Root>

				{/* Edit (placeholders) */}
				<Menu.Root modal={false} openOnHover>
					<Menu.Trigger className="px-2 py-1 text-xs rounded text-gray-300 hover:text-white hover:bg-white/5 data-[open]:bg-white/10 data-[open]:text-white">
						Edit
					</Menu.Trigger>
					<Menu.Portal container={portalContainer}>
						<Menu.Positioner side="bottom" align="start" sideOffset={4} className="z-90">
							<Menu.Popup className="mt-0 w-44 rounded border border-white/10 bg-[#0b0e13]/95 shadow-lg py-1 text-xs z-90" style={{ zIndex: 10050 }}>
								<Menu.Item disabled={!canUndo} className="w-full text-left px-3 py-1.5 hover:bg-white/10 text-gray-200 data-[disabled]:opacity-50 data-[disabled]:pointer-events-none" onClick={() => geometryUndo()}>Undo</Menu.Item>
								<Menu.Item disabled={!canRedo} className="w-full text-left px-3 py-1.5 hover:bg-white/10 text-gray-200 data-[disabled]:opacity-50 data-[disabled]:pointer-events-none" onClick={() => geometryRedo()}>Redo</Menu.Item>
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

					<AddObjectMenu
						portalContainer={portalContainer}
						onCreateShape={beginShape}
						onCreateText={() => { useTextStore.getState().createText(); }}
						onAddLight={addLight}
						onAddCamera={addCamera}
						onAddForce={addForce}
						onAddParticleSystem={handleCreateParticleSystem}
						onAddFluidSystem={handleCreateFluidSystem}
						onAddMetaball={() => {
							const id = sceneStore.createMetaballObject('Metaballs');
							sceneStore.selectObject(id);
							if (useSelectionStore.getState().selection.viewMode === 'object') useSelectionStore.getState().selectObjects([id]);
						}}
						onCreateTerrain={() => {
							const res = useTerrainStore.getState().createTerrain();
							// createTerrain returns { terrainId, objectId }
							if (res?.objectId) {
								sceneStore.selectObject(res.objectId);
								if (useSelectionStore.getState().selection.viewMode === 'object') useSelectionStore.getState().selectObjects([res.objectId]);
							}
						}}
					/>

				{/* View (placeholders) */}
				<Menu.Root modal={false} openOnHover>
					<Menu.Trigger className="px-2 py-1 text-xs rounded text-gray-300 hover:text-white hover:bg-white/5 data-[open]:bg-white/10 data-[open]:text-white">
						View
					</Menu.Trigger>
					<Menu.Portal container={portalContainer}>
						<Menu.Positioner side="bottom" align="start" sideOffset={4} className="z-90">
							<Menu.Popup className="mt-0 w-56 rounded border border-white/10 bg-[#0b0e13]/95 shadow-lg py-1 text-xs z-90" style={{ zIndex: 10050 }}>
								<Menu.Item className="w-full text-left px-3 py-1.5 hover:bg-white/10 text-gray-200" onClick={handleZoomIn}>Zoom In</Menu.Item>
								<Menu.Item className="w-full text-left px-3 py-1.5 hover:bg-white/10 text-gray-200" onClick={handleZoomOut}>Zoom Out</Menu.Item>
								<Menu.Item className="w-full text-left px-3 py-1.5 hover:bg-white/10 text-gray-200" onClick={handleFitToScreen}>Fit to Screen</Menu.Item>
								<Menu.Separator className="my-1 h-px bg-white/10" />
								<Menu.Item className="w-full text-left px-3 py-1.5 hover:bg-white/10 text-gray-200" onClick={() => viewportStore.toggleGrid()}>
									<span className="flex items-center justify-between w-full">
										<span>Toggle Grid</span>
										{viewportStore.showGrid ? <Check className="w-3.5 h-3.5 text-gray-300" /> : <span className="w-3.5 h-3.5" />}
									</span>
								</Menu.Item>
								<Menu.Item className="w-full text-left px-3 py-1.5 hover:bg-white/10 text-gray-200" onClick={() => viewportStore.toggleAxes()}>
									<span className="flex items-center justify-between w-full">
										<span>Toggle Axes</span>
										{viewportStore.showAxes ? <Check className="w-3.5 h-3.5 text-gray-300" /> : <span className="w-3.5 h-3.5" />}
									</span>
								</Menu.Item>
								<Menu.Separator className="my-1 h-px bg-white/10" />
								<Menu.Item className="w-full text-left px-3 py-1.5 hover:bg-white/10 text-gray-200" onClick={() => onOpenShaderEditor?.()}>Shader Editor…</Menu.Item>
								<Menu.Item className="w-full text-left px-3 py-1.5 hover:bg-white/10 text-gray-200" onClick={() => setUVOpen(true)}>UV Editor…</Menu.Item>
								<div className="px-3 py-1.5 text-[11px] uppercase tracking-wide text-gray-400">Shading</div>
								<Menu.Item className="w-full text-left px-3 py-1.5 hover:bg-white/10 text-gray-200" onClick={() => viewportStore.setShadingMode('wireframe')}>
									<span className="flex items-center justify-between w-full">
										<span>Wireframe</span>
										{viewportStore.shadingMode === 'wireframe' ? <Check className="w-3.5 h-3.5 text-gray-300" /> : <span className="w-3.5 h-3.5" />}
									</span>
								</Menu.Item>
								<Menu.Item className="w-full text-left px-3 py-1.5 hover:bg-white/10 text-gray-200" onClick={() => viewportStore.setShadingMode('solid')}>
									<span className="flex items-center justify-between w-full">
										<span>Solid</span>
										{viewportStore.shadingMode === 'solid' ? <Check className="w-3.5 h-3.5 text-gray-300" /> : <span className="w-3.5 h-3.5" />}
									</span>
								</Menu.Item>
								<Menu.Item className="w-full text-left px-3 py-1.5 hover:bg-white/10 text-gray-200" onClick={() => viewportStore.setShadingMode('material')}>
									<span className="flex items-center justify-between w-full">
										<span>Material</span>
										{viewportStore.shadingMode === 'material' ? <Check className="w-3.5 h-3.5 text-gray-300" /> : <span className="w-3.5 h-3.5" />}
									</span>
								</Menu.Item>
								<Menu.Item className="w-full text-left px-3 py-1.5 hover:bg-white/10 text-gray-200" onClick={() => viewportStore.setShadingMode('textured')}>
									<span className="flex items-center justify-between w-full">
										<span>Textured</span>
										{viewportStore.shadingMode === 'textured' ? <Check className="w-3.5 h-3.5 text-gray-300" /> : <span className="w-3.5 h-3.5" />}
									</span>
								</Menu.Item>
							</Menu.Popup>
						</Menu.Positioner>
					</Menu.Portal>
				</Menu.Root>
			</div>

			<div className="ml-auto flex items-center gap-2 text-[11px] text-gray-400">
				{/* Minimal UI toggle (no label, icon only) */}
				<button
					className="inline-flex items-center rounded p-1 text-gray-400 hover:text-gray-200 hover:bg-white/5"
					onClick={() => useWorkspaceStore.getState().toggleMinimalUi?.()}
					title="Toggle minimal UI"
				>
					<Minimize2 className="w-4 h-4" />
				</button>
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

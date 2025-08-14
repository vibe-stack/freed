'use client';

import React, { useCallback } from 'react';
import { useGeometryStore } from '../stores/geometryStore';
import { useSceneStore } from '../stores/sceneStore';
import { useViewportStore } from '../stores/viewportStore';
import { exportAndDownload, WorkspaceData } from '../utils/t3dExporter';
import { openImportDialog } from '../utils/t3dImporter';
import { Box, FileDown, FileUp } from 'lucide-react';

const IconBtn: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className = '', children, ...rest }) => (
  <button
    className={`inline-flex items-center gap-1 text-xs text-gray-300 hover:text-white px-2 py-1 rounded hover:bg-white/5 ${className}`}
    {...rest}
  >
    {children}
  </button>
);

const MenuBar: React.FC = () => {
  const geometryStore = useGeometryStore();
  const sceneStore = useSceneStore();
  const viewportStore = useViewportStore();

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

  return (
    <div className="h-8 w-full border-b border-white/10 bg-[#0b0e13]/80 backdrop-blur supports-[backdrop-filter]:bg-[#0b0e13]/60 flex items-center px-3 select-none z-30">
      <div className="flex items-center gap-2 text-sm text-gray-300 font-medium">
        <Box className="w-4 h-4 text-gray-400" aria-hidden />
        <span className="tracking-wide">Freed</span>
      </div>
      <div className="mx-2 h-4 w-px bg-white/10" />

      <div className="flex items-center gap-1">
        <IconBtn onClick={handleImport} title="Import (.t3d)">
          <FileUp className="w-4 h-4" />
          <span>Import</span>
        </IconBtn>
        <IconBtn onClick={handleExport} title="Export (.t3d)">
          <FileDown className="w-4 h-4" />
          <span>Export</span>
        </IconBtn>
      </div>

      <div className="ml-auto flex items-center gap-2 text-[11px] text-gray-400">
        <span>Dark</span>
        <span className="opacity-40">|</span>
        <span>Calm Mode</span>
      </div>
    </div>
  );
};

export default MenuBar;

// Export/Import Toolbar Component
// Provides UI controls for exporting and importing T3D files

import React, { useState, useCallback } from 'react';
import { useGeometryStore } from '../stores/geometryStore';
import { useSceneStore } from '../stores/sceneStore';
import { useViewportStore } from '../stores/viewportStore';
import { exportAndDownload, WorkspaceData } from '../utils/t3dExporter';
import { openImportDialog, ImportedWorkspaceData } from '../utils/t3dImporter';

interface T3DToolbarProps {
  className?: string;
}

export function T3DToolbar({ className = '' }: T3DToolbarProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [status, setStatus] = useState<string>('');

  // Get store hooks
  const geometryStore = useGeometryStore();
  const sceneStore = useSceneStore();
  const viewportStore = useViewportStore();

  // Clear status message after a delay
  const clearStatus = useCallback(() => {
    setTimeout(() => setStatus(''), 3000);
  }, []);

  // Handle export
  const handleExport = useCallback(async () => {
    if (isExporting) return;
    
    try {
      setIsExporting(true);
      setStatus('Exporting...');

      // Collect workspace data
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

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `scene_${timestamp}.t3d`;

      await exportAndDownload(workspaceData, filename);
      
      setStatus('Export successful!');
      clearStatus();

    } catch (error) {
      console.error('Export failed:', error);
      setStatus('Export failed. Please try again.');
      clearStatus();
    } finally {
      setIsExporting(false);
    }
  }, [isExporting, geometryStore, sceneStore, viewportStore, clearStatus]);

  // Handle import
  const handleImport = useCallback(() => {
    if (isImporting) return;

    setIsImporting(true);
    setStatus('Select file to import...');

    openImportDialog(
      (data: ImportedWorkspaceData) => {
        try {
          setStatus('Importing...');

          // Clear existing data
          // Note: In a real application, you might want to ask the user if they want to merge or replace
          
          // Import meshes - clear existing and add new ones
          const currentMeshes = Array.from(geometryStore.meshes.keys());
          currentMeshes.forEach(meshId => {
            geometryStore.removeMesh(meshId);
          });
          
          data.meshes.forEach(mesh => {
            geometryStore.addMesh(mesh);
          });

          // Import materials - clear existing and add new ones
          const currentMaterials = Array.from(geometryStore.materials.keys());
          currentMaterials.forEach(materialId => {
            geometryStore.removeMaterial(materialId);
          });
          
          data.materials.forEach(material => {
            geometryStore.addMaterial(material);
          });

          // Import scene objects - clear existing and add new ones
          const currentObjectIds = Object.keys(sceneStore.objects);
          currentObjectIds.forEach(id => {
            sceneStore.removeObject(id);
          });
          
          data.objects.forEach(object => {
            sceneStore.addObject(object);
          });

          // Update root objects - the addObject method should handle this automatically
          // but let's ensure the rootObjects array is correct
          const currentRootObjects = [...sceneStore.rootObjects];
          currentRootObjects.forEach(id => {
            const index = sceneStore.rootObjects.indexOf(id);
            if (index >= 0) {
              sceneStore.rootObjects.splice(index, 1);
            }
          });
          data.rootObjects.forEach(id => {
            if (!sceneStore.rootObjects.includes(id)) {
              sceneStore.rootObjects.push(id);
            }
          });

          // Set selection
          sceneStore.selectObject(data.selectedObjectId);

          // Import viewport state
          viewportStore.setCamera(data.viewport.camera);
          viewportStore.setShadingMode(data.viewport.shadingMode);
          viewportStore.setGridSize(data.viewport.gridSize);
          viewportStore.setBackgroundColor([
            data.viewport.backgroundColor.x,
            data.viewport.backgroundColor.y,
            data.viewport.backgroundColor.z,
          ]);

          if (data.viewport.showGrid !== viewportStore.showGrid) {
            viewportStore.toggleGrid();
          }
          if (data.viewport.showAxes !== viewportStore.showAxes) {
            viewportStore.toggleAxes();
          }

          setStatus(`Import successful! Loaded ${data.meshes.length} meshes, ${data.materials.length} materials.`);
          clearStatus();

        } catch (error) {
          console.error('Import processing failed:', error);
          setStatus('Import processing failed. Please try again.');
          clearStatus();
        } finally {
          setIsImporting(false);
        }
      },
      (error: Error) => {
        console.error('Import failed:', error);
        setStatus(`Import failed: ${error.message}`);
        clearStatus();
        setIsImporting(false);
      }
    );
  }, [isImporting, geometryStore, sceneStore, viewportStore, clearStatus]);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        onClick={handleExport}
        disabled={isExporting}
        className={`px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
          isExporting ? 'cursor-wait' : ''
        }`}
        title="Export current scene as .t3d file"
      >
        {isExporting ? 'Exporting...' : 'Export as .t3d'}
      </button>

      <button
        onClick={handleImport}
        disabled={isImporting}
        className={`px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
          isImporting ? 'cursor-wait' : ''
        }`}
        title="Import .t3d file into current scene"
      >
        {isImporting ? 'Importing...' : 'Import .t3d'}
      </button>

      {status && (
        <div className="flex items-center gap-2">
          <div className="h-4 border-l border-gray-300" />
          <span className={`text-sm ${
            status.includes('successful') ? 'text-green-600' : 
            status.includes('failed') || status.includes('error') ? 'text-red-600' : 
            'text-gray-600'
          }`}>
            {status}
          </span>
        </div>
      )}
    </div>
  );
}

export default T3DToolbar;

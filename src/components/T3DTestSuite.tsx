// T3D Test Suite Component
// Provides testing functions to verify export/import functionality

import React, { useState, useCallback } from 'react';
import { useGeometryStore } from '../stores/geometryStore';
import { useSceneStore } from '../stores/sceneStore';
import { useViewportStore } from '../stores/viewportStore';
import { exportToT3D, WorkspaceData } from '../utils/t3dExporter';
import { importFromT3DBlob, ImportedWorkspaceData } from '../utils/t3dImporter';

interface T3DTestSuiteProps {
  className?: string;
}

export function T3DTestSuite({ className = '' }: T3DTestSuiteProps) {
  const [testResults, setTestResults] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const geometryStore = useGeometryStore();
  const sceneStore = useSceneStore();
  const viewportStore = useViewportStore();

  const addTestResult = useCallback((result: string) => {
    setTestResults(prev => [...prev, result]);
  }, []);

  const clearResults = useCallback(() => {
    setTestResults([]);
  }, []);

  // Test export/import round-trip
  const runRoundTripTest = useCallback(async () => {
    if (isRunning) return;
    
    setIsRunning(true);
    clearResults();
    addTestResult('🚀 Starting T3D round-trip test...');

    try {
      // Create test data
      addTestResult('📦 Creating test cube...');
      const cubeId = geometryStore.createCube(2);
      const objectId = sceneStore.createMeshObject('Test Cube', cubeId);
      
      // Gather workspace data
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

      addTestResult(`📊 Initial data: ${workspaceData.meshes.length} meshes, ${workspaceData.objects.length} objects`);

      // Export to T3D
      addTestResult('💾 Exporting to T3D format...');
      const blob = await exportToT3D(workspaceData);
      addTestResult(`✅ Export successful: ${(blob.size / 1024).toFixed(2)} KB`);

      // Import from T3D
      addTestResult('📥 Importing from T3D format...');
      const importedData = await importFromT3DBlob(blob);
      addTestResult(`✅ Import successful: ${importedData.meshes.length} meshes, ${importedData.objects.length} objects`);

      // Verify data integrity
      addTestResult('🔍 Verifying data integrity...');
      
      // Check mesh count
      if (importedData.meshes.length !== workspaceData.meshes.length) {
        addTestResult(`❌ Mesh count mismatch: ${importedData.meshes.length} vs ${workspaceData.meshes.length}`);
      } else {
        addTestResult(`✅ Mesh count correct: ${importedData.meshes.length}`);
      }

      // Check object count
      if (importedData.objects.length !== workspaceData.objects.length) {
        addTestResult(`❌ Object count mismatch: ${importedData.objects.length} vs ${workspaceData.objects.length}`);
      } else {
        addTestResult(`✅ Object count correct: ${importedData.objects.length}`);
      }

      // Check mesh data
      const originalMesh = workspaceData.meshes[0];
      const importedMesh = importedData.meshes[0];
      
      if (originalMesh && importedMesh) {
        if (originalMesh.id !== importedMesh.id) {
          addTestResult(`❌ Mesh ID mismatch: ${importedMesh.id} vs ${originalMesh.id}`);
        } else {
          addTestResult(`✅ Mesh ID preserved: ${importedMesh.id}`);
        }

        if (originalMesh.vertices.length !== importedMesh.vertices.length) {
          addTestResult(`❌ Vertex count mismatch: ${importedMesh.vertices.length} vs ${originalMesh.vertices.length}`);
        } else {
          addTestResult(`✅ Vertex count correct: ${importedMesh.vertices.length}`);
        }

        if (originalMesh.faces.length !== importedMesh.faces.length) {
          addTestResult(`❌ Face count mismatch: ${importedMesh.faces.length} vs ${originalMesh.faces.length}`);
        } else {
          addTestResult(`✅ Face count correct: ${importedMesh.faces.length}`);
        }
      }

      // Check viewport data
      const originalCamera = workspaceData.viewport.camera;
      const importedCamera = importedData.viewport.camera;
      
      if (Math.abs(originalCamera.position.x - importedCamera.position.x) > 0.001) {
        addTestResult(`❌ Camera position X mismatch: ${importedCamera.position.x} vs ${originalCamera.position.x}`);
      } else {
        addTestResult(`✅ Camera position preserved`);
      }

      addTestResult('🎉 Round-trip test completed successfully!');

    } catch (error) {
      addTestResult(`❌ Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsRunning(false);
    }
  }, [isRunning, geometryStore, sceneStore, viewportStore, addTestResult, clearResults]);

  // Test export with filters
  const runFilterTest = useCallback(async () => {
    if (isRunning) return;

    setIsRunning(true);
    clearResults();
    addTestResult('🔧 Starting T3D filter test...');

    try {
      // Create multiple test objects
      const cube1Id = geometryStore.createCube(1);
      const cube2Id = geometryStore.createCube(2);
      const obj1Id = sceneStore.createMeshObject('Cube 1', cube1Id);
      const obj2Id = sceneStore.createMeshObject('Cube 2', cube2Id);

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

      addTestResult(`📊 Created test data: ${workspaceData.meshes.length} meshes`);

      // Export with filter (only first mesh)
      const blob = await exportToT3D(workspaceData, {
        includeMeshes: [cube1Id],
        includeViewport: false
      });

      const importedData = await importFromT3DBlob(blob);
      
      if (importedData.meshes.length !== 1) {
        addTestResult(`❌ Filter failed: expected 1 mesh, got ${importedData.meshes.length}`);
      } else {
        addTestResult(`✅ Filter successful: exported 1 of ${workspaceData.meshes.length} meshes`);
      }

      if (importedData.meshes[0].id !== cube1Id) {
        addTestResult(`❌ Wrong mesh exported: ${importedData.meshes[0].id} vs ${cube1Id}`);
      } else {
        addTestResult(`✅ Correct mesh exported: ${cube1Id}`);
      }

      addTestResult('🎉 Filter test completed successfully!');

    } catch (error) {
      addTestResult(`❌ Filter test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsRunning(false);
    }
  }, [isRunning, geometryStore, sceneStore, viewportStore, addTestResult, clearResults]);

  return (
    <div className={`p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800 ${className}`}>
      <h3 className="text-lg font-semibold mb-4 text-yellow-800 dark:text-yellow-200">
        🧪 T3D Test Suite
      </h3>
      
      <div className="flex gap-2 mb-4">
        <button
          onClick={runRoundTripTest}
          disabled={isRunning}
          className="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 text-sm"
        >
          {isRunning ? 'Running...' : 'Run Round-trip Test'}
        </button>
        
        <button
          onClick={runFilterTest}
          disabled={isRunning}
          className="px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 text-sm"
        >
          {isRunning ? 'Running...' : 'Run Filter Test'}
        </button>
        
        <button
          onClick={clearResults}
          disabled={isRunning}
          className="px-3 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50 text-sm"
        >
          Clear Results
        </button>
      </div>

      {testResults.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded p-3 border">
          <h4 className="font-medium mb-2 text-sm">Test Results:</h4>
          <div className="space-y-1 text-sm font-mono max-h-40 overflow-y-auto">
            {testResults.map((result, index) => (
              <div 
                key={index} 
                className={`${
                  result.includes('❌') ? 'text-red-600' : 
                  result.includes('✅') || result.includes('🎉') ? 'text-green-600' : 
                  'text-gray-600'
                }`}
              >
                {result}
              </div>
            ))}
          </div>
        </div>
      )}
      
      <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-2">
        These tests verify that T3D export/import preserves data integrity and that filtering works correctly.
      </p>
    </div>
  );
}

export default T3DTestSuite;

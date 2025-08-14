'use client';

import React from 'react';
import { useMeshes, useGeometryStore, useSelectedMesh } from '../stores/geometryStore';
import { useSelection, useSelectionStore } from '../stores/selectionStore';
import { useViewportStore } from '../stores/viewportStore';
import { useSceneObjects, useSceneStore } from '../stores/sceneStore';
import { logStoreStates } from '../stores';
import { SelectionModeToolbar } from './SelectionModeToolbar';
import { SelectionSummary } from './SelectionSummary';
import { ViewModeToolbar } from './ViewModeToolbar';
import T3DToolbar from './T3DToolbar';
import T3DTestSuite from './T3DTestSuite';
import DemoContentCreator from './DemoContentCreator';

export const GeometryDebugPanel: React.FC = () => {
  const meshes = useMeshes();
  const selectedMesh = useSelectedMesh();
  const selection = useSelection();
  const sceneObjects = useSceneObjects();
  
  const geometryActions = useGeometryStore();
  const selectionActions = useSelectionStore();
  const viewportActions = useViewportStore();
  const sceneActions = useSceneStore();

  const handleCreateCube = () => {
    const cubeId = geometryActions.createCube(Math.random() * 2 + 1);
    const objectId = sceneActions.createMeshObject(`Cube ${Date.now()}`, cubeId);
    if (selection.viewMode === 'object') {
      selectionActions.selectObjects([objectId]);
    }
  };

  const handleSelectVertex = (meshId: string, vertexId: string) => {
    selectionActions.toggleVertexSelection(meshId, vertexId);
  };

  const handleSelectEdge = (meshId: string, edgeId: string) => {
    selectionActions.toggleEdgeSelection(meshId, edgeId);
  };

  const handleSelectFace = (meshId: string, faceId: string) => {
    selectionActions.toggleFaceSelection(meshId, faceId);
  };

  const handleSelectObject = (objectId: string) => {
    if (selection.viewMode === 'object') {
      const isSelected = selection.objectIds.includes(objectId);
      if (isSelected) {
        const newSelection = selection.objectIds.filter(id => id !== objectId);
        selectionActions.selectObjects(newSelection);
      } else {
        selectionActions.selectObjects([...selection.objectIds, objectId], true);
      }
    }
  };

  const handleDoubleClickObject = (objectId: string) => {
    if (selection.viewMode === 'object') {
      const obj = sceneActions.objects[objectId];
      const meshId = obj?.meshId;
      if (meshId) selectionActions.enterEditMode(meshId);
    }
  };

  const handleClearSelection = () => {
    selectionActions.clearSelection();
  };

  const handleLogStores = () => {
    logStoreStates();
  };

  return (
    <div className="space-y-6">
      {/* Demo Content Creator */}
      <DemoContentCreator className="max-w-4xl mx-auto" />
      
      {/* T3D Export/Import Toolbar */}
      <T3DToolbar className="max-w-4xl mx-auto" />
      
      {/* View Mode Toolbar */}
      <ViewModeToolbar />
      
      {/* Selection Mode Toolbar - Only in Edit Mode */}
      <SelectionModeToolbar />
      
      {/* Selection Summary */}
      <SelectionSummary />
      
      <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg max-w-4xl mx-auto">
        <h2 className="text-xl font-bold mb-4">3D Editor - Reactive Geometry System</h2>
      
      <div className="space-y-4">
        {/* Actions */}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Actions</h3>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={handleCreateCube}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Create Cube
            </button>
            <button
              onClick={handleClearSelection}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            >
              Clear Selection
            </button>
            <button
              onClick={handleLogStores}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            >
              Log Store States
            </button>
          </div>
        </div>

        {/* Scene Objects */}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Scene Objects ({sceneObjects.length})</h3>
          <div className="grid gap-2">
            {sceneObjects.map(obj => (
              <button
                key={obj.id}
                onClick={() => handleSelectObject(obj.id)}
                onDoubleClick={() => handleDoubleClickObject(obj.id)}
                className={`p-3 rounded border-2 text-left transition-all duration-200 ${
                  selection.objectIds.includes(obj.id)
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                    : selection.viewMode === 'object'
                      ? 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 hover:border-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/10'
                      : 'border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 cursor-not-allowed opacity-50'
                }`}
                disabled={selection.viewMode !== 'object'}
                title={selection.viewMode === 'object' ? 'Click to select, double-click to enter Edit Mode' : 'Only available in Object Mode'}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{obj.name} ({obj.type})</div>
                    <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                      Position: ({obj.transform.position.x.toFixed(2)}, {obj.transform.position.y.toFixed(2)}, {obj.transform.position.z.toFixed(2)})
                    </div>
                  </div>
                  {selection.objectIds.includes(obj.id) && (
                    <div className="text-purple-500 dark:text-purple-400 text-lg">
                      ✓
                    </div>
                  )}
                </div>
                {selection.viewMode === 'object' && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 border-t pt-2">
                    Double-click to enter Edit Mode
                  </div>
                )}
              </button>
            ))}
            {sceneObjects.length === 0 && (
              <div className="p-4 text-center text-gray-500 dark:text-gray-400 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded">
                <div>No objects in scene</div>
                <div className="text-xs mt-1">Create a cube to get started</div>
              </div>
            )}
          </div>
        </div>

        {/* Meshes */}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Meshes ({meshes.length})</h3>
          <div className="grid gap-2">
            {meshes.map(mesh => (
              <div key={mesh.id} className="p-2 bg-white dark:bg-gray-700 rounded border">
                <div className="font-medium">{mesh.name}</div>
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  Vertices: {mesh.vertices.length}, Edges: {mesh.edges.length}, Faces: {mesh.faces.length}
                </div>
                
                {/* Vertices - Show in Edit Mode with Vertex selection, or Object Mode */}
                {(selection.viewMode === 'object' || (selection.viewMode === 'edit' && selection.selectionMode === 'vertex')) && (
                  <div className="mt-2">
                    <h4 className="font-medium text-sm">Vertices:</h4>
                    <div className="grid grid-cols-2 gap-1 text-xs">
                      {mesh.vertices.slice(0, 8).map(vertex => (
                        <button
                          key={vertex.id}
                          onClick={() => handleSelectVertex(mesh.id, vertex.id)}
                          className={`p-1 rounded text-left transition-colors ${
                            selection.vertexIds.includes(vertex.id)
                              ? 'bg-yellow-200 dark:bg-yellow-700 text-yellow-900 dark:text-yellow-100'
                              : selection.viewMode === 'edit'
                                ? 'bg-gray-100 dark:bg-gray-600 hover:bg-yellow-100 dark:hover:bg-yellow-800 hover:text-yellow-900 dark:hover:text-yellow-100'
                                : 'bg-gray-100 dark:bg-gray-600 cursor-not-allowed opacity-50'
                          }`}
                          disabled={selection.viewMode !== 'edit'}
                        >
                          V{vertex.id.slice(-4)}: ({vertex.position.x.toFixed(1)}, {vertex.position.y.toFixed(1)}, {vertex.position.z.toFixed(1)})
                        </button>
                      ))}
                      {mesh.vertices.length > 8 && (
                        <div className="p-1 text-gray-500">... +{mesh.vertices.length - 8} more</div>
                      )}
                    </div>
                  </div>
                )}

                {/* Edges - Show in Edit Mode with Edge selection, or Object Mode */}
                {(selection.viewMode === 'object' || (selection.viewMode === 'edit' && selection.selectionMode === 'edge')) && (
                  <div className="mt-2">
                    <h4 className="font-medium text-sm">Edges:</h4>
                    <div className="grid grid-cols-2 gap-1 text-xs">
                      {mesh.edges.slice(0, 8).map(edge => (
                        <button
                          key={edge.id}
                          onClick={() => handleSelectEdge(mesh.id, edge.id)}
                          className={`p-1 rounded text-left transition-colors ${
                            selection.edgeIds.includes(edge.id)
                              ? 'bg-green-200 dark:bg-green-700 text-green-900 dark:text-green-100'
                              : selection.viewMode === 'edit'
                                ? 'bg-gray-100 dark:bg-gray-600 hover:bg-green-100 dark:hover:bg-green-800 hover:text-green-900 dark:hover:text-green-100'
                                : 'bg-gray-100 dark:bg-gray-600 cursor-not-allowed opacity-50'
                          }`}
                          disabled={selection.viewMode !== 'edit'}
                        >
                          E{edge.id.slice(-4)}: {edge.vertexIds.map(id => id.slice(-4)).join('-')}
                        </button>
                      ))}
                      {mesh.edges.length > 8 && (
                        <div className="p-1 text-gray-500">... +{mesh.edges.length - 8} more</div>
                      )}
                    </div>
                  </div>
                )}

                {/* Faces - Show in Edit Mode with Face selection, or Object Mode */}
                {(selection.viewMode === 'object' || (selection.viewMode === 'edit' && selection.selectionMode === 'face')) && (
                  <div className="mt-2">
                    <h4 className="font-medium text-sm">Faces:</h4>
                    <div className="grid grid-cols-2 gap-1 text-xs">
                      {mesh.faces.slice(0, 8).map(face => (
                        <button
                          key={face.id}
                          onClick={() => handleSelectFace(mesh.id, face.id)}
                          className={`p-1 rounded text-left transition-colors ${
                            selection.faceIds.includes(face.id)
                              ? 'bg-blue-200 dark:bg-blue-700 text-blue-900 dark:text-blue-100'
                              : selection.viewMode === 'edit'
                                ? 'bg-gray-100 dark:bg-gray-600 hover:bg-blue-100 dark:hover:bg-blue-800 hover:text-blue-900 dark:hover:text-blue-100'
                                : 'bg-gray-100 dark:bg-gray-600 cursor-not-allowed opacity-50'
                          }`}
                          disabled={selection.viewMode !== 'edit'}
                        >
                          F{face.id.slice(-4)}: {face.vertexIds.length} verts
                        </button>
                      ))}
                      {mesh.faces.length > 8 && (
                        <div className="p-1 text-gray-500">... +{mesh.faces.length - 8} more</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Selected Mesh Details */}
        {selectedMesh && (
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Selected Mesh: {selectedMesh.name}</h3>
            <div className="p-2 bg-white dark:bg-gray-700 rounded border">
              <div><strong>ID:</strong> {selectedMesh.id}</div>
              <div><strong>Visible:</strong> {selectedMesh.visible ? 'Yes' : 'No'}</div>
              <div><strong>Locked:</strong> {selectedMesh.locked ? 'Yes' : 'No'}</div>
              <div><strong>Transform:</strong></div>
              <div className="ml-4 text-sm">
                <div>Position: ({selectedMesh.transform.position.x}, {selectedMesh.transform.position.y}, {selectedMesh.transform.position.z})</div>
                <div>Rotation: ({selectedMesh.transform.rotation.x}, {selectedMesh.transform.rotation.y}, {selectedMesh.transform.rotation.z})</div>
                <div>Scale: ({selectedMesh.transform.scale.x}, {selectedMesh.transform.scale.y}, {selectedMesh.transform.scale.z})</div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* T3D Test Suite */}
      <T3DTestSuite className="max-w-4xl mx-auto" />
    </div>
    </div>
  );
};

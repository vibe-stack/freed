'use client';

import React from 'react';
import { useMeshes, useGeometryStore, useSelectedMesh } from '../stores/geometryStore';
import { useSelection, useSelectionStore } from '../stores/selectionStore';
import { useViewportStore } from '../stores/viewportStore';
import { useSceneObjects, useSceneStore } from '../stores/sceneStore';
import { logStoreStates } from '../stores';

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
    // The cube is automatically added to the store by createCube
    sceneActions.createMeshObject(`Cube ${Date.now()}`, cubeId);
  };

  const handleSelectVertex = (meshId: string, vertexId: string) => {
    selectionActions.toggleVertexSelection(meshId, vertexId);
  };

  const handleClearSelection = () => {
    selectionActions.clearSelection();
  };

  const handleLogStores = () => {
    logStoreStates();
  };

  return (
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
              <div key={obj.id} className="p-2 bg-white dark:bg-gray-700 rounded border">
                <div className="font-medium">{obj.name} ({obj.type})</div>
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  Position: ({obj.transform.position.x.toFixed(2)}, {obj.transform.position.y.toFixed(2)}, {obj.transform.position.z.toFixed(2)})
                </div>
              </div>
            ))}
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
                
                {/* Vertices */}
                <div className="mt-2">
                  <h4 className="font-medium text-sm">Vertices:</h4>
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    {mesh.vertices.slice(0, 8).map(vertex => (
                      <button
                        key={vertex.id}
                        onClick={() => handleSelectVertex(mesh.id, vertex.id)}
                        className={`p-1 rounded text-left ${
                          selection.vertexIds.includes(vertex.id)
                            ? 'bg-yellow-200 dark:bg-yellow-700'
                            : 'bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500'
                        }`}
                      >
                        V{vertex.id.slice(-4)}: ({vertex.position.x.toFixed(1)}, {vertex.position.y.toFixed(1)}, {vertex.position.z.toFixed(1)})
                      </button>
                    ))}
                    {mesh.vertices.length > 8 && (
                      <div className="p-1 text-gray-500">... +{mesh.vertices.length - 8} more</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Selection Info */}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Selection</h3>
          <div className="p-2 bg-white dark:bg-gray-700 rounded border">
            <div><strong>Mode:</strong> {selection.mode}</div>
            <div><strong>Mesh:</strong> {selection.meshId || 'None'}</div>
            <div><strong>Vertices:</strong> {selection.vertexIds.length} selected</div>
            <div><strong>Edges:</strong> {selection.edgeIds.length} selected</div>
            <div><strong>Faces:</strong> {selection.faceIds.length} selected</div>
            
            {selection.vertexIds.length > 0 && (
              <div className="mt-2 text-sm">
                <strong>Selected Vertices:</strong> {selection.vertexIds.map(id => id.slice(-4)).join(', ')}
              </div>
            )}
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
    </div>
  );
};

// Demo Content Creator Component
// Creates sample content for testing the T3D export/import functionality

import React, { useCallback, useState } from 'react';
import { useGeometryStore } from '../stores/geometryStore';
import { useSceneStore } from '../stores/sceneStore';
import { useSelectionStore } from '../stores/selectionStore';

interface DemoContentCreatorProps {
  className?: string;
}

export function DemoContentCreator({ className = '' }: DemoContentCreatorProps) {
  const [isCreating, setIsCreating] = useState(false);
  const geometryStore = useGeometryStore();
  const sceneStore = useSceneStore();
  const selectionStore = useSelectionStore();

  const createDemoScene = useCallback(async () => {
    if (isCreating) return;
    
    setIsCreating(true);
    
    try {
      // Clear existing content first
      const currentMeshes = Array.from(geometryStore.meshes.keys());
      currentMeshes.forEach(meshId => {
        geometryStore.removeMesh(meshId);
      });
      
      const currentObjects = Object.keys(sceneStore.objects);
      currentObjects.forEach(objectId => {
        sceneStore.removeObject(objectId);
      });

      selectionStore.clearSelection();

      // Create sample materials
      const redMaterial = {
        id: 'material-red',
        name: 'Red Material',
        color: { x: 1, y: 0.2, z: 0.2 },
        roughness: 0.3,
        metalness: 0.1,
        emissive: { x: 0, y: 0, z: 0 },
      };

      const blueMaterial = {
        id: 'material-blue',
        name: 'Blue Material',
        color: { x: 0.2, y: 0.2, z: 1 },
        roughness: 0.7,
        metalness: 0.8,
        emissive: { x: 0, y: 0, z: 0 },
      };

      geometryStore.addMaterial(redMaterial);
      geometryStore.addMaterial(blueMaterial);

      // Create multiple cubes with different sizes and positions
      const cubeConfigs = [
        { size: 1, position: [-2, 0, 0], name: 'Small Cube', materialId: redMaterial.id },
        { size: 1.5, position: [0, 0, 0], name: 'Medium Cube', materialId: blueMaterial.id },
        { size: 2, position: [3, 0, 0], name: 'Large Cube' },
        { size: 0.8, position: [0, 2, -1], name: 'Floating Cube', materialId: redMaterial.id },
      ];

      const createdObjects = [];

      for (const config of cubeConfigs) {
        // Create the cube mesh
        const cubeId = geometryStore.createCube(config.size);
        const mesh = geometryStore.meshes.get(cubeId);
        
        if (mesh) {
          // Update mesh position
          geometryStore.updateMesh(cubeId, (mesh) => {
            mesh.transform.position.x = config.position[0];
            mesh.transform.position.y = config.position[1];
            mesh.transform.position.z = config.position[2];
          });

          // Assign material to faces if specified
          if (config.materialId) {
            geometryStore.updateMesh(cubeId, (mesh) => {
              mesh.faces.forEach(face => {
                face.materialId = config.materialId;
              });
            });
          }

          // Create scene object
          const objectId = sceneStore.createMeshObject(config.name, cubeId);
          
          // Update scene object transform to match mesh
          sceneStore.updateObject(objectId, (obj) => {
            obj.transform.position.x = config.position[0];
            obj.transform.position.y = config.position[1];
            obj.transform.position.z = config.position[2];
          });

          createdObjects.push(objectId);
        }
      }

      // Create a hierarchy by making one cube a child of another
      if (createdObjects.length >= 2) {
        sceneStore.setParent(createdObjects[3], createdObjects[1]); // Make floating cube a child of medium cube
      }

      // Select one of the objects
      if (createdObjects.length > 0) {
        selectionStore.selectObjects([createdObjects[1]]);
      }

    } catch (error) {
      console.error('Failed to create demo scene:', error);
    } finally {
      setIsCreating(false);
    }
  }, [isCreating, geometryStore, sceneStore, selectionStore]);

  const clearScene = useCallback(() => {
    // Clear all content
    const currentMeshes = Array.from(geometryStore.meshes.keys());
    currentMeshes.forEach(meshId => {
      geometryStore.removeMesh(meshId);
    });

    const currentMaterials = Array.from(geometryStore.materials.keys());
    currentMaterials.forEach(materialId => {
      geometryStore.removeMaterial(materialId);
    });
    
    const currentObjects = Object.keys(sceneStore.objects);
    currentObjects.forEach(objectId => {
      sceneStore.removeObject(objectId);
    });

    selectionStore.clearSelection();
  }, [geometryStore, sceneStore, selectionStore]);

  return (
    <div className={`p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800 ${className}`}>
      <h3 className="text-lg font-semibold mb-3 text-purple-800 dark:text-purple-200">
        🎨 Demo Content Creator
      </h3>
      
      <div className="flex gap-2 mb-3">
        <button
          onClick={createDemoScene}
          disabled={isCreating}
          className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isCreating ? 'Creating...' : 'Create Demo Scene'}
        </button>
        
        <button
          onClick={clearScene}
          disabled={isCreating}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Clear Scene
        </button>
      </div>
      
      <p className="text-xs text-purple-700 dark:text-purple-300">
        Creates a sample scene with multiple cubes, materials, and hierarchy for testing T3D export/import functionality.
      </p>
    </div>
  );
}

export default DemoContentCreator;

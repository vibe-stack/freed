'use client';

import React from 'react';
import { useGeometryStore } from './geometry-store';
import { useSelectionStore } from './selection-store';
import { useViewportStore } from './viewport-store';
import { useSceneStore } from './scene-store';

// Store provider component that initializes stores and provides context
export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isClient, setIsClient] = React.useState(false);
  
  // Ensure we only run client-side to avoid SSR issues
  React.useEffect(() => {
    setIsClient(true);
  }, []);

  // Don't render until we're on the client
  if (!isClient) {
    return React.createElement('div', null, 'Loading...');
  }

  return React.createElement(React.Fragment, null, children);
};

// Hook to access all stores (for debugging/development)
export const useAllStores = () => {
  const geometryStore = useGeometryStore();
  const selectionStore = useSelectionStore();
  const viewportStore = useViewportStore();
  const sceneStore = useSceneStore();
  
  return {
    geometry: geometryStore,
    selection: selectionStore,
    viewport: viewportStore,
    scene: sceneStore,
  };
};

// Debugging utilities
export const logStoreStates = () => {
  console.group('Store States');
  
  const geometryState = useGeometryStore.getState();
  console.log('Geometry Store:', {
    meshCount: geometryState.meshes.size,
    selectedMeshId: geometryState.selectedMeshId,
    meshes: Array.from(geometryState.meshes.values()),
  });
  
  const selectionState = useSelectionStore.getState();
  console.log('Selection Store:', selectionState.selection);
  
  const viewportState = useViewportStore.getState();
  console.log('Viewport Store:', {
    camera: viewportState.camera,
    shadingMode: viewportState.shadingMode,
    showGrid: viewportState.showGrid,
    showAxes: viewportState.showAxes,
  });
  
  const sceneState = useSceneStore.getState();
  console.log('Scene Store:', {
    objectCount: Object.keys(sceneState.objects).length,
    rootObjects: sceneState.rootObjects,
    selectedObjectId: sceneState.selectedObjectId,
    hierarchy: sceneState.getHierarchy(),
  });
  
  console.groupEnd();
};

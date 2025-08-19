'use client';

import React from 'react';
import { useGeometryStore } from './geometry-store';
import { useSelectionStore } from './selection-store';
import { useViewportStore } from './viewport-store';
import { useSceneStore } from './scene-store';
import { useModifiersStore } from './modifier-store';
import StarryLoader from '@/components/starry-loader';

// Store provider component that initializes stores and provides context
export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [hydrated, setHydrated] = React.useState(false);
  const [showSplash, setShowSplash] = React.useState(true);

  // Hydration flag
  React.useEffect(() => {
    setHydrated(true);
  }, []);

  // When hydrated, schedule hiding splash after min duration (handled inside StarryLoader too)
  const handleSplashDone = React.useCallback(() => {
    setShowSplash(false);
  }, []);

  return React.createElement(
    React.Fragment,
    null,
    children,
    showSplash
      ? React.createElement(StarryLoader, { onDone: handleSplashDone })
      : null,
  );
};

// Hook to access all stores (for debugging/development)
export const useAllStores = () => {
  const geometryStore = useGeometryStore();
  const selectionStore = useSelectionStore();
  const viewportStore = useViewportStore();
  const sceneStore = useSceneStore();
  const modifiersStore = useModifiersStore();
  
  return {
    geometry: geometryStore,
    selection: selectionStore,
    viewport: viewportStore,
    scene: sceneStore,
  modifiers: modifiersStore,
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
  const geoForMods = useGeometryStore.getState();
  console.log('Modifiers (from geometry store):', geoForMods.modifierStacks);
  
  console.groupEnd();
};

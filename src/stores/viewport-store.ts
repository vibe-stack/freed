import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { subscribeWithSelector } from 'zustand/middleware';
import { ViewportState, CameraState, ShadingMode } from '../types/geometry';
import { vec3 } from '../utils/geometry';

interface ViewportActions {
  setCamera: (camera: Partial<CameraState>) => void;
  setShadingMode: (mode: ShadingMode) => void;
  toggleGrid: () => void;
  toggleAxes: () => void;
  setGridSize: (size: number) => void;
  setBackgroundColor: (color: [number, number, number]) => void;
  resetCamera: () => void;
  focusOnObject: (center: [number, number, number], size: number) => void;
  setAutoOrbitInterval: (sec: 0 | 1 | 3 | 5) => void;
  toggleAutoOrbitInterval: () => void; // cycles 0 -> 1 -> 3 -> 5 -> 0
  reset: () => void;
}

type ViewportStore = ViewportState & ViewportActions;

const defaultCameraState: CameraState = {
  position: vec3(5, 5, 5),
  target: vec3(0, 0, 0),
  up: vec3(0, 1, 0),
  fov: 50,
  near: 0.1,
  far: 1000,
};

export const useViewportStore = create<ViewportStore>()(
  subscribeWithSelector(
    immer((set, _get) => ({
      // Initial state
      camera: defaultCameraState,
      shadingMode: 'solid' as ShadingMode,
      showGrid: true,
      showAxes: true,
      gridSize: 10,
      backgroundColor: vec3(0.01, 0.01, 0.01),
  autoOrbitIntervalSec: 0,

      // Actions
      setCamera: (camera: Partial<CameraState>) => {
        set((state) => {
          Object.assign(state.camera, camera);
        });
      },

      setShadingMode: (mode: ShadingMode) => {
        set((state) => {
          state.shadingMode = mode;
        });
      },

      toggleGrid: () => {
        set((state) => {
          state.showGrid = !state.showGrid;
        });
      },

      toggleAxes: () => {
        set((state) => {
          state.showAxes = !state.showAxes;
        });
      },

      setGridSize: (size: number) => {
        set((state) => {
          state.gridSize = Math.max(1, size);
        });
      },

      setBackgroundColor: (color: [number, number, number]) => {
        set((state) => {
          state.backgroundColor = vec3(color[0], color[1], color[2]);
        });
      },

      setAutoOrbitInterval: (sec: 0 | 1 | 3 | 5) => {
        set((state) => {
          state.autoOrbitIntervalSec = sec;
        });
      },

      toggleAutoOrbitInterval: () => {
        set((state) => {
          const current = state.autoOrbitIntervalSec ?? 0;
          const next = current === 0 ? 1 : current === 1 ? 3 : current === 3 ? 5 : 0;
          state.autoOrbitIntervalSec = next as 0 | 1 | 3 | 5;
        });
      },

      resetCamera: () => {
        set((state) => {
          state.camera = { ...defaultCameraState };
        });
      },

      focusOnObject: (center: [number, number, number], size: number) => {
        set((state) => {
          const distance = size * 2.5; // Adjust multiplier as needed
          const direction = vec3(1, 1, 1); // Default viewing direction

          // Normalize direction
          const length = Math.sqrt(direction.x * direction.x + direction.y * direction.y + direction.z * direction.z);
          const normalizedDirection = {
            x: direction.x / length,
            y: direction.y / length,
            z: direction.z / length,
          };

          state.camera.target = vec3(center[0], center[1], center[2]);
          state.camera.position = vec3(
            center[0] + normalizedDirection.x * distance,
            center[1] + normalizedDirection.y * distance,
            center[2] + normalizedDirection.z * distance
          );
        });
      },
      reset: () => {
        set((state) => {
          state.camera = { ...defaultCameraState };
          state.shadingMode = 'solid' as ShadingMode;
          state.showGrid = true;
          state.showAxes = true;
          state.gridSize = 10;
          state.backgroundColor = vec3(.1, .1, .1);
          state.autoOrbitIntervalSec = 0;
        });
      },
    }))
  )
);

// Selector hooks for optimized re-renders
export const useCamera = () => useViewportStore((state) => state.camera);
export const useShadingMode = () => useViewportStore((state) => state.shadingMode);
export const useViewportSettings = () => useViewportStore((state) => ({
  showGrid: state.showGrid,
  showAxes: state.showAxes,
  gridSize: state.gridSize,
  backgroundColor: state.backgroundColor,
}));

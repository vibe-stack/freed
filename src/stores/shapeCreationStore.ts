import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { subscribeWithSelector } from 'zustand/middleware';
import { useGeometryStore } from './geometryStore';
import { buildPlaneGeometry, buildCylinderGeometry, buildConeGeometry, buildUVSphereGeometry, buildIcoSphereGeometry, buildTorusGeometry, buildCubeGeometry } from '@/utils/geometry';

type ShapeType = 'cube' | 'plane' | 'cylinder' | 'cone' | 'uvsphere' | 'icosphere' | 'torus';

interface ShapeParams {
  // Common
  size?: number;
  // Plane
  width?: number;
  height?: number;
  widthSegments?: number;
  heightSegments?: number;
  // Cylinder/Cone
  radiusTop?: number;
  radiusBottom?: number;
  radius?: number;
  radialSegments?: number;
  // Cylinder heightSegments as well
  cylHeightSegments?: number;
  cylHeight?: number;
  // Sphere
  sphereWidthSegments?: number;
  sphereHeightSegments?: number;
  subdivisions?: number;
  // Torus
  ringRadius?: number;
  tubeRadius?: number;
  torusRadialSegments?: number;
  torusTubularSegments?: number;
}

interface ShapeCreationState {
  active: boolean;
  meshId: string | null;
  shape: ShapeType | null;
  params: ShapeParams;
}

interface ShapeCreationActions {
  start: (shape: ShapeType, meshId: string, params?: Partial<ShapeParams>) => void;
  applyParams: (params: Partial<ShapeParams>) => void;
  finalize: () => void;
  cancel: () => void;
}

type Store = ShapeCreationState & ShapeCreationActions;

const defaultParamsFor = (shape: ShapeType): ShapeParams => {
  switch (shape) {
    case 'cube':
      return { size: 1.5 };
    case 'plane':
      return { width: 2, height: 2, widthSegments: 1, heightSegments: 1 };
    case 'cylinder':
      return { radiusTop: 0.75, radiusBottom: 0.75, cylHeight: 2, radialSegments: 24, cylHeightSegments: 1 };
    case 'cone':
      return { radius: 0.9, cylHeight: 2, radialSegments: 24, cylHeightSegments: 1 };
    case 'uvsphere':
      return { radius: 1, sphereWidthSegments: 24, sphereHeightSegments: 16 };
    case 'icosphere':
      return { radius: 1, subdivisions: 1 };
    case 'torus':
      return { ringRadius: 1.2, tubeRadius: 0.35, torusRadialSegments: 16, torusTubularSegments: 24 };
  }
};

export const useShapeCreationStore = create<Store>()(
  subscribeWithSelector(
    immer((set, get) => ({
      active: false,
      meshId: null,
      shape: null,
      params: {},

      start: (shape, meshId, params) => {
        set((state) => {
          state.active = true;
          state.meshId = meshId;
          state.shape = shape;
          state.params = { ...defaultParamsFor(shape), ...(params || {}) };
        });
      },

      applyParams: (params) => {
        set((state) => {
          if (!state.active || !state.meshId || !state.shape) return;
          state.params = { ...state.params, ...params };
        });
        // After updating params, rebuild geometry live
        const { meshId, shape } = get();
        if (!meshId || !shape) return;
        const g = useGeometryStore.getState();
        const p = get().params;
        switch (shape) {
          case 'cube': {
            const { vertices, faces } = buildCubeGeometry(p.size ?? 1.5);
            g.replaceGeometry(meshId, vertices, faces);
            break;
          }
          case 'plane': {
            const { vertices, faces } = buildPlaneGeometry(p.width ?? 2, p.height ?? 2, p.widthSegments ?? 1, p.heightSegments ?? 1);
            g.replaceGeometry(meshId, vertices, faces);
            break;
          }
          case 'cylinder': {
            const { vertices, faces } = buildCylinderGeometry(
              p.radiusTop ?? 0.75,
              p.radiusBottom ?? 0.75,
              p.cylHeight ?? 2,
              p.radialSegments ?? 24,
              p.cylHeightSegments ?? 1,
              true
            );
            g.replaceGeometry(meshId, vertices, faces);
            break;
          }
          case 'cone': {
            const { vertices, faces } = buildConeGeometry(
              p.radius ?? 0.9,
              p.cylHeight ?? 2,
              p.radialSegments ?? 24,
              p.cylHeightSegments ?? 1,
              true
            );
            g.replaceGeometry(meshId, vertices, faces);
            break;
          }
          case 'uvsphere': {
            const { vertices, faces } = buildUVSphereGeometry(
              p.radius ?? 1,
              p.sphereWidthSegments ?? 24,
              p.sphereHeightSegments ?? 16
            );
            g.replaceGeometry(meshId, vertices, faces);
            break;
          }
          case 'icosphere': {
            const { vertices, faces } = buildIcoSphereGeometry(p.radius ?? 1, p.subdivisions ?? 1);
            g.replaceGeometry(meshId, vertices, faces);
            break;
          }
          case 'torus': {
            const { vertices, faces } = buildTorusGeometry(
              p.ringRadius ?? 1.2,
              p.tubeRadius ?? 0.35,
              p.torusRadialSegments ?? 16,
              p.torusTubularSegments ?? 24
            );
            g.replaceGeometry(meshId, vertices, faces);
            break;
          }
        }
      },

      finalize: () => {
        set((state) => {
          state.active = false;
          state.shape = null;
          state.meshId = null;
          state.params = {};
        });
      },

      cancel: () => {
        set((state) => {
          state.active = false;
          state.shape = null;
          state.meshId = null;
          state.params = {};
        });
      },
    }))
  )
);

export type { ShapeType, ShapeParams };

import * as THREE from 'three';
import { buildCubeGeometry, createMeshFromGeometry } from '@/utils/geometry';
import { useGeometryStore } from '@/stores/geometry-store';
import { useSceneStore } from '@/stores/scene-store';
import { useSelectionStore } from '@/stores/selection-store';
import type { BrushDefinition, BrushParams, CommitStores, PreviewTransform } from './types';
import { computeRectFootprint, quaternionToEuler } from './brush-utils';
import React from 'react';

const CubeIcon = React.createElement(
  'svg',
  { viewBox: '0 0 18 18', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round', width: 16, height: 16 },
  React.createElement('path', { d: 'M2 6l7-4 7 4v6l-7 4-7-4V6z' }),
  React.createElement('path', { d: 'M9 2v12M2 6l7 4 7-4' })
);

export const CubeBrush: BrushDefinition = {
  id: 'cube',
  label: 'Cube',
  shortcut: '1',
  icon: CubeIcon,
  footprintType: 'rect',

  buildPreviewGeometry(params: BrushParams): THREE.BufferGeometry {
    const { width, depth } = computeRectFootprint(params);
    const h = Math.max(0.01, Math.abs(params.height));
    // Geometry centred at origin, sized to exact dimensions — no drift
    return new THREE.BoxGeometry(width, h, depth);
  },

  computePreviewTransform(params: BrushParams): PreviewTransform {
    const { center, quaternion } = computeRectFootprint(params);
    const normal = new THREE.Vector3(params.normal.x, params.normal.y, params.normal.z).normalize();
    const hSigned = params.height;
    const h = Math.max(0.01, Math.abs(hSigned));
    // Lift by half height along the surface normal so base sits on the surface
    const worldCenter = center.clone().addScaledVector(normal, hSigned / 2);
    return {
      position: [worldCenter.x, worldCenter.y, worldCenter.z],
      quaternion: [quaternion.x, quaternion.y, quaternion.z, quaternion.w],
      scale: [1, 1, 1],
    };
  },

  commit(params: BrushParams, _stores: CommitStores): string {
    const { center, width, depth, quaternion } = computeRectFootprint(params);
    const normal = new THREE.Vector3(params.normal.x, params.normal.y, params.normal.z).normalize();
    const hSigned = params.height;
    const h = Math.max(0.05, Math.abs(hSigned));
    const worldCenter = center.clone().addScaledVector(normal, hSigned / 2);

    const { vertices, faces } = buildCubeGeometry(1);
    const mesh = createMeshFromGeometry('Cube', vertices, faces);
    const geometry = useGeometryStore.getState();
    geometry.addMesh(mesh);
    const scene = useSceneStore.getState();
    const objId = scene.createMeshObject('Cube', mesh.id);
    scene.setTransform(objId, {
      position: { x: worldCenter.x, y: worldCenter.y, z: worldCenter.z },
      rotation: quaternionToEuler(quaternion),
      scale: { x: Math.max(0.01, width), y: h, z: Math.max(0.01, depth) },
    });
    scene.selectObject(objId);
    useSelectionStore.getState().selectObjects([objId], false);
    return objId;
  },
};

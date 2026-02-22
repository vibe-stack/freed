import * as THREE from 'three';
import { buildUVSphereGeometry, createMeshFromGeometry } from '@/utils/geometry';
import { useGeometryStore } from '@/stores/geometry-store';
import { useSceneStore } from '@/stores/scene-store';
import { useSelectionStore } from '@/stores/selection-store';
import type { BrushDefinition, BrushParams, CommitStores, PreviewTransform } from './types';
import { computeRadialFootprint } from './brush-utils';
import React from 'react';

const SphereIcon = React.createElement(
  'svg',
  { viewBox: '0 0 18 18', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round', width: 16, height: 16 },
  React.createElement('circle', { cx: '9', cy: '9', r: '7' }),
  React.createElement('ellipse', { cx: '9', cy: '9', rx: '3.5', ry: '7' }),
  React.createElement('line', { x1: '2', y1: '9', x2: '16', y2: '9' })
);

export const SphereBrush: BrushDefinition = {
  id: 'sphere',
  label: 'Sphere',
  shortcut: '3',
  icon: SphereIcon,
  footprintType: 'radial',

  buildPreviewGeometry(params: BrushParams): THREE.BufferGeometry {
    const { radius } = computeRadialFootprint(params);
    return new THREE.SphereGeometry(radius, 16, 12);
  },

  computePreviewTransform(params: BrushParams): PreviewTransform {
    const { center, radius, quaternion } = computeRadialFootprint(params);
    const normal = new THREE.Vector3(params.normal.x, params.normal.y, params.normal.z).normalize();
    const worldCenter = center.clone().addScaledVector(normal, radius);
    return {
      position: [worldCenter.x, worldCenter.y, worldCenter.z],
      quaternion: [quaternion.x, quaternion.y, quaternion.z, quaternion.w],
      scale: [1, 1, 1],
    };
  },

  commit(params: BrushParams, _stores: CommitStores): string {
    const { center, radius } = computeRadialFootprint(params);
    const normal = new THREE.Vector3(params.normal.x, params.normal.y, params.normal.z).normalize();
    const worldCenter = center.clone().addScaledVector(normal, radius);
    const { vertices, faces } = buildUVSphereGeometry(radius, 16, 12);
    const mesh = createMeshFromGeometry('Sphere', vertices, faces, { shading: 'smooth' });
    useGeometryStore.getState().addMesh(mesh);
    const scene = useSceneStore.getState();
    const objId = scene.createMeshObject('Sphere', mesh.id);
    scene.setTransform(objId, {
      position: { x: worldCenter.x, y: worldCenter.y, z: worldCenter.z },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
    });
    scene.selectObject(objId);
    useSelectionStore.getState().selectObjects([objId], false);
    return objId;
  },
};

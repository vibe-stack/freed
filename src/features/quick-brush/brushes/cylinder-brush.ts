import * as THREE from 'three';
import { buildCylinderGeometry, createMeshFromGeometry } from '@/utils/geometry';
import { useGeometryStore } from '@/stores/geometry-store';
import { useSceneStore } from '@/stores/scene-store';
import { useSelectionStore } from '@/stores/selection-store';
import type { BrushDefinition, BrushParams, CommitStores, PreviewTransform } from './types';
import { computeRadialFootprint, quaternionToEuler } from './brush-utils';
import React from 'react';

const CylinderIcon = React.createElement(
  'svg',
  { viewBox: '0 0 18 18', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round', width: 16, height: 16 },
  React.createElement('ellipse', { cx: '9', cy: '5', rx: '6', ry: '2.5' }),
  React.createElement('ellipse', { cx: '9', cy: '13', rx: '6', ry: '2.5' }),
  React.createElement('line', { x1: '3', y1: '5', x2: '3', y2: '13' }),
  React.createElement('line', { x1: '15', y1: '5', x2: '15', y2: '13' })
);

export const CylinderBrush: BrushDefinition = {
  id: 'cylinder',
  label: 'Cylinder',
  shortcut: '4',
  icon: CylinderIcon,
  footprintType: 'radial',

  buildPreviewGeometry(params: BrushParams): THREE.BufferGeometry {
    const { radius } = computeRadialFootprint(params);
    const h = Math.max(0.01, Math.abs(params.height));
    return new THREE.CylinderGeometry(radius, radius, h, 16, 1);
  },

  computePreviewTransform(params: BrushParams): PreviewTransform {
    const { center, quaternion } = computeRadialFootprint(params);
    const normal = new THREE.Vector3(params.normal.x, params.normal.y, params.normal.z).normalize();
    const hSigned = params.height;
    const worldCenter = center.clone().addScaledVector(normal, hSigned / 2);
    return {
      position: [worldCenter.x, worldCenter.y, worldCenter.z],
      quaternion: [quaternion.x, quaternion.y, quaternion.z, quaternion.w],
      scale: [1, 1, 1],
    };
  },

  commit(params: BrushParams, _stores: CommitStores): string {
    const { center, radius, quaternion } = computeRadialFootprint(params);
    const normal = new THREE.Vector3(params.normal.x, params.normal.y, params.normal.z).normalize();
    const hSigned = params.height;
    const h = Math.max(0.05, Math.abs(hSigned));
    const worldCenter = center.clone().addScaledVector(normal, hSigned / 2);
    const { vertices, faces } = buildCylinderGeometry(radius, radius, h, 16, 1, true);
    const mesh = createMeshFromGeometry('Cylinder', vertices, faces, { shading: 'smooth' });
    useGeometryStore.getState().addMesh(mesh);
    const scene = useSceneStore.getState();
    const objId = scene.createMeshObject('Cylinder', mesh.id);
    scene.setTransform(objId, {
      position: { x: worldCenter.x, y: worldCenter.y, z: worldCenter.z },
      rotation: quaternionToEuler(quaternion),
      scale: { x: 1, y: 1, z: 1 },
    });
    scene.selectObject(objId);
    useSelectionStore.getState().selectObjects([objId], false);
    return objId;
  },
};

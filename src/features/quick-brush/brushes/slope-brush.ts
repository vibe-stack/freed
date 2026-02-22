import * as THREE from 'three';
import { createMeshFromGeometry } from '@/utils/geometry';
import { buildWedgeGeometry } from '../utils/brush-geometry';
import { useGeometryStore } from '@/stores/geometry-store';
import { useSceneStore } from '@/stores/scene-store';
import { useSelectionStore } from '@/stores/selection-store';
import type { BrushDefinition, BrushParams, CommitStores, PreviewTransform } from './types';
import { computeRectFootprint, quaternionToEuler } from './brush-utils';
import React from 'react';

const SlopeIcon = React.createElement(
  'svg',
  { viewBox: '0 0 18 18', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round', width: 16, height: 16 },
  React.createElement('path', { d: 'M2 14h14L2 6v8z' }),
  React.createElement('line', { x1: '2', y1: '14', x2: '16', y2: '14' })
);

export const SlopeBrush: BrushDefinition = {
  id: 'slope',
  label: 'Slope',
  shortcut: '2',
  icon: SlopeIcon,
  footprintType: 'rect',

  buildPreviewGeometry(params: BrushParams): THREE.BufferGeometry {
    const { width, depth } = computeRectFootprint(params);
    const h = Math.max(0.01, Math.abs(params.height));
    const w = Math.max(0.01, width);
    const d = Math.max(0.01, depth);
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array([
      -w/2, 0, -d/2,  w/2, 0, -d/2,  w/2, 0,  d/2, -w/2, 0,  d/2,
      -w/2, h, -d/2,  w/2, h, -d/2,
    ]);
    const indices = new Uint16Array([
      0, 2, 1,  0, 3, 2,
      0, 1, 5,  0, 5, 4,
      4, 5, 2,  4, 2, 3,
      0, 4, 3,
      1, 2, 5,
    ]);
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setIndex(new THREE.BufferAttribute(indices, 1));
    geo.computeVertexNormals();
    return geo;
  },

  computePreviewTransform(params: BrushParams): PreviewTransform {
    const { center, quaternion } = computeRectFootprint(params);
    const q = quaternion.clone();
    if (params.height < 0) {
      const flip = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI);
      q.multiply(flip);
    }
    return {
      position: [center.x, center.y, center.z],
      quaternion: [q.x, q.y, q.z, q.w],
      scale: [1, 1, 1],
    };
  },

  commit(params: BrushParams, _stores: CommitStores): string {
    const { center, width, depth, quaternion } = computeRectFootprint(params);
    const h = Math.max(0.05, Math.abs(params.height));
    const q = quaternion.clone();
    if (params.height < 0) {
      const flip = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI);
      q.multiply(flip);
    }
    const { vertices, faces } = buildWedgeGeometry(
      Math.max(0.01, width), h, Math.max(0.01, depth)
    );
    const mesh = createMeshFromGeometry('Slope', vertices, faces);
    useGeometryStore.getState().addMesh(mesh);
    const scene = useSceneStore.getState();
    const objId = scene.createMeshObject('Slope', mesh.id);
    scene.setTransform(objId, {
      position: { x: center.x, y: center.y, z: center.z },
      rotation: quaternionToEuler(q),
      scale: { x: 1, y: 1, z: 1 },
    });
    scene.selectObject(objId);
    useSelectionStore.getState().selectObjects([objId], false);
    return objId;
  },
};

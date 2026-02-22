import * as THREE from 'three';
import { createMeshFromGeometry } from '@/utils/geometry';
import { buildStairsGeometryWithOptions, curveStairsPositionBuffer } from '../utils/brush-geometry';
import { useGeometryStore } from '@/stores/geometry-store';
import { useSceneStore } from '@/stores/scene-store';
import { useSelectionStore } from '@/stores/selection-store';
import type { BrushDefinition, BrushParams, CommitStores, PreviewTransform } from './types';
import { computeRectFootprint, quaternionToEuler } from './brush-utils';
import React from 'react';

const ClosedStairsIcon = React.createElement(
  'svg',
  { viewBox: '0 0 18 18', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round', width: 16, height: 16 },
  React.createElement('path', { d: 'M2 14h12V4h2' }),
  React.createElement('path', { d: 'M2 14h4v-3h4V7h4V4' })
);

function buildClosedStairsPreviewGeometry(width: number, height: number, depth: number, steps: number, curve: number): THREE.BufferGeometry {
  const stepH = height / steps;
  const stepD = depth / steps;
  const hw = width / 2;
  const zStart = -depth / 2;

  const positions: number[] = [];
  const indices: number[] = [];
  let vi = 0;

  for (let i = 0; i < steps; i++) {
    const y0 = 0;
    const y1 = (i + 1) * stepH;
    const z0 = zStart + i * stepD;
    const z1 = zStart + (i + 1) * stepD;
    const base = vi;
    positions.push(
      -hw, y0, z0,  hw, y0, z0,  -hw, y0, z1,  hw, y0, z1,
      -hw, y1, z0,  hw, y1, z0,  -hw, y1, z1,  hw, y1, z1,
    );
    vi += 8;
    const [bfl,bfr,bbl,bbr,tfl,tfr,tbl,tbr] = Array.from({length:8}, (_,j) => base+j);
    indices.push(
      bfl,bbl,bbr, bfl,bbr,bfr,
      tfl,tfr,tbr, tfl,tbr,tbl,
      bfl,bfr,tfr, bfl,tfr,tfl,
      bbl,tbl,tbr, bbl,tbr,bbr,
      bfl,tfl,tbl, bfl,tbl,bbl,
      bfr,bbr,tbr, bfr,tbr,tfr,
    );
  }

  curveStairsPositionBuffer(positions, depth, curve);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export const ClosedStairsBrush: BrushDefinition = {
  id: 'closed-stairs',
  label: 'Closed Stairs',
  shortcut: '9',
  icon: ClosedStairsIcon,
  footprintType: 'rect',

  buildPreviewGeometry(params: BrushParams): THREE.BufferGeometry {
    const { width, depth } = computeRectFootprint(params);
    const h = Math.max(0.01, Math.abs(params.height));
    const steps = Math.max(2, Math.min(64, Math.round(params.stairsCount)));
    return buildClosedStairsPreviewGeometry(
      Math.max(0.01, width),
      h,
      Math.max(0.01, depth),
      steps,
      params.stairsCurve,
    );
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
    const steps = Math.max(2, Math.min(64, Math.round(params.stairsCount)));
    const q = quaternion.clone();
    if (params.height < 0) {
      const flip = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI);
      q.multiply(flip);
    }
    const { vertices, faces } = buildStairsGeometryWithOptions(
      Math.max(0.01, width),
      h,
      Math.max(0.01, depth),
      steps,
      true,
      params.stairsCurve,
    );
    const mesh = createMeshFromGeometry('Closed Stairs', vertices, faces);
    useGeometryStore.getState().addMesh(mesh);
    const scene = useSceneStore.getState();
    const objId = scene.createMeshObject('Closed Stairs', mesh.id);
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

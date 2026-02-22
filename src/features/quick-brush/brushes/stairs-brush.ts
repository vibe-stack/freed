import * as THREE from 'three';
import { createMeshFromGeometry } from '@/utils/geometry';
import { buildStairsGeometry } from '../utils/brush-geometry';
import { useGeometryStore } from '@/stores/geometry-store';
import { useSceneStore } from '@/stores/scene-store';
import { useSelectionStore } from '@/stores/selection-store';
import type { BrushDefinition, BrushParams, CommitStores, PreviewTransform } from './types';
import { computeRectFootprint, quaternionToEuler } from './brush-utils';
import React from 'react';

const StairsIcon = React.createElement(
  'svg',
  { viewBox: '0 0 18 18', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round', width: 16, height: 16 },
  React.createElement('path', { d: 'M2 14h4v-3h4V7h4V4h2' })
);

function stepsFromHeight(h: number): number {
  return Math.max(2, Math.min(16, Math.round(h / 0.25)));
}

export const StairsBrush: BrushDefinition = {
  id: 'stairs',
  label: 'Stairs',
  shortcut: '6',
  icon: StairsIcon,
  footprintType: 'rect',

  buildPreviewGeometry(params: BrushParams): THREE.BufferGeometry {
    const { width, depth } = computeRectFootprint(params);
    const h = Math.max(0.01, params.height);
    const steps = stepsFromHeight(h);
    const stepH = h / steps;
    const stepD = Math.max(0.01, depth) / steps;
    const hw = Math.max(0.01, width) / 2;

    const positions: number[] = [];
    const indices: number[] = [];
    let vi = 0;

    for (let i = 0; i < steps; i++) {
      const y0 = i * stepH;
      const y1 = (i + 1) * stepH;
      const z0 = -(i + 1) * stepD;
      const z1 = -i * stepD;
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

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  },

  computePreviewTransform(params: BrushParams): PreviewTransform {
    const { center, quaternion } = computeRectFootprint(params);
    return {
      position: [center.x, center.y, center.z],
      quaternion: [quaternion.x, quaternion.y, quaternion.z, quaternion.w],
      scale: [1, 1, 1],
    };
  },

  commit(params: BrushParams, _stores: CommitStores): string {
    const { center, width, depth, quaternion } = computeRectFootprint(params);
    const h = Math.max(0.05, params.height);
    const steps = stepsFromHeight(h);
    const { vertices, faces } = buildStairsGeometry(
      Math.max(0.01, width), h, Math.max(0.01, depth), steps
    );
    const mesh = createMeshFromGeometry('Stairs', vertices, faces);
    useGeometryStore.getState().addMesh(mesh);
    const scene = useSceneStore.getState();
    const objId = scene.createMeshObject('Stairs', mesh.id);
    scene.setTransform(objId, {
      position: { x: center.x, y: center.y, z: center.z },
      rotation: quaternionToEuler(quaternion),
      scale: { x: 1, y: 1, z: 1 },
    });
    scene.selectObject(objId);
    useSelectionStore.getState().selectObjects([objId], false);
    return objId;
  },
};

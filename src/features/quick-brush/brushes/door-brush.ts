import * as THREE from 'three';
import { createMeshFromGeometry } from '@/utils/geometry';
import { buildDoorGeometry } from '../utils/brush-geometry';
import { useGeometryStore } from '@/stores/geometry-store';
import { useSceneStore } from '@/stores/scene-store';
import { useSelectionStore } from '@/stores/selection-store';
import type { BrushDefinition, BrushParams, CommitStores, PreviewTransform } from './types';
import { computeRectFootprint, quaternionToEuler } from './brush-utils';
import React from 'react';

const DoorIcon = React.createElement(
  'svg',
  { viewBox: '0 0 18 18', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round', width: 16, height: 16 },
  React.createElement('rect', { x: '3', y: '2', width: '12', height: '15', rx: '1' }),
  React.createElement('rect', { x: '6', y: '4', width: '6', height: '11' }),
  React.createElement('circle', { cx: '11.5', cy: '9.5', r: '0.5', fill: 'currentColor' })
);

export const DoorBrush: BrushDefinition = {
  id: 'door',
  label: 'Door',
  shortcut: '7',
  icon: DoorIcon,
  footprintType: 'rect',

  buildPreviewGeometry(params: BrushParams): THREE.BufferGeometry {
    const { width, depth } = computeRectFootprint(params);
    const h = Math.max(0.01, params.height);
    const w = Math.max(0.01, width);
    const d = Math.max(0.01, depth);
    const t = Math.min(w * 0.15, 0.25);
    const lintelH = Math.max(h * 0.08, 0.1);
    const openingH = h - lintelH;
    const hw = w / 2;
    const openingHW = hw - t;
    const hd = d / 2;

    const positions: number[] = [];
    const indices: number[] = [];
    let vi = 0;

    function addBox(x0:number,x1:number,y0:number,y1:number,z0:number,z1:number) {
      const b = vi;
      positions.push(
        x0,y0,z0, x1,y0,z0, x0,y0,z1, x1,y0,z1,
        x0,y1,z0, x1,y1,z0, x0,y1,z1, x1,y1,z1,
      );
      vi += 8;
      const [bfl,bfr,bbl,bbr,tfl,tfr,tbl,tbr] = Array.from({length:8},(_,j)=>b+j);
      indices.push(
        bfl,bbl,bbr, bfl,bbr,bfr,
        tfl,tfr,tbr, tfl,tbr,tbl,
        bfl,bfr,tfr, bfl,tfr,tfl,
        bbl,tbl,tbr, bbl,tbr,bbr,
        bfl,tfl,tbl, bfl,tbl,bbl,
        bfr,bbr,tbr, bfr,tbr,tfr,
      );
    }

    addBox(-hw, -openingHW, 0, h, -hd, hd);
    addBox(openingHW, hw, 0, h, -hd, hd);
    addBox(-openingHW, openingHW, openingH, h, -hd, hd);

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
    const { vertices, faces } = buildDoorGeometry(
      Math.max(0.01, width), h, Math.max(0.01, depth)
    );
    const mesh = createMeshFromGeometry('Door', vertices, faces);
    useGeometryStore.getState().addMesh(mesh);
    const scene = useSceneStore.getState();
    const objId = scene.createMeshObject('Door', mesh.id);
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

import * as THREE from 'three';
import { createMeshFromGeometry } from '@/utils/geometry';
import { buildArchGeometry } from '../utils/brush-geometry';
import { useGeometryStore } from '@/stores/geometry-store';
import { useSceneStore } from '@/stores/scene-store';
import { useSelectionStore } from '@/stores/selection-store';
import type { BrushDefinition, BrushParams, CommitStores, PreviewTransform } from './types';
import { computeRectFootprint, quaternionToEuler } from './brush-utils';
import React from 'react';

const ArchIcon = React.createElement(
  'svg',
  { viewBox: '0 0 18 18', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round', width: 16, height: 16 },
  React.createElement('path', { d: 'M2 15V9a7 7 0 0 1 14 0v6' }),
  React.createElement('line', { x1: '2', y1: '15', x2: '5', y2: '15' }),
  React.createElement('line', { x1: '13', y1: '15', x2: '16', y2: '15' })
);

export const ArchBrush: BrushDefinition = {
  id: 'arch',
  label: 'Arch',
  shortcut: '8',
  icon: ArchIcon,
  footprintType: 'rect',

  buildPreviewGeometry(params: BrushParams): THREE.BufferGeometry {
    const { width, depth } = computeRectFootprint(params);
    const h = Math.max(0.01, Math.abs(params.height));
    const w = Math.max(0.01, width);
    const d = Math.max(0.01, depth);
    const t = Math.min(w * 0.15, 0.25);
    const archRadius = Math.max(0.01, w / 2 - t);
    const pillarH = h * 0.5;
    const archCenterY = pillarH;
    const hw = w / 2;
    const hd = d / 2;
    const segments = Math.max(4, Math.min(64, Math.round(params.archSegments)));

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

    addBox(-hw, -archRadius, 0, pillarH, -hd, hd);
    addBox(archRadius, hw, 0, pillarH, -hd, hd);

    for (let i = 0; i < segments; i++) {
      const a0 = Math.PI * (i / segments);
      const a1 = Math.PI * ((i + 1) / segments);
      const ix0 = -Math.cos(a0) * archRadius, iy0 = Math.sin(a0) * archRadius + archCenterY;
      const ix1 = -Math.cos(a1) * archRadius, iy1 = Math.sin(a1) * archRadius + archCenterY;
      const ox0 = -Math.cos(a0) * (archRadius + t), oy0 = Math.sin(a0) * (archRadius + t) + archCenterY;
      const ox1 = -Math.cos(a1) * (archRadius + t), oy1 = Math.sin(a1) * (archRadius + t) + archCenterY;
      const b = vi;
      positions.push(
        ix0,iy0,-hd, ix1,iy1,-hd, ox0,oy0,-hd, ox1,oy1,-hd,
        ix0,iy0, hd, ix1,iy1, hd, ox0,oy0, hd, ox1,oy1, hd,
      );
      vi += 8;
      const [fi0,fi1,fo0,fo1,bi0,bi1,bo0,bo1] = Array.from({length:8},(_,j)=>b+j);
      indices.push(
        fo0,fo1,fi1, fo0,fi1,fi0,
        bi0,bi1,bo1, bi0,bo1,bo0,
        fo0,bo0,bo1, fo0,bo1,fo1,
        fi0,fi1,bi1, fi0,bi1,bi0,
        fo0,fi0,bi0, fo0,bi0,bo0,
        fi1,fo1,bo1, fi1,bo1,bi1,
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
    const segments = Math.max(4, Math.min(64, Math.round(params.archSegments)));
    const { vertices, faces } = buildArchGeometry(
      Math.max(0.01, width), h, Math.max(0.01, depth), segments
    );
    const mesh = createMeshFromGeometry('Arch', vertices, faces);
    useGeometryStore.getState().addMesh(mesh);
    const scene = useSceneStore.getState();
    const objId = scene.createMeshObject('Arch', mesh.id);
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

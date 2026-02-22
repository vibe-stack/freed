import * as THREE from 'three';
import React from 'react';
import type { BrushDefinition, BrushParams, CommitStores, PreviewTransform } from './types';

const PolygonIcon = React.createElement(
  'svg',
  { viewBox: '0 0 18 18', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round', width: 16, height: 16 },
  React.createElement('path', { d: 'M3 5l5-3 6 2 2 6-4 5-7 1-3-6z' })
);

const EMPTY_GEO = new THREE.BufferGeometry();
const NOOP_TRANSFORM: PreviewTransform = { position: [0, 0, 0], quaternion: [0, 0, 0, 1], scale: [1, 1, 1] };

export const PolygonBrush: BrushDefinition = {
  id: 'polygon',
  label: 'Polygon',
  shortcut: 'p',
  icon: PolygonIcon,
  footprintType: 'rect',

  buildPreviewGeometry(_params: BrushParams): THREE.BufferGeometry {
    return EMPTY_GEO;
  },

  computePreviewTransform(_params: BrushParams): PreviewTransform {
    return NOOP_TRANSFORM;
  },

  commit(_params: BrushParams, _stores: CommitStores): string {
    return '';
  },
};

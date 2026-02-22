import * as THREE from 'three';
import React from 'react';
import type { BrushDefinition, BrushParams, CommitStores, PreviewTransform } from './types';

const SelectIcon = React.createElement(
  'svg',
  { viewBox: '0 0 18 18', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round', width: 16, height: 16 },
  React.createElement('path', { d: 'M4 3l10 6.5-5.5 1-2.5 5z' }),
);

const EMPTY_GEO = new THREE.BufferGeometry();
const NOOP_TRANSFORM: PreviewTransform = { position: [0, 0, 0], quaternion: [0, 0, 0, 1], scale: [1, 1, 1] };

/**
 * Select brush — a no-op cursor tool.
 * When active, the handler skips all placement logic so the user can orbit
 * and select objects normally without triggering shape creation.
 */
export const SelectBrush: BrushDefinition = {
  id: 'select',
  label: 'Select',
  shortcut: '0',
  icon: SelectIcon,
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

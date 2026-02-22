'use client';

import React, { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useQuickBrushStore } from '../stores/quick-brush-store';
import { getBrush } from '../brushes/registry';
import { computeRectFootprint, computeRadialFootprint } from '../brushes/brush-utils';
import type { BrushParams } from '../brushes/types';

const _previewMaterial = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0.18,
  depthWrite: false,
  side: THREE.DoubleSide,
});

/** Converts store plain-object params into BrushParams with THREE.Vector3 */
function toThreeParams(store: ReturnType<typeof useQuickBrushStore.getState>): BrushParams | null {
  if (!store.anchor || !store.current) return null;
  return {
    anchor: new THREE.Vector3(store.anchor.x, store.anchor.y, store.anchor.z),
    current: new THREE.Vector3(store.current.x, store.current.y, store.current.z),
    normal: new THREE.Vector3(store.normal.x, store.normal.y, store.normal.z),
    tangent: new THREE.Vector3(store.tangent.x, store.tangent.y, store.tangent.z),
    height: store.height,
  };
}

/** Tracks last geometry dimensions to avoid rebuilding on every frame */
interface LastDims {
  w: number;
  d: number;
  h: number;
  brushId: string;
}

const QuickBrushPreview: React.FC = () => {
  const meshRef = useRef<THREE.Mesh>(null);
  const lastDims = useRef<LastDims>({ w: 0, d: 0, h: 0, brushId: '' });

  // Geometry is kept as a ref, not React state, so we can swap it imperatively
  const geoRef = useRef<THREE.BufferGeometry>(new THREE.BoxGeometry(0.01, 0.01, 0.01));

  useEffect(() => {
    // Clean up geometry on unmount
    return () => {
      geoRef.current?.dispose();
    };
  }, []);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const store = useQuickBrushStore.getState();

    if (store.phase === 'idle' || !store.anchor || !store.current) {
      mesh.visible = false;
      return;
    }

    mesh.visible = true;

    const params = toThreeParams(store);
    if (!params) return;

    const brush = getBrush(store.activeBrush);

    // Compute actual footprint dimensions
    let w: number, d: number;
    if (brush.footprintType === 'radial') {
      const fp = computeRadialFootprint(params);
      w = fp.radius; d = fp.radius;
    } else {
      const fp = computeRectFootprint(params);
      w = fp.width; d = fp.depth;
    }
    const h = params.height;
    const dims = lastDims.current;

    // Rebuild geometry whenever dims change. Tight epsilon avoids redundant rebuilds
    // on identical frames while ensuring geo and transform always use the same params.
    const EPSILON = 0.001;
    if (
      Math.abs(w - dims.w) > EPSILON ||
      Math.abs(d - dims.d) > EPSILON ||
      Math.abs(h - dims.h) > EPSILON ||
      dims.brushId !== store.activeBrush
    ) {
      const newGeo = brush.buildPreviewGeometry(params);
      const oldGeo = geoRef.current;
      geoRef.current = newGeo;
      mesh.geometry = newGeo;
      oldGeo.dispose();
      lastDims.current = { w, d, h, brushId: store.activeBrush };
    }

    // Transform always applied from the same params snapshot — geo and position stay in sync
    const t = brush.computePreviewTransform(params);
    mesh.position.set(...t.position);
    mesh.quaternion.set(...t.quaternion);
    mesh.scale.set(...t.scale);
  });

  return (
    <mesh ref={meshRef} geometry={geoRef.current} material={_previewMaterial} visible={false} />
  );
};

export default QuickBrushPreview;

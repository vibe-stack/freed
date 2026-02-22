'use client';

import React, { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useQuickBrushStore } from '../stores/quick-brush-store';
import { useToolStore } from '@/stores/tool-store';
import { useSelectionStore } from '@/stores/selection-store';
import { useGeometryStore } from '@/stores/geometry-store';
import { useSceneStore } from '@/stores/scene-store';
import { getBrush } from '../brushes/registry';
import type { BrushParams } from '../brushes/types';
import { castToGroundOrSurface } from '../utils/ray-utils';
import QuickBrushPreview from './quick-brush-preview';

/** Cast a ray against a fixed plane and return the intersection point, or null. */
function castToPlane(
  clientX: number,
  clientY: number,
  camera: THREE.Camera,
  domElement: HTMLElement,
  plane: THREE.Plane,
): THREE.Vector3 | null {
  const rect = domElement.getBoundingClientRect();
  const ndc = new THREE.Vector2(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -((clientY - rect.top) / rect.height) * 2 + 1,
  );
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(ndc, camera);
  const target = new THREE.Vector3();
  return raycaster.ray.intersectPlane(plane, target) ? target : null;
}

function buildBrushParams(store: ReturnType<typeof useQuickBrushStore.getState>): BrushParams | null {
  if (!store.anchor || !store.current) return null;
  return {
    anchor: new THREE.Vector3(store.anchor.x, store.anchor.y, store.anchor.z),
    current: new THREE.Vector3(store.current.x, store.current.y, store.current.z),
    normal: new THREE.Vector3(store.normal.x, store.normal.y, store.normal.z),
    tangent: new THREE.Vector3(store.tangent.x, store.tangent.y, store.tangent.z),
    height: store.height,
  };
}

const QuickBrushHandler: React.FC = () => {
  const { camera, gl, scene } = useThree();
  const phaseRef = useRef(useQuickBrushStore.getState().phase);

  // Track which UI elements are being interacted with so we skip toolbar clicks
  const isOverUIRef = useRef(false);

  // The surface plane locked at mousedown — used for jitter-free footprint dragging
  const anchorPlaneRef = useRef<THREE.Plane | null>(null);

  useEffect(() => {
    // Subscribe to phase changes so our event handlers always see the latest phase
    const unsub = useQuickBrushStore.subscribe((s) => {
      phaseRef.current = s.phase;
    });
    return unsub;
  }, []);

  useEffect(() => {
    const HEIGHT_SENSITIVITY = 0.015;

    const getViewMode = () => useSelectionStore.getState().selection.viewMode;
    const isBrushMode = () => getViewMode() === 'brush';

    const getSceneMeshes = (): THREE.Mesh[] => {
      const meshes: THREE.Mesh[] = [];
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh && obj.visible) {
          meshes.push(obj);
        }
      });
      return meshes;
    };

    const onMouseDown = (e: MouseEvent) => {
      // Only act in brush mode
      if (!isBrushMode()) return;
      // Only left mouse button
      if (e.button !== 0) return;
      // Skip if over a UI element (panels, toolbars)
      if (isOverUIRef.current) return;
      // Don't start if the click target is not the canvas
      if (e.target !== gl.domElement) return;

      const phase = phaseRef.current;

      // In 'select' mode, never start placement
      const activeBrush = useQuickBrushStore.getState().activeBrush;
      if (activeBrush === 'select') return;

      if (phase === 'idle') {
        // Phase 1: begin footprint
        const hit = castToGroundOrSurface(e.clientX, e.clientY, camera, gl.domElement, getSceneMeshes());
        if (!hit) return;

        // Lock the surface plane once at mousedown — all footprint dragging casts against this
        anchorPlaneRef.current = new THREE.Plane().setFromNormalAndCoplanarPoint(hit.normal, hit.point);

        useQuickBrushStore.getState().beginFootprint(
          { x: hit.point.x, y: hit.point.y, z: hit.point.z },
          { x: hit.normal.x, y: hit.normal.y, z: hit.normal.z },
          { x: hit.tangent.x, y: hit.tangent.y, z: hit.tangent.z },
        );
        useToolStore.getState().setBrushPlacing(true);

      } else if (phase === 'height') {
        // Phase 2 commit: create the actual object
        const store = useQuickBrushStore.getState();
        const params = buildBrushParams(store);
        if (params) {
          const brush = getBrush(store.activeBrush);
          brush.commit(params, {
            geometry: useGeometryStore.getState(),
            scene: useSceneStore.getState(),
            selection: useSelectionStore.getState(),
          });
        }
        useQuickBrushStore.getState().commitPlacement();
        useToolStore.getState().setBrushPlacing(false);
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isBrushMode()) return;

      const phase = phaseRef.current;

      if (phase === 'footprint') {
        // Cast directly against the locked surface plane — no scene mesh traversal,
        // so the footprint is stable and jitter-free during the drag.
        const plane = anchorPlaneRef.current;
        if (!plane) return;
        const pt = castToPlane(e.clientX, e.clientY, camera, gl.domElement, plane);
        if (!pt) return;
        useQuickBrushStore.getState().updateFootprint({
          x: pt.x,
          y: pt.y,
          z: pt.z,
        });

      } else if (phase === 'height') {
        // Accumulate height from vertical mouse movement
        const delta = -e.movementY * HEIGHT_SENSITIVITY;
        useQuickBrushStore.getState().updateHeight(delta);
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      if (e.button !== 0) return;
      if (phaseRef.current === 'footprint') {
        anchorPlaneRef.current = null;
        useQuickBrushStore.getState().commitFootprint();
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const phase = phaseRef.current;
        if (phase !== 'idle') {
          anchorPlaneRef.current = null;
          useQuickBrushStore.getState().cancel();
          useToolStore.getState().setBrushPlacing(false);
        }
      }
    };

    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [camera, gl, scene]);

  // Track whether mouse is over a DOM UI element (to avoid swallowing toolbar clicks)
  useEffect(() => {
    const onEnter = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // If event target is NOT the canvas itself, we're over UI
      isOverUIRef.current = target !== gl.domElement;
    };
    document.addEventListener('mouseover', onEnter);
    return () => document.removeEventListener('mouseover', onEnter);
  }, [gl]);

  return <QuickBrushPreview />;
};

export default QuickBrushHandler;

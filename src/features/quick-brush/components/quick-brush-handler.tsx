'use client';

import React, { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useQuickBrushStore } from '../stores/quick-brush-store';
import { useToolStore } from '@/stores/tool-store';
import { useSelectionStore } from '@/stores/selection-store';
import { useGeometryStore } from '@/stores/geometry-store';
import { useSceneStore } from '@/stores/scene-store';
import { useViewportStore } from '@/stores/viewport-store';
import { getBrush } from '../brushes/registry';
import type { BrushParams } from '../brushes/types';
import { castToGroundOrSurface } from '../utils/ray-utils';
import QuickBrushPreview from './quick-brush-preview';
import { computeRectFootprint } from '../brushes/brush-utils';
import { snapValue } from '@/utils/grid-snapping';

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
    doorOpeningRatio: store.doorOpeningRatio,
    stairsCount: store.stairsCount,
    archSegments: store.archSegments,
    stairsCurve: store.stairsCurve,
  };
}

function commitActiveBrushPlacement() {
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

const QuickBrushHandler: React.FC = () => {
  const { camera, gl, scene } = useThree();
  const gridSnapping = useViewportStore((s) => s.gridSnapping);
  const gridSize = useViewportStore((s) => s.gridSize);
  const phaseRef = useRef(useQuickBrushStore.getState().phase);
  const heightDragRef = useRef<{ startY: number; startHeight: number } | null>(null);

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
    const HEIGHT_SENSITIVITY = 0.02;

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
      if (activeBrush === 'select' || activeBrush === 'polygon') return;

      if (phase === 'idle') {
        // Phase 1: begin footprint
        const hit = castToGroundOrSurface(e.clientX, e.clientY, camera, gl.domElement, getSceneMeshes());
        if (!hit) return;

        const snappedPoint = gridSnapping
          ? {
              x: snapValue(hit.point.x, gridSize),
              y: snapValue(hit.point.y, gridSize),
              z: snapValue(hit.point.z, gridSize),
            }
          : { x: hit.point.x, y: hit.point.y, z: hit.point.z };

        // Lock the surface plane once at mousedown — all footprint dragging casts against this
        anchorPlaneRef.current = new THREE.Plane().setFromNormalAndCoplanarPoint(hit.normal, new THREE.Vector3(snappedPoint.x, snappedPoint.y, snappedPoint.z));

        useQuickBrushStore.getState().beginFootprint(
          snappedPoint,
          { x: hit.normal.x, y: hit.normal.y, z: hit.normal.z },
          { x: hit.tangent.x, y: hit.tangent.y, z: hit.tangent.z },
        );
        useToolStore.getState().setBrushPlacing(true);

      } else if (phase === 'height') {
        // Phase 2 click: door advances to cutout; stairs advance to curve; others commit
        if (activeBrush === 'door') {
          useQuickBrushStore.getState().beginCutout();
          heightDragRef.current = null;
        } else if (activeBrush === 'stairs' || activeBrush === 'closed-stairs') {
          useQuickBrushStore.getState().beginCurve();
          heightDragRef.current = null;
        } else {
          commitActiveBrushPlacement();
          anchorPlaneRef.current = null;
          heightDragRef.current = null;
        }
      } else if (phase === 'curve') {
        commitActiveBrushPlacement();
        anchorPlaneRef.current = null;
        heightDragRef.current = null;
      } else if (phase === 'cutout') {
        // Phase 3 click: finalize door
        commitActiveBrushPlacement();
        anchorPlaneRef.current = null;
        heightDragRef.current = null;
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
        const nextPoint = gridSnapping
          ? { x: snapValue(pt.x, gridSize), y: snapValue(pt.y, gridSize), z: snapValue(pt.z, gridSize) }
          : { x: pt.x, y: pt.y, z: pt.z };
        useQuickBrushStore.getState().updateFootprint({
          x: nextPoint.x,
          y: nextPoint.y,
          z: nextPoint.z,
        });

      } else if (phase === 'height') {
        // Blender-like absolute drag: derive signed height from pointer offset since stage start
        const drag = heightDragRef.current;
        if (!drag) return;
        const rawHeight = drag.startHeight + (e.clientY - drag.startY) * HEIGHT_SENSITIVITY;
        const nextHeight = gridSnapping ? snapValue(rawHeight, gridSize) : rawHeight;
        useQuickBrushStore.getState().setHeight(nextHeight);
      } else if (phase === 'cutout') {
        // Door phase 3: adjust opening width from cursor position over the locked anchor plane
        const plane = anchorPlaneRef.current;
        if (!plane) return;
        const pt = castToPlane(e.clientX, e.clientY, camera, gl.domElement, plane);
        if (!pt) return;
        const store = useQuickBrushStore.getState();
        const params = buildBrushParams(store);
        if (!params) return;
        const fp = computeRectFootprint(params);
        const tangent = new THREE.Vector3(params.tangent.x, params.tangent.y, params.tangent.z).normalize();
        const halfOnTangent = Math.abs(pt.clone().sub(fp.center).dot(tangent));
        const openingWidth = Math.max(0.01, halfOnTangent * 2);
        const ratio = openingWidth / Math.max(0.01, fp.width);
        useQuickBrushStore.getState().setDoorOpeningRatio(ratio);
      } else if (phase === 'curve') {
        const CURVE_SENSITIVITY = e.shiftKey ? 0.002 : 0.01;
        const current = useQuickBrushStore.getState().stairsCurve;
        useQuickBrushStore.getState().setStairsCurve(current + e.movementX * CURVE_SENSITIVITY);
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      if (e.button !== 0) return;
      if (phaseRef.current === 'footprint') {
        const activeBrush = useQuickBrushStore.getState().activeBrush;
        if (activeBrush === 'sphere') {
          // Sphere is one-stage: drag radius then release to commit
          commitActiveBrushPlacement();
          anchorPlaneRef.current = null;
          heightDragRef.current = null;
          return;
        }
        useQuickBrushStore.getState().beginHeight();
        const h = useQuickBrushStore.getState().height;
        heightDragRef.current = { startY: e.clientY, startHeight: h };
      }
    };

    const onWheel = (e: WheelEvent) => {
      if (!isBrushMode()) return;
      if (e.target !== gl.domElement) return;
      if (phaseRef.current !== 'height') return;

      const activeBrush = useQuickBrushStore.getState().activeBrush;
      if (activeBrush !== 'stairs' && activeBrush !== 'closed-stairs' && activeBrush !== 'arch') return;

      e.preventDefault();
      const step = e.deltaY < 0 ? 1 : -1;
      if (activeBrush === 'stairs') {
        useQuickBrushStore.getState().adjustStairsCount(step);
      } else if (activeBrush === 'closed-stairs') {
        useQuickBrushStore.getState().adjustStairsCount(step);
      } else {
        useQuickBrushStore.getState().adjustArchSegments(step);
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const phase = phaseRef.current;
        if (phase !== 'idle') {
          anchorPlaneRef.current = null;
          heightDragRef.current = null;
          useQuickBrushStore.getState().cancel();
          useToolStore.getState().setBrushPlacing(false);
        }
      }
    };

    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('wheel', onWheel, { passive: false });
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('wheel', onWheel);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [camera, gl, scene, gridSnapping, gridSize]);

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

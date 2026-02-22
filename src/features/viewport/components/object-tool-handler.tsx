'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { Vector3, Euler, Camera } from 'three/webgpu';
import { useToolStore } from '@/stores/tool-store';
import { useSelectionStore } from '@/stores/selection-store';
import { useSceneStore } from '@/stores/scene-store';
import { useViewportStore } from '@/stores/viewport-store';
import { snapRotationRadians, snapValue } from '@/utils/grid-snapping';

// Helper to convert mouse delta to world delta like edit-mode
function mouseToWorldDelta(movementX: number, movementY: number, camera: Camera, distance: number, sensitivity: number = 0.005) {
  const factor = distance * sensitivity;
  const cameraMatrix = camera.matrixWorld;
  const right = new Vector3().setFromMatrixColumn(cameraMatrix, 0);
  const up = new Vector3().setFromMatrixColumn(cameraMatrix, 1);
  const delta = new Vector3();
  delta.addScaledVector(right, movementX * factor);
  delta.addScaledVector(up, -movementY * factor);
  return delta;
}

export const ObjectToolHandler: React.FC = () => {
  const { camera, gl } = useThree();
  const toolStore = useToolStore();
  // access selection store imperatively where needed to avoid rerenders
  const sceneStore = useSceneStore();
  const viewport = useViewportStore();

  const [original, setOriginal] = useState<{ id: string; pos: Vector3; rot: Euler; scale: Vector3 }[]>([]);
  const [center, setCenter] = useState<Vector3>(new Vector3());
  const moveAccum = useRef(new Vector3());
  const rotAccum = useRef(0);
  const scaleAccum = useRef(1);
  const pointerLocked = useRef(false);

  // When tool starts in object mode, snapshot selected objects
  useEffect(() => {
    if (!toolStore.isActive) {
      if (pointerLocked.current) {
        document.exitPointerLock();
        pointerLocked.current = false;
      }
      return;
    }
    const sel = useSelectionStore.getState().selection;
    if (sel.viewMode !== 'object') return;
  const ids = sel.objectIds;
    if (ids.length === 0) return;
  const objs = ids
      .map((id) => sceneStore.objects[id])
      .filter(Boolean)
      .filter((o) => !o.locked)
      .map((o) => ({
        id: o.id,
        pos: new Vector3(o.transform.position.x, o.transform.position.y, o.transform.position.z),
        rot: new Euler(o.transform.rotation.x, o.transform.rotation.y, o.transform.rotation.z),
        scale: new Vector3(o.transform.scale.x, o.transform.scale.y, o.transform.scale.z),
      }));
    setOriginal(objs);
    // compute center
    const c = objs.reduce((acc, o) => acc.add(o.pos), new Vector3()).multiplyScalar(1 / objs.length);
    setCenter(c);
    moveAccum.current.set(0, 0, 0);
    rotAccum.current = 0;
    scaleAccum.current = 1;
    // Seed local transforms in tool store so MeshView can read them without committing
    const localTransforms = Object.fromEntries(
      objs.map((o) => [
        o.id,
        {
          position: { x: o.pos.x, y: o.pos.y, z: o.pos.z },
          rotation: { x: o.rot.x, y: o.rot.y, z: o.rot.z },
          scale: { x: o.scale.x, y: o.scale.y, z: o.scale.z },
        },
      ])
    );
    useToolStore.getState().setLocalData({ kind: 'object-transform', transforms: localTransforms });
    if (document.pointerLockElement !== gl.domElement) gl.domElement.requestPointerLock();
  }, [toolStore.isActive, toolStore.tool, gl, sceneStore.objects]);

  useEffect(() => {
    const onLockChange = () => {
      pointerLocked.current = document.pointerLockElement === gl.domElement;
    };
    document.addEventListener('pointerlockchange', onLockChange);
    return () => document.removeEventListener('pointerlockchange', onLockChange);
  }, [gl]);

  useEffect(() => {
    if (!toolStore.isActive || original.length === 0) return;
  const onMouseMove = (e: MouseEvent) => {
      const sel = useSelectionStore.getState().selection;
      if (sel.viewMode !== 'object') return;
      const distance = camera.position.distanceTo(center);
      // Always mutate the local transforms for preview
      const state = useToolStore.getState();
      const local = state.localData?.kind === 'object-transform' ? state.localData.transforms : null;
      if (!local) return;
      if (toolStore.tool === 'move') {
        const delta = mouseToWorldDelta(e.movementX, e.movementY, camera, distance, useToolStore.getState().moveSensitivity);
        // Apply axis lock
        if (toolStore.axisLock !== 'none') {
          delta.set(
            toolStore.axisLock === 'x' ? delta.x : 0,
            toolStore.axisLock === 'y' ? delta.y : 0,
            toolStore.axisLock === 'z' ? delta.z : 0
          );
        }
        moveAccum.current.add(delta);
        const snappedMove = viewport.gridSnapping
          ? new Vector3(
              snapValue(moveAccum.current.x, viewport.gridSize),
              snapValue(moveAccum.current.y, viewport.gridSize),
              snapValue(moveAccum.current.z, viewport.gridSize)
            )
          : moveAccum.current;
        original.forEach((o) => {
          const t = local[o.id];
          if (t) {
            t.position.x = o.pos.x + snappedMove.x;
            t.position.y = o.pos.y + snappedMove.y;
            t.position.z = o.pos.z + snappedMove.z;
          }
        });
        // trigger store update so subscribers (MeshView) re-render
        useToolStore.getState().setLocalData({ kind: 'object-transform', transforms: { ...local } });
      } else if (toolStore.tool === 'rotate') {
        const delta = (e.movementX + e.movementY) * useToolStore.getState().rotateSensitivity;
        rotAccum.current += delta;
        const snappedRotation = viewport.gridSnapping
          ? snapRotationRadians(rotAccum.current, viewport.gridSize)
          : rotAccum.current;
        original.forEach((o) => {
          // Default: rotate around Z when no axis is locked (view-like behavior)
          const rx = toolStore.axisLock === 'x' ? snappedRotation : 0;
          const ry = toolStore.axisLock === 'y' ? snappedRotation : 0;
          const rz = toolStore.axisLock === 'z' || toolStore.axisLock === 'none' ? snappedRotation : 0;
          const t = local[o.id];
          if (t) {
            t.rotation.x = o.rot.x + rx;
            t.rotation.y = o.rot.y + ry;
            t.rotation.z = o.rot.z + rz;
          }
        });
        useToolStore.getState().setLocalData({ kind: 'object-transform', transforms: { ...local } });
      } else if (toolStore.tool === 'scale') {
        const sDelta = 1 + e.movementX * useToolStore.getState().scaleSensitivity;
        scaleAccum.current *= Math.max(0.01, sDelta);
        const scaleFactor = scaleAccum.current;
        original.forEach((o) => {
          const applyX = toolStore.axisLock === 'x' || toolStore.axisLock === 'none';
          const applyY = toolStore.axisLock === 'y' || toolStore.axisLock === 'none';
          const applyZ = toolStore.axisLock === 'z' || toolStore.axisLock === 'none';

          const rawX = applyX ? o.scale.x * scaleFactor : o.scale.x;
          const rawY = applyY ? o.scale.y * scaleFactor : o.scale.y;
          const rawZ = applyZ ? o.scale.z * scaleFactor : o.scale.z;

          const step = viewport.gridSize;
          const snappedX = viewport.gridSnapping && applyX ? snapValue(rawX, step) : rawX;
          const snappedY = viewport.gridSnapping && applyY ? snapValue(rawY, step) : rawY;
          const snappedZ = viewport.gridSnapping && applyZ ? snapValue(rawZ, step) : rawZ;

          const t = local[o.id];
          if (t) {
            t.scale.x = Math.max(0.01, snappedX);
            t.scale.y = Math.max(0.01, snappedY);
            t.scale.z = Math.max(0.01, snappedZ);
          }
        });
        useToolStore.getState().setLocalData({ kind: 'object-transform', transforms: { ...local } });
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        // Commit: write local transforms to the scene store, then clear tool state
        const state = useToolStore.getState();
        const local = state.localData?.kind === 'object-transform' ? state.localData.transforms : null;
        if (local) {
          Object.entries(local).forEach(([id, t]) => {
            const obj = sceneStore.objects[id];
            if (!obj || obj.locked) return;
            sceneStore.setTransform(id, {
              position: { ...t.position },
              rotation: { ...t.rotation },
              scale: { ...t.scale },
            });
          });
        }
        useToolStore.getState().endOperation(true);
        moveAccum.current.set(0, 0, 0);
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'escape') {
  // Cancel: discard local changes, keep scene store as last committed state
  useToolStore.getState().setLocalData(null);
        useToolStore.getState().endOperation(false);
        moveAccum.current.set(0, 0, 0);
      } else if (k === 'x' || k === 'y' || k === 'z') {
        const axis = k as 'x' | 'y' | 'z';
        const current = useToolStore.getState().axisLock;
        useToolStore.getState().setAxisLock(current === axis ? 'none' : axis);
      }
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [toolStore.isActive, toolStore.tool, toolStore.axisLock, center, camera, original, sceneStore, viewport.gridSnapping, viewport.gridSize]);

  // Axis visual when a transform is active and an axis is locked
  const showAxis = toolStore.isActive && toolStore.axisLock !== 'none' && original.length > 0;
  let axisPoints: [number, number, number][] | null = null;
  let axisColor = 'white';
  if (showAxis) {
    const distance = camera.position.distanceTo(center);
    const L = Math.max(2, distance * 2);
    const dir =
      toolStore.axisLock === 'x'
        ? new Vector3(1, 0, 0)
        : toolStore.axisLock === 'y'
        ? new Vector3(0, 1, 0)
        : new Vector3(0, 0, 1);
    axisColor = toolStore.axisLock === 'x' ? '#ff5555' : toolStore.axisLock === 'y' ? '#55cc55' : '#5599ff';
    const p1 = new Vector3().copy(center).addScaledVector(dir, -L);
    const p2 = new Vector3().copy(center).addScaledVector(dir, L);
    axisPoints = [p1.toArray() as [number, number, number], p2.toArray() as [number, number, number]];
  }

  return showAxis && axisPoints ? (
    // Render a bidirectional axis line through the selection center using native line
    <line>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[new Float32Array([...axisPoints[0], ...axisPoints[1]]), 3]} />
      </bufferGeometry>
      <lineBasicMaterial color={axisColor} depthTest={false} depthWrite={false} transparent opacity={0.9} />
    </line>
  ) : null;
};

export default ObjectToolHandler;

'use client';

import { useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useViewportStore } from '@/stores/viewport-store';

// Keeps the R3F camera in sync with the zustand camera state and reports back changes.
export function useCameraController() {
  const cameraState = useViewportStore((s) => s.camera);
  const setCamera = useViewportStore((s) => s.setCamera);
  const { camera } = useThree();

  useEffect(() => {
    camera.position.set(
      cameraState.position.x,
      cameraState.position.y,
      cameraState.position.z
    );
    camera.lookAt(
      cameraState.target.x,
      cameraState.target.y,
      cameraState.target.z
    );
    // @ts-ignore
    camera.fov = cameraState.fov;
    camera.near = cameraState.near;
    camera.far = cameraState.far;
    camera.updateProjectionMatrix();
  }, [camera, cameraState]);

  useFrame(() => {
    const current = useViewportStore.getState().camera.position;
    const x = camera.position.x,
      y = camera.position.y,
      z = camera.position.z;
    if (
      Math.abs(current.x - x) > 1e-5 ||
      Math.abs(current.y - y) > 1e-5 ||
      Math.abs(current.z - z) > 1e-5
    ) {
      setCamera({ position: { x, y, z } as any });
    }
  });
}

'use client';

import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { getCamera } from './camera-registry';
import { useViewportStore } from '@/stores/viewport-store';

// Switch R3F default camera to active scene camera, and restore when cleared.
export function useActiveCameraBinding() {
  const activeId = useViewportStore((s) => s.activeCameraObjectId ?? null);
  const { set, camera } = useThree() as any;
  const baseCameraRef = useRef<any | null>(null);

  // Capture the original Canvas default camera once
  useEffect(() => {
    if (!baseCameraRef.current) baseCameraRef.current = camera;
  }, [camera]);

  useEffect(() => {
    const target = getCamera(activeId) as any;
    if (target && target !== camera) {
      set({ camera: target });
    } else if (!target && baseCameraRef.current && camera !== baseCameraRef.current) {
      // Restore the original default camera when clearing selection
      set({ camera: baseCameraRef.current });
    }
    // Keep OrbitControls as makeDefault so it follows the current default camera
  }, [activeId, set, camera]);
}

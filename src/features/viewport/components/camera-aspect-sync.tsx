'use client';

import React from 'react';
import { useThree } from '@react-three/fiber';
import type { PerspectiveCamera, OrthographicCamera } from 'three/webgpu';

// Keeps whichever camera is currently the R3F default camera in sync with the canvas aspect
const CameraAspectSync: React.FC = () => {
  const { size, camera } = useThree();

  React.useEffect(() => {
    const w = Math.max(1, size.width);
    const h = Math.max(1, size.height);
    const anyCam = camera as PerspectiveCamera & OrthographicCamera & { isPerspectiveCamera?: boolean; isOrthographicCamera?: boolean; } & { updateProjectionMatrix: () => void } & { aspect?: number };

    // For perspective cameras, keep aspect matched to viewport to avoid stretching
    if ((anyCam as any).isPerspectiveCamera) {
      const aspect = w / h;
      if (typeof anyCam.aspect === 'number' && Math.abs((anyCam.aspect ?? 0) - aspect) > 1e-6) {
        (anyCam as any).aspect = aspect;
        anyCam.updateProjectionMatrix();
      } else {
        // Still ensure matrix is up-to-date on size changes
        anyCam.updateProjectionMatrix();
      }
    } else if ((anyCam as any).isOrthographicCamera) {
      // Orthographic cameras typically use explicit left/right/top/bottom; don't override here.
      anyCam.updateProjectionMatrix();
    }
  }, [size.width, size.height, camera]);

  return null;
};

export default CameraAspectSync;

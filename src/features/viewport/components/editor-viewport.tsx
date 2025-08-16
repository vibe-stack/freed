'use client';

import React from 'react';
import { Canvas } from '@react-three/fiber';
import type { RaycasterParameters } from 'three';
import { OrbitControls } from '@react-three/drei';
import { useViewportStore } from '@/stores/viewport-store';
import CalmBg from './calm-bg';
import SceneContent from './scene-content';
import CameraController from './camera-controller';

const EditorViewport: React.FC = () => {
  const camera = useViewportStore((s) => s.camera);

  // Camera controller runs inside Canvas via component

  return (
    <div className="absolute inset-0">
      <Canvas
        camera={{
          fov: camera.fov,
          near: camera.near,
          far: camera.far,
          position: [camera.position.x, camera.position.y, camera.position.z],
        }}
        dpr={[0.2, 2]}
  // Provide minimal raycaster params; cast to any to satisfy drei typing
  raycaster={{ params: { Mesh: {}, LOD: {}, Points: {}, Sprite: {}, Line2: { threshold: 0.1 }, Line: { threshold: 0.1 } } as unknown as RaycasterParameters }}
      >
  <CalmBg />
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 8, 3]} intensity={0.8} />
  <CameraController />
        <OrbitControls
          makeDefault
          target={[camera.target.x, camera.target.y, camera.target.z]}
          enableDamping
          dampingFactor={0.1}
        />
        <SceneContent />
      </Canvas>
    </div>
  );
};

export default EditorViewport;

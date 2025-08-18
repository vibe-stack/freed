'use client';

import React from 'react';
import { Canvas } from '@react-three/fiber';
import { WebGPURenderer } from 'three/webgpu';
import { WebGLRenderer } from 'three';
import type { RaycasterParameters } from 'three';
import { OrbitControls } from '@react-three/drei';
import { useViewportStore } from '@/stores/viewport-store';
import CalmBg from './calm-bg';
import SceneContent from './scene-content';
import CameraController from './camera-controller';
import WorldEffects from './world-effects';
import { useRendererSettings } from '@/stores/world-store';

const EditorViewport: React.FC = () => {
  const camera = useViewportStore((s) => s.camera);
  const shadingMode = useViewportStore((s) => s.shadingMode);
  const renderer = useRendererSettings();

  // Camera controller runs inside Canvas via component

  return (
    <div className="absolute inset-0">
      <Canvas
        gl={async (props) => {
          try {
            if ('gpu' in navigator) {
              const renderer = new WebGPURenderer(props as any);
              await renderer.init();
              return renderer;
            }
          } catch { }
          // Fallback to WebGL if WebGPU is unavailable
          return new WebGLRenderer(props as any);
        }}
        shadows={renderer.shadows && shadingMode === 'material'}
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
        {shadingMode !== 'material' && (
          <>
            {/* Headlight-style defaults for non-material modes; no shadows */}
            <ambientLight intensity={0.5} />
            <directionalLight position={[5, 8, 3]} intensity={0.8} />
          </>
        )}
        <CameraController />
        <OrbitControls
          makeDefault
          target={[camera.target.x, camera.target.y, camera.target.z]}
          enableDamping
          dampingFactor={0.1}
        />
        <SceneContent />
        <WorldEffects />
      </Canvas>
    </div>
  );
};

export default EditorViewport;

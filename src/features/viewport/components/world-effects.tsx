"use client";

import React, { Fragment, useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
// Postprocessing is not WebGPU compatible in this setup; disable for now
import * as THREE from 'three';
import { useBloom, useDoF, useEnvironment, useFog, useRendererSettings } from '@/stores/world-store';

const toThreeColor = (rgb: { x: number; y: number; z: number }) => new THREE.Color(rgb.x, rgb.y, rgb.z);

// const blendMap ... removed with postprocessing
// const kernelMap ... removed with postprocessing

const toneMap: Record<string, THREE.ToneMapping> = {
  None: THREE.NoToneMapping,
  Linear: THREE.LinearToneMapping,
  Reinhard: THREE.ReinhardToneMapping,
  Cineon: THREE.CineonToneMapping,
  ACESFilmic: THREE.ACESFilmicToneMapping,
};

const shadowMapType: Record<string, THREE.ShadowMapType> = {
  Basic: THREE.BasicShadowMap,
  PCF: THREE.PCFShadowMap,
  PCFSoft: THREE.PCFSoftShadowMap,
};

export const WorldEffects: React.FC = () => {
  const env = useEnvironment();
  const bloom = useBloom();
  const dof = useDoF();
  const fog = useFog();
  const renderer = useRendererSettings();
  const { gl, scene } = useThree();

  // Update renderer settings when they change
  useEffect(() => {
  // three newer versions removed physicallyCorrectLights; keep for compatibility
  // @ts-ignore - property may not exist in current three typings
    if ('physicallyCorrectLights' in gl) gl.physicallyCorrectLights = renderer.physicallyCorrectLights as any;
    gl.toneMapping = toneMap[renderer.toneMapping] ?? THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = renderer.exposure;
    gl.shadowMap.enabled = renderer.shadows;
    gl.shadowMap.type = shadowMapType[renderer.shadowType] ?? THREE.PCFSoftShadowMap;
  }, [gl, renderer]);

  const fogColor = useMemo(() => toThreeColor(fog.color), [fog.color.x, fog.color.y, fog.color.z]);

  // Ensure scene fog cleans up when switching types
  useEffect(() => {
    return () => {
      scene.fog = null;
    };
  }, [scene]);

  return (
    <>
      {/* Environment */}
      {env !== 'none' && <Environment preset={env as any} />}

      {/* Fog */}
      {fog.type === 'linear' && (
        <fog attach="fog" args={[fogColor, fog.near, fog.far]} />
      )}
      {fog.type === 'exp2' && (
        // @ts-ignore - fogExp2 is valid in R3F jsx
        <fogExp2 attach="fog" args={[fogColor, fog.density]} />
      )}

  {/* Postprocessing disabled for WebGPU: EffectComposer/Bloom/DepthOfField removed */}
    </>
  );
};

export default WorldEffects;

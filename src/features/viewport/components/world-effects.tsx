"use client";

import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
// Postprocessing is not WebGPU compatible in this setup; disable for now
import * as THREE from 'three/webgpu';
import { useBloom, useDoF, useEnvironment, useFog, useRendererSettings } from '@/stores/world-store';
// three WebGPU postprocessing via TSL
import { pass } from 'three/tsl';
import { bloom as bloomNode } from 'three/addons/tsl/display/BloomNode.js';

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
  const { gl, scene, camera } = useThree();

  // Post-processing refs
  const postRef = useRef<THREE.PostProcessing | null>(null);
  const bloomRef = useRef<any>(null);
  const scenePassColorRef = useRef<any>(null);

  // Update renderer settings when they change
  useEffect(() => {
  // three newer versions removed physicallyCorrectLights; keep for compatibility
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

  // Setup/teardown WebGPU bloom post-processing
  useEffect(() => {
    // Tear down any previous chain first
    if (postRef.current && typeof (postRef.current as any).dispose === 'function') {
      try { (postRef.current as any).dispose(); } catch {}
    }
    postRef.current = null;
    bloomRef.current = null;
    scenePassColorRef.current = null;

  if (!bloom.enabled) return;
  // Only available with WebGPU renderer
  if (!(gl as any)?.isWebGPURenderer) return;

    try {
      const post = new (THREE as any).PostProcessing(gl as any);
      // Build a scene pass and add bloom on top of the color output
      const scenePass = pass(scene as any, camera as any);
      const scenePassColor = (scenePass as any).getTextureNode('output');
      const bloomPass = bloomNode(scenePassColor);

      // Initial params
      if (bloomPass.threshold) bloomPass.threshold.value = bloom.luminanceThreshold;
      if (bloomPass.strength) bloomPass.strength.value = bloom.intensity;
      if (bloomPass.radius) bloomPass.radius.value = Math.max(0, Math.min(1, bloom.luminanceSmoothing));

      // Compose and assign
      post.outputNode = (scenePassColor as any).add(bloomPass);

      postRef.current = post;
      bloomRef.current = bloomPass;
      scenePassColorRef.current = scenePassColor;
    } catch (e) {
      // If anything goes wrong, disable gracefully
      if (postRef.current && typeof (postRef.current as any).dispose === 'function') {
        try { (postRef.current as any).dispose(); } catch {}
      }
      postRef.current = null;
      bloomRef.current = null;
      scenePassColorRef.current = null;
      // eslint-disable-next-line no-console
      console.warn('Bloom postprocessing init failed:', e);
    }
    return () => {
      if (postRef.current && typeof (postRef.current as any).dispose === 'function') {
        try { (postRef.current as any).dispose(); } catch {}
      }
      postRef.current = null;
      bloomRef.current = null;
      scenePassColorRef.current = null;
    };
  }, [gl, scene, camera, bloom.enabled]);

  // React to bloom parameter changes
  useEffect(() => {
    const bp: any = bloomRef.current;
    if (!bp) return;
    if (bp.threshold) bp.threshold.value = bloom.luminanceThreshold;
    if (bp.strength) bp.strength.value = bloom.intensity;
    if (bp.radius) bp.radius.value = Math.max(0, Math.min(1, bloom.luminanceSmoothing));
  }, [bloom.intensity, bloom.luminanceThreshold, bloom.luminanceSmoothing]);

  // Drive post-processing each frame (after the default r3f render)
  useFrame(() => {
    if (postRef.current) {
      postRef.current.render();
    } else {
      // Fallback: if no postprocessing chain is active, ensure the renderer still draws the scene.
      // In some WebGPU setups the default React-Three-Fiber render path can be bypassed; call render explicitly.
      try {
        (gl as any).render(scene as any, camera as any);
      } catch (e) {
        // ignore render errors here
      }
    }
  }, 1);

  return (
    <>
      {/* Environment */}
      {env !== 'none' && <Environment preset={env as any} />}

      {/* Fog */}
      {fog.type === 'linear' && (
        <fog attach="fog" args={[fogColor, fog.near, fog.far]} />
      )}
      {fog.type === 'exp2' && (
        <fogExp2 attach="fog" args={[fogColor, fog.density]} />
      )}

  {/* WebGPU post-processing is driven via useFrame above. */}
    </>
  );
};

export default WorldEffects;

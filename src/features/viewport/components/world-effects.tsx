"use client";

import React, { Fragment, useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import { EffectComposer, Bloom, DepthOfField } from '@react-three/postprocessing';
import { BlendFunction, KernelSize, Resolution } from 'postprocessing';
import * as THREE from 'three';
import { useBloom, useDoF, useEnvironment, useFog, useRendererSettings } from '@/stores/world-store';

const toThreeColor = (rgb: { x: number; y: number; z: number }) => new THREE.Color(rgb.x, rgb.y, rgb.z);

const blendMap: Record<string, BlendFunction> = {
  NORMAL: BlendFunction.NORMAL,
  SCREEN: BlendFunction.SCREEN,
  ADD: BlendFunction.ADD,
  MULTIPLY: BlendFunction.MULTIPLY,
  OVERLAY: BlendFunction.OVERLAY,
  SOFT_LIGHT: BlendFunction.SOFT_LIGHT,
  DARKEN: BlendFunction.DARKEN,
  LIGHTEN: BlendFunction.LIGHTEN,
  COLOR_DODGE: BlendFunction.COLOR_DODGE,
  COLOR_BURN: BlendFunction.COLOR_BURN,
  HARD_LIGHT: BlendFunction.HARD_LIGHT,
  DIFFERENCE: BlendFunction.DIFFERENCE,
  EXCLUSION: BlendFunction.EXCLUSION,
  HUE: BlendFunction.HUE,
  SATURATION: BlendFunction.SATURATION,
  COLOR: BlendFunction.COLOR,
  LUMINOSITY: BlendFunction.LUMINOSITY,
  ALPHA: BlendFunction.ALPHA,
  NEGATION: BlendFunction.NEGATION,
  SUBTRACT: BlendFunction.SUBTRACT,
  DIVIDE: BlendFunction.DIVIDE,
  VIVID_LIGHT: BlendFunction.VIVID_LIGHT,
};

const kernelMap: Record<string, KernelSize> = {
  VERY_SMALL: KernelSize.VERY_SMALL,
  SMALL: KernelSize.SMALL,
  MEDIUM: KernelSize.MEDIUM,
  LARGE: KernelSize.LARGE,
  HUGE: KernelSize.HUGE,
};

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

      {/* Postprocessing */}
      {bloom.enabled || dof.enabled ? (
        <EffectComposer>
          <Fragment>
            {bloom.enabled ? (
              <Bloom
                intensity={bloom.intensity}
                luminanceThreshold={bloom.luminanceThreshold}
                luminanceSmoothing={bloom.luminanceSmoothing}
                mipmapBlur={bloom.mipmapBlur}
                kernelSize={kernelMap[bloom.kernelSize]}
                resolutionX={bloom.resolutionX || Resolution.AUTO_SIZE}
                resolutionY={bloom.resolutionY || Resolution.AUTO_SIZE}
                blendFunction={blendMap[bloom.blendFunction]}
              />
            ) : null}
            {dof.enabled ? (
              <DepthOfField
                focusDistance={dof.focusDistance}
                focalLength={dof.focalLength}
                bokehScale={dof.bokehScale}
                blendFunction={blendMap[dof.blendFunction]}
              />
            ) : null}
          </Fragment>
        </EffectComposer>
      ) : null}
    </>
  );
};

export default WorldEffects;

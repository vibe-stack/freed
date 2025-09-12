"use client";

import React, { useEffect, useMemo, useRef } from 'react';
import { useSceneStore } from '@/stores/scene-store';
import MeshView from './mesh-view';
import TerrainView from '@/features/viewport/components/terrain-view';
import ParticleSystemNode from '@/features/particles/components/particle-system-node';
// Local relative import (avoids occasional path alias resolution issues in some build modes)
import FluidSystemNode from './fluid-system-node';
import { useToolStore } from '@/stores/tool-store';
import {
  Color,
  CameraHelper,
  DirectionalLightHelper,
  PointLightHelper,
  SpotLightHelper,
  DirectionalLight,
  SpotLight,
  PointLight,
  PerspectiveCamera,
  OrthographicCamera,
  Group,
} from 'three/webgpu';
import { useHelper } from '@react-three/drei';
import { useViewportStore } from '@/stores/viewport-store';
import { useCameraResource } from '@/stores/geometry-store';
import { registerCamera, unregisterCamera } from '../hooks/camera-registry';
import { registerObject3D, unregisterObject3D } from '../hooks/object3d-registry';
import { useAnimationStore } from '@/stores/animation-store';
import ForceFieldNode from './force-field-node';
// Light helper wrappers
const DirectionalLightNode: React.FC<{ color: Color; intensity: number }> = ({ color, intensity }) => {
  const ref = useRef<DirectionalLight>(null!);
  // @ts-expect-error helper typing is overly strict in our env
  useHelper(ref as unknown as never, DirectionalLightHelper as unknown as never);
  return <directionalLight ref={ref} color={color} intensity={intensity} />;
};

const DirectionalLightBare: React.FC<{ color: Color; intensity: number }> = ({ color, intensity }) => {
  const ref = useRef<DirectionalLight>(null!);
  useEffect(() => {
    const l = ref.current;
    if (!l) return;
    l.castShadow = true;
    l.shadow.mapSize.set(2048, 2048);
    // A tiny negative bias and a higher normalBias reduce self-shadowing (acne)
    l.shadow.bias = -0.0001;
    l.shadow.normalBias = 0.07;
    // Slight blur for PCFSoft
    l.shadow.radius = 2;
    // Tighter shadow camera helps reduce acne and peter-panning
    const cam = l.shadow.camera as any;
    if (cam) {
      cam.near = 1.0;
      cam.far = 200;
      if ('left' in cam) {
        cam.left = -30;
        cam.right = 30;
        cam.top = 30;
        cam.bottom = -30;
      }
      cam.updateProjectionMatrix?.();
    }
  }, []);
  return <directionalLight ref={ref} color={color} intensity={intensity} castShadow />;
};

const SpotLightNode: React.FC<{
  color: Color;
  intensity: number;
  distance: number;
  angle: number;
  penumbra: number;
  decay: number;
}> = ({ color, intensity, distance, angle, penumbra, decay }) => {
  const ref = useRef<SpotLight>(null!);
  // @ts-expect-error helper typing is overly strict in our env
  useHelper(ref as unknown as never, SpotLightHelper as unknown as never);
  return (
    <spotLight ref={ref} color={color} intensity={intensity} distance={distance} angle={angle} penumbra={penumbra} decay={decay} />
  );
};

const SpotLightBare: React.FC<{
  color: Color;
  intensity: number;
  distance: number;
  angle: number;
  penumbra: number;
  decay: number;
}> = ({ color, intensity, distance, angle, penumbra, decay }) => {
  const ref = useRef<SpotLight>(null!);
  useEffect(() => {
    const l = ref.current;
    if (!l) return;
    l.castShadow = true;
    l.shadow.mapSize.set(2048, 2048);
    l.shadow.bias = -0.0001;
    l.shadow.normalBias = 0.07;
    l.shadow.radius = 2;
    const cam = l.shadow.camera as any;
    if (cam) {
      cam.near = 0.1;
      cam.far = Math.max(50, l.distance || 50);
      cam.updateProjectionMatrix?.();
    }
  }, []);
  return (
    <spotLight
      ref={ref}
      color={color}
      intensity={intensity}
      distance={distance}
      angle={angle}
      penumbra={penumbra}
      decay={decay}
      castShadow
    />
  );
};

const PointLightNode: React.FC<{ color: Color; intensity: number; distance: number; decay: number }>
  = ({ color, intensity, distance, decay }) => {
    const ref = useRef<PointLight>(null!);
    // @ts-expect-error helper typing is overly strict in our env
    useHelper(ref as unknown as never, PointLightHelper as unknown as never);
    return <pointLight ref={ref} color={color} intensity={intensity} distance={distance} decay={decay} />;
  };

const PointLightBare: React.FC<{ color: Color; intensity: number; distance: number; decay: number }>
  = ({ color, intensity, distance, decay }) => {
    const ref = useRef<PointLight>(null!);
    useEffect(() => {
      const l = ref.current;
      if (!l) return;
      l.castShadow = true;
      l.shadow.mapSize.set(1024, 1024);
      l.shadow.bias = -0.0002;
      l.shadow.normalBias = 0.05;
      l.shadow.radius = 2;
    }, []);
    return <pointLight ref={ref} color={color} intensity={intensity} distance={distance} decay={decay} castShadow />;
  };

// Ambient has no helper in three; a simple wrapper to place the actual ambient light
const AmbientLightNode: React.FC<{ color: Color; intensity: number }> = ({ color, intensity }) => {
  return <ambientLight color={color} intensity={intensity} />;
};

// Visual helper for editor when not in material shading (small emissive sphere)
const AmbientLightHelper: React.FC<{ color: Color }> = ({ color }) => {
  // simple visual indicator; doesn't emit light
  return (
    <mesh>
      <sphereGeometry args={[0.08, 8, 8]} />
      <meshBasicMaterial color={color} />
    </mesh>
  );
};

// RectAreaLight removed for WebGPU compatibility

// Camera helper wrappers
const PerspectiveCameraNode: React.FC<{ objectId?: string; fov: number; near: number; far: number; zoom?: number; focus?: number; filmGauge?: number; filmOffset?: number }>
  = ({ objectId, fov, near, far, zoom = 1, focus = 10, filmGauge = 35, filmOffset = 0 }) => {
    const ref = useRef<PerspectiveCamera>(null!);
    useEffect(() => {
      if (!objectId) return;
      const c = ref.current;
      registerCamera(objectId, c);
      return () => unregisterCamera(objectId, c);
    }, [objectId]);
    // Ensure projection matrix updates when camera props change
    useEffect(() => {
      const c = ref.current;
      if (!c) return;
      c.fov = fov;
      c.near = near;
      c.far = far;
      c.zoom = zoom;
      // focus/film params also affect projection in three
      (c as PerspectiveCamera).focus = focus;
      (c as PerspectiveCamera).filmGauge = filmGauge;
      (c as PerspectiveCamera).filmOffset = filmOffset;
      c.updateProjectionMatrix();
    }, [fov, near, far, zoom, focus, filmGauge, filmOffset]);
    // @ts-expect-error helper typing is overly strict in our env
    useHelper(ref as unknown as never, CameraHelper as unknown as never);
    return <perspectiveCamera ref={ref} fov={fov} near={near} far={far} zoom={zoom} focus={focus} filmGauge={filmGauge} filmOffset={filmOffset} />;
  };

const PerspectiveCameraBare: React.FC<{ objectId?: string; fov: number; near: number; far: number; zoom?: number; focus?: number; filmGauge?: number; filmOffset?: number }>
  = ({ objectId, fov, near, far, zoom = 1, focus = 10, filmGauge = 35, filmOffset = 0 }) => {
    const ref = useRef<PerspectiveCamera>(null!);
    useEffect(() => {
      if (!objectId) return;
      const c = ref.current;
      registerCamera(objectId, c);
      return () => unregisterCamera(objectId, c);
    }, [objectId]);
    useEffect(() => {
      const c = ref.current;
      if (!c) return;
      c.fov = fov;
      c.near = near;
      c.far = far;
      c.zoom = zoom;
      (c as PerspectiveCamera).focus = focus;
      (c as PerspectiveCamera).filmGauge = filmGauge;
      (c as PerspectiveCamera).filmOffset = filmOffset;
      c.updateProjectionMatrix();
    }, [fov, near, far, zoom, focus, filmGauge, filmOffset]);
    return <perspectiveCamera ref={ref} fov={fov} near={near} far={far} zoom={zoom} focus={focus} filmGauge={filmGauge} filmOffset={filmOffset} />;
  };

const OrthographicCameraNode: React.FC<{ objectId?: string; left: number; right: number; top: number; bottom: number; near: number; far: number; zoom?: number }>
  = ({ objectId, left, right, top, bottom, near, far, zoom = 1 }) => {
    const ref = useRef<OrthographicCamera>(null!);
    useEffect(() => {
      if (!objectId) return;
      const c = ref.current;
      registerCamera(objectId, c);
      return () => unregisterCamera(objectId, c);
    }, [objectId]);
    useEffect(() => {
      const c = ref.current;
      if (!c) return;
      c.left = left;
      c.right = right;
      c.top = top;
      c.bottom = bottom;
      c.near = near;
      c.far = far;
      c.zoom = zoom;
      c.updateProjectionMatrix();
    }, [left, right, top, bottom, near, far, zoom]);
    // @ts-expect-error helper typing is overly strict in our env
    useHelper(ref as unknown as never, CameraHelper as unknown as never);
    return <orthographicCamera ref={ref} left={left} right={right} top={top} bottom={bottom} near={near} far={far} zoom={zoom} />;
  };

const OrthographicCameraBare: React.FC<{ objectId?: string; left: number; right: number; top: number; bottom: number; near: number; far: number; zoom?: number }>
  = ({ objectId, left, right, top, bottom, near, far, zoom = 1 }) => {
    const ref = useRef<OrthographicCamera>(null!);
    useEffect(() => {
      if (!objectId) return;
      const c = ref.current;
      registerCamera(objectId, c);
      return () => unregisterCamera(objectId, c);
    }, [objectId]);
    useEffect(() => {
      const c = ref.current;
      if (!c) return;
      c.left = left;
      c.right = right;
      c.top = top;
      c.bottom = bottom;
      c.near = near;
      c.far = far;
      c.zoom = zoom;
      c.updateProjectionMatrix();
    }, [left, right, top, bottom, near, far, zoom]);
    return <orthographicCamera ref={ref} left={left} right={right} top={top} bottom={bottom} near={near} far={far} zoom={zoom} />;
  };


type Props = { objectId: string };

const CameraObjectNode: React.FC<{ objectId: string; cameraId: string; isMaterial: boolean }>
  = ({ objectId, cameraId, isMaterial }) => {
    const camRes = useCameraResource(cameraId);
    if (!camRes) return null;
    if (camRes.type === 'perspective') {
      return isMaterial ? (
        <PerspectiveCameraBare
          objectId={objectId}
          fov={camRes.fov ?? 50}
          near={camRes.near}
          far={camRes.far}
          zoom={camRes.zoom ?? 1}
          focus={camRes.focus ?? 10}
          filmGauge={camRes.filmGauge ?? 35}
          filmOffset={camRes.filmOffset ?? 0}
        />
      ) : (
        <PerspectiveCameraNode
          objectId={objectId}
          fov={camRes.fov ?? 50}
          near={camRes.near}
          far={camRes.far}
          zoom={camRes.zoom ?? 1}
          focus={camRes.focus ?? 10}
          filmGauge={camRes.filmGauge ?? 35}
          filmOffset={camRes.filmOffset ?? 0}
        />
      );
    }
    return isMaterial ? (
      <OrthographicCameraBare
        objectId={objectId}
        left={camRes.left ?? -1}
        right={camRes.right ?? 1}
        top={camRes.top ?? 1}
        bottom={camRes.bottom ?? -1}
        near={camRes.near}
        far={camRes.far}
        zoom={camRes.zoom ?? 1}
      />
    ) : (
      <OrthographicCameraNode
        objectId={objectId}
        left={camRes.left ?? -1}
        right={camRes.right ?? 1}
        top={camRes.top ?? 1}
        bottom={camRes.bottom ?? -1}
        near={camRes.near}
        far={camRes.far}
        zoom={camRes.zoom ?? 1}
      />
    );
  };

const ObjectNode: React.FC<Props> = ({ objectId }) => {
  const scene = useSceneStore();
  const obj = scene.objects[objectId];
  const shading = useViewportStore((s) => s.shadingMode);
  const tool = useToolStore();
  const playing = useAnimationStore((s) => s.playing);
  // Determine if this object is driven by any transform tracks in the active clip
  const isDrivenByAnim = useAnimationStore((s) => {
    const clip = s.activeClipId ? s.clips[s.activeClipId] : null;
    if (!clip) return false;
    const solo = s.soloTrackIds;
    for (const tid of clip.trackIds) {
      if (solo.size > 0 && !solo.has(tid)) continue;
      const tr = s.tracks[tid];
      if (!tr || tr.muted) continue;
      if (tr.targetType !== 'sceneObject') continue;
      if (tr.targetId !== objectId) continue;
      // Any of position/rotation/scale component qualifies
      const p = tr.property as string;
      if (p.startsWith('position') || p.startsWith('rotation') || p.startsWith('scale')) return true;
    }
    return false;
  });

  const groupRef = useRef<Group>(null!);
  useEffect(() => {
    const g = groupRef.current;
    if (!g) return;
    registerObject3D(objectId, g);
    return () => unregisterObject3D(objectId, g);
  }, [objectId]);

  // Use live local transforms during active object tools for preview
  const t = useMemo(() => {
    if (!obj) return null;
    if (tool.isActive && tool.localData && tool.localData.kind === 'object-transform') {
      const lt = tool.localData.transforms[objectId];
      if (lt) return lt;
    }
    return obj.transform;
  }, [tool.isActive, tool.localData, objectId, obj]);

  if (!obj || !t) return null;

  // While playing, only skip transform props if animation is actively driving this object.
  // Otherwise, keep applying the scene transform so non-animated objects don't reset.
  const transformProps = (playing && isDrivenByAnim)
    ? {}
    : {
      position: [t.position.x, t.position.y, t.position.z] as [number, number, number],
      rotation: [t.rotation.x, t.rotation.y, t.rotation.z] as [number, number, number],
      scale: [t.scale.x, t.scale.y, t.scale.z] as [number, number, number],
    };

  return (
    <group ref={groupRef} visible={obj.visible} {...transformProps} userData={{ ...((groupRef.current?.userData as any) ?? {}), sceneObjectId: objectId }}>
  { (obj.type === 'mesh' || obj.type === 'text') && <MeshView objectId={objectId} noTransform /> }
  { obj.type === 'terrain' && <TerrainView objectId={objectId} noTransform /> }
      {obj.type === 'particles' && obj.particleSystemId && (
        <ParticleSystemNode objectId={objectId} systemId={obj.particleSystemId} />
      )}
      {obj.type === 'fluid' && obj.fluidSystemId && (
        <FluidSystemNode objectId={objectId} systemId={obj.fluidSystemId} />
      )}
      {obj.type === 'light' && obj.lightId && (() => {
        const light = scene.lights[obj.lightId!];
        if (!light) return null;
        const color = new Color(light.color.x, light.color.y, light.color.z);
        const isMaterial = (shading as unknown as string) === 'material';
        switch (light.type) {
          case 'directional':
            return isMaterial
              ? <DirectionalLightBare color={color} intensity={light.intensity} />
              : <DirectionalLightNode color={color} intensity={0} />;
          case 'ambient':
            return isMaterial
              ? <AmbientLightNode color={color} intensity={light.intensity} />
              : <AmbientLightHelper color={color} />;
          case 'spot':
            return (
              isMaterial ? (
                <SpotLightBare
                  color={color}
                  intensity={light.intensity}
                  distance={light.distance ?? 0}
                  angle={light.angle ?? Math.PI / 6}
                  penumbra={light.penumbra ?? 0}
                  decay={light.decay ?? 2}
                />
              ) : (
                <SpotLightNode
                  color={color}
                  intensity={0}
                  distance={light.distance ?? 0}
                  angle={light.angle ?? Math.PI / 6}
                  penumbra={light.penumbra ?? 0}
                  decay={light.decay ?? 2}
                />
              )
            );
          case 'point':
          default:
            return (
              isMaterial ? (
                <PointLightBare color={color} intensity={light.intensity} distance={light.distance ?? 0} decay={light.decay ?? 2} />
              ) : (
                <PointLightNode color={color} intensity={0} distance={light.distance ?? 0} decay={light.decay ?? 2} />
              )
            );
        }
      })()}
      {obj.type === 'camera' && obj.cameraId && (
        <CameraObjectNode objectId={objectId} cameraId={obj.cameraId!} isMaterial={(shading as unknown as string) === 'material'} />
      )}
      {obj.type === 'force' && obj.forceFieldId && (
        <ForceFieldNode fieldId={obj.forceFieldId} />
      )}
      {obj.children.map((cid) => (
        <ObjectNode key={cid} objectId={cid} />
      ))}
    </group>
  );
};


export default ObjectNode;

"use client";

import React, { useEffect, useMemo, useRef } from 'react';
import { useSceneStore } from '@/stores/scene-store';
import MeshView from './mesh-view';
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
} from 'three';
import { useHelper } from '@react-three/drei';
import { useViewportStore } from '@/stores/viewport-store';
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

// RectAreaLight removed for WebGPU compatibility

// Camera helper wrappers
const PerspectiveCameraNode: React.FC<{ fov: number; near: number; far: number }>
  = ({ fov, near, far }) => {
    const ref = useRef<PerspectiveCamera>(null!);
  // @ts-expect-error helper typing is overly strict in our env
  useHelper(ref as unknown as never, CameraHelper as unknown as never);
    return <perspectiveCamera ref={ref} fov={fov} near={near} far={far} />;
  };

const PerspectiveCameraBare: React.FC<{ fov: number; near: number; far: number }>
  = ({ fov, near, far }) => {
    const ref = useRef<PerspectiveCamera>(null!);
    return <perspectiveCamera ref={ref} fov={fov} near={near} far={far} />;
  };

const OrthographicCameraNode: React.FC<{ left: number; right: number; top: number; bottom: number; near: number; far: number }>
  = ({ left, right, top, bottom, near, far }) => {
    const ref = useRef<OrthographicCamera>(null!);
  // @ts-expect-error helper typing is overly strict in our env
  useHelper(ref as unknown as never, CameraHelper as unknown as never);
    return <orthographicCamera ref={ref} left={left} right={right} top={top} bottom={bottom} near={near} far={far} />;
  };

const OrthographicCameraBare: React.FC<{ left: number; right: number; top: number; bottom: number; near: number; far: number }>
  = ({ left, right, top, bottom, near, far }) => {
    const ref = useRef<OrthographicCamera>(null!);
    return <orthographicCamera ref={ref} left={left} right={right} top={top} bottom={bottom} near={near} far={far} />;
  };


type Props = { objectId: string };

const ObjectNode: React.FC<Props> = ({ objectId }) => {
  const scene = useSceneStore();
  const obj = scene.objects[objectId];
  const shading = useViewportStore((s) => s.shadingMode);
  const tool = useToolStore();

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

  return (
    <group
      position={[t.position.x, t.position.y, t.position.z]}
      rotation={[t.rotation.x, t.rotation.y, t.rotation.z]}
      scale={[t.scale.x, t.scale.y, t.scale.z]}
      visible={obj.visible}
    >
    {obj.type === 'mesh' && <MeshView objectId={objectId} noTransform />}
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
  {obj.type === 'camera' && obj.cameraId && (() => {
        const camRes = scene.cameras[obj.cameraId!];
        if (!camRes) return null;
        const isMaterial = (shading as unknown as string) === 'material';
        if (camRes.type === 'perspective') {
          return isMaterial
            ? <PerspectiveCameraBare fov={camRes.fov ?? 50} near={camRes.near} far={camRes.far} />
            : <PerspectiveCameraNode fov={camRes.fov ?? 50} near={camRes.near} far={camRes.far} />;
        }
        return isMaterial
          ? (
            <OrthographicCameraBare
              left={camRes.left ?? -1}
              right={camRes.right ?? 1}
              top={camRes.top ?? 1}
              bottom={camRes.bottom ?? -1}
              near={camRes.near}
              far={camRes.far}
            />
          ) : (
            <OrthographicCameraNode
              left={camRes.left ?? -1}
              right={camRes.right ?? 1}
              top={camRes.top ?? 1}
              bottom={camRes.bottom ?? -1}
              near={camRes.near}
              far={camRes.far}
            />
          );
      })()}
      {obj.children.map((cid) => (
        <ObjectNode key={cid} objectId={cid} />
      ))}
    </group>
  );
};

export default ObjectNode;

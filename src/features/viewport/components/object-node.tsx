"use client";

import React, { useMemo, useRef } from 'react';
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
  RectAreaLight,
  PerspectiveCamera,
  OrthographicCamera,
} from 'three';
import { RectAreaLightHelper } from 'three/examples/jsm/helpers/RectAreaLightHelper.js';
import { useHelper } from '@react-three/drei';
import { useViewportStore } from '@/stores/viewport-store';
// Light helper wrappers
const DirectionalLightNode: React.FC<{ color: Color; intensity: number }> = ({ color, intensity }) => {
  const ref = useRef<DirectionalLight>(null!);
  // @ts-ignore - helper typing is overly strict in our env
  useHelper(ref as any, DirectionalLightHelper as any);
  return <directionalLight ref={ref} color={color} intensity={intensity} />;
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
  // @ts-ignore - helper typing is overly strict in our env
  useHelper(ref as any, SpotLightHelper as any);
  return (
    <spotLight ref={ref} color={color} intensity={intensity} distance={distance} angle={angle} penumbra={penumbra} decay={decay} />
  );
};

const PointLightNode: React.FC<{ color: Color; intensity: number; distance: number; decay: number }>
  = ({ color, intensity, distance, decay }) => {
    const ref = useRef<PointLight>(null!);
  // @ts-ignore - helper typing is overly strict in our env
  useHelper(ref as any, PointLightHelper as any);
    return <pointLight ref={ref} color={color} intensity={intensity} distance={distance} decay={decay} />;
  };

const RectAreaLightNode: React.FC<{ color: Color; intensity: number; width: number; height: number }>
  = ({ color, intensity, width, height }) => {
    const ref = useRef<RectAreaLight>(null!);
  // @ts-ignore - helper typing is overly strict in our env
  useHelper(ref as any, RectAreaLightHelper as any);
    return <rectAreaLight ref={ref} color={color} intensity={intensity} width={width} height={height} />;
  };

// Camera helper wrappers
const PerspectiveCameraNode: React.FC<{ fov: number; near: number; far: number }>
  = ({ fov, near, far }) => {
    const ref = useRef<PerspectiveCamera>(null!);
  // @ts-ignore - helper typing is overly strict in our env
  useHelper(ref as any, CameraHelper as any);
    return <perspectiveCamera ref={ref} fov={fov} near={near} far={far} />;
  };

const OrthographicCameraNode: React.FC<{ left: number; right: number; top: number; bottom: number; near: number; far: number }>
  = ({ left, right, top, bottom, near, far }) => {
    const ref = useRef<OrthographicCamera>(null!);
  // @ts-ignore - helper typing is overly strict in our env
  useHelper(ref as any, CameraHelper as any);
    return <orthographicCamera ref={ref} left={left} right={right} top={top} bottom={bottom} near={near} far={far} />;
  };


type Props = { objectId: string };

const ObjectNode: React.FC<Props> = ({ objectId }) => {
  const scene = useSceneStore();
  const obj = scene.objects[objectId];
  if (!obj) return null;
  const shading = useViewportStore((s) => s.shadingMode);

  // Use live local transforms during active object tools for preview
  const tool = useToolStore();
  const t = useMemo(() => {
    if (tool.isActive && tool.localData && tool.localData.kind === 'object-transform') {
      const lt = tool.localData.transforms[objectId];
      if (lt) return lt;
    }
    return obj.transform;
  }, [tool.isActive, tool.localData, objectId, obj.transform]);

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
        const active = shading === 'material';
        switch (light.type) {
          case 'directional':
            return <DirectionalLightNode color={color} intensity={active ? light.intensity : 0} />;
          case 'spot':
            return (
              <SpotLightNode
                color={color}
                intensity={active ? light.intensity : 0}
                distance={light.distance ?? 0}
                angle={light.angle ?? Math.PI / 6}
                penumbra={light.penumbra ?? 0}
                decay={light.decay ?? 2}
              />
            );
          case 'rectarea':
            return (
              <RectAreaLightNode
                color={color}
                intensity={active ? light.intensity : 0}
                width={light.width ?? 1}
                height={light.height ?? 1}
              />
            );
          case 'point':
          default:
            return (
              <PointLightNode
                color={color}
                intensity={active ? light.intensity : 0}
                distance={light.distance ?? 0}
                decay={light.decay ?? 2}
              />
            );
        }
      })()}
  {obj.type === 'camera' && obj.cameraId && (() => {
        const camRes = scene.cameras[obj.cameraId!];
        if (!camRes) return null;
        if (camRes.type === 'perspective') {
          return <PerspectiveCameraNode fov={camRes.fov ?? 50} near={camRes.near} far={camRes.far} />;
        }
        return (
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

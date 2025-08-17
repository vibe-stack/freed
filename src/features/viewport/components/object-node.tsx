"use client";

import React, { useMemo } from 'react';
import { useSceneStore } from '@/stores/scene-store';
import MeshView from './mesh-view';
import { useToolStore } from '@/stores/tool-store';
import { Color } from 'three';

type Props = { objectId: string };

const ObjectNode: React.FC<Props> = ({ objectId }) => {
  const scene = useSceneStore();
  const obj = scene.objects[objectId];
  if (!obj) return null;

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
        switch (light.type) {
          case 'directional':
            return <directionalLight color={color} intensity={light.intensity} />;
          case 'spot':
            return (
              <spotLight
                color={color}
                intensity={light.intensity}
                distance={light.distance ?? 0}
                angle={light.angle ?? Math.PI / 6}
                penumbra={light.penumbra ?? 0}
                decay={light.decay ?? 2}
              />
            );
          case 'rectarea':
            return (
              <rectAreaLight
                color={color}
                intensity={light.intensity}
                width={light.width ?? 1}
                height={light.height ?? 1}
              />
            );
          case 'point':
          default:
            return (
              <pointLight
                color={color}
                intensity={light.intensity}
                distance={light.distance ?? 0}
                decay={light.decay ?? 2}
              />
            );
        }
      })()}
      {obj.type === 'camera' && (
        // Render a simple helper cone/frustum placeholder
        <mesh>
          <coneGeometry args={[0.1, 0.2, 8]} />
          <meshBasicMaterial color={0x88ccff} wireframe />
        </mesh>
      )}
      {obj.children.map((cid) => (
        <ObjectNode key={cid} objectId={cid} />
      ))}
    </group>
  );
};

export default ObjectNode;

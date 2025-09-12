'use client';

import React, { useMemo, useRef } from 'react';
import { Raycaster, Intersection, Mesh } from 'three/webgpu';
import { useSceneStore } from '@/stores/scene-store';
import { useGeometryStore } from '@/stores/geometry-store';
import { useTerrainStore } from '@/stores/terrain-store';
import { useViewportStore } from '@/stores/viewport-store';
import useGeometryAndMaterial from '../hooks/useGeometryAndMaterial';
import useShaderMaterialRenderer from './use-shader-material-renderer';
import { createNormalDataTexture } from '@/utils/terrain/three-texture';

// Dedicated Terrain renderer: same as MeshView but always applies terrain maps
// and forces appropriate material flags.

type Props = { objectId: string; noTransform?: boolean };

const TerrainView: React.FC<Props> = ({ objectId, noTransform = false }) => {
  const scene = useSceneStore();
  const geometryStore = useGeometryStore();
  const terrains = useTerrainStore((s) => s.terrains);
  const shading = useViewportStore((s) => s.shadingMode);

  const obj = scene.objects[objectId];
  const mesh = obj?.meshId ? geometryStore.meshes.get(obj.meshId) : undefined;

  const isSelected = false; // selection color not used for terrains

  const geomAndMat = useGeometryAndMaterial({ displayMesh: mesh, shading, isSelected, materials: geometryStore.materials });
  const activeMaterial = useShaderMaterialRenderer({ displayMesh: mesh, shading, isSelected, materials: geometryStore.materials });

  const downRef = useRef<{ x: number; y: number; id: string } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    // Don't block orbit; only use for selection
    downRef.current = { x: e.clientX, y: e.clientY, id: objectId };
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const start = downRef.current; downRef.current = null;
    if (!start) return;
    const dx = e.clientX - start.x; const dy = e.clientY - start.y;
    const dist = Math.hypot(dx, dy);
    const same = start.id === objectId;
    if (!same || dist > 10) return;
    e.stopPropagation();
    scene.selectObject(objectId);
  };

  // Terrain should be rendered even in non-material shading (except wireframe)
  const material = useMemo(() => {
    const m: any = activeMaterial;
    // Ensure receives shadows by default
    try { m.shadowSide = 1; } catch {}
    
    // Only attach terrain normal map in smooth shading mode and non-wireframe
    if (shading !== 'wireframe' && mesh?.id && mesh?.shading === 'smooth') {
      const terrain = Object.values(terrains).find((t: any) => t.meshId === mesh.id);
      const nrm = terrain?.maps?.normal;
      const texW = terrain?.textureResolution?.width;
      const texH = terrain?.textureResolution?.height;
      if (nrm && texW && texH) {
        try {
          const nrmTex = createNormalDataTexture(nrm, texW, texH);
          m.normalMap = nrmTex;
        } catch {}
      }
    } else {
      // Clear normal map for flat shading to avoid interference
      try { m.normalMap = null; } catch {}
    }
    return m;
  }, [activeMaterial, terrains, shading, mesh?.id, mesh?.shading]);

  if (!obj || !geomAndMat) return null;

  const raycastFn: ((raycaster: Raycaster, intersects: Intersection[]) => void) | undefined =
    (Mesh.prototype.raycast as unknown as (raycaster: Raycaster, intersects: Intersection[]) => void);

  const meshEl = (
    <mesh
      geometry={geomAndMat.geom}
      material={material}
      castShadow
      receiveShadow
      raycast={raycastFn}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    />
  );

  if (noTransform) return meshEl;

  const t = obj.transform;
  return (
    <group
      position={[t.position.x, t.position.y, t.position.z]}
      rotation={[t.rotation.x, t.rotation.y, t.rotation.z]}
      scale={[t.scale.x, t.scale.y, t.scale.z]}
      visible={obj.visible}
      castShadow
      receiveShadow
    >
      {meshEl}
    </group>
  );
};

export default TerrainView;

'use client';

import { useEffect, useMemo } from 'react';
import { Euler, Matrix4, Quaternion, Vector3 } from 'three/webgpu';
import { useViewportStore } from '@/stores/viewport-store';
import { useSelectionStore } from '@/stores/selection-store';
import { useSceneStore } from '@/stores/scene-store';
import { useGeometryStore } from '@/stores/geometry-store';

// Computes the center of currently selected object(s) and updates the camera target
// when auto-orbit is enabled. Designed to be subtle and only act when needed.
const AutoOrbitController: React.FC = () => {
  const autoOrbit = useViewportStore((s) => s.autoOrbitIntervalSec ?? 0);
  const setCamera = useViewportStore((s) => s.setCamera);
  const selection = useSelectionStore((s) => s.selection);
  const sceneObjects = useSceneStore((s) => s.objects);
  const meshes = useGeometryStore((s) => s.meshes);

  const selectedObjectIds = useMemo(() => {
    if (selection.viewMode === 'object' && selection.objectIds.length > 0) {
      return selection.objectIds;
    }
    // Fallback: if single selectedObjectId is used elsewhere, include it
    const sid = useSceneStore.getState().selectedObjectId;
    return sid ? [sid] : [];
  }, [selection.viewMode, selection.objectIds]);

  useEffect(() => {
    if (!autoOrbit) return; // disabled
    if (!selectedObjectIds.length) return; // nothing selected

    const min = new Vector3(Infinity, Infinity, Infinity);
    const max = new Vector3(-Infinity, -Infinity, -Infinity);
    let any = false;

    for (const oid of selectedObjectIds) {
      const obj = sceneObjects[oid];
      if (!obj || !obj.render || obj.type !== 'mesh' || !obj.meshId) continue;
      const mesh = meshes.get(obj.meshId);
      if (!mesh) continue;
      const euler = new Euler(obj.transform.rotation.x, obj.transform.rotation.y, obj.transform.rotation.z);
      const quat = new Quaternion().setFromEuler(euler);
      const scale = new Vector3(obj.transform.scale.x, obj.transform.scale.y, obj.transform.scale.z);
      const pos = new Vector3(obj.transform.position.x, obj.transform.position.y, obj.transform.position.z);
      const mat = new Matrix4().compose(pos, quat, scale);
      for (const v of mesh.vertices) {
        const p = new Vector3(v.position.x, v.position.y, v.position.z).applyMatrix4(mat);
        min.min(p); max.max(p); any = true;
      }
    }

    if (!any) return;

    const center = min.add(max).multiplyScalar(0.5);
    setCamera({ target: { x: center.x, y: center.y, z: center.z } });
  }, [autoOrbit, selectedObjectIds, sceneObjects, meshes, setCamera]);

  return null;
};

export default AutoOrbitController;

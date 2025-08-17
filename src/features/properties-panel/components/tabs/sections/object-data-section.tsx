"use client";

import React from 'react';
import { useSceneStore } from '@/stores/scene-store';
import { useGeometryStore } from '@/stores/geometry-store';
import { MaterialSection } from './material-section';

type Props = { objectId: string };

export const ObjectDataSection: React.FC<Props> = ({ objectId }) => {
  const scene = useSceneStore();
  const geo = useGeometryStore();
  const obj = scene.objects[objectId];
  if (!obj) return null;

  if (obj.type !== 'mesh' || !obj.meshId) {
    return <div className="bg-white/5 border border-white/10 rounded p-2 text-xs text-gray-400">No object data for this type.</div>;
  }

  const mesh = geo.meshes.get(obj.meshId);
  const assignMaterial = (id: string | undefined) => {
    if (!mesh) return;
    geo.updateMesh(mesh.id, (m) => { m.materialId = id; });
  };

  return (
    <div className="space-y-2">
  <MaterialSection materialId={mesh?.materialId} onAssignMaterial={assignMaterial} />
    </div>
  );
};

export default ObjectDataSection;

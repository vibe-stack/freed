"use client";

import React, { useMemo } from 'react';
import { useSceneStore } from '@/stores/scene-store';
import { useViewportStore } from '@/stores/viewport-store';

export const CameraSwitcher: React.FC = () => {
  const objects = useSceneStore((s) => s.objects);
  const ids = useSceneStore((s) => s.rootObjects);
  const activeId = useViewportStore((s) => s.activeCameraObjectId ?? null);
  const setActive = useViewportStore((s) => s.setActiveCamera);

  const cameras = useMemo(() => {
    const list: { id: string; name: string }[] = [];
    const addRecursive = (id: string) => {
      const obj = objects[id];
      if (!obj) return;
      if (obj.type === 'camera' && obj.cameraId) list.push({ id: obj.id, name: obj.name });
      obj.children.forEach(addRecursive);
    };
    ids.forEach(addRecursive);
    return list;
  }, [objects, ids]);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setActive(val === 'default' ? null : val);
  };

  // Always render with a Default Camera option
  return (
    <div className="pointer-events-auto bg-black/30 backdrop-blur-sm rounded-md border border-white/10 px-2 py-1">
      <label className="sr-only" htmlFor="camera-switcher">Active camera</label>
      <select
        id="camera-switcher"
        className="text-xs bg-transparent text-gray-200 outline-none appearance-none pr-6"
        value={activeId ?? 'default'}
        onChange={handleChange}
        title="Select active camera"
      >
        <option value="default">Default Camera</option>
        {cameras.map((cam) => (
          <option key={cam.id} value={cam.id}>{cam.name}</option>
        ))}
      </select>
    </div>
  );
};

export default CameraSwitcher;

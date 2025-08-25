import type { Object3D } from 'three';

// Module-level registry mapping scene objectId -> Three.js Object3D (group root)
const registry = new Map<string, Object3D>();

export function registerObject3D(objectId: string, obj: Object3D) {
  registry.set(objectId, obj);
}

export function unregisterObject3D(objectId: string, obj?: Object3D) {
  const current = registry.get(objectId);
  if (!obj || current === obj) registry.delete(objectId);
}

export function getObject3D(objectId: string | null | undefined): Object3D | undefined {
  if (!objectId) return undefined;
  return registry.get(objectId);
}

export function listRegisteredObjects() {
  return Array.from(registry.keys());
}

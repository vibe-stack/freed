import type { Camera } from 'three';

// Module-level registry for scene cameras
const registry = new Map<string, Camera>();

export function registerCamera(objectId: string, camera: Camera) {
  registry.set(objectId, camera);
}

export function unregisterCamera(objectId: string, camera?: Camera) {
  const current = registry.get(objectId);
  if (!camera || current === camera) {
    registry.delete(objectId);
  }
}

export function getCamera(objectId: string | null | undefined): Camera | undefined {
  if (!objectId) return undefined;
  return registry.get(objectId);
}

export function listRegisteredCameras() {
  return Array.from(registry.keys());
}

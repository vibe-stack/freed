import { Vector3, Euler } from 'three/webgpu';
import { Vertex } from '@/types/geometry';
import { TransformContext } from './types';

/**
 * Calculates the centroid of a list of vertices
 */
export function calculateCentroid(vertices: Vertex[]): Vector3 {
  if (vertices.length === 0) return new Vector3();
  
  const sum = vertices.reduce(
    (acc, vertex) => ({
      x: acc.x + vertex.position.x,
      y: acc.y + vertex.position.y,
      z: acc.z + vertex.position.z,
    }),
    { x: 0, y: 0, z: 0 }
  );
  
  return new Vector3(
    sum.x / vertices.length,
    sum.y / vertices.length,
    sum.z / vertices.length
  );
}

/**
 * Converts world space delta to object-local delta by applying inverse transforms
 */
export function worldToLocalDelta(
  deltaWorld: Vector3,
  objectRotation?: { x: number; y: number; z: number },
  objectScale?: { x: number; y: number; z: number }
): Vector3 {
  const deltaLocal = deltaWorld.clone();
  
  if (objectRotation) {
    deltaLocal.applyEuler(new Euler(-objectRotation.x, -objectRotation.y, -objectRotation.z));
  }
  
  if (objectScale) {
    deltaLocal.set(
      deltaLocal.x / Math.max(1e-6, objectScale.x),
      deltaLocal.y / Math.max(1e-6, objectScale.y),
      deltaLocal.z / Math.max(1e-6, objectScale.z)
    );
  }
  
  return deltaLocal;
}

/**
 * Calculates the scale factor based on object scale for sensitivity compensation
 */
export function getScaleFactor(objectScale?: { x: number; y: number; z: number }): number {
  return objectScale ? (Math.abs(objectScale.x) + Math.abs(objectScale.y) + Math.abs(objectScale.z)) / 3 : 1;
}

/**
 * Gets the distance from camera to centroid for mouse sensitivity calculations
 */
export function getCameraDistance(context: TransformContext, centroid: Vector3): number {
  return context.camera.position.distanceTo(centroid);
}
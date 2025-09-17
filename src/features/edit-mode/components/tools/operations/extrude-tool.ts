import { Vector3, Euler } from 'three/webgpu';
import { Vertex } from '@/types/geometry';
import { AxisLock } from '@/stores/tool-store';
import { mouseToWorldDelta } from '../../tool-operations';
import { worldToLocalDelta, getCameraDistance } from '../utils/transform-utils';
import { TransformContext } from '../utils/types';

export interface ExtrudeToolState {
  extrudeAccumulator: Vector3;
  avgNormalLocal: Vector3;
}

export function handleExtrudeOperation(
  event: MouseEvent,
  originalVertices: Vertex[],
  centroid: Vector3,
  context: TransformContext,
  axisLock: AxisLock,
  moveSensitivity: number,
  extrudeAccumulator: Vector3,
  avgNormalLocal: Vector3
): {
  vertices: Vertex[];
  newAccumulator: Vector3;
} {
  const distance = getCameraDistance(context, centroid);
  
  // Calculate world space delta
  const deltaWorld = mouseToWorldDelta(
    event.movementX, 
    event.movementY, 
    context.camera, 
    distance, 
    moveSensitivity
  );
  
  // Convert to object-local delta
  const deltaLocal = worldToLocalDelta(
    deltaWorld, 
    context.objectRotation, 
    context.objectScale
  );
  
  // Apply axis lock or project onto average normal
  let step = deltaLocal.clone();
  if (axisLock === 'x' || axisLock === 'y' || axisLock === 'z') {
    step.set(
      axisLock === 'x' ? deltaLocal.x : 0,
      axisLock === 'y' ? deltaLocal.y : 0,
      axisLock === 'z' ? deltaLocal.z : 0
    );
  } else {
    // Project onto averaged local normal
    const dir = avgNormalLocal.clone().normalize();
    const s = deltaLocal.dot(dir);
    step = dir.multiplyScalar(s);
  }
  
  const newAccumulator = extrudeAccumulator.clone().add(step);
  
  // Apply offset to selected vertices
  const newVertices = originalVertices.map(v => ({
    ...v,
    position: {
      x: v.position.x + newAccumulator.x,
      y: v.position.y + newAccumulator.y,
      z: v.position.z + newAccumulator.z,
    },
  }));
  
  return {
    vertices: newVertices,
    newAccumulator
  };
}
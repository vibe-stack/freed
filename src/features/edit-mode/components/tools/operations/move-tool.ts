import { Vector3 } from 'three/webgpu';
import { Vertex } from '@/types/geometry';
import { AxisLock } from '@/stores/tool-store';
import { 
  applyMoveOperation, 
  mouseToWorldDelta 
} from '../../tool-operations';
import { worldToLocalDelta, getScaleFactor, getCameraDistance } from '../utils/transform-utils';
import { TransformContext } from '../utils/types';

export interface MoveToolState {
  moveAccumulator: Vector3;
}

export function handleMoveOperation(
  event: MouseEvent,
  originalVertices: Vertex[],
  centroid: Vector3,
  context: TransformContext,
  axisLock: AxisLock,
  moveSensitivity: number,
  moveAccumulator: Vector3
): {
  vertices: Vertex[];
  newAccumulator: Vector3;
} {
  const distance = getCameraDistance(context, centroid);
  const scaleFactor = getScaleFactor(context.objectScale);
  
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
  
  // Accumulate movement since start in local space
  const newAccumulator = moveAccumulator.clone().add(deltaLocal);
  
  // Apply move operation
  const newVertices = applyMoveOperation(originalVertices, newAccumulator, axisLock);
  
  return {
    vertices: newVertices,
    newAccumulator
  };
}
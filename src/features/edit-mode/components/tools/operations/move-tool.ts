import { Vector3 } from 'three/webgpu';
import { Vertex } from '@/types/geometry';
import { AxisLock } from '@/stores/tool-store';
import { 
  applyMoveOperation, 
  mouseToWorldDelta 
} from '../../tool-operations';
import { worldToLocalDelta, getScaleFactor, getCameraDistance } from '../utils/transform-utils';
import { TransformContext } from '../utils/types';
import { snapValue } from '@/utils/grid-snapping';

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
  const appliedDelta = context.gridSnapping
    ? new Vector3(
        snapValue(newAccumulator.x, context.gridSize ?? 1),
        snapValue(newAccumulator.y, context.gridSize ?? 1),
        snapValue(newAccumulator.z, context.gridSize ?? 1)
      )
    : newAccumulator;
  
  // Apply move operation
  const newVertices = applyMoveOperation(originalVertices, appliedDelta, axisLock);
  
  return {
    vertices: newVertices,
    newAccumulator
  };
}
import { Vector3 } from 'three/webgpu';
import { Vertex } from '@/types/geometry';
import { AxisLock } from '@/stores/tool-store';
import { applyRotateOperation } from '../../tool-operations';
import { TransformContext } from '../utils/types';
import { snapRotationRadians } from '@/utils/grid-snapping';

export interface RotateToolState {
  rotationAccumulator: number;
}

export function handleRotateOperation(
  event: MouseEvent,
  originalVertices: Vertex[],
  centroid: Vector3,
  context: TransformContext,
  axisLock: AxisLock,
  rotateSensitivity: number,
  currentRotation: number
): {
  vertices: Vertex[];
  newRotation: number;
} {
  // Rotation based on mouse movement
  const rotationDelta = (event.movementX + event.movementY) * rotateSensitivity;
  const rawRotation = currentRotation + rotationDelta;
  const newRotation = context.gridSnapping
    ? snapRotationRadians(rawRotation, context.gridSize ?? 1)
    : rawRotation;
  
  const newVertices = applyRotateOperation(originalVertices, newRotation, axisLock, centroid);
  
  return {
    vertices: newVertices,
    newRotation
  };
}
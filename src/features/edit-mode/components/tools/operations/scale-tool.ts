import { Vector3 } from 'three/webgpu';
import { Vertex } from '@/types/geometry';
import { AxisLock } from '@/stores/tool-store';
import { applyScaleOperation } from '../../tool-operations';
import { getScaleFactor } from '../utils/transform-utils';
import { TransformContext } from '../utils/types';

export interface ScaleToolState {
  scaleAccumulator: number;
}

export function handleScaleOperation(
  event: MouseEvent,
  originalVertices: Vertex[],
  centroid: Vector3,
  context: TransformContext,
  axisLock: AxisLock,
  scaleSensitivity: number,
  currentScale: number
): {
  vertices: Vertex[];
  newScale: number;
} {
  const scaleFactor = getScaleFactor(context.objectScale);
  const scaleDelta = event.movementX * scaleSensitivity / Math.max(1e-6, scaleFactor);
  const newScale = Math.max(0.01, currentScale + scaleDelta); // Prevent negative scale
  
  const newVertices = applyScaleOperation(originalVertices, newScale, axisLock, centroid);
  
  return {
    vertices: newVertices,
    newScale
  };
}
import { Vector3 } from 'three/webgpu';
import { Vertex } from '@/types/geometry';
import { applyScaleOperation } from '../../tool-operations';
import { getScaleFactor } from '../utils/transform-utils';
import { TransformContext } from '../utils/types';
import { snapScaleValue } from '@/utils/grid-snapping';

export interface InsetToolState {
  insetAccumulator: number;
}

export function handleInsetOperation(
  event: MouseEvent,
  originalVertices: Vertex[],
  centroid: Vector3,
  context: TransformContext,
  scaleSensitivity: number,
  currentScale: number
): {
  vertices: Vertex[];
  newScale: number;
} {
  const scaleFactor = getScaleFactor(context.objectScale);
  const scaleDelta = event.movementX * scaleSensitivity / Math.max(1e-6, scaleFactor);
  const rawScale = Math.max(0.05, Math.min(2, currentScale + scaleDelta));
  const newScale = context.gridSnapping
    ? Math.max(0.05, Math.min(2, snapScaleValue(rawScale, context.gridSize ?? 1)))
    : rawScale;
  
  // Inset preview: scale selected vertices towards centroid
  const newVertices = applyScaleOperation(originalVertices, newScale, 'none', centroid);
  
  return {
    vertices: newVertices,
    newScale
  };
}
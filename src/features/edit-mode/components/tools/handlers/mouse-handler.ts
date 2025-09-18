import { Vector3 } from 'three/webgpu';
import { Vertex } from '@/types/geometry';
import { AxisLock, useToolStore } from '@/stores/tool-store';
import { TransformContext } from '../utils/types';
import {
  handleMoveOperation,
  handleRotateOperation,
  handleScaleOperation,
  handleExtrudeOperation,
  handleInsetOperation,
  handleBevelOperation,
  MoveToolState,
  RotateToolState,
  ScaleToolState,
  ExtrudeToolState,
  InsetToolState,
  BevelToolState,
  handleChamferOperation,
  handleFilletOperation
} from '../operations';

interface MouseMoveHandlerParams {
  event: MouseEvent;
  originalVertices: Vertex[];
  centroid: Vector3;
  context: TransformContext;
  accumulator: { rotation: number; scale: number };
  selectedFaceIds: string[];
  avgNormalLocal: Vector3;
  meshId: string;
  moveAccumRef: React.MutableRefObject<Vector3>;
  onVerticesChange: (vertices: Vertex[]) => void;
  onAccumulatorChange: React.Dispatch<React.SetStateAction<{ rotation: number; scale: number }>>;
}

export function createMouseMoveHandler({
  originalVertices,
  centroid,
  context,
  accumulator,
  selectedFaceIds,
  avgNormalLocal,
  meshId,
  moveAccumRef,
  onVerticesChange,
  onAccumulatorChange
}: Omit<MouseMoveHandlerParams, 'event'>) {
  return (event: MouseEvent) => {
    const toolStore = useToolStore.getState();
    const implemented = toolStore.tool === 'move' || toolStore.tool === 'rotate' || 
                       toolStore.tool === 'scale' || toolStore.tool === 'extrude' || 
                       toolStore.tool === 'inset' || toolStore.tool === 'bevel' || 
                       toolStore.tool === 'chamfer' || toolStore.tool === 'fillet';
    
    if (!toolStore.isActive || !implemented || originalVertices.length === 0) return;

    if (toolStore.tool === 'move') {
      const result = handleMoveOperation(
        event,
        originalVertices,
        centroid,
        context,
        toolStore.axisLock,
        toolStore.moveSensitivity,
        moveAccumRef.current
      );
      
      moveAccumRef.current = result.newAccumulator;
      onVerticesChange(result.vertices);
      
    } else if (toolStore.tool === 'rotate') {
      const result = handleRotateOperation(
        event,
        originalVertices,
        centroid,
        context,
        toolStore.axisLock,
        toolStore.rotateSensitivity,
        accumulator.rotation
      );
      
      onAccumulatorChange(prev => ({ ...prev, rotation: result.newRotation }));
      onVerticesChange(result.vertices);
      
    } else if (toolStore.tool === 'scale') {
      const result = handleScaleOperation(
        event,
        originalVertices,
        centroid,
        context,
        toolStore.axisLock,
        toolStore.scaleSensitivity,
        accumulator.scale
      );
      
      onAccumulatorChange(prev => ({ ...prev, scale: result.newScale }));
      onVerticesChange(result.vertices);
      
    } else if (toolStore.tool === 'extrude') {
      const result = handleExtrudeOperation(
        event,
        originalVertices,
        centroid,
        context,
        toolStore.axisLock,
        toolStore.moveSensitivity,
        moveAccumRef.current,
        avgNormalLocal
      );
      
      moveAccumRef.current = result.newAccumulator;
      onVerticesChange(result.vertices);
      
    } else if (toolStore.tool === 'inset') {
      const result = handleInsetOperation(
        event,
        originalVertices,
        centroid,
        context,
        toolStore.scaleSensitivity,
        accumulator.scale
      );
      
      onAccumulatorChange(prev => ({ ...prev, scale: result.newScale }));
      onVerticesChange(result.vertices);
      
    } else if (toolStore.tool === 'bevel') {
      const result = handleBevelOperation(
        event,
        originalVertices,
        centroid,
        context,
        meshId,
        selectedFaceIds,
        toolStore.scaleSensitivity,
        accumulator.scale || 0,
        toolStore.tool
      );
      
      onAccumulatorChange(prev => ({ ...prev, scale: result.newWidth }));
      onVerticesChange(result.vertices);
    } else if (toolStore.tool === 'chamfer') {
      const result = handleChamferOperation(
        event,
        originalVertices,
        centroid,
        context,
        meshId,
        toolStore.scaleSensitivity,
        accumulator.scale || 0
      );
      onAccumulatorChange(prev => ({ ...prev, scale: result.newDistance }));
      onVerticesChange(result.vertices);
    } else if (toolStore.tool === 'fillet') {
      const result = handleFilletOperation(
        event,
        originalVertices,
        centroid,
        context,
        meshId,
        toolStore.scaleSensitivity,
        accumulator.scale || 0
      );
      onAccumulatorChange(prev => ({ ...prev, scale: result.newRadius }));
      onVerticesChange(result.vertices);
    }
  };
}
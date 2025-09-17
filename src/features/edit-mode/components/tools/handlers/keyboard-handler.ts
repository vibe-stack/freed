import { Vector3 } from 'three/webgpu';
import { Vertex } from '@/types/geometry';
import { useToolStore } from '@/stores/tool-store';

interface KeyboardHandlerParams {
  originalVertices: Vertex[];
  moveAccumRef: React.MutableRefObject<Vector3>;
  onVerticesChange: (vertices: Vertex[]) => void;
  onEndOperation: (commit: boolean) => void;
}

export function createKeyboardHandler({
  originalVertices,
  moveAccumRef,
  onVerticesChange,
  onEndOperation
}: KeyboardHandlerParams) {
  return (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    const toolStore = useToolStore.getState();
    
    if (key === 'escape') {
      // Abort operation - restore original state
      onVerticesChange(originalVertices);
      onEndOperation(false);
      moveAccumRef.current.set(0, 0, 0);
    } else if (key === 'x') {
      toolStore.setAxisLock(toolStore.axisLock === 'x' ? 'none' : 'x');
    } else if (key === 'y') {
      toolStore.setAxisLock(toolStore.axisLock === 'y' ? 'none' : 'y');
    } else if (key === 'z') {
      toolStore.setAxisLock(toolStore.axisLock === 'z' ? 'none' : 'z');
    }
  };
}
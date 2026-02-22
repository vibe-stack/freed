import { Vector3, Camera } from 'three/webgpu';
import { Vertex } from '@/types/geometry';

export interface ToolHandlerProps {
  meshId: string;
  onLocalDataChange: (vertices: Vertex[]) => void;
  objectRotation?: { x: number; y: number; z: number };
  objectScale?: { x: number; y: number; z: number };
}

export interface ToolState {
  originalVertices: Vertex[];
  localVertices: Vertex[];
  centroid: Vector3;
  accumulator: { rotation: number; scale: number };
  selectedFaceIds: string[];
  avgNormalLocal: Vector3;
}

export interface TransformContext {
  camera: Camera;
  distance: number;
  objectRotation?: { x: number; y: number; z: number };
  objectScale?: { x: number; y: number; z: number };
  gridSnapping?: boolean;
  gridSize?: number;
}
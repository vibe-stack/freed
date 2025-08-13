// Core geometry data types - designed for React compatibility
// All data structures are plain objects/arrays that can trigger React re-renders

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface Vector2 {
  x: number;
  y: number;
}

export interface Vertex {
  id: string;
  position: Vector3;
  normal: Vector3;
  uv: Vector2;
  selected: boolean;
}

export interface Edge {
  id: string;
  vertexIds: [string, string];
  faceIds: string[]; // Adjacent faces
  selected: boolean;
}

export interface Face {
  id: string;
  vertexIds: string[]; // Support for quads and triangles
  normal: Vector3;
  materialId?: string;
  selected: boolean;
}

export interface Mesh {
  id: string;
  name: string;
  vertices: Vertex[];
  edges: Edge[];
  faces: Face[];
  transform: Transform;
  visible: boolean;
  locked: boolean;
}

export interface Transform {
  position: Vector3;
  rotation: Vector3; // Euler angles in radians
  scale: Vector3;
}

export interface Material {
  id: string;
  name: string;
  color: Vector3;
  roughness: number;
  metalness: number;
  emissive: Vector3;
}

// Selection types
export type SelectionMode = 'vertex' | 'edge' | 'face' | 'object';

export interface Selection {
  mode: SelectionMode;
  meshId: string | null;
  vertexIds: string[];
  edgeIds: string[];
  faceIds: string[];
  objectIds: string[];
}

// Scene hierarchy
export interface SceneObject {
  id: string;
  name: string;
  type: 'mesh' | 'light' | 'camera' | 'group';
  parentId: string | null;
  children: string[];
  transform: Transform;
  visible: boolean;
  locked: boolean;
  meshId?: string; // For mesh objects
}

// Animation types
export interface Keyframe {
  id: string;
  time: number;
  property: string; // e.g., 'transform.position.x'
  value: number;
  interpolation: 'linear' | 'bezier' | 'step';
}

export interface AnimationClip {
  id: string;
  name: string;
  duration: number;
  keyframes: Keyframe[];
  loop: boolean;
}

// Viewport types
export interface CameraState {
  position: Vector3;
  target: Vector3;
  up: Vector3;
  fov: number;
  near: number;
  far: number;
}

export type ShadingMode = 'wireframe' | 'solid' | 'material' | 'textured';

export interface ViewportState {
  camera: CameraState;
  shadingMode: ShadingMode;
  showGrid: boolean;
  showAxes: boolean;
  gridSize: number;
  backgroundColor: Vector3;
}

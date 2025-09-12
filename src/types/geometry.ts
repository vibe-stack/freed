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
  // Optional second UV channel (for AO/lightmaps)
  uv2?: Vector2;
  selected: boolean;
}

export interface Edge {
  id: string;
  vertexIds: [string, string];
  faceIds: string[]; // Adjacent faces
  selected: boolean;
  // If true, this edge is marked as a UV seam (cuts when unwrapping)
  seam?: boolean;
}

export interface Face {
  id: string;
  vertexIds: string[]; // Support for quads and triangles
  normal: Vector3;
  materialId?: string;
  selected: boolean;
  // Per-face-corner (loop) UVs – length matches vertexIds. Enables seams without duplicating geometry vertices.
  uvs?: Vector2[];
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
  // Reference to material resource in geometry-store.materials
  materialId?: string;
  // Rendering flags
  castShadow?: boolean;
  receiveShadow?: boolean;
  shading?: 'flat' | 'smooth';
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
  emissiveIntensity: number;
}

// View and Selection types
export type ViewMode = 'object' | 'edit';
export type SelectionMode = 'vertex' | 'edge' | 'face';

export interface Selection {
  viewMode: ViewMode;
  selectionMode: SelectionMode; // Only used in edit mode
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
  type: 'mesh' | 'light' | 'camera' | 'group' | 'particles' | 'force' | 'fluid' | 'text' | 'metaball' | 'terrain';
  parentId: string | null;
  children: string[];
  transform: Transform;
  visible: boolean;
  locked: boolean;
  // If true, included in final render (camera icon)
  render: boolean;
  meshId?: string; // For mesh objects
  // Component references for non-mesh objects
  lightId?: string; // For light objects
  cameraId?: string; // For camera objects
  // Particle system component reference
  particleSystemId?: string; // For particle system objects
  // Force field component reference (for type === 'force')
  forceFieldId?: string;
  // Fluid system component reference (for type === 'fluid')
  fluidSystemId?: string;
  // Text 3D component reference (for type === 'text')
  textId?: string;
  // Metaball single blob reference (for type === 'metaball')
  metaballId?: string;
  // Terrain component reference (for type === 'terrain')
  terrainId?: string;
}

// Parametric Text3D resource (procedural until rasterized)
export interface Text3D {
  id: string;
  text: string;
  fontFamily: string; // CSS font family name
  size: number; // nominal character height in world units
  depth: number; // extrusion depth
  bevelEnabled: boolean;
  bevelSize: number; // inset on front/back face
  bevelSegments: number; // steps between front/back
  curveSegments: number; // outline smoothing for future advanced fonts
  align: 'left' | 'center' | 'right';
  lineHeight: number; // multiple of size
  meshId: string; // underlying generated mesh (kept in geometry-store)
  rasterized: boolean; // if true, resource is ready to be removed & object converted to mesh
}

// Scene component data types
export type LightType = 'directional' | 'spot' | 'point' | 'ambient';

export interface Light {
  id: string;
  type: LightType;
  color: Vector3; // 0-1 RGB
  intensity: number;
  // Common optional props
  distance?: number; // for point/spot
  decay?: number; // for physically correct falloff
  // Spot specific
  angle?: number; // radians
  penumbra?: number; // 0-1
  // RectArea removed for WebGPU in-editor compatibility
}

export type CameraType = 'perspective' | 'orthographic';

export interface CameraResource {
  id: string;
  type: CameraType;
  // Perspective
  fov?: number; // degrees
  zoom?: number; // shared: Camera has zoom; applies to both, default 1
  focus?: number; // perspective focus distance (for DOF pipelines)
  filmGauge?: number; // perspective film size in mm (default 35)
  filmOffset?: number; // perspective horizontal film offset in mm
  // Orthographic
  left?: number;
  right?: number;
  top?: number;
  bottom?: number;
  // Shared
  near: number;
  far: number;
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
  // Auto-orbit interval in seconds; 0 disables. Used for subtle recording orbits.
  autoOrbitIntervalSec?: 0 | 1 | 5 | 15;
  // If set, the editor uses this scene object (camera) as the active view camera
  activeCameraObjectId?: string | null;
}

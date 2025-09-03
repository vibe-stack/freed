// T3D File Format Types
// Version 1.0.0

export interface T3DVersion {
  major: number;
  minor: number;
  patch: number;
}

export interface T3DMetadata {
  version: T3DVersion;
  created: string; // ISO date string
  modified: string; // ISO date string
  author?: string;
  description?: string;
  application: string;
  applicationVersion: string;
}

export interface T3DMesh {
  id: string;
  name: string;
  vertices: Array<{
    id: string;
    position: { x: number; y: number; z: number };
    normal: { x: number; y: number; z: number };
    uv: { x: number; y: number };
    selected: boolean;
  }>;
  edges: Array<{
    id: string;
    vertexIds: [string, string];
    faceIds: string[];
    selected: boolean;
  }>;
  faces: Array<{
    id: string;
    vertexIds: string[];
    normal: { x: number; y: number; z: number };
    materialId?: string;
    selected: boolean;
  }>;
  transform: {
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    scale: { x: number; y: number; z: number };
  };
  visible: boolean;
  locked: boolean;
}

export interface T3DMaterial {
  id: string;
  name: string;
  color: { x: number; y: number; z: number };
  roughness: number;
  metalness: number;
  emissive: { x: number; y: number; z: number };
  emissiveIntensity?: number;
}

export interface T3DSceneObject {
  id: string;
  name: string;
  type: 'mesh' | 'light' | 'camera' | 'group' | 'force';
  parentId: string | null;
  children: string[];
  transform: {
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    scale: { x: number; y: number; z: number };
  };
  visible: boolean;
  locked: boolean;
  render: boolean;
  meshId?: string;
  // Optional component links
  lightId?: string;
  cameraId?: string;
  // Optional particle system link (editor extension)
  particleSystemId?: string;
  // Optional force field link (editor extension)
  forceFieldId?: string;
}

export interface T3DCamera {
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
  up: { x: number; y: number; z: number };
  fov: number;
  near: number;
  far: number;
}

export interface T3DViewport {
  camera: T3DCamera;
  shadingMode: 'wireframe' | 'solid' | 'material' | 'textured';
  showGrid: boolean;
  showAxes: boolean;
  gridSize: number;
  backgroundColor: { x: number; y: number; z: number };
  activeCameraObjectId?: string | null;
}

export interface T3DLight {
  id: string;
  type: 'directional' | 'spot' | 'point' | 'ambient';
  color: { x: number; y: number; z: number };
  intensity: number;
  distance?: number;
  decay?: number;
  angle?: number;
  penumbra?: number;
}

export interface T3DCameraResource {
  id: string;
  type: 'perspective' | 'orthographic';
  fov?: number;
  zoom?: number;
  focus?: number;
  filmGauge?: number;
  filmOffset?: number;
  left?: number;
  right?: number;
  top?: number;
  bottom?: number;
  near: number;
  far: number;
}

export interface T3DScene {
  metadata: T3DMetadata;
  meshes: T3DMesh[];
  materials: T3DMaterial[];
  objects: T3DSceneObject[];
  rootObjects: string[];
  viewport: T3DViewport;
  selectedObjectId: string | null;
  // Optional component data
  lights?: T3DLight[];
  cameras?: T3DCameraResource[];
  // Optional particle systems payload (editor extension)
  particles?: {
    systems: Array<{
      id: string;
      name?: string;
  seed?: number;
  capacity?: number;
      emitterObjectId: string | null;
      particleObjectId: string | null;
      emissionRate: number;
      velocity: { x: number; y: number; z: number };
  velocityLocal?: boolean;
  velocityJitter?: number;
  spawnMode?: 'point' | 'surface';
  positionJitter?: number;
      particleLifetime: number;
      minScale: number;
      maxScale: number;
      angularVelocity: { x: number; y: number; z: number };
      gravity: { x: number; y: number; z: number };
      wind: { x: number; y: number; z: number };
    }>;
  };
  // Optional force fields payload (editor extension)
  forces?: {
    fields: Array<{ id: string; type: 'attractor' | 'repulsor' | 'vortex'; name?: string; enabled?: boolean; radius: number; strength: number }>
  };
  // Optional MVP animation payload
  animations?: {
    fps: number;
    clips: Array<{
      id: string; name: string; start: number; end: number; loop: boolean; speed: number;
      tracks: Array<{ id: string; targetId: string; property: string; keys: Array<{ id: string; t: number; v: number; interp: 'step'|'linear'|'bezier' }> }>;
    }>;
    activeClipId?: string | null;
  };
  ui?: {
    timelinePanelOpen?: boolean;
    lastUsedFps?: number;
  };
}

export interface T3DExportFilter {
  includeMeshes?: string[]; // If specified, only export these mesh IDs
  includeMaterials?: string[]; // If specified, only export these material IDs  
  includeObjects?: string[]; // If specified, only export these object IDs
  includeViewport?: boolean; // Whether to include viewport state
}

export interface T3DExportConfig {
  compressed?: boolean; // Whether to use compression in the zip
  prettyPrint?: boolean; // Whether to format JSON with indentation
  includeAssets?: boolean; // Whether to include assets folder (for future use)
}

// Current version constant
export const T3D_VERSION: T3DVersion = {
  major: 1,
  minor: 0,
  patch: 0,
};

export const T3D_APPLICATION = 'Gestalt 3D Editor';
export const T3D_APPLICATION_VERSION = '0.1.0';

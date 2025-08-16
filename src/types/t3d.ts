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
}

export interface T3DSceneObject {
  id: string;
  name: string;
  type: 'mesh' | 'light' | 'camera' | 'group';
  parentId: string | null;
  children: string[];
  transform: {
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    scale: { x: number; y: number; z: number };
  };
  visible: boolean;
  locked: boolean;
  meshId?: string;
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
}

export interface T3DScene {
  metadata: T3DMetadata;
  meshes: T3DMesh[];
  materials: T3DMaterial[];
  objects: T3DSceneObject[];
  rootObjects: string[];
  viewport: T3DViewport;
  selectedObjectId: string | null;
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

export const T3D_APPLICATION = 'Freed 3D Editor';
export const T3D_APPLICATION_VERSION = '0.1.0';

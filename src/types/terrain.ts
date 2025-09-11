// Node-based Terrain system types

export type TerrainSocketType = 'float' | 'vec2';

export type TerrainNodeType =
  | 'input' // provides uv and initial height
  | 'output' // consumes final height
  | 'perlin' // noise-based height modifier
  | 'voronoi'; // cellular noise-based modifier

export interface TerrainNodeBase {
  id: string;
  type: TerrainNodeType;
  position: { x: number; y: number };
  hidden?: boolean;
  data: Record<string, any>;
}

export interface TerrainInputNode extends TerrainNodeBase {
  type: 'input';
  // data: none for now
}

export interface TerrainOutputNode extends TerrainNodeBase {
  type: 'output';
}

export interface TerrainPerlinNode extends TerrainNodeBase {
  type: 'perlin';
  data: {
    seed: number; // unique per node when created
    scale: number; // frequency (world units per repeat)
    octaves: number;
    persistence: number;
    lacunarity: number;
    amplitude: number; // amplitude contribution
    operation: 'add' | 'mix' | 'max' | 'min' | 'replace';
    amount: number; // mix factor for 'mix'
  };
}

export interface TerrainVoronoiNode extends TerrainNodeBase {
  type: 'voronoi';
  data: {
    seed: number;
    density: number; // cells per unit
    jitter: number; // 0..1
    metric: 'euclidean' | 'manhattan' | 'chebyshev';
    feature: 'f1' | 'f2' | 'f2-f1';
    amplitude: number;
    operation: 'add' | 'mix' | 'max' | 'min' | 'replace';
    amount: number; // mix factor
  };
}

export type TerrainNode =
  | TerrainInputNode
  | TerrainOutputNode
  | TerrainPerlinNode
  | TerrainVoronoiNode
  | TerrainNodeBase;

export interface TerrainEdge {
  id: string;
  source: string;
  sourceHandle: string; // 'out' or named
  target: string;
  targetHandle: string; // 'in' or named
}

export interface TerrainGraph {
  terrainId: string;
  nodes: TerrainNode[];
  edges: TerrainEdge[];
}

// Terrain resource and settings
export interface TerrainResource {
  id: string;
  name: string;
  // Linked generated mesh
  meshId: string;
  // Resolution and sizing
  vertexResolution: { x: number; y: number }; // grid vertices (widthSegments+1, heightSegments+1)
  textureResolution: { width: number; height: number }; // normal/height textures resolution
  width: number; // world units X (terrain width)
  height: number; // world units Z (terrain depth/length)
  heightScale?: number; // elevation multiplier for vertex displacement (default: 3.0)
  // Always-on terrain maps (computed)
  maps?: {
    height?: Float32Array; // textureResolution sized heightmap (0..1)
    normal?: Float32Array; // RGBA or XYZ per texel (packed as x,y,z,1)
  };
}

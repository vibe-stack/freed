// Node-based Terrain system types

export type TerrainSocketType = 'float' | 'vec2';

export type TerrainNodeType =
  | 'input' // provides uv and initial height
  | 'output' // consumes final height
  | 'perlin' // noise-based height modifier
  | 'voronoi' // cellular noise-based modifier
  | 'mountain' // geoprimitive
  | 'crater' // geoprimitive
  | 'canyon' // erosional geoprimitive
  | 'dunes' // aeolian sand dunes
  | 'badlands'; // stratified erosional terrain

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

export interface TerrainMountainNode extends TerrainNodeBase {
  type: 'mountain';
  data: {
    seed: number;
    centerX: number; centerY: number; // in UV 0..1
    radius: number; // UV scale
    peak: number; // peak height
    falloff: number; // radial falloff exponent
    sharpness: number; // profile sharpness
    ridges: number; // ridge amplitude
    octaves: number;
    gain: number;
    lacunarity: number;
    operation: 'add' | 'mix' | 'max' | 'min' | 'replace';
    amount: number;
  };
}

export interface TerrainCraterNode extends TerrainNodeBase {
  type: 'crater';
  data: {
    centerX: number; centerY: number; // uv
    radius: number; // uv
    depth: number; // depression depth
    rimHeight: number;
    rimWidth: number; // 0..1 relative to radius
    floor: number; // floor height relative
    smooth: number; // 0..1
    operation: 'add' | 'mix' | 'max' | 'min' | 'replace';
    amount: number;
  };
}

export interface TerrainCanyonNode extends TerrainNodeBase {
  type: 'canyon';
  data: {
    seed: number;
    centerX: number; centerY: number; // uv
    width: number; // canyon width in UV
    length: number; // canyon length in UV
    depth: number; // max canyon depth
    angle: number; // canyon orientation in radians
    meanders: number; // sinuosity amount
    branches: number; // number of side branches
    erosion: number; // erosion complexity
    stratification: number; // rock layer visibility
    operation: 'add' | 'mix' | 'max' | 'min' | 'replace';
    amount: number;
  };
}

export interface TerrainDunesNode extends TerrainNodeBase {
  type: 'dunes';
  data: {
    seed: number;
    density: number; // dunes per UV unit
    height: number; // max dune height
    wavelength: number; // dominant dune spacing
    asymmetry: number; // windward/leeward slope ratio
    slipface: number; // steep face sharpness
    complexity: number; // secondary ripple detail
    windDirection: number; // wind direction in radians
    migration: number; // dune shape variation
    operation: 'add' | 'mix' | 'max' | 'min' | 'replace';
    amount: number;
  };
}

export interface TerrainBadlandsNode extends TerrainNodeBase {
  type: 'badlands';
  data: {
    seed: number;
    scale: number; // overall feature scale
    stratification: number; // horizontal layering strength
    erosion: number; // vertical erosion channels
    weathering: number; // surface breakdown
    hardness: number; // resistant layer influence
    tilting: number; // geological tilting angle
    faulting: number; // fault line disruption
    drainageComplexity: number; // gully system complexity
    operation: 'add' | 'mix' | 'max' | 'min' | 'replace';
    amount: number;
  };
}

export type TerrainNode =
  | TerrainInputNode
  | TerrainOutputNode
  | TerrainPerlinNode
  | TerrainVoronoiNode
  | TerrainMountainNode
  | TerrainCraterNode
  | TerrainCanyonNode
  | TerrainDunesNode
  | TerrainBadlandsNode
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
  // Surface detail parameters
  surfaceDetail?: {
    crackDensity?: number;
    crackDepth?: number;
    strataDensity?: number;
    strataDepth?: number;
    roughness?: number;
    seed?: number;
  };
}

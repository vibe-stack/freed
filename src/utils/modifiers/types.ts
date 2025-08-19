import type { Mesh, Vertex, Face, Vector3 } from '@/types/geometry';

export type ModifierType =
  | 'mirror'
  | 'subdivide'
  | 'array'
  | 'weld'
  | 'triangulate'
  | 'edge-split'
  | 'decimate'
  | 'solidify'
  | 'screw'
  | 'bevel'
  | 'remesh'
  | 'volume-to-mesh';

export type MirrorAxis = 'x' | 'y' | 'z';

export interface MirrorModifierSettings {
  axis: MirrorAxis;
  merge?: boolean;
  mergeThreshold?: number; // world units
}

export interface SubdivideModifierSettings {
  level: number; // 1..3 typical
  smooth?: boolean; // apply Laplacian smoothing after subdivision
  smoothIterations?: number; // 0..5
  smoothStrength?: number; // 0..1 (lambda)
}

export type ModifierSettings =
  | { type: 'mirror'; value: MirrorModifierSettings }
  | { type: 'subdivide'; value: SubdivideModifierSettings }
  | { type: 'array'; value: ArrayModifierSettings }
  | { type: 'weld'; value: WeldModifierSettings }
  | { type: 'triangulate'; value: TriangulateModifierSettings }
  | { type: 'edge-split'; value: EdgeSplitModifierSettings }
  | { type: 'decimate'; value: DecimateModifierSettings }
  | { type: 'solidify'; value: SolidifyModifierSettings }
  | { type: 'screw'; value: ScrewModifierSettings }
  | { type: 'bevel'; value: BevelModifierSettings }
  | { type: 'remesh'; value: RemeshModifierSettings }
  | { type: 'volume-to-mesh'; value: VolumeToMeshModifierSettings };

export interface ModifierStackItem {
  id: string;
  type: ModifierType;
  enabled: boolean;
  // settings stored as simple object per type
  settings: any;
}

// New modifier settings
export interface ArrayModifierSettings {
  count: number; // >= 2
  offset: Vector3; // per-instance offset
}

export interface WeldModifierSettings {
  distance: number; // merge threshold
}

export interface EdgeSplitModifierSettings {
  angle: number; // degrees 0..180
}

export interface DecimateModifierSettings {
  ratio: number; // 0..1 keep ratio (1 keeps all)
}

export interface SolidifyModifierSettings {
  thickness: number; // world units
}

export interface ScrewModifierSettings {
  steps: number; // number of clones
  angle: number; // total rotation in degrees
  height: number; // total height along axis (Z)
}

export type TriangulateModifierSettings = Record<string, never>;

export interface BevelModifierSettings {
  width: number; // world units
  segments: number; // 1..5
  miter?: 'sharp' | 'chamfer' | 'arc';
  angleThreshold?: number; // degrees 0..180
  clampWidth?: boolean; // prevent width larger than local edge distances
  cullDegenerate?: boolean; // drop near-zero-area faces
}

export interface RemeshModifierSettings {
  mode: 'blocks' | 'quads' | 'smooth';
  voxelSize: number; // approximate size
}

export interface VolumeToMeshModifierSettings {
  threshold: number;
}

// Re-export geometry types for convenience in consumers
export type { Mesh, Vertex, Face, Vector3 };

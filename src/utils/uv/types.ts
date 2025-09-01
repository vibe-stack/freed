import type { Vector2 } from '@/types/geometry';

// Shared UV mapping types
export type Axis = 'x' | 'y' | 'z';

export type Island = { faceIds: string[]; verts: Set<string> };

// Options for Smart UV Project
export type MarginMethod = 'fraction' | 'add' | 'scaled';
export type RotationMethod = 'axis-aligned' | 'axis-aligned-vertical' | 'axis-aligned-horizontal';
export type SmartUVOptions = {
  angleLimitDeg: number; // dihedral split limit in degrees
  marginMethod: MarginMethod;
  rotationMethod: RotationMethod;
  islandMargin: number; // value interpreted per marginMethod
  areaWeight: number; // 0..1, how much to weight areas when scaling islands
  correctAspect: boolean;
  scaleToBounds: boolean;
  selection?: Set<string>; // optional subset of vertex ids to operate on
};

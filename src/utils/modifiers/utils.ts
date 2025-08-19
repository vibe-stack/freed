import type {
  ModifierType,
  MirrorModifierSettings,
  SubdivideModifierSettings,
  ArrayModifierSettings,
  WeldModifierSettings,
  EdgeSplitModifierSettings,
  DecimateModifierSettings,
  SolidifyModifierSettings,
  ScrewModifierSettings,
  BevelModifierSettings,
  RemeshModifierSettings,
  VolumeToMeshModifierSettings,
} from './types';

export const createDefaultSettings = (type: ModifierType): any => {
  switch (type) {
    case 'mirror':
      return { axis: 'x', merge: true, mergeThreshold: 0.0001 } as MirrorModifierSettings;
    case 'subdivide':
      return { level: 1, smooth: true, smoothIterations: 1, smoothStrength: 0.2 } as SubdivideModifierSettings;
    case 'array':
      return { count: 2, offset: { x: 1, y: 0, z: 0 } } as ArrayModifierSettings;
    case 'weld':
      return { distance: 0.0001 } as WeldModifierSettings;
    case 'triangulate':
      return {};
    case 'edge-split':
      return { angle: 30 } as EdgeSplitModifierSettings;
    case 'decimate':
      return { ratio: 0.5 } as DecimateModifierSettings;
    case 'solidify':
      return { thickness: 0.02 } as SolidifyModifierSettings;
    case 'screw':
      return { steps: 8, angle: 360, height: 1 } as ScrewModifierSettings;
    case 'bevel':
      return { width: 0.02, segments: 1 } as BevelModifierSettings;
    case 'remesh':
      return { mode: 'quads', voxelSize: 0.1 } as RemeshModifierSettings;
    case 'volume-to-mesh':
      return { threshold: 0.5 } as VolumeToMeshModifierSettings;
    default:
      return {};
  }
};

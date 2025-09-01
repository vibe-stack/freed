// Barrel module: re-export public API split across optimized modules
export type { Axis, SmartUVOptions, MarginMethod, RotationMethod } from './uv/types';
export { fitUVs01, scaleOffsetUVs } from './uv/common';
export { planarProject, sphereProject, cubeProject } from './uv/projections';
export { unwrapMeshBySeams } from './uv/seams';
export { smartUVProject } from './uv/smart';

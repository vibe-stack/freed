import { buildEdgesFromFaces, calculateVertexNormals } from '@/utils/geometry';
import type { Mesh } from '@/types/geometry';
import type { ModifierStackItem } from './types';
import { mirrorModifier } from './mirror';
import { subdivideModifier } from './subdivide';
import { arrayModifier } from './array';
import { weldModifier } from './weld';
import { triangulateModifier } from './triangulate';
import { edgeSplitModifier } from './edge-split';
import { decimateModifier } from './decimate';
import { solidifyModifier } from './solidify';
import { screwModifier } from './screw';
import { bevelModifier } from './bevel';
import { remeshModifier } from './remesh';
import { volumeToMeshModifier } from './volume-to-mesh';

export function applyModifiersToMesh(base: Mesh, stack: ModifierStackItem[]): Mesh {
  // Start from a shallow copy of base but with cloned topology arrays
  let cur: Mesh = {
    ...base,
    vertices: base.vertices.map(v => ({ ...v, position: { ...v.position }, normal: { ...v.normal }, uv: { ...v.uv } })),
    faces: base.faces.map(f => ({ ...f, vertexIds: [...f.vertexIds] })),
    edges: base.edges.slice(),
  };

  for (const item of stack) {
    if (!item.enabled) continue;
    switch (item.type) {
      case 'mirror':
        cur = mirrorModifier(cur, item.settings);
        break;
      case 'subdivide':
        cur = subdivideModifier(cur, item.settings);
        break;
      case 'array':
        cur = arrayModifier(cur, item.settings);
        break;
      case 'weld':
        cur = weldModifier(cur, item.settings);
        break;
      case 'triangulate':
        cur = triangulateModifier(cur);
        break;
      case 'edge-split':
        cur = edgeSplitModifier(cur, item.settings);
        break;
      case 'decimate':
        cur = decimateModifier(cur, item.settings);
        break;
      case 'solidify':
        cur = solidifyModifier(cur, item.settings);
        break;
      case 'screw':
        cur = screwModifier(cur, item.settings);
        break;
      case 'bevel':
        cur = bevelModifier(cur, item.settings);
        break;
      case 'remesh':
        cur = remeshModifier(cur, item.settings);
        break;
      case 'volume-to-mesh':
        cur = volumeToMeshModifier(cur, item.settings);
        break;
      default:
        break;
    }
  }

  // Rebuild edges and normals once at end for stability
  const edges = buildEdgesFromFaces(cur.vertices, cur.faces);
  const vertices = calculateVertexNormals({ ...cur, edges } as Mesh);
  return { ...cur, edges, vertices };
}

import type { Mesh } from '@/types/geometry';
import type { Axis } from './types';
import { fitUVs01 } from './common';

export function planarProject(mesh: Mesh, axis: Axis = 'z', vertexIds?: Set<string>) {
  const verts = vertexIds ? mesh.vertices.filter(v => vertexIds.has(v.id)) : mesh.vertices;
  for (let i = 0; i < verts.length; i++) {
    const v = verts[i];
    const p = v.position;
    if (axis === 'z') v.uv = { x: p.x, y: p.y };
    else if (axis === 'y') v.uv = { x: p.x, y: p.z };
    else v.uv = { x: p.z, y: p.y };
  }
  fitUVs01(mesh, vertexIds);
}

export function sphereProject(mesh: Mesh, vertexIds?: Set<string>) {
  const verts = vertexIds ? mesh.vertices.filter(v => vertexIds.has(v.id)) : mesh.vertices;
  for (let i = 0; i < verts.length; i++) {
    const v = verts[i];
    const p = v.position;
    const r = Math.max(1e-6, Math.hypot(p.x, p.y, p.z));
    const theta = Math.atan2(p.z, p.x);
    const phi = Math.acos(Math.max(-1, Math.min(1, p.y / r)));
    v.uv = { x: (theta + Math.PI) / (2 * Math.PI), y: 1 - phi / Math.PI };
  }
}

export function cubeProject(mesh: Mesh, vertexIds?: Set<string>) {
  const verts = vertexIds ? mesh.vertices.filter(v => vertexIds.has(v.id)) : mesh.vertices;
  for (let i = 0; i < verts.length; i++) {
    const v = verts[i];
    const p = v.position;
    const n = v.normal || { x: 0, y: 0, z: 1 };
    const anX = Math.abs(n.x), anY = Math.abs(n.y), anZ = Math.abs(n.z);
    if (anX >= anY && anX >= anZ) {
      const u = n.x >= 0 ? p.z : -p.z;
      const w = p.y;
      v.uv = { x: u, y: w };
    } else if (anY >= anX && anY >= anZ) {
      const u = p.x;
      const w = n.y >= 0 ? p.z : -p.z;
      v.uv = { x: u, y: w };
    } else {
      const u = n.z >= 0 ? p.x : -p.x;
      const w = p.y;
      v.uv = { x: u, y: w };
    }
  }
  fitUVs01(mesh, vertexIds);
}

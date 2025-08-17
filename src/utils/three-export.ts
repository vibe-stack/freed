'use client';

// Utilities to convert internal scene to THREE.Scene and export via three.js exporters

import { Scene, Group, Mesh as ThreeMesh, BufferGeometry, Float32BufferAttribute, Color as ThreeColor, MeshStandardMaterial, Vector3 as ThreeVector3 } from 'three';
import type { Mesh as GMesh, SceneObject, Material as GMaterial } from '@/types/geometry';
import { convertQuadToTriangles } from '@/utils/geometry';

export type ExportFormat = 'gltf' | 'glb' | 'obj' | 'stl';

export type ExportBuildInput = {
  objects: Record<string, SceneObject>;
  rootObjects: string[];
  meshes: Map<string, GMesh>;
  materials: Map<string, GMaterial>;
  includeObjectIds: string[]; // which scene object ids to include
  includeChildren: boolean;
};

/** Build a THREE.Scene with selected objects */
export function buildThreeScene(input: ExportBuildInput): Scene {
  const scene = new Scene();

  const include = new Set<string>();
  const addWithChildren = (id: string) => {
    if (include.has(id)) return;
    include.add(id);
    if (!input.includeChildren) return;
    const o = input.objects[id];
    if (o) o.children.forEach(addWithChildren);
  };
  input.includeObjectIds.forEach(addWithChildren);

  const idToThree: Record<string, Group | ThreeMesh> = {};

  // Build hierarchy only for included nodes (and their ancestors)
  const ensureParent = (id: string): Group | undefined => {
    const o = input.objects[id];
    if (!o) return undefined;
    if (idToThree[id]) return idToThree[id] as Group;
    const group = new Group();
    group.name = o.name;
    group.position.set(o.transform.position.x, o.transform.position.y, o.transform.position.z);
    group.rotation.set(o.transform.rotation.x, o.transform.rotation.y, o.transform.rotation.z);
    group.scale.set(o.transform.scale.x, o.transform.scale.y, o.transform.scale.z);
    idToThree[id] = group;
    if (o.parentId && input.objects[o.parentId]) {
      const parent = ensureParent(o.parentId);
      parent?.add(group);
    } else {
      // attach to scene root
      scene.add(group);
    }
    return group;
  };

  // Helper to create a Three mesh from internal mesh data
  const buildThreeMesh = (mesh: GMesh): ThreeMesh => {
    const geo = new BufferGeometry();
    const vertexMap = new Map(mesh.vertices.map((v) => [v.id, v] as const));
    const positions: number[] = [];
    const normals: number[] = [];

    mesh.faces.forEach((face) => {
      const tris = convertQuadToTriangles(face.vertexIds);
      tris.forEach((tri) => {
        const v0 = vertexMap.get(tri[0])!;
        const v1 = vertexMap.get(tri[1])!;
        const v2 = vertexMap.get(tri[2])!;
        const p0 = new ThreeVector3(v0.position.x, v0.position.y, v0.position.z);
        const p1 = new ThreeVector3(v1.position.x, v1.position.y, v1.position.z);
        const p2 = new ThreeVector3(v2.position.x, v2.position.y, v2.position.z);
        const faceNormal = new ThreeVector3().subVectors(p1, p0).cross(new ThreeVector3().subVectors(p2, p0)).normalize();
        positions.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
        if ((mesh.shading ?? 'flat') === 'smooth') {
          const n0 = v0.normal; const n1 = v1.normal; const n2 = v2.normal;
          normals.push(n0.x, n0.y, n0.z, n1.x, n1.y, n1.z, n2.x, n2.y, n2.z);
        } else {
          for (let i = 0; i < 3; i++) normals.push(faceNormal.x, faceNormal.y, faceNormal.z);
        }
      });
    });

    geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new Float32BufferAttribute(normals, 3));
    geo.computeBoundingSphere();

    // Material
    let color = new ThreeColor(0.8, 0.8, 0.85);
    let roughness = 0.8;
    let metalness = 0.05;
    let emissive = new ThreeColor(0, 0, 0);
    if (mesh.materialId) {
      const matRes = input.materials.get(mesh.materialId);
      if (matRes) {
        color = new ThreeColor(matRes.color.x, matRes.color.y, matRes.color.z);
        roughness = matRes.roughness;
        metalness = matRes.metalness;
        emissive = new ThreeColor(matRes.emissive.x, matRes.emissive.y, matRes.emissive.z);
      }
    }
    const mat = new MeshStandardMaterial({ color, roughness, metalness, emissive });
    const threeMesh = new ThreeMesh(geo, mat);
    threeMesh.castShadow = !!mesh.castShadow;
    threeMesh.receiveShadow = !!mesh.receiveShadow;
    return threeMesh;
  };

  // Attach included objects
  for (const id of include) {
    const o = input.objects[id];
    if (!o || !o.render) continue; // export only renderable objects
    const parent = ensureParent(id)!;
    if (o.type === 'mesh' && o.meshId) {
      const gm = input.meshes.get(o.meshId);
      if (!gm) continue;
      const m = buildThreeMesh(gm);
      // local transform already on group; just add mesh as child
      parent.add(m);
    }
  }

  return scene;
}

export type ExportResult = { blob: Blob; suggestedName: string };

/**
 * Export a THREE.Scene to various formats using dynamic imports from three/examples.
 */
export async function exportThreeScene(scene: Scene, format: ExportFormat, nameBase: string): Promise<ExportResult> {
  if (format === 'gltf' || format === 'glb') {
    const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');
    const exporter = new GLTFExporter();
    const options: any = { binary: format === 'glb' };
    const data: any = await new Promise((resolve, reject) => {
      exporter.parse(
        scene,
        (result) => resolve(result),
        (err) => reject(err),
        options
      );
    });
    if (format === 'glb') {
      const blob = new Blob([data as ArrayBuffer], { type: 'model/gltf-binary' });
      return { blob, suggestedName: `${nameBase}.glb` };
    } else {
      const json = typeof data === 'string' ? data : JSON.stringify(data);
      const blob = new Blob([json], { type: 'model/gltf+json' });
      return { blob, suggestedName: `${nameBase}.gltf` };
    }
  }

  if (format === 'obj') {
    const { OBJExporter } = await import('three/examples/jsm/exporters/OBJExporter.js');
    const exporter = new OBJExporter();
    const result: string = exporter.parse(scene);
    const blob = new Blob([result], { type: 'text/plain' });
    return { blob, suggestedName: `${nameBase}.obj` };
  }

  if (format === 'stl') {
    const { STLExporter } = await import('three/examples/jsm/exporters/STLExporter.js');
    const exporter = new STLExporter();
    const result: string | ArrayBuffer = exporter.parse(scene, { binary: false });
    const blob = new Blob([result as string], { type: 'model/stl' });
    return { blob, suggestedName: `${nameBase}.stl` };
  }

  throw new Error('Unsupported format');
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

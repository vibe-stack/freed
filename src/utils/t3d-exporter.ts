// T3D File Exporter
// Exports the current workspace state to a .t3d file format

import JSZip from 'jszip';
import { 
  T3DScene, 
  T3DExportFilter, 
  T3DExportConfig, 
  T3D_VERSION, 
  T3D_APPLICATION, 
  T3D_APPLICATION_VERSION,
  T3DMesh,
  T3DMaterial,
  T3DSceneObject,
  T3DViewport
} from '../types/t3d';
import { Mesh, Material, SceneObject, ViewportState } from '../types/geometry';
import { useAnimationStore } from '@/stores/animation-store';

/**
 * Converts internal Vector3 to T3D format
 */
function vector3ToT3D(v: { x: number; y: number; z: number }) {
  return { x: v.x, y: v.y, z: v.z };
}

/**
 * Converts internal Vector2 to T3D format
 */
function vector2ToT3D(v: { x: number; y: number }) {
  return { x: v.x, y: v.y };
}

/**
 * Converts internal mesh to T3D format
 */
function meshToT3D(mesh: Mesh): T3DMesh {
  return {
    id: mesh.id,
    name: mesh.name,
    vertices: mesh.vertices.map(vertex => ({
      id: vertex.id,
      position: vector3ToT3D(vertex.position),
      normal: vector3ToT3D(vertex.normal),
      uv: vector2ToT3D(vertex.uv),
      selected: vertex.selected,
    })),
    edges: mesh.edges.map(edge => ({
      id: edge.id,
      vertexIds: edge.vertexIds,
      faceIds: [...edge.faceIds],
      selected: edge.selected,
    })),
    faces: mesh.faces.map(face => ({
      id: face.id,
      vertexIds: [...face.vertexIds],
      normal: vector3ToT3D(face.normal),
      materialId: face.materialId,
      selected: face.selected,
    })),
    transform: {
      position: vector3ToT3D(mesh.transform.position),
      rotation: vector3ToT3D(mesh.transform.rotation),
      scale: vector3ToT3D(mesh.transform.scale),
    },
    visible: mesh.visible,
    locked: mesh.locked,
  };
}

/**
 * Converts internal material to T3D format
 */
function materialToT3D(material: Material): T3DMaterial {
  return {
    id: material.id,
    name: material.name,
    color: vector3ToT3D(material.color),
    roughness: material.roughness,
    metalness: material.metalness,
    emissive: vector3ToT3D(material.emissive),
  emissiveIntensity: material.emissiveIntensity,
  };
}

/**
 * Converts internal scene object to T3D format
 */
function sceneObjectToT3D(object: SceneObject): T3DSceneObject {
  return {
    id: object.id,
    name: object.name,
    type: object.type,
    parentId: object.parentId,
    children: [...object.children],
    transform: {
      position: vector3ToT3D(object.transform.position),
      rotation: vector3ToT3D(object.transform.rotation),
      scale: vector3ToT3D(object.transform.scale),
    },
    visible: object.visible,
    locked: object.locked,
  render: object.render,
    meshId: object.meshId,
  };
}

/**
 * Converts internal viewport state to T3D format
 */
function viewportToT3D(viewport: ViewportState): T3DViewport {
  return {
    camera: {
      position: vector3ToT3D(viewport.camera.position),
      target: vector3ToT3D(viewport.camera.target),
      up: vector3ToT3D(viewport.camera.up),
      fov: viewport.camera.fov,
      near: viewport.camera.near,
      far: viewport.camera.far,
    },
    shadingMode: viewport.shadingMode,
    showGrid: viewport.showGrid,
    showAxes: viewport.showAxes,
    gridSize: viewport.gridSize,
    backgroundColor: vector3ToT3D(viewport.backgroundColor),
  };
}

/**
 * Filters data based on the provided filter
 */
function applyFilter<T extends { id: string }>(
  data: T[], 
  filter: string[] | undefined
): T[] {
  if (!filter) return data;
  return data.filter(item => filter.includes(item.id));
}

export interface WorkspaceData {
  meshes: Mesh[];
  materials: Material[];
  objects: SceneObject[];
  rootObjects: string[];
  viewport: ViewportState;
  selectedObjectId: string | null;
}

/**
 * Exports workspace data to T3D format
 */
export async function exportToT3D(
  workspaceData: WorkspaceData,
  filter: T3DExportFilter | null = null,
  config: T3DExportConfig = {}
): Promise<Blob> {
  const {
    compressed = true,
    prettyPrint = false,
    includeAssets = true,
  } = config;

  // Apply filters
  const filteredMeshes = filter?.includeMeshes 
    ? applyFilter(workspaceData.meshes, filter.includeMeshes)
    : workspaceData.meshes;

  const filteredMaterials = filter?.includeMaterials
    ? applyFilter(workspaceData.materials, filter.includeMaterials)
    : workspaceData.materials;

  const filteredObjects = filter?.includeObjects
    ? applyFilter(workspaceData.objects, filter.includeObjects)
    : workspaceData.objects;

  // Create T3D scene
  const t3dScene: T3DScene = {
    metadata: {
      version: T3D_VERSION,
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      application: T3D_APPLICATION,
      applicationVersion: T3D_APPLICATION_VERSION,
    },
    meshes: filteredMeshes.map(meshToT3D),
    materials: filteredMaterials.map(materialToT3D),
    objects: filteredObjects.map(sceneObjectToT3D),
    rootObjects: [...workspaceData.rootObjects],
    viewport: filter?.includeViewport !== false ? viewportToT3D(workspaceData.viewport) : {
      camera: {
        position: { x: 5, y: 5, z: 5 },
        target: { x: 0, y: 0, z: 0 },
        up: { x: 0, y: 1, z: 0 },
        fov: 50,
        near: 0.1,
        far: 1000,
      },
      shadingMode: 'solid',
      showGrid: true,
      showAxes: true,
      gridSize: 10,
      backgroundColor: { x: 0.2, y: 0.2, z: 0.2 },
    },
    selectedObjectId: workspaceData.selectedObjectId,
  };

  // Optionally include animations and UI prefs (MVP)
  try {
    const a = useAnimationStore.getState();
    const activeClip = a.activeClipId ? a.clips[a.activeClipId] : null;
    t3dScene.animations = {
      fps: a.fps,
      activeClipId: a.activeClipId,
      clips: a.clipOrder.map((cid) => {
        const c = a.clips[cid];
        return {
          id: c.id, name: c.name, start: c.start, end: c.end, loop: c.loop, speed: c.speed,
          tracks: c.trackIds.map((tid) => {
            const tr = a.tracks[tid];
            return {
              id: tr.id, targetId: tr.targetId, property: tr.property,
              keys: tr.channel.keys.map((k) => ({ id: k.id, t: k.t, v: k.v, interp: k.interp }))
            };
          })
        };
      }),
    };
    t3dScene.ui = { timelinePanelOpen: a.timelinePanelOpen, lastUsedFps: a.lastUsedFps };
  } catch {}

  // Create ZIP file
  const zip = new JSZip();
  
  // Add scene.json
  const sceneJson = prettyPrint 
    ? JSON.stringify(t3dScene, null, 2)
    : JSON.stringify(t3dScene);
  
  zip.file('scene.json', sceneJson);
  
  // Create assets folder (for future use with textures)
  if (includeAssets) {
    zip.folder('assets');
    // Add a placeholder file to ensure the folder exists
    zip.file('assets/.gitkeep', '');
  }

  // Generate and return the blob
  const blob = await zip.generateAsync({
    type: 'blob',
    compression: compressed ? 'DEFLATE' : 'STORE',
    compressionOptions: {
      level: compressed ? 6 : 0,
    },
  });

  return blob;
}

/**
 * Downloads a T3D file to the user's computer
 */
export function downloadT3D(blob: Blob, filename: string = 'scene.t3d'): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.t3d') ? filename : `${filename}.t3d`;
  
  // Append to body, click, and remove
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Clean up the URL
  URL.revokeObjectURL(url);
}

/**
 * Helper function to export and download in one step
 */
export async function exportAndDownload(
  workspaceData: WorkspaceData,
  filename: string = 'scene.t3d',
  filter: T3DExportFilter | null = null,
  config: T3DExportConfig = {}
): Promise<void> {
  try {
    const blob = await exportToT3D(workspaceData, filter, config);
    downloadT3D(blob, filename);
  } catch (error) {
    console.error('Failed to export T3D file:', error);
    throw new Error('Export failed. Please try again.');
  }
}

// T3D File Importer
// Imports a .t3d file format into the current workspace

import JSZip from 'jszip';
import { 
  T3DScene, 
  T3D_VERSION, 
  T3DMesh,
  T3DMaterial,
  T3DSceneObject,
  T3DViewport
} from '../types/t3d';
import { 
  Mesh, 
  Material, 
  SceneObject, 
  ViewportState, 
  Vector3, 
  Vector2,
  Vertex,
  Edge,
  Face,
  Transform
} from '../types/geometry';

/**
 * Converts T3D Vector3 to internal format
 */
function t3dToVector3(v: { x: number; y: number; z: number }): Vector3 {
  return { x: v.x, y: v.y, z: v.z };
}

/**
 * Converts T3D Vector2 to internal format
 */
function t3dToVector2(v: { x: number; y: number }): Vector2 {
  return { x: v.x, y: v.y };
}

/**
 * Converts T3D mesh to internal format
 */
function t3dToMesh(t3dMesh: T3DMesh): Mesh {
  const vertices: Vertex[] = t3dMesh.vertices.map(vertex => ({
    id: vertex.id,
    position: t3dToVector3(vertex.position),
    normal: t3dToVector3(vertex.normal),
    uv: t3dToVector2(vertex.uv),
    selected: vertex.selected,
  }));

  const edges: Edge[] = t3dMesh.edges.map(edge => ({
    id: edge.id,
    vertexIds: edge.vertexIds,
    faceIds: [...edge.faceIds],
    selected: edge.selected,
  }));

  const faces: Face[] = t3dMesh.faces.map(face => ({
    id: face.id,
    vertexIds: [...face.vertexIds],
    normal: t3dToVector3(face.normal),
    materialId: face.materialId,
    selected: face.selected,
  }));

  const transform: Transform = {
    position: t3dToVector3(t3dMesh.transform.position),
    rotation: t3dToVector3(t3dMesh.transform.rotation),
    scale: t3dToVector3(t3dMesh.transform.scale),
  };

  return {
    id: t3dMesh.id,
    name: t3dMesh.name,
    vertices,
    edges,
    faces,
    transform,
    visible: t3dMesh.visible,
    locked: t3dMesh.locked,
  };
}

/**
 * Converts T3D material to internal format
 */
function t3dToMaterial(t3dMaterial: T3DMaterial): Material {
  return {
    id: t3dMaterial.id,
    name: t3dMaterial.name,
    color: t3dToVector3(t3dMaterial.color),
    roughness: t3dMaterial.roughness,
    metalness: t3dMaterial.metalness,
    emissive: t3dToVector3(t3dMaterial.emissive),
  };
}

/**
 * Converts T3D scene object to internal format
 */
function t3dToSceneObject(t3dObject: T3DSceneObject): SceneObject {
  const transform: Transform = {
    position: t3dToVector3(t3dObject.transform.position),
    rotation: t3dToVector3(t3dObject.transform.rotation),
    scale: t3dToVector3(t3dObject.transform.scale),
  };

  return {
    id: t3dObject.id,
    name: t3dObject.name,
    type: t3dObject.type,
    parentId: t3dObject.parentId,
    children: [...t3dObject.children],
    transform,
    visible: t3dObject.visible,
    locked: t3dObject.locked,
    meshId: t3dObject.meshId,
  };
}

/**
 * Converts T3D viewport to internal format
 */
function t3dToViewport(t3dViewport: T3DViewport): ViewportState {
  return {
    camera: {
      position: t3dToVector3(t3dViewport.camera.position),
      target: t3dToVector3(t3dViewport.camera.target),
      up: t3dToVector3(t3dViewport.camera.up),
      fov: t3dViewport.camera.fov,
      near: t3dViewport.camera.near,
      far: t3dViewport.camera.far,
    },
    shadingMode: t3dViewport.shadingMode,
    showGrid: t3dViewport.showGrid,
    showAxes: t3dViewport.showAxes,
    gridSize: t3dViewport.gridSize,
    backgroundColor: t3dToVector3(t3dViewport.backgroundColor),
  };
}

/**
 * Checks if the T3D version is compatible with the current importer
 */
function isVersionCompatible(version: { major: number; minor: number; patch: number }): boolean {
  // For now, we only support the same major version
  return version.major === T3D_VERSION.major;
}

export interface ImportedWorkspaceData {
  meshes: Mesh[];
  materials: Material[];
  objects: SceneObject[];
  rootObjects: string[];
  viewport: ViewportState;
  selectedObjectId: string | null;
  metadata: {
    version: string;
    created: string;
    modified: string;
    author?: string;
    description?: string;
    application: string;
    applicationVersion: string;
  };
}

/**
 * Imports a T3D file from a File object
 */
export async function importFromT3D(file: File): Promise<ImportedWorkspaceData> {
  try {
    // Load the zip file
    const zip = new JSZip();
    const zipContents = await zip.loadAsync(file);

    // Check if scene.json exists
    const sceneFile = zipContents.file('scene.json');
    if (!sceneFile) {
      throw new Error('Invalid T3D file: scene.json not found');
    }

    // Parse scene.json
    const sceneJsonText = await sceneFile.async('text');
    let t3dScene: T3DScene;
    
    try {
      t3dScene = JSON.parse(sceneJsonText);
    } catch (parseError) {
      throw new Error('Invalid T3D file: scene.json is not valid JSON');
    }

    // Validate the file structure
    if (!t3dScene.metadata || !t3dScene.meshes || !t3dScene.materials || !t3dScene.objects) {
      throw new Error('Invalid T3D file: missing required data');
    }

    // Check version compatibility
    if (!isVersionCompatible(t3dScene.metadata.version)) {
      const versionString = `${t3dScene.metadata.version.major}.${t3dScene.metadata.version.minor}.${t3dScene.metadata.version.patch}`;
      const currentVersionString = `${T3D_VERSION.major}.${T3D_VERSION.minor}.${T3D_VERSION.patch}`;
      throw new Error(`Incompatible T3D version: ${versionString}. Current version: ${currentVersionString}`);
    }

    // Convert T3D data to internal format
    const meshes = t3dScene.meshes.map(t3dToMesh);
    const materials = t3dScene.materials.map(t3dToMaterial);
    const objects = t3dScene.objects.map(t3dToSceneObject);
    const viewport = t3dToViewport(t3dScene.viewport);

    return {
      meshes,
      materials,
      objects,
      rootObjects: [...t3dScene.rootObjects],
      viewport,
      selectedObjectId: t3dScene.selectedObjectId,
      metadata: {
        version: `${t3dScene.metadata.version.major}.${t3dScene.metadata.version.minor}.${t3dScene.metadata.version.patch}`,
        created: t3dScene.metadata.created,
        modified: t3dScene.metadata.modified,
        author: t3dScene.metadata.author,
        description: t3dScene.metadata.description,
        application: t3dScene.metadata.application,
        applicationVersion: t3dScene.metadata.applicationVersion,
      },
    };

  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to import T3D file: Unknown error occurred');
  }
}

/**
 * Imports a T3D file from a Blob
 */
export async function importFromT3DBlob(blob: Blob): Promise<ImportedWorkspaceData> {
  // Convert blob to File object for consistent handling
  const file = new File([blob], 'imported.t3d', { type: 'application/zip' });
  return importFromT3D(file);
}

/**
 * Creates a file input element for importing T3D files
 */
export function createFileInput(
  onImport: (data: ImportedWorkspaceData) => void,
  onError: (error: Error) => void
): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.t3d';
  input.style.display = 'none';
  
  input.addEventListener('change', async (event) => {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    
    if (file) {
      try {
        const data = await importFromT3D(file);
        onImport(data);
      } catch (error) {
        onError(error as Error);
      }
    }
    
    // Clean up
    target.value = '';
  });
  
  return input;
}

/**
 * Opens a file dialog to import a T3D file
 */
export function openImportDialog(
  onImport: (data: ImportedWorkspaceData) => void,
  onError: (error: Error) => void
): void {
  const input = createFileInput(onImport, onError);
  document.body.appendChild(input);
  input.click();
  document.body.removeChild(input);
}

'use client';

// OBJ importer: loads a Wavefront OBJ file and inserts its content into the scene

import type {
    Mesh as GMesh,
    Material as GMaterial,
    SceneObject,
    Vector3 as GVec3,
    Vector2 as GVec2,
    Vertex,
    Face,
} from '@/types/geometry';
import { createVertex, createFace, vec3, vec2, calculateVertexNormals, buildEdgesFromFaces } from '@/utils/geometry';
import { useGeometryStore } from '@/stores/geometry-store';
import { useSceneStore } from '@/stores/scene-store';
import { nanoid } from 'nanoid';

export type OBJImportSummary = {
    rootGroupId: string;
    createdObjectIds: string[];
    createdMeshIds: string[];
    createdMaterialIds: string[];
    warnings: string[];
};

interface OBJParseResult {
    vertices: GVec3[];
    normals: GVec3[];
    uvs: GVec2[];
    faces: Array<{
        vertices: number[];
        normals?: number[];
        uvs?: number[];
    }>;
    objects: Array<{
        name: string;
        faces: number[];
    }>;
    materials: Array<{
        name: string;
        color?: GVec3;
        roughness?: number;
        metalness?: number;
        emissive?: GVec3;
    }>;
}

function parseOBJ(text: string): OBJParseResult {
    const lines = text.split('\n');
    const vertices: GVec3[] = [];
    const normals: GVec3[] = [];
    const uvs: GVec2[] = [];
    const faces: Array<{
        vertices: number[];
        normals?: number[];
        uvs?: number[];
    }> = [];
    const objects: Array<{
        name: string;
        faces: number[];
    }> = [];
    const materials: Array<{
        name: string;
        color?: GVec3;
        roughness?: number;
        metalness?: number;
        emissive?: GVec3;
    }> = [];

    let currentObject = { name: 'default', faces: [] as number[] };
    let currentMaterial: string | null = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Skip empty lines and comments
        if (!line || line.startsWith('#')) continue;

        const parts = line.split(/\s+/);
        const command = parts[0];

        try {
            switch (command) {
                case 'v': {
                    // Vertex position: v x y z [w]
                    if (parts.length < 4) throw new Error(`Invalid vertex at line ${i + 1}`);
                    const x = parseFloat(parts[1]);
                    const y = parseFloat(parts[2]);
                    const z = parseFloat(parts[3]);
                    if (isNaN(x) || isNaN(y) || isNaN(z)) {
                        throw new Error(`Invalid vertex coordinates at line ${i + 1}`);
                    }
                    vertices.push(vec3(x, y, z));
                    break;
                }

                case 'vn': {
                    // Vertex normal: vn x y z
                    if (parts.length < 4) throw new Error(`Invalid normal at line ${i + 1}`);
                    const x = parseFloat(parts[1]);
                    const y = parseFloat(parts[2]);
                    const z = parseFloat(parts[3]);
                    if (isNaN(x) || isNaN(y) || isNaN(z)) {
                        throw new Error(`Invalid normal coordinates at line ${i + 1}`);
                    }
                    normals.push(vec3(x, y, z));
                    break;
                }

                case 'vt': {
                    // Vertex texture coordinate: vt u v [w]
                    if (parts.length < 3) throw new Error(`Invalid texture coordinate at line ${i + 1}`);
                    const u = parseFloat(parts[1]);
                    const v = parseFloat(parts[2]);
                    if (isNaN(u) || isNaN(v)) {
                        throw new Error(`Invalid texture coordinates at line ${i + 1}`);
                    }
                    uvs.push(vec2(u, v));
                    break;
                }

                case 'f': {
                    // Face: f v1[/vt1[/vn1]] v2[/vt2[/vn2]] v3[/vt3[/vn3]] ...
                    if (parts.length < 4) throw new Error(`Face needs at least 3 vertices at line ${i + 1}`);
                    
                    const faceVertices: number[] = [];
                    const faceUVs: number[] = [];
                    const faceNormals: number[] = [];
                    let hasUVs = false;
                    let hasNormals = false;

                    for (let j = 1; j < parts.length; j++) {
                        const vertexData = parts[j].split('/');
                        
                        // Parse vertex index (required)
                        const vIdx = parseInt(vertexData[0]);
                        if (isNaN(vIdx) || vIdx === 0) {
                            throw new Error(`Invalid vertex index at line ${i + 1}`);
                        }
                        // Convert 1-based to 0-based, handle negative indices
                        const vertexIndex = vIdx > 0 ? vIdx - 1 : vertices.length + vIdx;
                        if (vertexIndex < 0 || vertexIndex >= vertices.length) {
                            throw new Error(`Vertex index ${vIdx} out of range at line ${i + 1}`);
                        }
                        faceVertices.push(vertexIndex);

                        // Parse UV index (optional)
                        if (vertexData.length > 1 && vertexData[1]) {
                            const uvIdx = parseInt(vertexData[1]);
                            if (!isNaN(uvIdx) && uvIdx !== 0) {
                                const uvIndex = uvIdx > 0 ? uvIdx - 1 : uvs.length + uvIdx;
                                if (uvIndex >= 0 && uvIndex < uvs.length) {
                                    faceUVs.push(uvIndex);
                                    hasUVs = true;
                                }
                            }
                        }

                        // Parse normal index (optional)
                        if (vertexData.length > 2 && vertexData[2]) {
                            const nIdx = parseInt(vertexData[2]);
                            if (!isNaN(nIdx) && nIdx !== 0) {
                                const normalIndex = nIdx > 0 ? nIdx - 1 : normals.length + nIdx;
                                if (normalIndex >= 0 && normalIndex < normals.length) {
                                    faceNormals.push(normalIndex);
                                    hasNormals = true;
                                }
                            }
                        }
                    }

                    if (faceVertices.length < 3) {
                        throw new Error(`Face needs at least 3 vertices at line ${i + 1}`);
                    }

                    const face: any = { vertices: faceVertices };
                    if (hasUVs && faceUVs.length === faceVertices.length) {
                        face.uvs = faceUVs;
                    }
                    if (hasNormals && faceNormals.length === faceVertices.length) {
                        face.normals = faceNormals;
                    }

                    const faceIndex = faces.length;
                    faces.push(face);
                    currentObject.faces.push(faceIndex);
                    break;
                }

                case 'o':
                case 'g': {
                    // Object/Group: o name or g name
                    if (currentObject.faces.length > 0) {
                        objects.push(currentObject);
                    }
                    const name = parts.slice(1).join(' ') || `object_${objects.length}`;
                    currentObject = { name, faces: [] };
                    break;
                }

                case 'usemtl': {
                    // Use material: usemtl material_name
                    currentMaterial = parts.slice(1).join(' ') || null;
                    break;
                }

                case 'mtllib': {
                    // Material library reference: mtllib filename
                    // Note: We don't actually load MTL files in this basic implementation
                    break;
                }

                default:
                    // Ignore unknown commands
                    break;
            }
        } catch (error) {
            throw new Error(`Parse error at line ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    // Add the last object if it has faces
    if (currentObject.faces.length > 0) {
        objects.push(currentObject);
    }

    // If no explicit objects were defined, create a default one
    if (objects.length === 0 && faces.length > 0) {
        objects.push({
            name: 'default',
            faces: faces.map((_, index) => index)
        });
    }

    return {
        vertices,
        normals,
        uvs,
        faces,
        objects,
        materials
    };
}

function createMeshFromOBJData(
    name: string,
    objVertices: GVec3[],
    objNormals: GVec3[],
    objUVs: GVec2[],
    objFaces: Array<{
        vertices: number[];
        normals?: number[];
        uvs?: number[];
    }>,
    faceIndices: number[]
): GMesh {
    const vertices: Vertex[] = [];
    const faces: Face[] = [];
    const vertexMap = new Map<string, string>(); // Maps unique vertex key to vertex ID

    // Helper to create unique key for vertex
    const getVertexKey = (vIdx: number, nIdx?: number, uvIdx?: number) => {
        return `${vIdx}_${nIdx ?? 'none'}_${uvIdx ?? 'none'}`;
    };

    // Process each face
    for (const faceIdx of faceIndices) {
        const objFace = objFaces[faceIdx];
        if (!objFace) continue;

        const faceVertexIds: string[] = [];

        // Process each vertex in the face
        for (let i = 0; i < objFace.vertices.length; i++) {
            const vIdx = objFace.vertices[i];
            const nIdx = objFace.normals?.[i];
            const uvIdx = objFace.uvs?.[i];

            const key = getVertexKey(vIdx, nIdx, uvIdx);
            
            let vertexId = vertexMap.get(key);
            if (!vertexId) {
                // Create new vertex
                const position = objVertices[vIdx];
                const normal = nIdx !== undefined ? objNormals[nIdx] : vec3(0, 1, 0);
                const uv = uvIdx !== undefined ? objUVs[uvIdx] : vec2(0, 0);

                const vertex = createVertex(position, normal, uv);
                vertices.push(vertex);
                vertexId = vertex.id;
                vertexMap.set(key, vertexId);
            }

            faceVertexIds.push(vertexId);
        }

        // Create face (triangulate if necessary)
        if (faceVertexIds.length === 3) {
            // Triangle
            faces.push(createFace(faceVertexIds));
        } else if (faceVertexIds.length === 4) {
            // Quad - split into two triangles
            faces.push(createFace([faceVertexIds[0], faceVertexIds[1], faceVertexIds[2]]));
            faces.push(createFace([faceVertexIds[0], faceVertexIds[2], faceVertexIds[3]]));
        } else if (faceVertexIds.length > 4) {
            // N-gon - fan triangulation from first vertex
            for (let i = 1; i < faceVertexIds.length - 1; i++) {
                faces.push(createFace([faceVertexIds[0], faceVertexIds[i], faceVertexIds[i + 1]]));
            }
        }
    }

    // Build edges from faces
    const edges = buildEdgesFromFaces(vertices, faces);

    // Create mesh
    const mesh: GMesh = {
        id: nanoid(),
        name,
        vertices,
        edges,
        faces,
        transform: {
            position: vec3(0, 0, 0),
            rotation: vec3(0, 0, 0),
            scale: vec3(1, 1, 1),
        },
        visible: true,
        locked: false,
        shading: 'smooth'
    };

    // Calculate normals if not provided in OBJ
    if (objNormals.length === 0) {
        mesh.vertices = calculateVertexNormals(mesh);
    }

    return mesh;
}

export async function importOBJFile(file: File): Promise<OBJImportSummary> {
    const warnings: string[] = [];
    const geom = useGeometryStore.getState();
    const scene = useSceneStore.getState();

    const nameBase = file.name.replace(/\.obj$/i, '');
    
    // Validate file
    if (!file) {
        throw new Error('No file provided');
    }
    
    if (file.size === 0) {
        throw new Error('File is empty');
    }
    
    if (file.size > 50 * 1024 * 1024) { // 50MB limit
        throw new Error('File is too large (maximum 50MB)');
    }
    
    try {
        // Read file as text
        const text = await file.text();
        
        if (!text || text.trim().length === 0) {
            throw new Error('File contains no content');
        }
        
        // Parse OBJ data
        const objData = parseOBJ(text);
        
        if (objData.vertices.length === 0) {
            throw new Error('No vertices found in OBJ file');
        }

        const createdObjectIds: string[] = [];
        const createdMeshIds: string[] = [];
        const createdMaterialIds: string[] = [];

        // Create root group for imported objects
        const rootGroupId = scene.createGroupObject(`Imported ${nameBase}`);

        // Create default material if none exists
        let defaultMaterialId: string | undefined;
        if (objData.objects.length > 0) {
            const defaultMaterial: GMaterial = {
                id: nanoid(),
                name: 'OBJ Material',
                color: vec3(0.8, 0.8, 0.8),
                roughness: 0.8,
                metalness: 0.05,
                emissive: vec3(0, 0, 0),
                emissiveIntensity: 1,
            };
            geom.addMaterial(defaultMaterial);
            defaultMaterialId = defaultMaterial.id;
            createdMaterialIds.push(defaultMaterial.id);
        }

        // Create meshes for each object
        for (const objObject of objData.objects) {
            if (objObject.faces.length === 0) {
                warnings.push(`Object '${objObject.name}' has no faces, skipping`);
                continue;
            }

            try {
                const mesh = createMeshFromOBJData(
                    objObject.name,
                    objData.vertices,
                    objData.normals,
                    objData.uvs,
                    objData.faces,
                    objObject.faces
                );

                // Assign default material
                if (defaultMaterialId) {
                    (mesh as any).materialId = defaultMaterialId;
                }

                geom.addMesh(mesh);
                createdMeshIds.push(mesh.id);

                // Create scene object
                const objectId = scene.createMeshObject(objObject.name, mesh.id);
                scene.setParent(objectId, rootGroupId);
                createdObjectIds.push(objectId);

            } catch (error) {
                warnings.push(`Failed to create mesh for object '${objObject.name}': ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }

        if (createdMeshIds.length === 0) {
            throw new Error('No valid meshes could be created from OBJ file');
        }

        return {
            rootGroupId,
            createdObjectIds,
            createdMeshIds,
            createdMaterialIds,
            warnings
        };

    } catch (error) {
        throw new Error(`Failed to import OBJ file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

export function openOBJImportDialog(
    onDone?: (summary: OBJImportSummary) => void,
    onError?: (e: Error) => void
) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.obj,model/obj,text/plain';
    input.style.display = 'none';
    input.addEventListener('change', async (ev) => {
        const file = (ev.target as HTMLInputElement).files?.[0];
        if (!file) return;
        try {
            const summary = await importOBJFile(file);
            onDone?.(summary);
        } catch (e) {
            onError?.(e as Error);
        } finally {
            if (ev.target) {
                (ev.target as HTMLInputElement).value = '';
            }
        }
    });
    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
}
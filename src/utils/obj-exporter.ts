'use client';

// OBJ exporter: exports meshes to Wavefront OBJ format

import type { Mesh, Vector3, Vector2 } from '@/types/geometry';
import { useGeometryStore } from '@/stores/geometry-store';
import { useSceneStore } from '@/stores/scene-store';

export interface OBJExportOptions {
    includeNormals?: boolean;
    includeUVs?: boolean;
    selectedOnly?: boolean;
    meshIds?: string[];
    exportMaterials?: boolean;
}

export interface OBJExportResult {
    objContent: string;
    mtlContent?: string;
    filename: string;
    warnings: string[];
}

function formatVector3(v: Vector3, precision: number = 6): string {
    return `${v.x.toFixed(precision)} ${v.y.toFixed(precision)} ${v.z.toFixed(precision)}`;
}

function formatVector2(v: Vector2, precision: number = 6): string {
    return `${v.x.toFixed(precision)} ${v.y.toFixed(precision)}`;
}

function sanitizeName(name: string): string {
    // Replace invalid characters with underscores
    return name.replace(/[^a-zA-Z0-9_-]/g, '_');
}

export function exportMeshesToOBJ(
    meshes: Mesh[],
    options: OBJExportOptions = {}
): OBJExportResult {
    const {
        includeNormals = true,
        includeUVs = true,
        exportMaterials = false
    } = options;

    const warnings: string[] = [];
    let objContent = '';
    let mtlContent = '';

    // Validate input
    if (!meshes || !Array.isArray(meshes)) {
        throw new Error('Invalid meshes array provided');
    }

    // Add header comment
    objContent += `# Exported from Gestalt 3D Editor\n`;
    objContent += `# ${new Date().toISOString()}\n\n`;

    if (meshes.length === 0) {
        warnings.push('No meshes to export');
        return {
            objContent,
            mtlContent: exportMaterials ? mtlContent : undefined,
            filename: 'empty.obj',
            warnings
        };
    }

    // Validate meshes
    const validMeshes = meshes.filter(mesh => {
        if (!mesh) {
            warnings.push('Null mesh found, skipping');
            return false;
        }
        if (!mesh.vertices || !Array.isArray(mesh.vertices)) {
            warnings.push(`Mesh '${mesh.name || 'unnamed'}' has invalid vertices, skipping`);
            return false;
        }
        if (!mesh.faces || !Array.isArray(mesh.faces)) {
            warnings.push(`Mesh '${mesh.name || 'unnamed'}' has invalid faces, skipping`);
            return false;
        }
        return true;
    });

    if (validMeshes.length === 0) {
        warnings.push('No valid meshes to export');
        return {
            objContent,
            mtlContent: exportMaterials ? mtlContent : undefined,
            filename: 'empty.obj',
            warnings
        };
    }

    // Global vertex, normal, and UV counters
    let globalVertexIndex = 1;
    let globalNormalIndex = 1;
    let globalUVIndex = 1;

    // Store materials for MTL export
    const materials = new Set<string>();
    const geom = useGeometryStore.getState();

    // Reference MTL file if exporting materials
    if (exportMaterials) {
        const baseFilename = 'exported';
        objContent += `mtllib ${baseFilename}.mtl\n\n`;
        
        // MTL header
        mtlContent += `# Material file exported from Gestalt 3D Editor\n`;
        mtlContent += `# ${new Date().toISOString()}\n\n`;
    }

    // Process each mesh
    for (const mesh of validMeshes) {
        try {
            objContent += `# Object: ${mesh.name}\n`;
            objContent += `o ${sanitizeName(mesh.name)}\n\n`;

            // Check if mesh has valid data
            if (mesh.vertices.length === 0) {
                warnings.push(`Mesh '${mesh.name}' has no vertices, skipping`);
                continue;
            }

            if (mesh.faces.length === 0) {
                warnings.push(`Mesh '${mesh.name}' has no faces, skipping`);
                continue;
            }

            // Create vertex ID to index mapping for this mesh
            const vertexIdToIndex = new Map<string, number>();
            const vertexIndexToGlobalIndex = new Map<number, number>();

            // Export vertices
            objContent += `# Vertices (${mesh.vertices.length})\n`;
            mesh.vertices.forEach((vertex, index) => {
                const pos = vertex.position;
                objContent += `v ${formatVector3(pos)}\n`;
                vertexIdToIndex.set(vertex.id, index);
                vertexIndexToGlobalIndex.set(index, globalVertexIndex++);
            });
            objContent += '\n';

            // Export UVs if requested and available
            let hasUVs = false;
            if (includeUVs) {
                const uvVertices = mesh.vertices.filter(v => v.uv);
                if (uvVertices.length > 0) {
                    hasUVs = true;
                    objContent += `# Texture coordinates (${uvVertices.length})\n`;
                    mesh.vertices.forEach((vertex) => {
                        const uv = vertex.uv;
                        // OBJ V coordinate is inverted compared to standard UV
                        objContent += `vt ${formatVector2({ x: uv.x, y: 1.0 - uv.y })}\n`;
                    });
                    objContent += '\n';
                }
            }

            // Export normals if requested and available
            let hasNormals = false;
            if (includeNormals) {
                const normalVertices = mesh.vertices.filter(v => v.normal);
                if (normalVertices.length > 0) {
                    hasNormals = true;
                    objContent += `# Normals (${normalVertices.length})\n`;
                    mesh.vertices.forEach((vertex) => {
                        const normal = vertex.normal;
                        objContent += `vn ${formatVector3(normal)}\n`;
                    });
                    objContent += '\n';
                }
            }

            // Handle material
            let currentMaterial: string | null = null;
            if (exportMaterials && mesh.materialId) {
                const material = geom.materials.get(mesh.materialId);
                if (material) {
                    const matName = sanitizeName(material.name);
                    currentMaterial = matName;
                    materials.add(mesh.materialId);
                    objContent += `usemtl ${matName}\n`;
                }
            }

            // Export faces
            objContent += `# Faces (${mesh.faces.length})\n`;
            for (const face of mesh.faces) {
                if (face.vertexIds.length < 3) {
                    warnings.push(`Face in mesh '${mesh.name}' has less than 3 vertices, skipping`);
                    continue;
                }

                let faceString = 'f';
                
                for (const vertexId of face.vertexIds) {
                    const localIndex = vertexIdToIndex.get(vertexId);
                    if (localIndex === undefined) {
                        warnings.push(`Invalid vertex reference in face of mesh '${mesh.name}'`);
                        continue;
                    }

                    const globalIndex = vertexIndexToGlobalIndex.get(localIndex);
                    if (globalIndex === undefined) {
                        warnings.push(`Could not find global index for vertex in mesh '${mesh.name}'`);
                        continue;
                    }

                    // Build face vertex reference: v[/vt[/vn]]
                    let vertexRef = globalIndex.toString();
                    
                    if (hasUVs) {
                        vertexRef += `/${globalIndex}`;
                    } else if (hasNormals) {
                        vertexRef += '/';
                    }
                    
                    if (hasNormals) {
                        if (!hasUVs) {
                            vertexRef += '/';
                        }
                        vertexRef += globalIndex.toString();
                    }
                    
                    faceString += ` ${vertexRef}`;
                }
                
                objContent += faceString + '\n';
            }

            objContent += '\n';

            // Update global indices for normals and UVs
            if (hasNormals) {
                globalNormalIndex += mesh.vertices.length;
            }
            if (hasUVs) {
                globalUVIndex += mesh.vertices.length;
            }

        } catch (error) {
            warnings.push(`Error exporting mesh '${mesh.name}': ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    // Export materials to MTL content
    if (exportMaterials && materials.size > 0) {
        for (const materialId of materials) {
            const material = geom.materials.get(materialId);
            if (!material) continue;

            const matName = sanitizeName(material.name);
            mtlContent += `newmtl ${matName}\n`;
            
            // Basic PBR properties
            mtlContent += `Kd ${formatVector3(material.color)}\n`; // Diffuse color
            mtlContent += `Ks ${formatVector3(material.emissive)}\n`; // Specular color (using emissive)
            mtlContent += `Ns ${(1 - material.roughness) * 1000}\n`; // Specular exponent (inverse of roughness)
            
            // Transparency
            mtlContent += `d 1.0\n`; // Opacity (full opacity)
            
            // Illumination model (2 = highlight on)
            mtlContent += `illum 2\n`;
            
            mtlContent += '\n';
        }
    }

    // Generate filename
    const meshNames = validMeshes.map(m => sanitizeName(m.name)).join('_');
    const filename = meshNames.length > 20 
        ? `exported_${validMeshes.length}_meshes.obj`
        : `${meshNames}.obj`;

    return {
        objContent: objContent.trim(),
        mtlContent: exportMaterials ? mtlContent.trim() : undefined,
        filename,
        warnings
    };
}

export function exportSelectedMeshesToOBJ(options: OBJExportOptions = {}): OBJExportResult {
    const geom = useGeometryStore.getState();
    const scene = useSceneStore.getState();
    
    let meshesToExport: Mesh[] = [];

    if (options.meshIds) {
        // Export specific meshes by ID
        meshesToExport = options.meshIds
            .map(id => geom.meshes.get(id))
            .filter((mesh): mesh is Mesh => mesh !== undefined);
    } else if (options.selectedOnly) {
        // Export currently selected objects' meshes
        const selectedObjectIds = scene.selectedObjectId ? [scene.selectedObjectId] : [];
        
        meshesToExport = selectedObjectIds
            .map(objId => scene.objects[objId])
            .filter(obj => obj && obj.type === 'mesh' && obj.meshId)
            .map(obj => geom.meshes.get(obj.meshId!))
            .filter((mesh): mesh is Mesh => mesh !== undefined);
    } else {
        // Export all meshes
        meshesToExport = Array.from(geom.meshes.values());
    }

    return exportMeshesToOBJ(meshesToExport, options);
}

export function downloadOBJExport(
    result: OBJExportResult,
    baseFilename?: string
): void {
    const { objContent, mtlContent, filename } = result;
    
    // Determine base filename
    const baseName = baseFilename || filename.replace(/\.obj$/, '');
    
    // Download OBJ file
    const objBlob = new Blob([objContent], { type: 'text/plain' });
    const objUrl = URL.createObjectURL(objBlob);
    const objLink = document.createElement('a');
    objLink.href = objUrl;
    objLink.download = `${baseName}.obj`;
    objLink.style.display = 'none';
    document.body.appendChild(objLink);
    objLink.click();
    document.body.removeChild(objLink);
    URL.revokeObjectURL(objUrl);

    // Download MTL file if materials were exported
    if (mtlContent) {
        const mtlBlob = new Blob([mtlContent], { type: 'text/plain' });
        const mtlUrl = URL.createObjectURL(mtlBlob);
        const mtlLink = document.createElement('a');
        mtlLink.href = mtlUrl;
        mtlLink.download = `${baseName}.mtl`;
        mtlLink.style.display = 'none';
        document.body.appendChild(mtlLink);
        mtlLink.click();
        document.body.removeChild(mtlLink);
        URL.revokeObjectURL(mtlUrl);
    }
}

export function exportAndDownloadOBJ(
    options: OBJExportOptions = {},
    filename?: string
): OBJExportResult {
    const result = exportSelectedMeshesToOBJ(options);
    downloadOBJExport(result, filename);
    return result;
}
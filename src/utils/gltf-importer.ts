'use client';

// GLB/GLTF importer: loads a glTF/GLB file and inserts its content into the scene

import type {
    Mesh as GMesh,
    Material as GMaterial,
    SceneObject,
    Vector3 as GVec3,
    Vertex,
    Face,
} from '@/types/geometry';
import { createMeshFromGeometry, createVertex, createFace, vec3 } from '@/utils/geometry';
import { useGeometryStore } from '@/stores/geometry-store';
import type { ShaderGraph, ShaderNode } from '@/types/shader';
import { ensureFileIdForBlob, type FileId } from '@/stores/files-store';
import { useSceneStore } from '@/stores/scene-store';
import { nanoid } from 'nanoid';

export type ImportSummary = {
    rootGroupId: string;
    createdObjectIds: string[];
    createdMeshIds: string[];
    createdMaterialIds: string[];
    createdLightIds: string[]; // light component ids
    createdCameraIds: string[]; // camera resource ids
    warnings: string[];
};

function toVec3(x: number, y: number, z: number): GVec3 { return { x, y, z }; }

/** Build our geometry buffers from a THREE.BufferGeometry */
function buildGeometryFromThreeGeometry(geo: any): { vertices: Vertex[]; faces: Face[] } {
    const pos = geo.getAttribute('position');
    if (!pos) throw new Error('Mesh has no position attribute');
    const nor = geo.getAttribute('normal');
    const uv = geo.getAttribute('uv');

    const vertices: Vertex[] = [];
    const vidMap: number[] = []; // three vertex index -> vertices index
    const vcount = pos.count;
    for (let i = 0; i < vcount; i++) {
        const p = toVec3(pos.getX(i), pos.getY(i), pos.getZ(i));
        const n = nor ? toVec3(nor.getX(i), nor.getY(i), nor.getZ(i)) : toVec3(0, 1, 0);
        const u = uv ? { x: uv.getX(i), y: uv.getY(i) } : { x: 0, y: 0 };
        const v = createVertex(p, n, u);
        vidMap[i] = vertices.push(v) - 1;
    }

    const faces: Face[] = [];
    if (geo.index) {
        const idx = geo.index;
        const triCount = Math.floor(idx.count / 3);
        for (let t = 0; t < triCount; t++) {
            const a = idx.getX(3 * t + 0);
            const b = idx.getX(3 * t + 1);
            const c = idx.getX(3 * t + 2);
            const fa = vertices[vidMap[a]].id;
            const fb = vertices[vidMap[b]].id;
            const fc = vertices[vidMap[c]].id;
            faces.push(createFace([fa, fb, fc]));
        }
    } else {
        const triCount = Math.floor(vcount / 3);
        for (let t = 0; t < triCount; t++) {
            const a = 3 * t + 0;
            const b = 3 * t + 1;
            const c = 3 * t + 2;
            const fa = vertices[vidMap[a]].id;
            const fb = vertices[vidMap[b]].id;
            const fc = vertices[vidMap[c]].id;
            faces.push(createFace([fa, fb, fc]));
        }
    }
    return { vertices, faces };
}

/** Create a base material resource from a THREE material (numeric PBR factors). Graph/textures are handled separately. */
function materialFromThree(mat: any): GMaterial {
    const color = mat?.color ? toVec3(mat.color.r, mat.color.g, mat.color.b) : toVec3(0.8, 0.8, 0.85);
    const roughness = typeof mat?.roughness === 'number' ? mat.roughness : 0.8;
    const metalness = typeof mat?.metalness === 'number' ? mat.metalness : 0.05;
    const emissive = mat?.emissive ? toVec3(mat.emissive.r, mat.emissive.g, mat.emissive.b) : toVec3(0, 0, 0);
    const emissiveIntensity = typeof mat?.emissiveIntensity === 'number' ? mat.emissiveIntensity : 1;
    return {
        id: nanoid(),
        name: (mat?.name as string) || 'Material',
        color,
        roughness,
        metalness,
        emissive,
        emissiveIntensity,
    };
}

/** Convert a THREE.Object3D transform to our Transform partial */
function transformFromObject3D(obj: any) {
    return {
        position: vec3(obj.position.x, obj.position.y, obj.position.z),
        rotation: vec3(obj.rotation.x, obj.rotation.y, obj.rotation.z),
        scale: vec3(obj.scale.x, obj.scale.y, obj.scale.z),
    } as SceneObject['transform'];
}

/** Import a GLB/GLTF file into the current scene, grouped under a new root */
export async function importGLTFFile(file: File): Promise<ImportSummary> {
    const warnings: string[] = [];
    const geom = useGeometryStore.getState();
    const scene = useSceneStore.getState();

    const nameBase = file.name.replace(/\.(glb|gltf)$/i, '');
    const rootGroupId = scene.createGroupObject(`Imported ${nameBase}`);

    // Dynamically import loader to avoid SSR issues
    const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
    const loader = new GLTFLoader();

    const arrayBuf = await file.arrayBuffer();

    const gltf: any = await new Promise((resolve, reject) => {
        loader.parse(arrayBuf as ArrayBuffer, '', (g: any) => resolve(g), (e: any) => reject(e));
    });

    const createdObjectIds: string[] = [];
    const createdMeshIds: string[] = [];
    const createdMaterialIds: string[] = [];
    const createdLightIds: string[] = [];
    const createdCameraIds: string[] = [];
    const materialGraphBuilds: Promise<void>[] = [];

    // Map THREE.Material -> materialId (dedupe)
    const matIdByThree = new Map<any, string>();
    const texFileIdByThree = new Map<any, Promise<FileId | null>>();

    async function imageToBlob(img: any, mime: string = 'image/png'): Promise<Blob> {
        // Supports HTMLImageElement or ImageBitmap
        const w = img?.width ?? img?.videoWidth ?? 0;
        const h = img?.height ?? img?.videoHeight ?? 0;
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, w);
        canvas.height = Math.max(1, h);
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas 2D context unavailable');
        try {
            ctx.drawImage(img, 0, 0);
        } catch {
            // Some image types may not be drawable; fallback to blank
        }
        const blob: Blob = await new Promise((resolve, reject) => {
            canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), mime);
        });
        return blob;
    }

    async function getFileIdForThreeTexture(tex: any, nameHint: string): Promise<FileId | null> {
        if (!tex) return null;
        if (texFileIdByThree.has(tex)) return texFileIdByThree.get(tex)!;
        const p = (async () => {
            // Try to extract a Blob from the texture's image
            const img = tex.image || tex.source?.data;
            if (!img) return null;
            try {
                const blob = await imageToBlob(img, 'image/png');
                const fileId = await ensureFileIdForBlob(blob, `${nameHint || tex.name || 'texture'}.png`);
                return fileId;
            } catch {
                return null;
            }
        })();
        texFileIdByThree.set(tex, p);
        return p;
    }

    function addNode(type: string, x: number, y: number, data: Record<string, any> = {}): ShaderNode {
        return { id: nanoid(), type: type as any, position: { x, y }, hidden: false, data } as any;
    }

    function addEdge(a: ShaderNode, aHandle: string, b: ShaderNode, bHandle: string) {
        return { id: nanoid(), source: a.id, sourceHandle: aHandle, target: b.id, targetHandle: bHandle } as any;
    }

    async function buildShaderGraphForThreeMaterial(mat: any, materialId: string) {
        // Gather textures and factors
        const baseMap = mat?.map;
        const mrMap = mat?.metalnessMap || mat?.roughnessMap || mat?.metalnessRoughnessMap || mat?.metalRoughnessMap;
        const emissiveMap = mat?.emissiveMap;
        const aoMap = mat?.aoMap || mat?.occlusionMap;
        // const normalMap = mat?.normalMap; // TODO: needs proper TBN support

        const baseId = await getFileIdForThreeTexture(baseMap, 'BaseColor');
        const mrId = await getFileIdForThreeTexture(mrMap, 'MetalRough');
        const emiId = await getFileIdForThreeTexture(emissiveMap, 'Emissive');
        const aoId = await getFileIdForThreeTexture(aoMap, 'Occlusion');

        // If no textures, keep default auto graph; but still bake numeric factors
        const hasAnyTex = !!(baseId || mrId || emiId || aoId);
        if (!hasAnyTex) {
            // Ensure default graph updated with numeric factors from material
            geom.updateShaderGraph(materialId, (g) => {
                // Replace default constant nodes values to match imported numeric properties
                const colorNode = g.nodes.find((n: any) => n.id === 'color' || (n as any).type === 'const-color');
                const roughNode = g.nodes.find((n: any) => n.id === 'rough' || (n as any).type === 'const-float');
                const metalNode = g.nodes.find((n: any) => n.id === 'metal' || (n as any).type === 'const-float');
                const emisNode = g.nodes.find((n: any) => n.id === 'emissive' || (n as any).type === 'const-color');
                const emisIntNode = g.nodes.find((n: any) => n.id === 'emissiveIntensity' || (n as any).type === 'const-float');
                if (colorNode && (colorNode as any).type === 'const-color' && mat?.color) {
                    (colorNode as any).data = { r: mat.color.r, g: mat.color.g, b: mat.color.b };
                }
                if (roughNode && (roughNode as any).type === 'const-float' && typeof mat?.roughness === 'number') {
                    (roughNode as any).data = { value: mat.roughness };
                }
                if (metalNode && (metalNode as any).type === 'const-float' && typeof mat?.metalness === 'number') {
                    (metalNode as any).data = { value: mat.metalness };
                }
                if (emisNode && (emisNode as any).type === 'const-color' && mat?.emissive) {
                    (emisNode as any).data = { r: mat.emissive.r, g: mat.emissive.g, b: mat.emissive.b };
                }
                if (emisIntNode && (emisIntNode as any).type === 'const-float' && typeof mat?.emissiveIntensity === 'number') {
                    (emisIntNode as any).data = { value: mat.emissiveIntensity };
                }
            });
            return;
        }

        // Build a custom graph
        const nodes: ShaderNode[] = [];
        const edges: any[] = [];
        const idIn = addNode('input', 40, 160);
        const idOut = addNode('output-standard', 820, 160);
        nodes.push(idIn, idOut);

        // Helper to create UV transform input if texture has transforms
        const buildUVFor = (tex: any, baseY: number): ShaderNode | null => {
            if (!tex) return null;
            const needs = (tex.offset?.x || tex.offset?.y || 0) !== 0 || (tex.repeat?.x !== 1 || tex.repeat?.y !== 1) || (tex.rotation || 0) !== 0 || (tex.center && (tex.center.x !== 0 || tex.center.y !== 0));
            if (!needs) return null;
            const uvt = addNode('uvTransform', 280, baseY, {});
            nodes.push(uvt);
            // center (pivot)
            if (tex.center && (tex.center.x !== 0 || tex.center.y !== 0)) {
                const ctr = addNode('vec2', 140, baseY - 80, {});
                const cx = addNode('const-float', 40, baseY - 100, { value: tex.center.x });
                const cy = addNode('const-float', 40, baseY - 60, { value: tex.center.y });
                nodes.push(ctr, cx, cy);
                edges.push(addEdge(cx, 'out', ctr, 'x'), addEdge(cy, 'out', ctr, 'y'), addEdge(ctr, 'out', uvt, 'center'));
            }
            // offset
            if (tex.offset && (tex.offset.x !== 0 || tex.offset.y !== 0)) {
                const off = addNode('vec2', 140, baseY - 40, {});
                const offX = addNode('const-float', 40, baseY - 60, { value: tex.offset.x });
                const offY = addNode('const-float', 40, baseY - 20, { value: tex.offset.y });
                nodes.push(off, offX, offY);
                edges.push(addEdge(offX, 'out', off, 'x'), addEdge(offY, 'out', off, 'y'), addEdge(off, 'out', uvt, 'offset'));
            }
            // scale (repeat)
            if (tex.repeat && (tex.repeat.x !== 1 || tex.repeat.y !== 1)) {
                const scl = addNode('vec2', 140, baseY + 20, {});
                const sx = addNode('const-float', 40, baseY + 0, { value: tex.repeat.x });
                const sy = addNode('const-float', 40, baseY + 40, { value: tex.repeat.y });
                nodes.push(scl, sx, sy);
                edges.push(addEdge(sx, 'out', scl, 'x'), addEdge(sy, 'out', scl, 'y'), addEdge(scl, 'out', uvt, 'scale'));
            }
            // rotation
            if (tex.rotation && tex.rotation !== 0) {
                const rot = addNode('const-float', 140, baseY + 80, { value: tex.rotation });
                nodes.push(rot);
                edges.push(addEdge(rot, 'out', uvt, 'rotation'));
            }
            return uvt;
        };

        // Base color
        if (baseId) {
            const baseTex = addNode('texture', 520, 80, { fileId: baseId, colorSpace: 'sRGB' });
            nodes.push(baseTex);
            const uvt = buildUVFor(baseMap, 80);
            if (uvt) edges.push(addEdge(uvt, 'out', baseTex, 'uv'));
            // Multiply with base color factor if not default
            if (mat?.color && (mat.color.r !== 1 || mat.color.g !== 1 || mat.color.b !== 1)) {
                const colorConst = addNode('const-color', 520, 20, { r: mat.color.r, g: mat.color.g, b: mat.color.b });
                const mul = addNode('mul', 660, 80, {});
                nodes.push(colorConst, mul);
                edges.push(addEdge(baseTex, 'out', mul, 'a'), addEdge(colorConst, 'out', mul, 'b'), addEdge(mul, 'out', idOut, 'color'));
            } else {
                edges.push(addEdge(baseTex, 'out', idOut, 'color'));
            }
        } else {
            // No base texture, set color constant
            const colorConst = addNode('const-color', 520, 80, { r: mat?.color?.r ?? 0.8, g: mat?.color?.g ?? 0.8, b: mat?.color?.b ?? 0.85 });
            nodes.push(colorConst);
            edges.push(addEdge(colorConst, 'out', idOut, 'color'));
        }

        // Metallic-Roughness
        if (mrId) {
            const mrTex = addNode('texture', 520, 200, { fileId: mrId, colorSpace: 'linear' });
            nodes.push(mrTex);
            const uvt = buildUVFor(mrMap, 200);
            if (uvt) edges.push(addEdge(uvt, 'out', mrTex, 'uv'));
            // Channels: G=roughness, B=metalness in glTF; swizzle directly from texture vec4
            const roughSrc = addNode('swizzle', 660, 200, { mask: 'y' });
            const metalSrc = addNode('swizzle', 660, 240, { mask: 'z' });
            nodes.push(roughSrc, metalSrc);
            edges.push(addEdge(mrTex, 'out', roughSrc, 'in'));
            edges.push(addEdge(mrTex, 'out', metalSrc, 'in'));
            // Multiply by scalar factors if present
            if (typeof mat?.roughness === 'number' && mat.roughness !== 1) {
                const rf = addNode('const-float', 760, 180, { value: mat.roughness });
                const rm = addNode('mul', 820, 200, {});
                nodes.push(rf, rm);
                edges.push(addEdge(roughSrc, 'out', rm, 'a'), addEdge(rf, 'out', rm, 'b'), addEdge(rm, 'out', idOut, 'roughness'));
            } else {
                edges.push(addEdge(roughSrc, 'out', idOut, 'roughness'));
            }
            if (typeof mat?.metalness === 'number' && mat.metalness !== 1) {
                const mf = addNode('const-float', 760, 260, { value: mat.metalness });
                const mm = addNode('mul', 820, 240, {});
                nodes.push(mf, mm);
                edges.push(addEdge(metalSrc, 'out', mm, 'a'), addEdge(mf, 'out', mm, 'b'), addEdge(mm, 'out', idOut, 'metalness'));
            } else {
                edges.push(addEdge(metalSrc, 'out', idOut, 'metalness'));
            }
        } else {
            // No MR texture: constants
            const rough = addNode('const-float', 520, 200, { value: typeof mat?.roughness === 'number' ? mat.roughness : 0.8 });
            const metal = addNode('const-float', 520, 240, { value: typeof mat?.metalness === 'number' ? mat.metalness : 0.05 });
            nodes.push(rough, metal);
            edges.push(addEdge(rough, 'out', idOut, 'roughness'), addEdge(metal, 'out', idOut, 'metalness'));
        }

        // Emissive
        if (emiId) {
            const eTex = addNode('texture', 520, 320, { fileId: emiId, colorSpace: 'sRGB' });
            nodes.push(eTex);
            const uvt = buildUVFor(emissiveMap, 320);
            if (uvt) edges.push(addEdge(uvt, 'out', eTex, 'uv'));
            // Multiply with emissive factor if any
            if (mat?.emissive && (mat.emissive.r !== 1 || mat.emissive.g !== 1 || mat.emissive.b !== 1)) {
                const eConst = addNode('const-color', 660, 260, { r: mat.emissive.r, g: mat.emissive.g, b: mat.emissive.b });
                const mul = addNode('mul', 740, 320, {});
                nodes.push(eConst, mul);
                edges.push(addEdge(eTex, 'out', mul, 'a'), addEdge(eConst, 'out', mul, 'b'), addEdge(mul, 'out', idOut, 'emissive'));
            } else {
                edges.push(addEdge(eTex, 'out', idOut, 'emissive'));
            }
            // Emissive intensity
            const ei = addNode('const-float', 520, 380, { value: typeof mat?.emissiveIntensity === 'number' ? mat.emissiveIntensity : 1 });
            nodes.push(ei);
            edges.push(addEdge(ei, 'out', idOut, 'emissiveIntensity'));
        } else {
            const eConst = addNode('const-color', 520, 320, { r: mat?.emissive?.r ?? 0, g: mat?.emissive?.g ?? 0, b: mat?.emissive?.b ?? 0 });
            const ei = addNode('const-float', 520, 380, { value: typeof mat?.emissiveIntensity === 'number' ? mat.emissiveIntensity : 1 });
            nodes.push(eConst, ei);
            edges.push(addEdge(eConst, 'out', idOut, 'emissive'), addEdge(ei, 'out', idOut, 'emissiveIntensity'));
        }

        // Ambient occlusion (if present)
        if (aoId) {
            const aTex = addNode('texture', 520, 460, { fileId: aoId, colorSpace: 'linear' });
            nodes.push(aTex);
            const uvt = buildUVFor(aoMap, 460);
            if (uvt) edges.push(addEdge(uvt, 'out', aTex, 'uv'));
            const ax = addNode('swizzle', 660, 460, { mask: 'x' });
            nodes.push(ax);
            edges.push(addEdge(aTex, 'out', ax, 'in'));
            // Multiply by aoMapIntensity if provided by material
            if (typeof mat?.aoMapIntensity === 'number' && mat.aoMapIntensity !== 1) {
                const ai = addNode('const-float', 740, 440, { value: mat.aoMapIntensity });
                const am = addNode('mul', 800, 460, {});
                nodes.push(ai, am);
                edges.push(addEdge(ax, 'out', am, 'a'), addEdge(ai, 'out', am, 'b'), addEdge(am, 'out', idOut, 'ao'));
            } else {
                edges.push(addEdge(ax, 'out', idOut, 'ao'));
            }
        }

        // Opacity / Alpha cutout from base color alpha
        if (baseId) {
            const baseTexForAlpha = addNode('texture', 520, 520, { fileId: baseId, colorSpace: 'sRGB' });
            nodes.push(baseTexForAlpha);
            const uvtA = buildUVFor(baseMap, 520);
            if (uvtA) edges.push(addEdge(uvtA, 'out', baseTexForAlpha, 'uv'));
            const alpha = addNode('swizzle', 660, 520, { mask: 'w' });
            nodes.push(alpha);
            edges.push(addEdge(baseTexForAlpha, 'out', alpha, 'in'));
            edges.push(addEdge(alpha, 'out', idOut, 'opacity'));
            // Alpha test/cutoff if defined on material (glTF MASK mode)
            if (typeof mat?.alphaTest === 'number' && mat.alphaTest > 0) {
                const at = addNode('const-float', 740, 560, { value: mat.alphaTest });
                nodes.push(at);
                edges.push(addEdge(at, 'out', idOut, 'alphaTest'));
            }
        } else if (typeof mat?.opacity === 'number' && mat.opacity < 1) {
            // No texture alpha; still pass scalar opacity if < 1
            const op = addNode('const-float', 520, 520, { value: mat.opacity });
            nodes.push(op);
            edges.push(addEdge(op, 'out', idOut, 'opacity'));
            if (typeof mat?.alphaTest === 'number' && mat.alphaTest > 0) {
                const at = addNode('const-float', 560, 560, { value: mat.alphaTest });
                nodes.push(at);
                edges.push(addEdge(at, 'out', idOut, 'alphaTest'));
            }
        }

        const graph: ShaderGraph = { materialId, nodes, edges } as any;
        geom.setShaderGraph(materialId, graph);
    }

    const ensureMaterial = (mat: any): string | undefined => {
        if (!mat) return undefined;
        const existing = matIdByThree.get(mat);
        if (existing) return existing;
        const mres = materialFromThree(mat);
        geom.addMaterial(mres);
        createdMaterialIds.push(mres.id);
        matIdByThree.set(mat, mres.id);
        // Build graph asynchronously
        materialGraphBuilds.push(buildShaderGraphForThreeMaterial(mat, mres.id).catch((e) => {
            warnings.push(`Failed to build shader graph for material '${mres.name}': ${(e as Error).message}`);
        }));
        return mres.id;
    };

    // Walk and create scene objects
    const visit = (obj: any, parentId: string | null) => {
        const isMesh = obj.isMesh || obj.isSkinnedMesh;
        const isLight = obj.isLight === true;
        const isCamera = obj.isCamera === true;

        // For plain groups with no direct component, create a group SceneObject
        let thisId: string | null = null;

        if (isMesh) {
            try {
                const geo = obj.geometry;
                const { vertices, faces } = buildGeometryFromThreeGeometry(geo);
                const mesh: GMesh = createMeshFromGeometry(obj.name || 'Mesh', vertices, faces);
                // Assign material if available (first material when array)
                const tMat = Array.isArray(obj.material) ? obj.material[0] : obj.material;
                const matId = ensureMaterial(tMat);
                if (matId) (mesh as any).materialId = matId;
                geom.addMesh(mesh);
                createdMeshIds.push(mesh.id);
                const oid = scene.createMeshObject(obj.name || `Mesh ${mesh.id.slice(-4)}`, mesh.id);
                scene.setParent(oid, parentId);
                scene.setTransform(oid, transformFromObject3D(obj));
                thisId = oid;
                createdObjectIds.push(oid);
            } catch (e) {
                warnings.push(`Failed to import mesh '${obj.name}': ${(e as Error).message}`);
            }
        } else if (isLight) {
            try {
                let type: 'directional' | 'spot' | 'point' = 'point';
                if (obj.isDirectionalLight) type = 'directional';
                else if (obj.isSpotLight) type = 'spot';
                else if (obj.isPointLight) type = 'point';
                const oid = scene.createLightObject(obj.name || `${type} light`, type);
                scene.setParent(oid, parentId);
                scene.setTransform(oid, transformFromObject3D(obj));
                const sid = (scene.getObject(oid) as any)?.lightId as string | undefined;
                if (sid) {
                    createdLightIds.push(sid);
                    // Update light component properties
                    const col = obj.color; const inten = obj.intensity ?? 1;
                    useSceneStore.setState((s) => {
                        const L = s.lights[sid];
                        if (!L) return;
                        L.color = toVec3(col?.r ?? 1, col?.g ?? 1, col?.b ?? 1);
                        L.intensity = inten;
                        if (type === 'spot') {
                            (L as any).angle = obj.angle ?? Math.PI / 6;
                            (L as any).penumbra = obj.penumbra ?? 0.2;
                            (L as any).distance = obj.distance ?? 0;
                            (L as any).decay = obj.decay ?? 2;
                        }
                        if (type === 'point') {
                            (L as any).distance = obj.distance ?? 0;
                            (L as any).decay = obj.decay ?? 2;
                        }
                    });
                }
                thisId = oid;
                createdObjectIds.push(oid);
            } catch (e) {
                warnings.push(`Failed to import light '${obj.name}': ${(e as Error).message}`);
            }
        } else if (isCamera) {
            try {
                const camType: 'perspective' | 'orthographic' = obj.isPerspectiveCamera ? 'perspective' : 'orthographic';
                const oid = useSceneStore.getState().createCameraObject(obj.name || `${camType} camera`, camType);
                scene.setParent(oid, parentId);
                scene.setTransform(oid, transformFromObject3D(obj));
                const camId = useSceneStore.getState().getObject(oid)?.cameraId;
                if (camId) {
                    createdCameraIds.push(camId);
                    useGeometryStore.getState().updateCamera(camId, (c) => {
                        if (camType === 'perspective') {
                            (c as any).fov = obj.fov ?? 50;
                            (c as any).zoom = obj.zoom ?? 1;
                            (c as any).focus = obj.focus ?? 10;
                            (c as any).filmGauge = obj.filmGauge ?? 35;
                            (c as any).filmOffset = obj.filmOffset ?? 0;
                        } else {
                            (c as any).left = obj.left ?? -1;
                            (c as any).right = obj.right ?? 1;
                            (c as any).top = obj.top ?? 1;
                            (c as any).bottom = obj.bottom ?? -1;
                            (c as any).zoom = obj.zoom ?? 1;
                        }
                        c.near = obj.near ?? 0.1;
                        c.far = obj.far ?? 1000;
                    });
                }
                thisId = oid;
                createdObjectIds.push(oid);
            } catch (e) {
                warnings.push(`Failed to import camera '${obj.name}': ${(e as Error).message}`);
            }
        } else {
            // Plain grouping node
            const gid = scene.createGroupObject(obj.name || 'Group');
            scene.setParent(gid, parentId);
            scene.setTransform(gid, transformFromObject3D(obj));
            thisId = gid;
            createdObjectIds.push(gid);
        }

        // Recurse into children
        for (const child of obj.children || []) {
            visit(child, thisId);
        }
    };

    // Seed recursion under the newly created root group
    for (const child of gltf.scene?.children || []) {
        visit(child, rootGroupId);
    }

    if (gltf.animations && gltf.animations.length) {
        warnings.push('Animations found in GLTF, but animation import is not yet implemented.');
    }

    // Ensure all material graphs/textures are prepared
    try { await Promise.all(materialGraphBuilds); } catch { /* handled per-material */ }

    return { rootGroupId, createdObjectIds, createdMeshIds, createdMaterialIds, createdLightIds, createdCameraIds, warnings };
}

export function openGLTFImportDialog(
    onDone?: (summary: ImportSummary) => void,
    onError?: (e: Error) => void
) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.glb,.gltf,model/gltf-binary,model/gltf+json';
    input.style.display = 'none';
    input.addEventListener('change', async (ev) => {
        const file = (ev.target as HTMLInputElement).files?.[0];
        if (!file) return;
        try {
            const summary = await importGLTFFile(file);
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

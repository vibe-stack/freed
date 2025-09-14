import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { nanoid } from 'nanoid';
import type { TerrainGraph, TerrainResource } from '@/types/terrain';
import { useGeometryStore } from './geometry-store';
import { useSceneStore } from './scene-store';
import { buildGridMesh, type GridBuildResult } from '@/utils/terrain/grid';
import { evaluateTerrainGraphToHeightmap, bakeEnhancedNormalMap, computeTerrainGraphSignature } from '../utils/terrain/generate';

interface TerrainState {
  terrains: Record<string, TerrainResource>;
}

interface TerrainActions {
  createTerrain: (params?: Partial<Omit<TerrainResource, 'id' | 'meshId' | 'maps'>>, type?: 'perlin' | 'voronoi' | 'mountain') => { terrainId: string; objectId: string };
  updateTerrain: (terrainId: string, updater: (t: TerrainResource) => void) => void;
  removeTerrain: (terrainId: string) => void;
  setGraph: (terrainId: string, graph: TerrainGraph) => void;
  updateGraph: (terrainId: string, updater: (g: TerrainGraph) => void) => void;
  regenerate: (terrainId: string) => Promise<void>;
}

type TerrainStore = TerrainState & TerrainActions;

// Module-local caches (not part of Zustand state)
const __regenCache = new Map<string, { sig: string; height: Float32Array; normal: Float32Array; heightHash: number }>();
const __inflight = new Map<string, Promise<void>>();

export const useTerrainStore = create<TerrainStore>()(immer((set, get) => ({
  terrains: {},
  createTerrain: (params = {}, type = 'perlin') => {
    const geom = useGeometryStore.getState();
    const scene = useSceneStore.getState();
    const id = nanoid();
    const defaults: Omit<TerrainResource, 'id' | 'meshId' | 'maps'> = {
      name: 'Terrain',
      vertexResolution: { x: 128, y: 128 }, // power-of-two+1 grid
      textureResolution: { width: 128, height: 128 },
      width: 10,
      height: 10,
      heightScale: 3.0, // Elevation multiplier for visible displacement
    } as any;
    const tRes: TerrainResource = { id, meshId: '', ...defaults, ...params } as any;

    // Initial graph with input->type->output chain
    const inputId = nanoid();
    const typeNodeId = nanoid();
    const outputId = nanoid();
    
    // Create type-specific node data
    const typeNodeData = type === 'perlin'
      ? { seed: Math.floor(Math.random() * 1e9), scale: 2, octaves: 4, persistence: 0.5, lacunarity: 2.0, amplitude: 1, operation: 'add', amount: 1 }
      : type === 'voronoi'
        ? { seed: Math.floor(Math.random() * 1e9), density: 4, jitter: 0.5, metric: 'euclidean', feature: 'f1', amplitude: 1, operation: 'add', amount: 1 }
        : type === 'mountain'
          ? { seed: Math.floor(Math.random() * 1e9), centerX: 0.5, centerY: 0.5, radius: 0.35, peak: 1.0, falloff: 2.0, sharpness: 1.5, ridges: 0.2, octaves: 4, gain: 0.5, lacunarity: 2.0, operation: 'add', amount: 1 }
          : { seed: Math.floor(Math.random() * 1e9), scale: 2, octaves: 4, persistence: 0.5, lacunarity: 2.0, amplitude: 1, operation: 'add', amount: 1 }; // fallback to perlin

    const g: TerrainGraph = {
      terrainId: id,
      nodes: [
        { id: inputId, type: 'input', position: { x: 40, y: 160 }, data: {} },
        { id: typeNodeId, type, position: { x: 280, y: 160 }, data: typeNodeData },
        { id: outputId, type: 'output', position: { x: 560, y: 160 }, data: {} },
      ],
      edges: [
        { id: nanoid(), source: inputId, sourceHandle: 'out', target: typeNodeId, targetHandle: 'in' },
        { id: nanoid(), source: typeNodeId, sourceHandle: 'out', target: outputId, targetHandle: 'in' },
      ],
    };

    set((state) => { state.terrains[id] = tRes; });
    // Persist graph in geometry-store (single source of truth)
    useGeometryStore.getState().setTerrainGraph(id, g);

    // Build base grid mesh synchronously
    const grid: GridBuildResult = buildGridMesh(tRes.name, tRes.width, tRes.height, tRes.vertexResolution.x - 1, tRes.vertexResolution.y - 1);
    geom.addMesh(grid.mesh);

    // Link mesh to resource and create scene object
    set((state) => { state.terrains[id].meshId = grid.mesh.id; });
    const object = {
      id: nanoid(),
      name: tRes.name,
      type: 'terrain',
      parentId: null,
      children: [],
      transform: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
      visible: true,
      locked: false,
      render: true,
      meshId: grid.mesh.id,
      terrainId: id,
    } as any;
    scene.addObject(object);
    scene.selectObject(object.id);

    // Bake initial height/normal maps and apply displacement
    get().regenerate(id);

    return { terrainId: id, objectId: object.id };
  },
  updateTerrain: (terrainId, updater) => {
    set((state) => {
      const t = state.terrains[terrainId];
      if (!t) return;
      const oldWidth = t.width;
      const oldHeight = t.height;
      const oldVertexResX = t.vertexResolution.x;
      const oldVertexResY = t.vertexResolution.y;
      
      updater(t);
      
      // Check if we need to rebuild the base mesh (dimensions or vertex resolution changed)
      const needsRebuild = 
        t.width !== oldWidth || 
        t.height !== oldHeight || 
        t.vertexResolution.x !== oldVertexResX || 
        t.vertexResolution.y !== oldVertexResY;
        
      if (needsRebuild) {
        // Rebuild the base mesh with new dimensions
        const geom = useGeometryStore.getState();
        const grid = buildGridMesh(t.name, t.width, t.height, t.vertexResolution.x - 1, t.vertexResolution.y - 1);
        geom.replaceGeometry(t.meshId, grid.mesh.vertices, grid.mesh.faces);
      }
    });
    // Debounce regeneration per terrain
    const key = `__regen_${terrainId}` as const;
    const anyWin = globalThis as any;
    if (anyWin[key]) clearTimeout(anyWin[key]);
    anyWin[key] = setTimeout(() => {
      try { get().regenerate(terrainId); } catch {}
    }, 150);
  },
  removeTerrain: (terrainId) => {
    set((state) => { delete state.terrains[terrainId]; });
    try { useGeometryStore.getState().removeTerrainGraph(terrainId); } catch {}
  },
  setGraph: (terrainId, graph) => { try { useGeometryStore.getState().setTerrainGraph(terrainId, graph); } catch {} },
  updateGraph: (terrainId, updater) => { try { useGeometryStore.getState().updateTerrainGraph(terrainId, updater); } catch {} },
  regenerate: async (terrainId) => {
    const { terrains } = get();
    const t = terrains[terrainId];
    const g = useGeometryStore.getState().terrainGraphs.get(terrainId);
    if (!t || !g) return;

    // Create a stable signature of the computational graph. Moving nodes in the editor
    // should NOT trigger a rebake; only parameter or connectivity changes should.
    const sig = computeTerrainGraphSignature(g, t.surfaceDetail) + `|tex:${t.textureResolution.width}x${t.textureResolution.height}|world:${t.width}x${t.height}|scale:${t.heightScale ?? 3}`;

    // Coalesce concurrent regenerations
    if (__inflight.has(terrainId)) {
      try { await __inflight.get(terrainId); } catch {}
      // After awaiting, fall through to use cache or continue
    }

    // Cache check
    const cached = __regenCache.get(terrainId);
    if (cached && cached.sig === sig) {
      // Use cached maps but still re-apply displacement (mesh might have been rebuilt)
      set((state) => {
        const tt = state.terrains[terrainId];
        if (!tt) return;
        tt.maps = { height: cached.height, normal: cached.normal } as any;
      });

      const geom = useGeometryStore.getState();
      const meshId = t.meshId;
      const mesh = geom.meshes.get(meshId);
      if (!mesh) return;

      const height = cached.height;
      const w = t.textureResolution.width, h = t.textureResolution.height;
      const getHeight = (u: number, v: number) => {
        const fx = u * (w - 1); const fy = v * (h - 1);
        const x0 = Math.floor(fx); const y0 = Math.floor(fy);
        const x1 = Math.min(w - 1, x0 + 1); const y1 = Math.min(h - 1, y0 + 1);
        const tx = fx - x0; const ty = fy - y0;
        const i00 = y0 * w + x0; const i10 = y0 * w + x1; const i01 = y1 * w + x0; const i11 = y1 * w + x1;
        const h00 = height[i00]; const h10 = height[i10]; const h01 = height[i01]; const h11 = height[i11];
        const hx0 = h00 * (1 - tx) + h10 * tx;
        const hx1 = h01 * (1 - tx) + h11 * tx;
        return hx0 * (1 - ty) + hx1 * ty;
      };
      const verts = mesh.vertices.map((vert) => {
        let u = (vert as any).uv?.x; let v = (vert as any).uv?.y;
        if (u === undefined || v === undefined || Number.isNaN(u) || Number.isNaN(v)) {
          const px = (vert.position.x + t.width * 0.5) / Math.max(1e-6, t.width);
          const pz = (vert.position.z + t.height * 0.5) / Math.max(1e-6, t.height);
          u = Math.min(1, Math.max(0, px));
          v = Math.min(1, Math.max(0, pz));
        }
        const elevation = getHeight(u, v);
        const heightScale = t.heightScale ?? 3.0;
        return { ...vert, position: { ...vert.position, y: elevation * heightScale } };
      });
      geom.replaceGeometry(meshId, verts as any, mesh.faces);
      try { geom.recalculateNormals(meshId); } catch {}
      return;
    }

    // Start a new bake and record inflight
    const p = (async () => {
      // Evaluate graph to heightmap (cooperative yielding to keep UI responsive)
      const height = await evaluateTerrainGraphToHeightmap(g, t.textureResolution.width, t.textureResolution.height, t.width, t.height, { 
        yieldEveryRows: 32,
        surfaceDetail: {
          crackDensity: t.surfaceDetail?.crackDensity ?? 0.35,
          crackDepth: t.surfaceDetail?.crackDepth ?? 0.4,
          strataDensity: t.surfaceDetail?.strataDensity ?? 0.45,
          strataDepth: t.surfaceDetail?.strataDepth ?? 0.6,
          roughness: t.surfaceDetail?.roughness ?? 0.30,
          seed: t.surfaceDetail?.seed ?? 42
        }
      });
      const normal = bakeEnhancedNormalMap(height, t.textureResolution.width, t.textureResolution.height, (t.width / t.textureResolution.width), (t.height / t.textureResolution.height), {
        crackDensity: t.surfaceDetail?.crackDensity ?? 0.35,
        crackDepth: t.surfaceDetail?.crackDepth ?? 0.4,
        strataDensity: t.surfaceDetail?.strataDensity ?? 0.45,
        strataDepth: t.surfaceDetail?.strataDepth ?? 0.6,
        roughness: t.surfaceDetail?.roughness ?? 0.30,
        seed: t.surfaceDetail?.seed ?? 42
      });

      // Save in cache
      const hhash = hashFloat32(height);
  __regenCache.set(terrainId, { sig, height, normal, heightHash: hhash });

      // Save maps
      set((state) => {
        const tt = state.terrains[terrainId];
        if (!tt) return;
        tt.maps = { height, normal } as any;
      });

      // Displace grid vertices by sampled height to create actual geometry detail control via vertexResolution
      const geom = useGeometryStore.getState();
      const meshId = t.meshId;
      const mesh = geom.meshes.get(meshId);
      if (!mesh) return;

      // Sample height at each vertex uv (fallback to planar if missing uvs)
      const w = t.textureResolution.width, h = t.textureResolution.height;
      const getHeight = (u: number, v: number) => {
        const fx = u * (w - 1); const fy = v * (h - 1);
        const x0 = Math.floor(fx); const y0 = Math.floor(fy);
        const x1 = Math.min(w - 1, x0 + 1); const y1 = Math.min(h - 1, y0 + 1);
        const tx = fx - x0; const ty = fy - y0;
        const i00 = y0 * w + x0; const i10 = y0 * w + x1; const i01 = y1 * w + x0; const i11 = y1 * w + x1;
        const h00 = height[i00]; const h10 = height[i10]; const h01 = height[i01]; const h11 = height[i11];
        const hx0 = h00 * (1 - tx) + h10 * tx;
        const hx1 = h01 * (1 - tx) + h11 * tx;
        return hx0 * (1 - ty) + hx1 * ty;
      };
      const verts = mesh.vertices.map((vert) => {
        // UV fallback: if uv missing or out of bounds, derive from local XY extent
        let u = vert.uv?.x; let v = vert.uv?.y;
        if (u === undefined || v === undefined || Number.isNaN(u) || Number.isNaN(v)) {
          const px = (vert.position.x + t.width * 0.5) / Math.max(1e-6, t.width);
          const pz = (vert.position.z + t.height * 0.5) / Math.max(1e-6, t.height);
          u = Math.min(1, Math.max(0, px));
          v = Math.min(1, Math.max(0, pz));
        }
        const elevation = getHeight(u, v);
        const heightScale = t.heightScale ?? 3.0;
        return { ...vert, position: { ...vert.position, y: elevation * heightScale } };
      });
      geom.replaceGeometry(meshId, verts as any, mesh.faces);
      try { geom.recalculateNormals(meshId); } catch {}
    })();

  __inflight.set(terrainId, p);
  try { await p; } finally { __inflight.delete(terrainId); }
  },
})));

export const useTerrain = (terrainId: string) => useTerrainStore((s) => s.terrains[terrainId]);

// Local helper to cheaply hash a Float32Array; stable across sessions for same contents
function hashFloat32(arr: Float32Array): number {
  // Fowler–Noll–Vo style, interpreting 32-bit chunks
  let h = 0x811c9dc5 | 0;
  const view = new Uint32Array(arr.buffer, arr.byteOffset, Math.floor(arr.byteLength / 4));
  for (let i = 0; i < view.length; i++) {
    h ^= view[i];
    h = Math.imul(h, 0x01000193);
  }
  // Handle tail bytes if any
  const tailBytes = arr.byteLength & 3;
  if (tailBytes) {
    const bytes = new Uint8Array(arr.buffer, arr.byteOffset + (view.length << 2), tailBytes);
    for (let i = 0; i < bytes.length; i++) {
      h ^= bytes[i];
      h = Math.imul(h, 0x01000193);
    }
  }
  return h >>> 0;
}

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { nanoid } from 'nanoid';
import type { TerrainGraph, TerrainResource } from '@/types/terrain';
import { useGeometryStore } from './geometry-store';
import { useSceneStore } from './scene-store';
import { buildGridMesh, type GridBuildResult } from '@/utils/terrain/grid';
import { evaluateTerrainGraphToHeightmap, bakeEnhancedNormalMap } from '../utils/terrain/generate';

interface TerrainState {
  terrains: Record<string, TerrainResource>;
}

interface TerrainActions {
  createTerrain: (params?: Partial<Omit<TerrainResource, 'id' | 'meshId' | 'maps'>>) => { terrainId: string; objectId: string };
  updateTerrain: (terrainId: string, updater: (t: TerrainResource) => void) => void;
  removeTerrain: (terrainId: string) => void;
  setGraph: (terrainId: string, graph: TerrainGraph) => void;
  updateGraph: (terrainId: string, updater: (g: TerrainGraph) => void) => void;
  regenerate: (terrainId: string) => Promise<void>;
}

type TerrainStore = TerrainState & TerrainActions;

export const useTerrainStore = create<TerrainStore>()(immer((set, get) => ({
  terrains: {},
  createTerrain: (params = {}) => {
    const geom = useGeometryStore.getState();
    const scene = useSceneStore.getState();
    const id = nanoid();
    const defaults: Omit<TerrainResource, 'id' | 'meshId' | 'maps'> = {
      name: 'Terrain',
      vertexResolution: { x: 129, y: 129 }, // power-of-two+1 grid
      textureResolution: { width: 512, height: 512 },
      width: 10,
      height: 10,
      heightScale: 3.0, // Elevation multiplier for visible displacement
    } as any;
    const tRes: TerrainResource = { id, meshId: '', ...defaults, ...params } as any;

    // Initial graph with input->perlin->output chain
    const inputId = nanoid();
    const perlinId = nanoid();
    const outputId = nanoid();
    const g: TerrainGraph = {
      terrainId: id,
      nodes: [
        { id: inputId, type: 'input', position: { x: 40, y: 160 }, data: {} },
        { id: perlinId, type: 'perlin', position: { x: 280, y: 160 }, data: { seed: Math.floor(Math.random()*1e9), scale: 2, octaves: 4, persistence: 0.5, lacunarity: 2.0, amplitude: 1, operation: 'add', amount: 1 } },
        { id: outputId, type: 'output', position: { x: 560, y: 160 }, data: {} },
      ],
      edges: [
        { id: nanoid(), source: inputId, sourceHandle: 'out', target: perlinId, targetHandle: 'in' },
        { id: nanoid(), source: perlinId, sourceHandle: 'out', target: outputId, targetHandle: 'in' },
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
    // Evaluate graph to heightmap
    const height = await evaluateTerrainGraphToHeightmap(g, t.textureResolution.width, t.textureResolution.height, t.width, t.height);
    const normal = bakeEnhancedNormalMap(height, t.textureResolution.width, t.textureResolution.height, (t.width / t.textureResolution.width), (t.height / t.textureResolution.height), {
      crackDensity: t.surfaceDetail?.crackDensity ?? 0.25,
      crackDepth: t.surfaceDetail?.crackDepth ?? 0.4,
      strataDensity: t.surfaceDetail?.strataDensity ?? 0.15,
      strataDepth: t.surfaceDetail?.strataDepth ?? 0.25,
      roughness: t.surfaceDetail?.roughness ?? 0.20,
      seed: t.surfaceDetail?.seed ?? 42
    });
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
    // Sample height at each vertex uv
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
      const u = vert.uv.x; const v = vert.uv.y;
      const elevation = getHeight(u, v);
      // Apply elevation with configurable height scale (fallback to 3.0 for existing terrains)
      const heightScale = t.heightScale ?? 3.0;
      return { ...vert, position: { ...vert.position, y: elevation * heightScale } };
    });
    geom.replaceGeometry(meshId, verts as any, mesh.faces);
    try { geom.recalculateNormals(meshId); } catch {}
  },
})));

export const useTerrain = (terrainId: string) => useTerrainStore((s) => s.terrains[terrainId]);

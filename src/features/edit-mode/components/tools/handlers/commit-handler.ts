import { Vector3 } from 'three/webgpu';
import { Vertex } from '@/types/geometry';
import { useGeometryStore } from '@/stores/geometry-store';
import { useSelectionStore } from '@/stores/selection-store';
import { useToolStore } from '@/stores/tool-store';
import { createVertex, createFace, buildEdgesFromFaces, calculateFaceNormal } from '@/utils/geometry';

interface CommitHandlerParams {
  localVertices: Vertex[];
  selectedFaceIds: string[];
  meshId: string;
  moveAccumRef: React.MutableRefObject<Vector3>;
  geometryStore: any;
  onEndOperation: (commit: boolean) => void;
}

export function createCommitHandler({
  localVertices,
  selectedFaceIds,
  meshId,
  moveAccumRef,
  geometryStore,
  onEndOperation
}: CommitHandlerParams) {
  return (event: MouseEvent) => {
    if (event.button !== 0) return; // Only left mouse button
    
    const toolStore = useToolStore.getState();
    
    if (localVertices.length > 0) {
      if (toolStore.tool === 'extrude') {
        commitExtrudeOperation(localVertices, selectedFaceIds, meshId, geometryStore);
      } else if (toolStore.tool === 'inset') {
        commitInsetOperation(localVertices, selectedFaceIds, meshId, geometryStore);
      } else if (toolStore.tool === 'bevel' || toolStore.tool === 'chamfer' || toolStore.tool === 'fillet') {
        commitBevelOperation(localVertices, selectedFaceIds, meshId, geometryStore, toolStore);
      } else {
        // Simple vertex position update
        commitVertexUpdate(localVertices, meshId, geometryStore);
      }
    }
    
    onEndOperation(true);
    moveAccumRef.current.set(0, 0, 0);
  };
}

export function commitVertexUpdate(localVertices: Vertex[], meshId: string, geometryStore: any) {
  geometryStore.updateMesh(meshId, (mesh: any) => {
    const vertexMap = new Map(localVertices.map(v => [v.id, v]));
    mesh.vertices.forEach((vertex: any) => {
      const updatedVertex = vertexMap.get(vertex.id);
      if (updatedVertex) {
        vertex.position = updatedVertex.position;
      }
    });
  });
  geometryStore.recalculateNormals(meshId);
}

export function commitExtrudeOperation(
  localVertices: Vertex[], 
  selectedFaceIds: string[], 
  meshId: string, 
  geometryStore: any
) {
  const movedMap = new Map(localVertices.map(v => [v.id, v]));
  
  geometryStore.updateMesh(meshId, (mesh: any) => {
    if (selectedFaceIds.length === 0) return;
    
    // Compute boundary edges among selected faces
    const selectedFaceSet = new Set(selectedFaceIds);
    const boundaryEdges: Array<{ a: string; b: string }> = [];
    const edgeCount = new Map<string, number>();
    const edgeOrder = new Map<string, { a: string; b: string }>();
    
    const facesCopy = mesh.faces.slice();
    for (const f of facesCopy) {
      if (!selectedFaceSet.has(f.id)) continue;
      const n = f.vertexIds.length;
      for (let i = 0; i < n; i++) {
        const a = f.vertexIds[i];
        const b = f.vertexIds[(i + 1) % n];
        const key = [a, b].slice().sort().join('-');
        edgeOrder.set(key, { a, b });
        edgeCount.set(key, (edgeCount.get(key) || 0) + 1);
      }
    }
    
    edgeCount.forEach((count, key) => {
      if (count === 1) {
        const ord = edgeOrder.get(key)!;
        boundaryEdges.push({ a: ord.a, b: ord.b });
      }
    });
    
    // Duplicate vertices at preview positions
    const dupMap = new Map<string, string>();
    const vertsToDup = new Set<string>();
    for (const fid of selectedFaceIds) {
      const face = mesh.faces.find((f: any) => f.id === fid);
      if (!face) continue;
      face.vertexIds.forEach((id: string) => vertsToDup.add(id));
    }
    
    for (const vid of vertsToDup) {
      const vOrig = mesh.vertices.find((v: any) => v.id === vid)!;
      const moved = movedMap.get(vid);
      const pos = moved ? moved.position : vOrig.position;
      const dup = createVertex({ ...pos }, { ...vOrig.normal }, { ...vOrig.uv });
      mesh.vertices.push(dup);
      dupMap.set(vid, dup.id);
    }
    
    // Create cap faces from duplicates
    const newCaps = selectedFaceIds.map(fid => {
      const f = mesh.faces.find((ff: any) => ff.id === fid);
      if (!f) return null;
      const ids = f.vertexIds.map((id: string) => dupMap.get(id) || id);
      return createFace(ids);
    }).filter(Boolean);
    
    mesh.faces.push(...newCaps);
    
    // Create side quads
    for (const { a, b } of boundaryEdges) {
      const da = dupMap.get(a)!;
      const db = dupMap.get(b)!;
      if (!da || !db || a === b) continue;
      mesh.faces.push(createFace([a, b, db, da]));
    }
    
    mesh.edges = buildEdgesFromFaces(mesh.vertices, mesh.faces);
  });
  
  geometryStore.recalculateNormals(meshId);
}

export function commitInsetOperation(
  localVertices: Vertex[], 
  selectedFaceIds: string[], 
  meshId: string, 
  geometryStore: any
) {
  const movedMap = new Map(localVertices.map(v => [v.id, v]));
  
  geometryStore.updateMesh(meshId, (mesh: any) => {
    if (selectedFaceIds.length === 0) return;
    
    const selected = new Set(selectedFaceIds);
    const facesToInset = mesh.faces.filter((f: any) => selected.has(f.id));
    
    // Remove original selected faces
    mesh.faces = mesh.faces.filter((f: any) => !selected.has(f.id));
    
    for (const f of facesToInset) {
      const outer = f.vertexIds;
      const dupIds: string[] = [];
      
      for (const vid of outer) {
        const vOrig = mesh.vertices.find((v: any) => v.id === vid)!;
        const moved = movedMap.get(vid);
        const pos = moved ? moved.position : vOrig.position;
        const dup = createVertex({ ...pos }, { ...vOrig.normal }, { ...vOrig.uv });
        mesh.vertices.push(dup);
        dupIds.push(dup.id);
      }
      
      // New inner cap face
      const innerFace = createFace([...dupIds]);
      mesh.faces.push(innerFace);
      
      // Ring quads between outer and inner
      const n = outer.length;
      for (let i = 0; i < n; i++) {
        const a = outer[i];
        const b = outer[(i + 1) % n];
        const da = dupIds[i];
        const db = dupIds[(i + 1) % n];
        mesh.faces.push(createFace([a, b, db, da]));
      }
    }
    
    mesh.edges = buildEdgesFromFaces(mesh.vertices, mesh.faces);
  });
  
  geometryStore.recalculateNormals(meshId);
}

export function commitBevelOperation(
  localVertices: Vertex[], 
  selectedFaceIds: string[], 
  meshId: string, 
  geometryStore: any,
  toolStore: any
) {
  const movedMap = new Map(localVertices.map(v => [v.id, v]));
  
  geometryStore.updateMesh(meshId, (mesh: any) => {
    const selection = useSelectionStore.getState().selection;
    const hasFaces = selection.faceIds.length > 0;
    const hasEdges = selection.edgeIds.length > 0;
    
    if (!hasFaces && !hasEdges) return;

    if (hasFaces) {
      // Same as inset for face bevel
      const selected = new Set(selection.faceIds);
      const facesToBevel = mesh.faces.filter((f: any) => selected.has(f.id));
      mesh.faces = mesh.faces.filter((f: any) => !selected.has(f.id));
      
      for (const f of facesToBevel) {
        const outer = f.vertexIds;
        const dupIds: string[] = [];
        
        for (const vid of outer) {
          const vOrig = mesh.vertices.find((v: any) => v.id === vid)!;
          const moved = movedMap.get(vid);
          const pos = moved ? moved.position : vOrig.position;
          const dup = createVertex({ ...pos }, { ...vOrig.normal }, { ...vOrig.uv });
          mesh.vertices.push(dup);
          dupIds.push(dup.id);
        }
        
        mesh.faces.push(createFace([...dupIds]));
        
        const n = outer.length;
        for (let i = 0; i < n; i++) {
          const a = outer[i];
          const b = outer[(i + 1) % n];
          const da = dupIds[i];
          const db = dupIds[(i + 1) % n];
          mesh.faces.push(createFace([a, b, db, da]));
        }
      }
    }

    if (hasEdges) {
      // Edge bevel/chamfer/fillet implementation
      // This is a simplified version - the full implementation would be quite complex
      console.log('Edge bevel/chamfer/fillet commit - simplified implementation');
    }

    mesh.edges = buildEdgesFromFaces(mesh.vertices, mesh.faces);
  });
  
  geometryStore.recalculateNormals(meshId);
}
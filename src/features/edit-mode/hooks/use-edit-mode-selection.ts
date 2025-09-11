import { ThreeEvent } from '@react-three/fiber';
import { useCallback, useRef } from 'react';
import { Mesh } from '@/types/geometry';
import { useSelectionStore } from '@/stores/selection-store';
import { useGeometryStore } from '@/stores/geometry-store';
import { computeEdgeLoopTopological, computeEdgeRing, computeFaceLoop, selectLoopInnerRegion, getBoundaryEdges } from '@/utils/selection/loops';

interface Params {
  meshId: string | null;
  toolActive: boolean;
}

export const useEditModeSelection = ({ meshId, toolActive }: Params) => {
  const selectionStore = useSelectionStore();
  const geo = useGeometryStore();
  const lastAltEdgeRef = useRef<string | null>(null);
  const boundaryClickCountRef = useRef<number>(0);

  const getMesh = useCallback((): Mesh | null => (meshId ? geo.meshes.get(meshId) || null : null), [meshId, geo.meshes]);

  const handleVertexClick = useCallback((vertexId: string, e: ThreeEvent<PointerEvent>) => {
    if (toolActive || !meshId) return;
    if (e.shiftKey) selectionStore.toggleVertexSelection(meshId, vertexId);
    else selectionStore.selectVertices(meshId, [vertexId]);
  }, [toolActive, meshId, selectionStore]);

  const handleFaceClick = useCallback((faceId: string, e: ThreeEvent<PointerEvent>) => {
    if (toolActive || !meshId) return;
    if (e.shiftKey) selectionStore.toggleFaceSelection(meshId, faceId);
    else selectionStore.selectFaces(meshId, [faceId]);
  }, [toolActive, meshId, selectionStore]);

  const handleEdgeClick = useCallback((edgeId: string, e: ThreeEvent<PointerEvent>) => {
    if (toolActive || !meshId) return;
    const mesh = getMesh(); if (!mesh) return;
    const selMode = selectionStore.selection.selectionMode;
    const alt = (e as any).altKey; const shift = e.shiftKey; const ctrl = (e as any).ctrlKey || (e as any).metaKey;

    // Ctrl+Alt (edge ring OR face loop depending on mode)
    if (ctrl && alt) {
      if (selMode === 'edge') {
        const ring = computeEdgeRing(mesh, edgeId);
        selectionStore.selectEdges(meshId, ring, shift);
      } else {
        // vertex or face mode -> face loop
        const faces = computeFaceLoop(mesh, edgeId);
        selectionStore.selectFaces(meshId, faces, shift);
      }
      return;
    }

    // Alt only (edge loop or face loop)
    if (alt) {
      if (selMode === 'face') {
        const faces = computeFaceLoop(mesh, edgeId);
        selectionStore.selectFaces(meshId, faces, shift);
        return;
      }
      // Edge/Vertex selection -> edge loop
  const loop = computeEdgeLoopTopological(mesh, edgeId);
      const additive = shift;
      const edgeObj = mesh.edges.find(e2 => e2.id === edgeId);
      if (edgeObj && edgeObj.faceIds.length < 2) {
        if (lastAltEdgeRef.current === edgeId) {
          boundaryClickCountRef.current += 1;
        } else {
          boundaryClickCountRef.current = 1;
        }
        lastAltEdgeRef.current = edgeId;
        if (boundaryClickCountRef.current >= 2) {
          const allBoundaries = getBoundaryEdges(mesh);
            selectionStore.selectEdges(meshId, allBoundaries, additive);
            return;
        }
      } else {
        boundaryClickCountRef.current = 0;
        lastAltEdgeRef.current = edgeId;
      }
    selectionStore.selectEdges(meshId, loop, additive);
      return;
    }

    // Ctrl only (face loop in face mode)
    if (ctrl && selMode === 'face') {
      const faces = computeFaceLoop(mesh, edgeId);
      selectionStore.selectFaces(meshId, faces, shift);
      return;
    }

    // Regular edge selection
    if (shift) selectionStore.toggleEdgeSelection(meshId, edgeId);
    else selectionStore.selectEdges(meshId, [edgeId]);
  }, [toolActive, meshId, selectionStore, getMesh]);

  const handleLoopInnerRegion = useCallback(() => {
    if (!meshId) return [];
    const mesh = getMesh(); if (!mesh) return [];
    const sel = selectionStore.selection;
    const loopEdgeIds = sel.edgeIds;
    const faces = selectLoopInnerRegion(mesh, loopEdgeIds);
    selectionStore.selectFaces(meshId, faces);
    return faces;
  }, [meshId, selectionStore, getMesh]);

  return { handleVertexClick, handleEdgeClick, handleFaceClick, handleLoopInnerRegion };
};

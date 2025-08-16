'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { Vector3, Euler } from 'three';
import { useToolStore } from '@/stores/tool-store';
import { useSelectionStore } from '@/stores/selection-store';
import { useGeometryStore } from '@/stores/geometry-store';
import { Vertex } from '@/types/geometry';
import {
  calculateCentroid,
  applyMoveOperation,
  applyScaleOperation,
  applyRotateOperation,
  mouseToWorldDelta
} from './tool-operations';
import { calculateFaceNormal, createFace, createVertex, buildEdgesFromFaces } from '@/utils/geometry';

interface ToolHandlerProps {
  meshId: string;
  onLocalDataChange: (vertices: Vertex[]) => void;
  objectRotation?: { x: number; y: number; z: number };
  objectScale?: { x: number; y: number; z: number };
}

export const ToolHandler: React.FC<ToolHandlerProps> = ({ meshId, onLocalDataChange, objectRotation, objectScale }) => {
  const { camera, gl } = useThree();
  const toolStore = useToolStore();
  const selectionStore = useSelectionStore();
  const geometryStore = useGeometryStore();
  
  const [originalVertices, setOriginalVertices] = useState<Vertex[]>([]);
  const [localVertices, setLocalVertices] = useState<Vertex[]>([]);
  const [centroid, setCentroid] = useState<Vector3>(new Vector3());
  const [accumulator, setAccumulator] = useState<{ rotation: number, scale: number }>({ rotation: 0, scale: 1 });
  const moveAccumRef = useRef(new Vector3(0, 0, 0));
  const [selectedFaceIds, setSelectedFaceIds] = useState<string[]>([]);
  const [avgNormalLocal, setAvgNormalLocal] = useState<Vector3>(new Vector3(0, 1, 0));
  
  const pointerLocked = useRef(false);
  
  // Get current selection data
  // We'll read fresh state inside effects to avoid unnecessary re-renders
  
  // Setup tool operation when tool becomes active (only for implemented tools)
  useEffect(() => {
  const implemented = toolStore.tool === 'move' || toolStore.tool === 'rotate' || toolStore.tool === 'scale' || toolStore.tool === 'extrude' || toolStore.tool === 'inset' || toolStore.tool === 'bevel';
    if (toolStore.isActive && implemented) {
      const mesh = useGeometryStore.getState().meshes.get(meshId);
      const selection = useSelectionStore.getState().selection;
      // Get selected vertices based on selection mode
      let selectedVertices: Vertex[] = [];
      let faceIds: string[] = [];
      
      if (selection.selectionMode === 'vertex') {
        selectedVertices = (mesh?.vertices || []).filter(v => selection.vertexIds.includes(v.id));
      } else if (selection.selectionMode === 'edge') {
        // Get vertices from selected edges
        const vertexIds = new Set<string>();
        selection.edgeIds.forEach(edgeId => {
          const edge = mesh?.edges.find(e => e.id === edgeId);
          if (edge) {
            edge.vertexIds.forEach(vid => vertexIds.add(vid));
          }
        });
        selectedVertices = (mesh?.vertices || []).filter(v => vertexIds.has(v.id));
      } else if (selection.selectionMode === 'face') {
        // Get vertices from selected faces
        const vertexIds = new Set<string>();
        selection.faceIds.forEach(faceId => {
          const face = mesh?.faces.find(f => f.id === faceId);
          if (face) {
            face.vertexIds.forEach(vid => vertexIds.add(vid));
          }
        });
        selectedVertices = (mesh?.vertices || []).filter(v => vertexIds.has(v.id));
        faceIds = selection.faceIds.slice();
      }
      
      if (selectedVertices.length > 0) {
  // Always re-snapshot from store at operation start so we start from last committed state
  setOriginalVertices(selectedVertices);
        setLocalVertices(selectedVertices);
        setCentroid(calculateCentroid(selectedVertices));
        setAccumulator({ rotation: 0, scale: 1 });
        moveAccumRef.current.set(0, 0, 0);
        onLocalDataChange(selectedVertices);
        setSelectedFaceIds(faceIds);
        // Compute average normal in local space when face selection and extrude
        if (selection.selectionMode === 'face' && faceIds.length > 0 && mesh) {
          // Average face normals using current mesh vertices (object-local)
          const vmap = new Map(mesh.vertices.map(v => [v.id, v]));
          let nx = 0, ny = 0, nz = 0;
          faceIds.forEach(fid => {
            const face = mesh.faces.find(f => f.id === fid);
            if (face) {
              const n = calculateFaceNormal(face, mesh.vertices);
              nx += n.x; ny += n.y; nz += n.z;
            }
          });
          const len = Math.hypot(nx, ny, nz) || 1;
          setAvgNormalLocal(new Vector3(nx / len, ny / len, nz / len));
        } else {
          setAvgNormalLocal(new Vector3(0, 1, 0));
        }
        
        // Request pointer lock for infinite movement
        if (!pointerLocked.current && document.pointerLockElement !== gl.domElement) {
          gl.domElement.requestPointerLock();
        }
      }
  } else {
      // Tool is not active, release pointer lock
      if (pointerLocked.current) {
        document.exitPointerLock();
        pointerLocked.current = false;
      }
    }
    
    return () => {
      if (pointerLocked.current) {
        document.exitPointerLock();
        pointerLocked.current = false;
      }
    };
  }, [toolStore.isActive, toolStore.tool, meshId, gl, onLocalDataChange]);

  // Track pointer lock state
  useEffect(() => {
    const onLockChange = () => {
      pointerLocked.current = document.pointerLockElement === gl.domElement;
    };
    document.addEventListener('pointerlockchange', onLockChange);
    return () => document.removeEventListener('pointerlockchange', onLockChange);
  }, [gl]);
  
  // Handle mouse movement during tool operations (only for implemented tools)
  useEffect(() => {
  const implemented = toolStore.tool === 'move' || toolStore.tool === 'rotate' || toolStore.tool === 'scale' || toolStore.tool === 'extrude' || toolStore.tool === 'inset' || toolStore.tool === 'bevel';
    if (!toolStore.isActive || !implemented || originalVertices.length === 0) return;
    
  const handleMouseMove = (event: MouseEvent) => {
  const distance = camera.position.distanceTo(centroid);
  // Compensate move sensitivity for object scale so it feels the same regardless of scale
  const scaleFactor = objectScale ? (Math.abs(objectScale.x) + Math.abs(objectScale.y) + Math.abs(objectScale.z)) / 3 : 1;
      
      if (toolStore.tool === 'move') {
        const moveSensitivity = useToolStore.getState().moveSensitivity;
        const deltaWorld = mouseToWorldDelta(event.movementX, event.movementY, camera, distance, moveSensitivity);
        // Convert world delta to object-local delta (inverse rotate, inverse scale)
        const deltaLocal = deltaWorld.clone();
        if (objectRotation) {
          deltaLocal.applyEuler(new Euler(-objectRotation.x, -objectRotation.y, -objectRotation.z));
        }
        if (objectScale) {
          deltaLocal.set(
            deltaLocal.x / Math.max(1e-6, objectScale.x),
            deltaLocal.y / Math.max(1e-6, objectScale.y),
            deltaLocal.z / Math.max(1e-6, objectScale.z)
          );
        }
        // accumulate movement since start in local space
        moveAccumRef.current.add(deltaLocal);
        const newVertices = applyMoveOperation(originalVertices, moveAccumRef.current.clone(), toolStore.axisLock);
        setLocalVertices(newVertices);
        onLocalDataChange(newVertices);
      } else if (toolStore.tool === 'rotate') {
        // Rotation based on mouse movement
        const rotateSensitivity = useToolStore.getState().rotateSensitivity;
        const rotationDelta = (event.movementX + event.movementY) * rotateSensitivity;
        const newRotation = accumulator.rotation + rotationDelta;
        setAccumulator(prev => ({ ...prev, rotation: newRotation }));
        
        const newVertices = applyRotateOperation(originalVertices, newRotation, toolStore.axisLock, centroid);
        setLocalVertices(newVertices);
        onLocalDataChange(newVertices);
      } else if (toolStore.tool === 'scale') {
        // Scale based on mouse movement
  const scaleSensitivity = useToolStore.getState().scaleSensitivity;
  const scaleDelta = event.movementX * scaleSensitivity / Math.max(1e-6, scaleFactor);
        const newScale = Math.max(0.01, accumulator.scale + scaleDelta); // Prevent negative scale
        setAccumulator(prev => ({ ...prev, scale: newScale }));
        
        const newVertices = applyScaleOperation(originalVertices, newScale, toolStore.axisLock, centroid);
        setLocalVertices(newVertices);
        onLocalDataChange(newVertices);
      } else if (toolStore.tool === 'inset') {
        // Inset preview: scale selected vertices towards centroid in plane (approx via 3D scale around centroid)
        const scaleSensitivity = useToolStore.getState().scaleSensitivity;
        const scaleDelta = event.movementX * scaleSensitivity / Math.max(1e-6, scaleFactor);
        const newScale = Math.max(0.05, Math.min(2, accumulator.scale + scaleDelta));
        setAccumulator(prev => ({ ...prev, scale: newScale }));
        const newVertices = applyScaleOperation(originalVertices, newScale, 'none', centroid);
        setLocalVertices(newVertices);
        onLocalDataChange(newVertices);
      } else if (toolStore.tool === 'bevel') {
        // Bevel preview for faces: same as inset preview (single segment)
        const scaleSensitivity = useToolStore.getState().scaleSensitivity;
        const scaleDelta = event.movementX * scaleSensitivity / Math.max(1e-6, scaleFactor);
        const newScale = Math.max(0.05, Math.min(2, accumulator.scale + scaleDelta));
        setAccumulator(prev => ({ ...prev, scale: newScale }));
        const newVertices = applyScaleOperation(originalVertices, newScale, 'none', centroid);
        setLocalVertices(newVertices);
        onLocalDataChange(newVertices);
      } else if (toolStore.tool === 'extrude') {
        // Extrude distance is derived from mouse movement similar to move, but projected onto axis lock or average normal
        const moveSensitivity = useToolStore.getState().moveSensitivity; // reuse for distance feel
        const deltaWorld = mouseToWorldDelta(event.movementX, event.movementY, camera, distance, moveSensitivity);
        const deltaLocal = deltaWorld.clone();
        if (objectRotation) {
          deltaLocal.applyEuler(new Euler(-objectRotation.x, -objectRotation.y, -objectRotation.z));
        }
        if (objectScale) {
          deltaLocal.set(
            deltaLocal.x / Math.max(1e-6, objectScale.x),
            deltaLocal.y / Math.max(1e-6, objectScale.y),
            deltaLocal.z / Math.max(1e-6, objectScale.z)
          );
        }
        let step = deltaLocal.clone();
        if (toolStore.axisLock === 'x' || toolStore.axisLock === 'y' || toolStore.axisLock === 'z') {
          step.set(
            toolStore.axisLock === 'x' ? deltaLocal.x : 0,
            toolStore.axisLock === 'y' ? deltaLocal.y : 0,
            toolStore.axisLock === 'z' ? deltaLocal.z : 0
          );
        } else {
          // Project onto averaged local normal
          const dir = avgNormalLocal.clone().normalize();
          const s = deltaLocal.dot(dir);
          step = dir.multiplyScalar(s);
        }
        moveAccumRef.current.add(step);
        // Apply offset to selected (local) vertices
        const newVertices = originalVertices.map(v => ({
          ...v,
          position: {
            x: v.position.x + moveAccumRef.current.x,
            y: v.position.y + moveAccumRef.current.y,
            z: v.position.z + moveAccumRef.current.z,
          },
        }));
        setLocalVertices(newVertices);
        onLocalDataChange(newVertices);
      }
    };
    
  const handleMouseDown = (event: MouseEvent) => {
      if (event.button === 0) { // Left mouse button - commit operation
        if (localVertices.length > 0) {
          if (toolStore.tool === 'extrude') {
            // Commit topology for face extrude without moving originals
            const movedMap = new Map(localVertices.map(v => [v.id, v]));
            geometryStore.updateMesh(meshId, (mesh) => {
              if (selectedFaceIds.length === 0) return;
              // Compute boundary edges among selected faces on current topology
              const selectedFaceSet = new Set(selectedFaceIds);
              type EdgeKey = string;
              const boundaryEdges: Array<{ a: string; b: string }> = [];
              const edgeCount = new Map<EdgeKey, number>();
              const edgeOrder = new Map<EdgeKey, { a: string; b: string }>();
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
              // Duplicate vertices referenced by selected faces at PREVIEW positions
              const dupMap = new Map<string, string>();
              const vertsToDup = new Set<string>();
              for (const fid of selectedFaceIds) {
                const face = mesh.faces.find(f => f.id === fid);
                if (!face) continue;
                face.vertexIds.forEach(id => vertsToDup.add(id));
              }
              for (const vid of vertsToDup) {
                const vOrig = mesh.vertices.find(v => v.id === vid)!;
                const moved = movedMap.get(vid);
                const pos = moved ? moved.position : vOrig.position;
                const dup = createVertex({ ...pos }, { ...vOrig.normal }, { ...vOrig.uv });
                mesh.vertices.push(dup);
                dupMap.set(vid, dup.id);
              }
              // Create cap faces from duplicates (new, moved layer)
              const newCaps = selectedFaceIds.map(fid => {
                const f = mesh.faces.find(ff => ff.id === fid);
                if (!f) return null;
                const ids = f.vertexIds.map(id => dupMap.get(id) || id);
                return createFace(ids);
              }).filter(Boolean) as ReturnType<typeof createFace>[];
              mesh.faces.push(...newCaps);
              // Create side quads between original edge and duplicate edge: [a, b, db, da]
              for (const { a, b } of boundaryEdges) {
                const da = dupMap.get(a)!;
                const db = dupMap.get(b)!;
                if (!da || !db || a === b) continue;
                mesh.faces.push(createFace([a, b, db, da]));
              }
              // Rebuild edges
              mesh.edges = buildEdgesFromFaces(mesh.vertices, mesh.faces);
            });
            geometryStore.recalculateNormals(meshId);
          } else if (toolStore.tool === 'inset') {
            // Commit topology for inset: replace selected faces with inner faces at preview positions and ring quads
            const movedMap = new Map(localVertices.map(v => [v.id, v]));
            geometryStore.updateMesh(meshId, (mesh) => {
              if (selectedFaceIds.length === 0) return;
              const selected = new Set(selectedFaceIds);
              // Duplicate per-face vertices at preview positions
              const facesToInset = mesh.faces.filter(f => selected.has(f.id));
              // Remove original selected faces
              mesh.faces = mesh.faces.filter(f => !selected.has(f.id));
              for (const f of facesToInset) {
                const outer = f.vertexIds;
                // Build dup ring
                const dupIds: string[] = [];
                for (const vid of outer) {
                  const vOrig = mesh.vertices.find(v => v.id === vid)!;
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
              // Rebuild edges
              mesh.edges = buildEdgesFromFaces(mesh.vertices, mesh.faces);
            });
            geometryStore.recalculateNormals(meshId);
          } else if (toolStore.tool === 'bevel') {
            // Commit topology for bevel (faces): same as inset (single segment bevel)
            const movedMap = new Map(localVertices.map(v => [v.id, v]));
            geometryStore.updateMesh(meshId, (mesh) => {
              if (selectedFaceIds.length === 0) return;
              const selected = new Set(selectedFaceIds);
              const facesToBevel = mesh.faces.filter(f => selected.has(f.id));
              // Remove original selected faces
              mesh.faces = mesh.faces.filter(f => !selected.has(f.id));
              for (const f of facesToBevel) {
                const outer = f.vertexIds;
                const dupIds: string[] = [];
                for (const vid of outer) {
                  const vOrig = mesh.vertices.find(v => v.id === vid)!;
                  const moved = movedMap.get(vid);
                  const pos = moved ? moved.position : vOrig.position;
                  const dup = createVertex({ ...pos }, { ...vOrig.normal }, { ...vOrig.uv });
                  mesh.vertices.push(dup);
                  dupIds.push(dup.id);
                }
                // Inner cap
                mesh.faces.push(createFace([...dupIds]));
                // Border ring
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
          } else {
            // Non-extrude: Just commit moved vertices
            geometryStore.updateMesh(meshId, (mesh) => {
              const vertexMap = new Map(localVertices.map(v => [v.id, v]));
              mesh.vertices.forEach(vertex => {
                const updatedVertex = vertexMap.get(vertex.id);
                if (updatedVertex) {
                  vertex.position = updatedVertex.position;
                }
              });
            });
            geometryStore.recalculateNormals(meshId);
          }
        }
        toolStore.endOperation(true);
        moveAccumRef.current.set(0, 0, 0);
      }
    };
    
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      
      if (key === 'escape') {
        // Abort operation - restore original state
        setLocalVertices(originalVertices);
        onLocalDataChange(originalVertices);
        toolStore.endOperation(false);
        moveAccumRef.current.set(0, 0, 0);
      } else if (key === 'x') {
        toolStore.setAxisLock(toolStore.axisLock === 'x' ? 'none' : 'x');
      } else if (key === 'y') {
        toolStore.setAxisLock(toolStore.axisLock === 'y' ? 'none' : 'y');
      } else if (key === 'z') {
        toolStore.setAxisLock(toolStore.axisLock === 'z' ? 'none' : 'z');
      }
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [toolStore, originalVertices, localVertices, centroid, accumulator, camera, meshId, geometryStore, onLocalDataChange]);
  
  return null; // This component only handles events, no rendering
};

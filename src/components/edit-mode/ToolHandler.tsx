'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import { useToolStore } from '../../stores/toolStore';
import { useSelectionStore } from '../../stores/selectionStore';
import { useGeometryStore } from '../../stores/geometryStore';
import { Vertex } from '../../types/geometry';
import {
  calculateCentroid,
  applyMoveOperation,
  applyScaleOperation,
  applyRotateOperation,
  mouseToWorldDelta
} from './toolOperations';

interface ToolHandlerProps {
  meshId: string;
  onLocalDataChange: (vertices: Vertex[]) => void;
}

export const ToolHandler: React.FC<ToolHandlerProps> = ({ meshId, onLocalDataChange }) => {
  const { camera, gl } = useThree();
  const toolStore = useToolStore();
  const selectionStore = useSelectionStore();
  const geometryStore = useGeometryStore();
  
  const [originalVertices, setOriginalVertices] = useState<Vertex[]>([]);
  const [localVertices, setLocalVertices] = useState<Vertex[]>([]);
  const [centroid, setCentroid] = useState<Vector3>(new Vector3());
  const [accumulator, setAccumulator] = useState<{ rotation: number, scale: number }>({ rotation: 0, scale: 1 });
  const moveAccumRef = useRef(new Vector3(0, 0, 0));
  
  const pointerLocked = useRef(false);
  
  // Get current selection data
  // We'll read fresh state inside effects to avoid unnecessary re-renders
  
  // Setup tool operation when tool becomes active
  useEffect(() => {
    if (toolStore.isActive) {
      const mesh = useGeometryStore.getState().meshes.get(meshId);
      const selection = useSelectionStore.getState().selection;
      // Get selected vertices based on selection mode
      let selectedVertices: Vertex[] = [];
      
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
      }
      
      if (selectedVertices.length > 0) {
        // Avoid re-initializing if selection unchanged
        const same = originalVertices.length === selectedVertices.length && originalVertices.every((v, i) => v.id === selectedVertices[i].id);
        if (!same) setOriginalVertices(selectedVertices);
        setLocalVertices(selectedVertices);
        setCentroid(calculateCentroid(selectedVertices));
        setAccumulator({ rotation: 0, scale: 1 });
        moveAccumRef.current.set(0, 0, 0);
        onLocalDataChange(selectedVertices);
        
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
  }, [toolStore.isActive, meshId, gl, onLocalDataChange, originalVertices.length]);

  // Track pointer lock state
  useEffect(() => {
    const onLockChange = () => {
      pointerLocked.current = document.pointerLockElement === gl.domElement;
    };
    document.addEventListener('pointerlockchange', onLockChange);
    return () => document.removeEventListener('pointerlockchange', onLockChange);
  }, [gl]);
  
  // Handle mouse movement during tool operations
  useEffect(() => {
    if (!toolStore.isActive || originalVertices.length === 0) return;
    
  const handleMouseMove = (event: MouseEvent) => {
      const distance = camera.position.distanceTo(centroid);
      
      if (toolStore.tool === 'move') {
        const moveSensitivity = useToolStore.getState().moveSensitivity;
        const delta = mouseToWorldDelta(event.movementX, event.movementY, camera, distance, moveSensitivity);
    // accumulate movement since start
    moveAccumRef.current.add(delta);
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
        const scaleDelta = event.movementX * scaleSensitivity;
        const newScale = Math.max(0.01, accumulator.scale + scaleDelta); // Prevent negative scale
        setAccumulator(prev => ({ ...prev, scale: newScale }));
        
        const newVertices = applyScaleOperation(originalVertices, newScale, toolStore.axisLock, centroid);
        setLocalVertices(newVertices);
        onLocalDataChange(newVertices);
      }
    };
    
  const handleMouseDown = (event: MouseEvent) => {
      if (event.button === 0) { // Left mouse button - commit operation
        if (localVertices.length > 0) {
          // Update the store with new vertex positions
          geometryStore.updateMesh(meshId, (mesh) => {
            const vertexMap = new Map(localVertices.map(v => [v.id, v]));
            mesh.vertices.forEach(vertex => {
              const updatedVertex = vertexMap.get(vertex.id);
              if (updatedVertex) {
                vertex.position = updatedVertex.position;
              }
            });
          });
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

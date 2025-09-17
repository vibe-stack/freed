'use client';

import React, { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { Vector3 } from 'three/webgpu';
import { useToolStore } from '@/stores/tool-store';
import { useGeometryStore } from '@/stores/geometry-store';
import { 
  ToolHandlerProps,
  TransformContext,
  usePointerLock,
  useToolSetup,
  handleMoveOperation,
  handleRotateOperation,
  handleScaleOperation,
  handleExtrudeOperation,
  handleInsetOperation,
  handleBevelOperation,
  commitVertexUpdate,
  commitExtrudeOperation,
  commitInsetOperation,
  commitBevelOperation,
  createMouseMoveHandler,
  createKeyboardHandler,
  createWheelHandler,
  createCommitHandler
} from './tools';

export const ToolHandler: React.FC<ToolHandlerProps> = ({ 
  meshId, 
  onLocalDataChange, 
  objectRotation, 
  objectScale 
}) => {
  const { camera, gl } = useThree();
  const toolStore = useToolStore();
  const geometryStore = useGeometryStore();
  const moveAccumRef = useRef(new Vector3(0, 0, 0));
  
  // Setup tool operation state
  const {
    originalVertices,
    localVertices,
    centroid,
    accumulator,
    selectedFaceIds,
    avgNormalLocal,
    setLocalVertices,
    setAccumulator
  } = useToolSetup(meshId, onLocalDataChange);
  
  // Manage pointer lock
  const implementedTool = toolStore.tool === 'move' || toolStore.tool === 'rotate' || 
                         toolStore.tool === 'scale' || toolStore.tool === 'extrude' || 
                         toolStore.tool === 'inset' || toolStore.tool === 'bevel' || 
                         toolStore.tool === 'chamfer' || toolStore.tool === 'fillet';
  
  usePointerLock(gl, toolStore.isActive && implementedTool);
  
  // Create transform context
  const context: TransformContext = {
    camera,
    distance: camera.position.distanceTo(centroid),
    objectRotation,
    objectScale
  };
  
  // Handle mouse movement during tool operations
  useEffect(() => {
    if (!toolStore.isActive || !implementedTool || originalVertices.length === 0) return;
    
    const handleMouseMove = (event: MouseEvent) => {
      // Get fresh context and state each time
      const freshContext: TransformContext = {
        camera,
        distance: camera.position.distanceTo(centroid),
        objectRotation,
        objectScale
      };
      
      const toolState = useToolStore.getState();
      
      if (toolState.tool === 'move') {
        const result = handleMoveOperation(
          event,
          originalVertices,
          centroid,
          freshContext,
          toolState.axisLock,
          toolState.moveSensitivity,
          moveAccumRef.current
        );
        
        moveAccumRef.current = result.newAccumulator;
        setLocalVertices(result.vertices);
        onLocalDataChange(result.vertices);
        
      } else if (toolState.tool === 'rotate') {
        const result = handleRotateOperation(
          event,
          originalVertices,
          centroid,
          freshContext,
          toolState.axisLock,
          toolState.rotateSensitivity,
          accumulator.rotation
        );
        
        setAccumulator(prev => ({ ...prev, rotation: result.newRotation }));
        setLocalVertices(result.vertices);
        onLocalDataChange(result.vertices);
        
      } else if (toolState.tool === 'scale') {
        const result = handleScaleOperation(
          event,
          originalVertices,
          centroid,
          freshContext,
          toolState.axisLock,
          toolState.scaleSensitivity,
          accumulator.scale
        );
        
        setAccumulator(prev => ({ ...prev, scale: result.newScale }));
        setLocalVertices(result.vertices);
        onLocalDataChange(result.vertices);
        
      } else if (toolState.tool === 'extrude') {
        const result = handleExtrudeOperation(
          event,
          originalVertices,
          centroid,
          freshContext,
          toolState.axisLock,
          toolState.moveSensitivity,
          moveAccumRef.current,
          avgNormalLocal
        );
        
        moveAccumRef.current = result.newAccumulator;
        setLocalVertices(result.vertices);
        onLocalDataChange(result.vertices);
        
      } else if (toolState.tool === 'inset') {
        const result = handleInsetOperation(
          event,
          originalVertices,
          centroid,
          freshContext,
          toolState.scaleSensitivity,
          accumulator.scale
        );
        
        setAccumulator(prev => ({ ...prev, scale: result.newScale }));
        setLocalVertices(result.vertices);
        onLocalDataChange(result.vertices);
        
      } else if (toolState.tool === 'bevel' || toolState.tool === 'chamfer' || toolState.tool === 'fillet') {
        const result = handleBevelOperation(
          event,
          originalVertices,
          centroid,
          freshContext,
          meshId,
          selectedFaceIds,
          toolState.scaleSensitivity,
          accumulator.scale || 0,
          toolState.tool
        );
        
        setAccumulator(prev => ({ ...prev, scale: result.newWidth }));
        setLocalVertices(result.vertices);
        onLocalDataChange(result.vertices);
      }
    };
    
    const handleMouseUp = (event: MouseEvent) => {
      if (event.button !== 0) return; // Only left mouse button
      
      const toolState = useToolStore.getState();
      
      if (localVertices.length > 0) {
        if (toolState.tool === 'extrude') {
          commitExtrudeOperation(localVertices, selectedFaceIds, meshId, geometryStore);
        } else if (toolState.tool === 'inset') {
          commitInsetOperation(localVertices, selectedFaceIds, meshId, geometryStore);
        } else if (toolState.tool === 'bevel' || toolState.tool === 'chamfer' || toolState.tool === 'fillet') {
          commitBevelOperation(localVertices, selectedFaceIds, meshId, geometryStore, toolState);
        } else {
          // Simple vertex position update
          commitVertexUpdate(localVertices, meshId, geometryStore);
        }
      }
      
      toolStore.endOperation(true);
      moveAccumRef.current.set(0, 0, 0);
    };
    
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const toolState = useToolStore.getState();
      
      if (key === 'escape') {
        // Abort operation - restore original state
        setLocalVertices(originalVertices);
        onLocalDataChange(originalVertices);
        toolStore.endOperation(false);
        moveAccumRef.current.set(0, 0, 0);
      } else if (key === 'x') {
        toolState.setAxisLock(toolState.axisLock === 'x' ? 'none' : 'x');
      } else if (key === 'y') {
        toolState.setAxisLock(toolState.axisLock === 'y' ? 'none' : 'y');
      } else if (key === 'z') {
        toolState.setAxisLock(toolState.axisLock === 'z' ? 'none' : 'z');
      }
    };
    
    const handleWheel = (e: WheelEvent) => {
      const toolState = useToolStore.getState();
      
      if (!toolState.isActive || toolState.tool !== 'fillet') return;
      
      e.preventDefault();
      const delta = Math.sign(e.deltaY);
      
      // Store divisions in tool localData
      const data = toolState.localData as any;
      const prev = (data?.divisions ?? 1) as number;
      const next = Math.max(1, prev + (delta > 0 ? 1 : -1));
      
      toolState.setLocalData({ ...(data || {}), divisions: next });
      console.log(`Fillet divisions: ${next}`);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('wheel', handleWheel, { passive: false });
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('wheel', handleWheel as any);
    };
  }, [
    toolStore.isActive,
    implementedTool,
    originalVertices,
    localVertices,
    centroid,
    accumulator,
    selectedFaceIds,
    avgNormalLocal,
    meshId,
    camera,
    objectRotation,
    objectScale,
    onLocalDataChange,
    setLocalVertices,
    setAccumulator,
    geometryStore
  ]);
  
  return null; // This component only handles events, no rendering
};

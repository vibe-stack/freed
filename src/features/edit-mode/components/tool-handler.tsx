"use client";

import React, { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { Vector3 } from "three/webgpu";
import { useToolStore } from "@/stores/tool-store";
import { useGeometryStore } from "@/stores/geometry-store";
import { useViewportStore } from "@/stores/viewport-store";
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
  handleChamferOperation,
  handleFilletOperation,
  commitVertexUpdate,
  commitExtrudeOperation,
  commitInsetOperation,
  commitBevelOperation,
  commitChamferOperation,
  commitFilletOperation,
  createMouseMoveHandler,
  createKeyboardHandler,
  createWheelHandler,
  createCommitHandler,
} from "./tools";

export const ToolHandler: React.FC<ToolHandlerProps> = ({
  meshId,
  onLocalDataChange,
  objectRotation,
  objectScale,
}) => {
  const { camera, gl } = useThree();
  const toolStore = useToolStore();
  const geometryStore = useGeometryStore();
  const gridSnapping = useViewportStore((s) => s.gridSnapping);
  const gridSize = useViewportStore((s) => s.gridSize);
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
    setAccumulator,
  } = useToolSetup(meshId, onLocalDataChange);

  const originalVerticesRef = useRef(originalVertices);
  const localVerticesRef = useRef(localVertices);
  const selectedFaceIdsRef = useRef(selectedFaceIds);
  const accumulatorRef = useRef(accumulator);

  // Manage pointer lock
  const implementedTool =
    toolStore.tool === "move" ||
    toolStore.tool === "rotate" ||
    toolStore.tool === "scale" ||
    toolStore.tool === "extrude" ||
    toolStore.tool === "inset" ||
    toolStore.tool === "bevel" ||
    toolStore.tool === "chamfer" ||
    toolStore.tool === "fillet";

  usePointerLock(gl, toolStore.isActive && implementedTool);

  // Create transform context
  const context: TransformContext = {
    camera,
    distance: camera.position.distanceTo(centroid),
    objectRotation,
    objectScale,
    gridSnapping,
    gridSize,
  };

  useEffect(() => {
    originalVerticesRef.current = originalVertices;
  }, [originalVertices]);
  useEffect(() => {
    localVerticesRef.current = localVertices;
  }, [localVertices]);
  useEffect(() => {
    selectedFaceIdsRef.current = selectedFaceIds;
  }, [selectedFaceIds]);
  useEffect(() => {
    accumulatorRef.current = accumulator;
  }, [accumulator]);

  // Handle mouse movement during tool operations
  useEffect(() => {
    if (
      !toolStore.isActive ||
      !implementedTool ||
      originalVertices.length === 0
    )
      return;

    const handleMouseMove = (event: MouseEvent) => {
      // Get fresh context and state each time
      const freshContext: TransformContext = {
        camera,
        distance: camera.position.distanceTo(centroid),
        objectRotation,
        objectScale,
        gridSnapping,
        gridSize,
      };

      const toolState = useToolStore.getState();

      if (toolState.tool === "move") {
        const result = handleMoveOperation(
          event,
          originalVerticesRef.current,
          centroid,
          freshContext,
          toolState.axisLock,
          toolState.moveSensitivity,
          moveAccumRef.current,
        );

        moveAccumRef.current = result.newAccumulator;
        setLocalVertices(result.vertices);
        onLocalDataChange(result.vertices);
      } else if (toolState.tool === "rotate") {
        const result = handleRotateOperation(
          event,
          originalVerticesRef.current,
          centroid,
          freshContext,
          toolState.axisLock,
          toolState.rotateSensitivity,
          accumulatorRef.current.rotation,
        );
        accumulatorRef.current = {
          ...accumulatorRef.current,
          rotation: result.newRotation,
        };
        setAccumulator((prev) => ({ ...prev, rotation: result.newRotation }));
        setLocalVertices(result.vertices);
        onLocalDataChange(result.vertices);
      } else if (toolState.tool === "scale") {
        const result = handleScaleOperation(
          event,
          originalVerticesRef.current,
          centroid,
          freshContext,
          toolState.axisLock,
          toolState.scaleSensitivity,
          accumulatorRef.current.scale,
        );
        accumulatorRef.current = {
          ...accumulatorRef.current,
          scale: result.newScale,
        };
        setAccumulator((prev) => ({ ...prev, scale: result.newScale }));
        setLocalVertices(result.vertices);
        onLocalDataChange(result.vertices);
      } else if (toolState.tool === "extrude") {
        const result = handleExtrudeOperation(
          event,
          originalVerticesRef.current,
          centroid,
          freshContext,
          toolState.axisLock,
          toolState.moveSensitivity,
          moveAccumRef.current,
          avgNormalLocal,
        );

        moveAccumRef.current = result.newAccumulator;
        setLocalVertices(result.vertices);
        onLocalDataChange(result.vertices);
      } else if (toolState.tool === "inset") {
        const result = handleInsetOperation(
          event,
          originalVerticesRef.current,
          centroid,
          freshContext,
          toolState.scaleSensitivity,
          accumulatorRef.current.scale,
        );
        accumulatorRef.current = {
          ...accumulatorRef.current,
          scale: result.newScale,
        };
        setAccumulator((prev) => ({ ...prev, scale: result.newScale }));
        setLocalVertices(result.vertices);
        onLocalDataChange(result.vertices);
      } else if (toolState.tool === "bevel") {
        const result = handleBevelOperation(
          event,
          originalVerticesRef.current,
          centroid,
          freshContext,
          meshId,
          selectedFaceIdsRef.current,
          toolState.scaleSensitivity,
          accumulatorRef.current.scale || 0,
          toolState.tool,
        );
        accumulatorRef.current = {
          ...accumulatorRef.current,
          scale: result.newWidth,
        };
        setAccumulator((prev) => ({ ...prev, scale: result.newWidth }));
        setLocalVertices(result.vertices);
        onLocalDataChange(result.vertices);
      } else if (toolState.tool === "chamfer") {
        const result = handleChamferOperation(
          event,
          originalVerticesRef.current,
          centroid,
          freshContext,
          meshId,
          toolState.scaleSensitivity,
          accumulatorRef.current.scale || 0,
        );
        accumulatorRef.current = {
          ...accumulatorRef.current,
          scale: result.newDistance,
        };
        setAccumulator((prev) => ({ ...prev, scale: result.newDistance }));
        // persist current distance in localData for commit
        const data = (toolState.localData as any) || {};
        toolStore.setLocalData({ ...data, distance: result.newDistance });
        setLocalVertices(result.vertices);
        onLocalDataChange(result.vertices);
      } else if (toolState.tool === "fillet") {
        const result = handleFilletOperation(
          event,
          originalVerticesRef.current,
          centroid,
          freshContext,
          meshId,
          toolState.scaleSensitivity,
          accumulatorRef.current.scale || 0,
        );
        accumulatorRef.current = {
          ...accumulatorRef.current,
          scale: result.newRadius,
        };
        setAccumulator((prev) => ({ ...prev, scale: result.newRadius }));
        // persist current radius in localData for commit
        const data = (toolState.localData as any) || {};
        toolStore.setLocalData({ ...data, radius: result.newRadius });
        setLocalVertices(result.vertices);
        onLocalDataChange(result.vertices);
      }
    };

    const handleMouseUp = (event: MouseEvent) => {
      if (event.button !== 0) return; // Only left mouse button

      const toolState = useToolStore.getState();

      const latestLocalVertices = localVerticesRef.current;
      const latestSelectedFaceIds = selectedFaceIdsRef.current;
      const latestAccumulator = accumulatorRef.current;

      if (latestLocalVertices.length > 0) {
        if (toolState.tool === "extrude") {
          commitExtrudeOperation(
            latestLocalVertices,
            latestSelectedFaceIds,
            meshId,
            geometryStore,
          );
        } else if (toolState.tool === "inset") {
          commitInsetOperation(
            latestLocalVertices,
            latestSelectedFaceIds,
            meshId,
            geometryStore,
          );
        } else if (toolState.tool === "bevel") {
          commitBevelOperation(
            latestLocalVertices,
            latestSelectedFaceIds,
            meshId,
            geometryStore,
            toolState,
          );
        } else if (toolState.tool === "chamfer") {
          const distance =
            (toolState.localData as any)?.distance ??
            latestAccumulator.scale ??
            0;
          commitChamferOperation(meshId, geometryStore, distance);
        } else if (toolState.tool === "fillet") {
          const radius =
            (toolState.localData as any)?.radius ??
            latestAccumulator.scale ??
            0;
          const divisions = (toolState.localData as any)?.divisions ?? 1;
          commitFilletOperation(meshId, geometryStore, radius, divisions);
        } else {
          // Simple vertex position update
          commitVertexUpdate(latestLocalVertices, meshId, geometryStore);
        }
      }

      toolStore.endOperation(true);
      moveAccumRef.current.set(0, 0, 0);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const toolState = useToolStore.getState();

      if (key === "escape") {
        // Abort operation - restore original state
        const latestOriginalVertices = originalVerticesRef.current;
        setLocalVertices(latestOriginalVertices);
        onLocalDataChange(latestOriginalVertices);
        toolStore.endOperation(false);
        moveAccumRef.current.set(0, 0, 0);
      } else if (key === "x") {
        toolState.setAxisLock(toolState.axisLock === "x" ? "none" : "x");
      } else if (key === "y") {
        toolState.setAxisLock(toolState.axisLock === "y" ? "none" : "y");
      } else if (key === "z") {
        toolState.setAxisLock(toolState.axisLock === "z" ? "none" : "z");
      }
    };

    const handleWheel = (e: WheelEvent) => {
      const toolState = useToolStore.getState();
      if (!toolState.isActive) return;
      if (toolState.tool === "fillet" || toolState.tool === "bevel") {
        // Disable camera zoom while adjusting bevel/fillet divisions
        try {
          e.preventDefault();
        } catch {}
        try {
          e.stopPropagation();
        } catch {}
        try {
          (e as any).stopImmediatePropagation?.();
        } catch {}
        const delta = Math.sign(e.deltaY);
        const data = (toolState.localData as any) || {};
        const prev = (data.divisions ?? 1) as number;
        const next = Math.max(1, Math.min(64, prev + (delta > 0 ? 1 : -1)));
        toolState.setLocalData({ ...data, divisions: next });
      } else if (toolState.tool === "chamfer") {
        // no wheel behavior for chamfer now
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("wheel", handleWheel, {
      passive: false,
      capture: true,
    });

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("wheel", handleWheel as any, true);
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
    gridSnapping,
    gridSize,
    onLocalDataChange,
    setLocalVertices,
    setAccumulator,
    geometryStore,
  ]);

  return null; // This component only handles events, no rendering
};

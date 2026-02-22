'use client';

import React from 'react';
// Grid and GizmoViewport are not WebGPU-compatible; provide custom Grid and disable axes gizmo
import WebGPUGrid from './webgpu-grid';
import { useViewportStore } from '@/stores/viewport-store';
import { useSceneStore } from '@/stores/scene-store';
import { useViewMode } from '@/stores/selection-store';
import ObjectNode from './object-node';
import EditModeOverlay from '@/features/edit-mode/components/edit-mode-overlay';
import ObjectToolHandler from './object-tool-handler';
import QuickBrushHandler from '@/features/quick-brush/components/quick-brush-handler';
import PolygonBrushHandler from '@/features/quick-brush/components/polygon-brush-handler';

const SceneContent: React.FC = () => {
  const scene = useSceneStore();
  const viewport = useViewportStore();
  const viewMode = useViewMode();
  const gridDivisions = Math.max(1, Math.round(500 / Math.max(0.01, viewport.gridSize)));
  // RectAreaLight removed: no init required for WebGPU

  return (
    <>
      <ObjectToolHandler />
      <QuickBrushHandler />
      <PolygonBrushHandler />
      {viewport.showGrid && (
        <WebGPUGrid
          args={[500, gridDivisions]}
          position={[0, -0.001, 0]}
          cellColor="#3c3c3c"
          sectionColor="#646464"
          cellSize={0.5}
          sectionSize={1}
          fadeDistance={400}
          fadeStrength={1}
          cellThickness={0.5}
          sectionThickness={1}
        />
      )}
      {/* Axes gizmo disabled for WebGPU (incompatible); retain setting state */}
      {scene.rootObjects.map((id) => (
        <ObjectNode key={id} objectId={id} />
      ))}
      {viewMode === 'edit' && <EditModeOverlay />}
    </>
  );
};

export default SceneContent;

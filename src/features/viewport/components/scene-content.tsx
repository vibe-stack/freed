'use client';

import React from 'react';
import { Grid, GizmoHelper, GizmoViewport } from '@react-three/drei';
import { useViewportStore } from '@/stores/viewport-store';
import { useSceneStore } from '@/stores/scene-store';
import { useViewMode } from '@/stores/selection-store';
import MeshView from './mesh-view';
import EditModeOverlay from '@/features/edit-mode/components/edit-mode-overlay';
import ObjectToolHandler from './object-tool-handler';

const SceneContent: React.FC = () => {
  const scene = useSceneStore();
  const viewport = useViewportStore();
  const viewMode = useViewMode();

  return (
    <>
      <ObjectToolHandler />
      {viewport.showGrid && (
        <Grid
          infiniteGrid
          args={[10, 10]}
          position={[0, -0.001, 0]}
          cellColor="rgba(60, 60, 60, 0.35)"
          sectionColor="rgba(100, 100, 100, 0.6)"
        />
      )}
      {viewport.showAxes && (
        <GizmoHelper alignment="top-left" margin={[80, 80]}>
          <GizmoViewport labelColor="white" axisHeadScale={1} />
        </GizmoHelper>
      )}
      {scene.rootObjects.map((id) => (
        <MeshView key={id} objectId={id} />
      ))}
      {viewMode === 'edit' && <EditModeOverlay />}
    </>
  );
};

export default SceneContent;

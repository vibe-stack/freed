import React, { useEffect, useState } from 'react';
import { useSelectionStore } from '../stores/selectionStore';
import { useToolStore } from '../stores/toolStore';
import { useGeometryStore } from '../stores/geometryStore';
import { Vertex } from '../types/geometry';
import { VertexRenderer } from './edit-mode/VertexRenderer';
import { EdgeRenderer } from './edit-mode/EdgeRenderer';
import { FaceRenderer } from './edit-mode/FaceRenderer';
import { ToolHandler } from './edit-mode/ToolHandler';

const EditModeOverlay: React.FC = () => {
  const selectionStore = useSelectionStore();
  const toolStore = useToolStore();
  const geometryStore = useGeometryStore();
  
  const [localVertices, setLocalVertices] = useState<Vertex[] | null>(null);
  
  const selection = selectionStore.selection;
  const meshId = selection.meshId;
  
  if (!meshId) return null;
  
  const mesh = geometryStore.meshes.get(meshId);
  if (!mesh) return null;
  
  // Handle selection interactions
  const handleVertexClick = (vertexId: string, event: any) => {
    if (toolStore.isActive) return; // Don't allow selection during tool operations
    
    const isShiftPressed = event.shiftKey;
    if (isShiftPressed) {
      selectionStore.toggleVertexSelection(meshId, vertexId);
    } else {
      selectionStore.selectVertices(meshId, [vertexId]);
    }
  };
  
  const handleEdgeClick = (edgeId: string, event: any) => {
    if (toolStore.isActive) return;
    
    const isShiftPressed = event.shiftKey;
    if (isShiftPressed) {
      selectionStore.toggleEdgeSelection(meshId, edgeId);
    } else {
      selectionStore.selectEdges(meshId, [edgeId]);
    }
  };
  
  const handleFaceClick = (faceId: string, event: any) => {
    if (toolStore.isActive) return;
    
    const isShiftPressed = event.shiftKey;
    if (isShiftPressed) {
      selectionStore.toggleFaceSelection(meshId, faceId);
    } else {
      selectionStore.selectFaces(meshId, [faceId]);
    }
  };
  
  // Handle local vertex updates during tool operations
  const handleLocalDataChange = (vertices: Vertex[]) => {
    setLocalVertices(vertices);
  };
  
  // Clear local vertices when tool operation ends
  useEffect(() => {
    if (!toolStore.isActive) {
      setLocalVertices(null);
    }
  }, [toolStore.isActive]);
  
  return (
    <>
      {/* Tool Handler - manages tool operations */}
      <ToolHandler meshId={meshId} onLocalDataChange={handleLocalDataChange} />
      
      {/* Vertex Renderer - always visible, selectable in vertex mode */}
      <VertexRenderer
        meshId={meshId}
        selectedVertexIds={selection.vertexIds}
        onVertexClick={handleVertexClick}
        selectionMode={selection.selectionMode}
        localVertices={localVertices || undefined}
      />
      
      {/* Edge Renderer - always visible, selectable in edge mode */}
      <EdgeRenderer
        meshId={meshId}
        selectedEdgeIds={selection.edgeIds}
        onEdgeClick={handleEdgeClick}
        selectionMode={selection.selectionMode}
        localVertices={localVertices || undefined}
      />
      
      {/* Face Renderer - always visible, selectable in face mode */}
      <FaceRenderer
        meshId={meshId}
        selectedFaceIds={selection.faceIds}
        onFaceClick={handleFaceClick}
        selectionMode={selection.selectionMode}
        localVertices={localVertices || undefined}
      />
    </>
  );
};

export default EditModeOverlay;

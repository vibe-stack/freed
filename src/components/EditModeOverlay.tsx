'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelectionStore } from '../stores/selectionStore';
import { useToolStore } from '../stores/toolStore';
import { useGeometryStore } from '../stores/geometryStore';
import { Vertex } from '../types/geometry';
import { VertexRenderer } from './edit-mode/VertexRenderer';
import { EdgeRenderer } from './edit-mode/EdgeRenderer';
import { FaceRenderer } from './edit-mode/FaceRenderer';
import { ToolHandler } from './edit-mode/ToolHandler';
import { Color, Vector3 } from 'three';

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
  const handleLocalDataChange = useCallback((vertices: Vertex[]) => {
    setLocalVertices(vertices);
  }, []);

  // Clear local vertices when tool operation ends
  useEffect(() => {
    if (!toolStore.isActive) {
      setLocalVertices(null);
    }
  }, [toolStore.isActive]);

  // Compute current selection vertices (for axis rays)
  const currentSelectionVertices = useMemo(() => {
    if (localVertices && localVertices.length > 0) return localVertices;
    const sel = selectionStore.selection;
    if (!mesh) return [] as Vertex[];
    if (sel.selectionMode === 'vertex') {
      return mesh.vertices.filter(v => sel.vertexIds.includes(v.id));
    }
    if (sel.selectionMode === 'edge') {
      const ids = new Set<string>();
      sel.edgeIds.forEach(eid => {
        const e = mesh.edges.find(ed => ed.id === eid);
        if (e) e.vertexIds.forEach(id => ids.add(id));
      });
      return mesh.vertices.filter(v => ids.has(v.id));
    }
    if (sel.selectionMode === 'face') {
      const ids = new Set<string>();
      sel.faceIds.forEach(fid => {
        const f = mesh.faces.find(fc => fc.id === fid);
        if (f) f.vertexIds.forEach(id => ids.add(id));
      });
      return mesh.vertices.filter(v => ids.has(v.id));
    }
    return [] as Vertex[];
  }, [localVertices, selectionStore.selection, mesh]);

  const centroid = useMemo(() => {
    if (!currentSelectionVertices || currentSelectionVertices.length === 0) return null as Vector3 | null;
    const c = currentSelectionVertices.reduce((acc, v) => ({ x: acc.x + v.position.x, y: acc.y + v.position.y, z: acc.z + v.position.z }), { x: 0, y: 0, z: 0 });
    return new Vector3(c.x / currentSelectionVertices.length, c.y / currentSelectionVertices.length, c.z / currentSelectionVertices.length);
  }, [currentSelectionVertices]);

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

      {/* Axis lock visual rays (visible when a tool is active) */}
      {toolStore.isActive && centroid && (
        <group>
          {[{ key: 'x', dir: new Vector3(1, 0, 0), color: new Color(1, 0, 0) },
            { key: 'y', dir: new Vector3(0, 1, 0), color: new Color(0, 1, 0) },
            { key: 'z', dir: new Vector3(0, 0, 1), color: new Color(0, 0, 1) }].map(({ key, dir, color }) => {
              const len = 1000;
              const positions = new Float32Array([
                centroid.x - dir.x * len, centroid.y - dir.y * len, centroid.z - dir.z * len,
                centroid.x + dir.x * len, centroid.y + dir.y * len, centroid.z + dir.z * len,
              ]);
              const opacity = toolStore.axisLock === key ? 1 : 0.2;
              return (
                <line key={key} ref={(n: any) => { if (n) n.renderOrder = 2550; }}>
                  <bufferGeometry>
                    {/* @ts-ignore */}
                    <bufferAttribute attach="attributes-position" args={[positions, 3]} />
                  </bufferGeometry>
                  <lineBasicMaterial color={color} depthTest={false} depthWrite={false} transparent opacity={opacity} />
                </line>
              );
            })}
        </group>
      )}
    </>
  );
};

export default EditModeOverlay;

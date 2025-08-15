'use client';

import React, { useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { Color, PerspectiveCamera, Vector3 } from 'three';
import { useGeometryStore } from '../../../stores/geometry-store';
import { Vertex } from '../../../types/geometry';

const ORANGE = new Color(1.0, 0.5, 0.0);
const BLACK = new Color(0, 0, 0);

// Convert desired pixel size to world-space scale so cubes appear constant on screen
function getScreenScale(camera: PerspectiveCamera, position: Vector3, viewportHeight: number, pixelSize = 10): number {
  const distance = camera.position.distanceTo(position);
  const vFOV = (camera.fov * Math.PI) / 180;
  const worldScreenHeightAtDistance = 2 * Math.tan(vFOV / 2) * distance;
  return (pixelSize / viewportHeight) * worldScreenHeightAtDistance;
}

interface VertexRendererProps {
  meshId: string;
  selectedVertexIds: string[];
  onVertexClick: (vertexId: string, event: any) => void;
  selectionMode: string;
  localVertices?: Vertex[]; // For showing local changes during tool operations
}

export const VertexRenderer: React.FC<VertexRendererProps> = ({
  meshId,
  selectedVertexIds,
  onVertexClick,
  selectionMode,
  localVertices
}) => {
  const { camera, size } = useThree();
  const geometryStore = useGeometryStore();
  const mesh = geometryStore.meshes.get(meshId);
  
  // Merge local vertex overrides (during tool operations) with mesh vertices so all vertices are always visible
  const vertices = useMemo(() => {
    const base = mesh?.vertices || [];
    if (!localVertices || localVertices.length === 0) return base;
    const overrides = new Map(localVertices.map(v => [v.id, v] as const));
    return base.map(v => overrides.get(v.id) || v);
  }, [mesh?.vertices, localVertices]);
  
  const vertexData = useMemo(() => {
    return vertices.map(vertex => {
      const position = new Vector3(vertex.position.x, vertex.position.y, vertex.position.z);
      const isSelected = selectedVertexIds.includes(vertex.id);
      const scale = getScreenScale(camera as PerspectiveCamera, position, size.height, 10);
      
      return {
        id: vertex.id,
        position,
        isSelected,
        scale
      };
    });
  }, [vertices, selectedVertexIds, camera, size.height]);

  const handleVertexPointerDown = (vertexId: string) => (event: any) => {
    if (selectionMode === 'vertex') {
      event.stopPropagation();
      onVertexClick(vertexId, event);
    }
  };

  return (
    <>
      {vertexData.map(vertex => (
        <mesh
          key={vertex.id}
          position={vertex.position}
          scale={[vertex.scale, vertex.scale, vertex.scale]}
          onPointerDown={handleVertexPointerDown(vertex.id)}
          renderOrder={3000}
        >
          <boxGeometry args={[.5, .5, .5]} />
          <meshBasicMaterial color={vertex.isSelected ? ORANGE : BLACK} depthTest={false} depthWrite={false} />
        </mesh>
      ))}
    </>
  );
};

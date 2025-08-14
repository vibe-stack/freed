import React, { useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { InstancedMesh, Object3D, Color, PerspectiveCamera, Vector3 } from 'three';
import { useGeometryStore } from '../../stores/geometryStore';
import { useSelectionStore } from '../../stores/selectionStore';
import { Vertex } from '../../types/geometry';

const ORANGE = new Color(1.0, 0.5, 0.0);
const BLACK = new Color(0, 0, 0);

// Screen-constant vertex size utility
function getScreenScale(camera: PerspectiveCamera, position: Vector3, size = 0.04): number {
  const distance = camera.position.distanceTo(position);
  const vFOV = (camera.fov * Math.PI) / 180;
  const height = 2 * Math.tan(vFOV / 2) * distance;
  return size * height / window.innerHeight;
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
  const { camera } = useThree();
  const geometryStore = useGeometryStore();
  const mesh = geometryStore.meshes.get(meshId);
  
  // Use local vertices if provided (during tool operations), otherwise use store vertices
  const vertices = localVertices || mesh?.vertices || [];
  
  const vertexData = useMemo(() => {
    return vertices.map(vertex => {
      const position = new Vector3(vertex.position.x, vertex.position.y, vertex.position.z);
      const isSelected = selectedVertexIds.includes(vertex.id);
      const scale = getScreenScale(camera as PerspectiveCamera, position);
      
      return {
        id: vertex.id,
        position,
        isSelected,
        scale
      };
    });
  }, [vertices, selectedVertexIds, camera]);

  const handleVertexPointerDown = (vertexId: string) => (event: any) => {
    event.stopPropagation();
    if (selectionMode === 'vertex') {
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
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial color={vertex.isSelected ? ORANGE : BLACK} />
        </mesh>
      ))}
    </>
  );
};

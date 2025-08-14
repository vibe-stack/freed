import React, { useMemo } from 'react';
import { Vector3, Color, BufferGeometry, Float32BufferAttribute } from 'three';
import { useGeometryStore } from '../../stores/geometryStore';
import { Edge, Vertex } from '../../types/geometry';

const ORANGE = new Color(1.0, 0.5, 0.0);
const BLACK = new Color(0, 0, 0);

interface EdgeRendererProps {
  meshId: string;
  selectedEdgeIds: string[];
  onEdgeClick: (edgeId: string, event: any) => void;
  selectionMode: string;
  localVertices?: Vertex[]; // For showing local changes during tool operations
}

export const EdgeRenderer: React.FC<EdgeRendererProps> = ({
  meshId,
  selectedEdgeIds,
  onEdgeClick,
  selectionMode,
  localVertices
}) => {
  const geometryStore = useGeometryStore();
  const mesh = geometryStore.meshes.get(meshId);
  
  // Use local vertices if provided (during tool operations), otherwise use store vertices
  const vertices = localVertices || mesh?.vertices || [];
  const edges = mesh?.edges || [];
  
  const edgeData = useMemo(() => {
    const vertexMap = new Map(vertices.map(v => [v.id, v]));
    
    return edges.map(edge => {
      const v0 = vertexMap.get(edge.vertexIds[0]);
      const v1 = vertexMap.get(edge.vertexIds[1]);
      
      if (!v0 || !v1) return null;
      
      const isSelected = selectedEdgeIds.includes(edge.id);
      
      const geometry = new BufferGeometry();
      const positions = new Float32Array([
        v0.position.x, v0.position.y, v0.position.z,
        v1.position.x, v1.position.y, v1.position.z,
      ]);
      geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
      
      return {
        id: edge.id,
        geometry,
        isSelected
      };
    }).filter(Boolean);
  }, [edges, vertices, selectedEdgeIds]);

  const handleEdgePointerDown = (edgeId: string) => (event: any) => {
    event.stopPropagation();
    if (selectionMode === 'edge') {
      onEdgeClick(edgeId, event);
    }
  };

  return (
    <>
      {edgeData.map(edge => {
        if (!edge) return null;
        
        return (
          <line key={edge.id} onPointerDown={handleEdgePointerDown(edge.id)}>
            <primitive object={edge.geometry} />
            <lineBasicMaterial color={edge.isSelected ? ORANGE : BLACK} linewidth={2} />
          </line>
        );
      })}
    </>
  );
};

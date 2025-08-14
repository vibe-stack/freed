import React, { useMemo } from 'react';
import { Color, BufferGeometry, Float32BufferAttribute } from 'three';
import { useGeometryStore } from '../../stores/geometryStore';
import { Face, Vertex } from '../../types/geometry';
import { convertQuadToTriangles } from '../../utils/geometry';

const ORANGE = new Color(1.0, 0.5, 0.0);
const GREY = new Color(0.5, 0.5, 0.5);

interface FaceRendererProps {
  meshId: string;
  selectedFaceIds: string[];
  onFaceClick: (faceId: string, event: any) => void;
  selectionMode: string;
  localVertices?: Vertex[]; // For showing local changes during tool operations
}

export const FaceRenderer: React.FC<FaceRendererProps> = ({
  meshId,
  selectedFaceIds,
  onFaceClick,
  selectionMode,
  localVertices
}) => {
  const geometryStore = useGeometryStore();
  const mesh = geometryStore.meshes.get(meshId);
  
  // Use local vertices if provided (during tool operations), otherwise use store vertices
  const vertices = localVertices || mesh?.vertices || [];
  const faces = mesh?.faces || [];
  
  const faceData = useMemo(() => {
    const vertexMap = new Map(vertices.map(v => [v.id, v]));
    
    return faces.map(face => {
      const faceVertices = face.vertexIds.map(vid => vertexMap.get(vid)).filter(Boolean);
      
      if (faceVertices.length < 3) return null;
      
      const isSelected = selectedFaceIds.includes(face.id);
      
      // Convert face to triangles for rendering
      const triangles = convertQuadToTriangles(face.vertexIds);
      const positions: number[] = [];
      const normals: number[] = [];
      
      triangles.forEach(triangle => {
        triangle.forEach(vertexId => {
          const vertex = vertexMap.get(vertexId);
          if (vertex) {
            positions.push(vertex.position.x, vertex.position.y, vertex.position.z);
            normals.push(vertex.normal.x, vertex.normal.y, vertex.normal.z);
          }
        });
      });
      
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
      geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
      
      return {
        id: face.id,
        geometry,
        isSelected
      };
    }).filter(Boolean);
  }, [faces, vertices, selectedFaceIds]);

  const handleFacePointerDown = (faceId: string) => (event: any) => {
    event.stopPropagation();
    if (selectionMode === 'face') {
      onFaceClick(faceId, event);
    }
  };

  return (
    <>
      {faceData.map(face => {
        if (!face) return null;
        
        return (
          <mesh key={face.id} onPointerDown={handleFacePointerDown(face.id)}>
            <primitive object={face.geometry} />
            <meshBasicMaterial 
              color={face.isSelected ? ORANGE : GREY} 
              side={2} // DoubleSide
              transparent 
              opacity={0.5} 
            />
          </mesh>
        );
      })}
    </>
  );
};

import { useState, useEffect } from 'react';
import { Vector3 } from 'three/webgpu';
import { Vertex } from '@/types/geometry';
import { useGeometryStore } from '@/stores/geometry-store';
import { useToolStore } from '@/stores/tool-store';
import { calculateFaceNormal } from '@/utils/geometry';
import { calculateCentroid, getSelectedVertices } from '../utils';

interface ToolSetupResult {
  originalVertices: Vertex[];
  localVertices: Vertex[];
  centroid: Vector3;
  accumulator: { rotation: number; scale: number };
  selectedFaceIds: string[];
  avgNormalLocal: Vector3;
  setLocalVertices: (vertices: Vertex[]) => void;
  setAccumulator: React.Dispatch<React.SetStateAction<{ rotation: number; scale: number }>>;
}

export function useToolSetup(
  meshId: string,
  onLocalDataChange: (vertices: Vertex[]) => void
): ToolSetupResult {
  const toolStore = useToolStore();
  
  const [originalVertices, setOriginalVertices] = useState<Vertex[]>([]);
  const [localVertices, setLocalVertices] = useState<Vertex[]>([]);
  const [centroid, setCentroid] = useState<Vector3>(new Vector3());
  const [accumulator, setAccumulator] = useState<{ rotation: number, scale: number }>({ rotation: 0, scale: 1 });
  const [selectedFaceIds, setSelectedFaceIds] = useState<string[]>([]);
  const [avgNormalLocal, setAvgNormalLocal] = useState<Vector3>(new Vector3(0, 1, 0));

  // Setup tool operation when tool becomes active
  useEffect(() => {
    const implemented = toolStore.tool === 'move' || toolStore.tool === 'rotate' || 
                       toolStore.tool === 'scale' || toolStore.tool === 'extrude' || 
                       toolStore.tool === 'inset' || toolStore.tool === 'bevel' || 
                       toolStore.tool === 'chamfer' || toolStore.tool === 'fillet';
    
    if (toolStore.isActive && implemented) {
      const { vertices: selectedVertices, faceIds } = getSelectedVertices(meshId);
      
      if (selectedVertices.length > 0) {
        // Always re-snapshot from store at operation start
        setOriginalVertices(selectedVertices);
        setLocalVertices(selectedVertices);
        setCentroid(calculateCentroid(selectedVertices));
        setAccumulator({ rotation: 0, scale: 1 });
        onLocalDataChange(selectedVertices);
        setSelectedFaceIds(faceIds);
        
        // Compute average normal in local space when face selection and extrude
        if (faceIds.length > 0) {
          const mesh = useGeometryStore.getState().meshes.get(meshId);
          if (mesh) {
            let nx = 0, ny = 0, nz = 0;
            faceIds.forEach(fid => {
              const face = mesh.faces.find(f => f.id === fid);
              if (face) {
                const n = calculateFaceNormal(face, mesh.vertices);
                nx += n.x; ny += n.y; nz += n.z;
              }
            });
            const len = Math.hypot(nx, ny, nz) || 1;
            setAvgNormalLocal(new Vector3(nx / len, ny / len, nz / len));
          }
        } else {
          setAvgNormalLocal(new Vector3(0, 1, 0));
        }
      }
    }
  }, [toolStore.isActive, toolStore.tool, meshId, onLocalDataChange]);

  return {
    originalVertices,
    localVertices,
    centroid,
    accumulator,
    selectedFaceIds,
    avgNormalLocal,
    setLocalVertices,
    setAccumulator
  };
}
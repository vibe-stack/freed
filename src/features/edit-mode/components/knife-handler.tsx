'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { Vector3, Raycaster, Vector2, BufferGeometry, Float32BufferAttribute, Mesh as ThreeMesh } from 'three/webgpu';
import { useToolStore } from '@/stores/tool-store';
import { useGeometryStore } from '@/stores/geometry-store';
import { Mesh } from '@/types/geometry';
import { applyKnifeCut } from '@/features/edit-mode/utils/knife-cut';

interface KnifeHandlerProps {
  meshId: string;
  objectRotation: { x: number; y: number; z: number };
  objectScale: { x: number; y: number; z: number };
  objectPosition: { x: number; y: number; z: number };
}

interface CutPoint {
  x: number;
  y: number;
  z: number;
  faceId: string;
}

interface CutLine {
  a: { x: number; y: number; z: number };
  b: { x: number; y: number; z: number };
}

function convertQuadToTriangles(vertexIds: string[]): [string, string, string][] {
  if (vertexIds.length === 3) return [[vertexIds[0], vertexIds[1], vertexIds[2]]];
  if (vertexIds.length === 4) return [
    [vertexIds[0], vertexIds[1], vertexIds[2]],
    [vertexIds[0], vertexIds[2], vertexIds[3]]
  ];
  // For n-gons, triangulate from first vertex
  const result: [string, string, string][] = [];
  for (let i = 1; i < vertexIds.length - 1; i++) {
    result.push([vertexIds[0], vertexIds[i], vertexIds[i + 1]]);
  }
  return result;
}

// Find the shortest path across faces between two points
function findFacePath(mesh: Mesh, startFaceId: string, endFaceId: string, startPoint: Vector3, endPoint: Vector3): CutLine[] {
  if (startFaceId === endFaceId) {
    // Same face, direct line
    return [{
      a: { x: startPoint.x, y: startPoint.y, z: startPoint.z },
      b: { x: endPoint.x, y: endPoint.y, z: endPoint.z }
    }];
  }
  
  // For now, use direct line - in a full implementation, you'd do pathfinding across face adjacency
  return [{
    a: { x: startPoint.x, y: startPoint.y, z: startPoint.z },
    b: { x: endPoint.x, y: endPoint.y, z: endPoint.z }
  }];
}

export const KnifeHandler: React.FC<KnifeHandlerProps> = ({ 
  meshId, 
  objectRotation, 
  objectScale, 
  objectPosition 
}) => {
  const { camera, gl } = useThree();
  const toolStore = useToolStore();
  const geometryStore = useGeometryStore();
  
  const [cutPoints, setCutPoints] = useState<CutPoint[]>([]);
  const [, setPreviewPath] = useState<CutLine[]>([]);
  const [, setHoverPoint] = useState<{ x: number; y: number; z: number; faceId: string } | null>(null);
  const [, setHoverPreviewLine] = useState<CutLine | null>(null);
  
  const mesh = geometryStore.meshes.get(meshId);
  
  const objTransform = useMemo(() => ({
    position: objectPosition,
    rotation: objectRotation,
    scale: objectScale
  }), [objectPosition, objectRotation, objectScale]);

  // Raycast against mesh faces to find hit point
  const raycastFace = useCallback((clientX: number, clientY: number) => {
    if (!mesh) return null;
    
    const rect = gl.domElement.getBoundingClientRect();
    const ndc = new Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -(((clientY - rect.top) / rect.height) * 2 - 1)
    );
    
    const raycaster = new Raycaster();
    raycaster.setFromCamera(ndc, camera);
    
    // Build temporary mesh for raycasting
    const positions: number[] = [];
    const triFace: string[] = [];
    const vmap = new Map(mesh.vertices.map((v) => [v.id, v]));
    
    for (const face of mesh.faces) {
      const tris = convertQuadToTriangles(face.vertexIds);
      for (const tri of tris) {
        const p0 = vmap.get(tri[0])?.position;
        const p1 = vmap.get(tri[1])?.position;
        const p2 = vmap.get(tri[2])?.position;
        if (!p0 || !p1 || !p2) continue;
        
        positions.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
        triFace.push(face.id);
      }
    }
    
    const tmp = new BufferGeometry();
    tmp.setAttribute('position', new Float32BufferAttribute(new Float32Array(positions), 3));
    const tmpMesh = new ThreeMesh(tmp);
    tmpMesh.position.set(objTransform.position.x, objTransform.position.y, objTransform.position.z);
    tmpMesh.rotation.set(objTransform.rotation.x, objTransform.rotation.y, objTransform.rotation.z);
    tmpMesh.scale.set(objTransform.scale.x, objTransform.scale.y, objTransform.scale.z);
    tmpMesh.updateMatrixWorld(true);
    
    const intersects = raycaster.intersectObject(tmpMesh, false);
    tmp.dispose();
    
    if (intersects.length === 0) return null;
    
    const hit = intersects[0];
    const faceIndex = hit.faceIndex ?? -1;
    if (faceIndex < 0) return null;
    
    const faceId = triFace[faceIndex];
    if (!faceId) return null;
    
    // Convert world hit point to local space
    const worldPoint = hit.point.clone();
    const localPoint = worldPoint.clone();
    localPoint.sub(new Vector3(objTransform.position.x, objTransform.position.y, objTransform.position.z));
    localPoint.divide(new Vector3(objTransform.scale.x, objTransform.scale.y, objTransform.scale.z));
    // Apply inverse rotation - simplified for this example
    
    return {
      x: localPoint.x,
      y: localPoint.y,
      z: localPoint.z,
      faceId
    };
  }, [mesh, camera, gl, objTransform]);

  // Update preview path when hovering
  const updatePreviewPath = useCallback((mousePoint: { x: number; y: number; z: number; faceId: string } | null) => {
    if (!mousePoint || cutPoints.length === 0) {
      setPreviewPath([]);
      setHoverPreviewLine(null);
      return;
    }
    
    const lastPoint = cutPoints[cutPoints.length - 1];
    const lastPos = new Vector3(lastPoint.x, lastPoint.y, lastPoint.z);
    const currentPos = new Vector3(mousePoint.x, mousePoint.y, mousePoint.z);
    
    // Set hover preview line from last cut point to current hover point
    setHoverPreviewLine({
      a: { x: lastPoint.x, y: lastPoint.y, z: lastPoint.z },
      b: { x: mousePoint.x, y: mousePoint.y, z: mousePoint.z }
    });
    
    if (mesh) {
      const path = findFacePath(mesh, lastPoint.faceId, mousePoint.faceId, lastPos, currentPos);
      setPreviewPath(path);
    }
  }, [cutPoints, mesh]);

  // Handle mouse move for hover preview
  useEffect(() => {
    if (!toolStore.isActive || toolStore.tool !== 'knife') return;
    
    const handleMouseMove = (e: MouseEvent) => {
      const point = raycastFace(e.clientX, e.clientY);
      setHoverPoint(point);
      updatePreviewPath(point);
      
      // Update tool store with hover line if we have cut points
      if (point && cutPoints.length > 0) {
        const lastPoint = cutPoints[cutPoints.length - 1];
        const currentData = toolStore.localData;
        if (currentData?.kind === 'knife') {
          toolStore.setLocalData({
            ...currentData,
            hoverLine: {
              a: { x: lastPoint.x, y: lastPoint.y, z: lastPoint.z },
              b: { x: point.x, y: point.y, z: point.z }
            }
          });
        }
      }
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, [toolStore.isActive, toolStore.tool, raycastFace, updatePreviewPath, cutPoints, toolStore]);

  // Handle mouse clicks
  useEffect(() => {
    if (!toolStore.isActive || toolStore.tool !== 'knife') return;
    
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return; // Only left click
      
      const point = raycastFace(e.clientX, e.clientY);
      if (!point) return;
      
      e.preventDefault();
      e.stopPropagation();
      
      setCutPoints(prev => {
        const newPoints = [...prev, point];
        
        // Update tool store with current state
        const newPath: CutLine[] = [];
        for (let i = 0; i < newPoints.length - 1; i++) {
          const a = newPoints[i];
          const b = newPoints[i + 1];
          if (mesh) {
            const pathSegments = findFacePath(mesh, a.faceId, b.faceId, 
              new Vector3(a.x, a.y, a.z), new Vector3(b.x, b.y, b.z));
            newPath.push(...pathSegments);
          }
        }
        
        toolStore.setLocalData({
          kind: 'knife',
          meshId,
          cutPoints: newPoints,
          previewPath: newPath
        });
        
        return newPoints;
      });
    };
    
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [toolStore, meshId, raycastFace, mesh]);

  // Handle keyboard events
  useEffect(() => {
    if (!toolStore.isActive || toolStore.tool !== 'knife') return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        // Confirm knife operation
        if (cutPoints.length >= 2) {
          // Apply the actual knife cut to the mesh
          geometryStore.updateMesh(meshId, (mesh) => {
            applyKnifeCut(mesh, cutPoints);
          });
          
          // Recalculate normals after cutting
          geometryStore.recalculateNormals(meshId);
          
          // End the operation
          toolStore.endOperation(true);
          setCutPoints([]);
          setPreviewPath([]);
          setHoverPoint(null);
        }
      } else if (e.key === 'Escape') {
        // Cancel knife operation
        toolStore.endOperation(false);
        setCutPoints([]);
        setPreviewPath([]);
        setHoverPoint(null);
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [toolStore, cutPoints, geometryStore, meshId]);

  // Clean up when tool becomes inactive
  useEffect(() => {
    if (!toolStore.isActive || toolStore.tool !== 'knife') {
      setCutPoints([]);
      setPreviewPath([]);
      setHoverPoint(null);
      setHoverPreviewLine(null);
    }
  }, [toolStore.isActive, toolStore.tool]);

  return null; // This component only handles events, no rendering
};

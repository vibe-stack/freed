"use client";

import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import * as THREE from 'three';

interface CPUBlob { 
  worldPos: { x: number; y: number; z: number }; 
  radius: number; 
  strength: number; 
}

interface Props {
  blobs: CPUBlob[];
  resolution: number;
  iso: number;
  smooth: boolean;
}

interface WorkerResult {
  id: string;
  vertices: Float32Array;
  indices: Uint32Array;
  normals: Float32Array;
  bounds: {
    min: [number, number, number];
    max: [number, number, number];
  };
  error?: string;
}

export const WebWorkerMarchingCubesField: React.FC<Props> = ({
  blobs,
  resolution,
  iso,
  smooth // eslint-disable-line @typescript-eslint/no-unused-vars
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const workerRef = useRef<Worker | null>(null);
  const pendingRequestId = useRef<string | null>(null);
  const materialRef = useRef(new THREE.MeshStandardMaterial({ 
    color: 0x4a90e2, 
    roughness: 0.25, 
    metalness: 0.05 
  }));

  const updateMesh = useCallback((result: WorkerResult) => {
    if (!groupRef.current) return;

    // Remove old mesh
    if (meshRef.current) {
      groupRef.current.remove(meshRef.current);
      meshRef.current.geometry.dispose();
    }

    // Create new geometry
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(result.vertices, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(result.normals, 3));
    geometry.setIndex(new THREE.BufferAttribute(result.indices, 1));

    // Create new mesh
    const mesh = new THREE.Mesh(geometry, materialRef.current);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    
    // Position based on bounds
    const center = [
      (result.bounds.min[0] + result.bounds.max[0]) / 2,
      (result.bounds.min[1] + result.bounds.max[1]) / 2,
      (result.bounds.min[2] + result.bounds.max[2]) / 2
    ];
    mesh.position.set(center[0], center[1], center[2]);

    meshRef.current = mesh;
    groupRef.current.add(mesh);
  }, []);

  // Initialize worker
  useEffect(() => {
    workerRef.current = new Worker(
      new URL('./metaball-worker.ts', import.meta.url),
      { type: 'module' }
    );

    workerRef.current.onmessage = (event: MessageEvent<WorkerResult>) => {
      const result = event.data;
      
      if (result.id !== pendingRequestId.current) {
        return; // Ignore stale results
      }

      if (result.error) {
        console.error('Worker error:', result.error);
        return;
      }

      updateMesh(result);
      pendingRequestId.current = null;
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, [updateMesh]);

  // Compute bounds
  const bounds = useMemo(() => {
    if (!blobs.length) {
      return { min: [-1, -1, -1] as [number, number, number], max: [1, 1, 1] as [number, number, number] };
    }

    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    
    for (const blob of blobs) {
      const { x, y, z } = blob.worldPos;
      const r = blob.radius;
      
      minX = Math.min(minX, x - r);
      minY = Math.min(minY, y - r);
      minZ = Math.min(minZ, z - r);
      maxX = Math.max(maxX, x + r);
      maxY = Math.max(maxY, y + r);
      maxZ = Math.max(maxZ, z + r);
    }

    // Add padding
    const sizeX = maxX - minX;
    const sizeY = maxY - minY;
    const sizeZ = maxZ - minZ;
    const maxExtent = Math.max(sizeX, sizeY, sizeZ) || 1;
    const pad = maxExtent * 0.1;
    
    return {
      min: [minX - pad, minY - pad, minZ - pad] as [number, number, number],
      max: [maxX + pad, maxY + pad, maxZ + pad] as [number, number, number]
    };
  }, [blobs]);

  // Request computation when inputs change
  useEffect(() => {
    if (!workerRef.current || !blobs.length) return;

    const requestId = `${Date.now()}-${Math.random()}`;
    pendingRequestId.current = requestId;

    const metaballs = blobs.map(blob => ({
      position: [blob.worldPos.x, blob.worldPos.y, blob.worldPos.z] as [number, number, number],
      radius: blob.radius,
      strength: blob.strength
    }));

    workerRef.current.postMessage({
      id: requestId,
      metaballs,
      bounds,
      resolution: Math.max(8, Math.min(128, resolution)),
      iso
    });
  }, [blobs, bounds, resolution, iso]);

  return <group ref={groupRef} />;
};

export default WebWorkerMarchingCubesField;

"use client";

import React, { useEffect, useRef, useMemo } from 'react';
import * as THREE from 'three';
import { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js';

interface CPUBlob { 
  worldPos: { x: number; y: number; z: number }; 
  radius: number; 
  strength: number; 
  color?: string | number; 
}

interface Props {
  blobs: CPUBlob[];
  resolution: number;
  iso: number;
  smooth: boolean;
}

export const OptimizedMarchingCubesField: React.FC<Props> = ({
  blobs,
  resolution,
  iso,
  smooth
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const mcRef = useRef<typeof MarchingCubes.prototype | null>(null);
  const materialRef = useRef(new THREE.MeshStandardMaterial({ 
    color: 0x4a90e2, 
    roughness: 0.25, 
    metalness: 0.05 
  }));

  // Stable refs for change detection
  const lastBlobsRef = useRef<CPUBlob[]>([]);
  const lastIsoRef = useRef<number>(NaN);
  const lastResolutionRef = useRef<number>(NaN);
  const needsUpdate = useRef<boolean>(true);

  // Initialize MarchingCubes object
  useEffect(() => {
    if (!groupRef.current) return;
    
    const targetRes = Math.max(8, resolution | 0);
    
    // Clean up previous
    if (mcRef.current) {
      groupRef.current.remove(mcRef.current as any);
      (mcRef.current as any).geometry?.dispose?.();
    }
    
    // Create new
    const mc = new MarchingCubes(targetRes, materialRef.current, true, true);
    mc.enableUvs = false;
    mc.enableColors = false;
    mc.isolation = 80;
    mc.castShadow = true;
    mc.receiveShadow = true;
    
    mcRef.current = mc;
    groupRef.current.add(mc);
    
    lastResolutionRef.current = targetRes;
    needsUpdate.current = true;
  }, [resolution]);

  // Check for changes that require surface rebuild
  const hasChanged = useMemo(() => {
    // Check iso level
    if (iso !== lastIsoRef.current) {
      lastIsoRef.current = iso;
      return true;
    }

    // Check blob changes (deep comparison)
    const lastBlobs = lastBlobsRef.current;
    if (blobs.length !== lastBlobs.length) {
      return true;
    }

    for (let i = 0; i < blobs.length; i++) {
      const current = blobs[i];
      const last = lastBlobs[i];
      
      if (!last || 
          Math.abs(current.worldPos.x - last.worldPos.x) > 1e-6 ||
          Math.abs(current.worldPos.y - last.worldPos.y) > 1e-6 ||
          Math.abs(current.worldPos.z - last.worldPos.z) > 1e-6 ||
          Math.abs(current.radius - last.radius) > 1e-6 ||
          Math.abs(current.strength - last.strength) > 1e-6) {
        return true;
      }
    }

    return false;
  }, [blobs, iso]);

  // Update surface only when needed
  useEffect(() => {
    if (!hasChanged && !needsUpdate.current) return;
    
    const mc = mcRef.current as any;
    if (!mc) return;

    // Store current state
    lastBlobsRef.current = blobs.map(b => ({ ...b, worldPos: { ...b.worldPos } }));
    needsUpdate.current = false;

    // Rebuild surface
    rebuildSurface(mc, blobs, iso);
  }, [hasChanged, blobs, iso]);

  return <group ref={groupRef} />;
};

function rebuildSurface(mc: any, blobs: CPUBlob[], iso: number) {
  mc.reset();

  if (!blobs.length) {
    mc.isolation = 10;
    mc.update();
    return;
  }

  // Compute bounds
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
  
  minX -= pad; minY -= pad; minZ -= pad;
  maxX += pad; maxY += pad; maxZ += pad;
  
  const finalSizeX = maxX - minX;
  const finalSizeY = maxY - minY;
  const finalSizeZ = maxZ - minZ;

  mc.position.set(minX, minY, minZ);
  mc.scale.set(finalSizeX, finalSizeY, finalSizeZ);
  mc.isolation = THREE.MathUtils.clamp(iso * 40, 5, 200);

  // Add blobs
  const subtract = 12;
  for (const blob of blobs) {
    const nx = (blob.worldPos.x - minX) / finalSizeX;
    const ny = (blob.worldPos.y - minY) / finalSizeY;
    const nz = (blob.worldPos.z - minZ) / finalSizeZ;
    const strength = (blob.radius / maxExtent) * blob.strength * 1.2 + 0.0001;
    mc.addBall(nx, ny, nz, strength, subtract);
  }

  mc.update();

  // Fallback if empty
  const posAttr = mc.geometry.getAttribute('position');
  if (!posAttr || posAttr.count === 0) {
    mc.reset();
    mc.isolation = 30;
    for (const blob of blobs) {
      const nx = (blob.worldPos.x - minX) / finalSizeX;
      const ny = (blob.worldPos.y - minY) / finalSizeY;
      const nz = (blob.worldPos.z - minZ) / finalSizeZ;
      const strength = (blob.radius / maxExtent) * blob.strength * 1.5 + 0.0001;
      mc.addBall(nx, ny, nz, strength, subtract);
    }
    mc.update();
  }
}

export default OptimizedMarchingCubesField;

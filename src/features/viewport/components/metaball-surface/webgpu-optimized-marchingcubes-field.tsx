"use client";

import React, { useEffect, useRef, useMemo } from 'react';
import * as THREE from 'three';
// @ts-ignore examples path
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

export const WebGPUOptimizedMarchingCubesField: React.FC<Props> = ({
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

  // Track previous state for change detection
  const prevStateRef = useRef<{
    blobs: CPUBlob[];
    resolution: number;
    iso: number;
  }>({ blobs: [], resolution: 0, iso: 0 });

  // Initialize MarchingCubes
  useEffect(() => {
    if (!groupRef.current) return;
    
    const targetRes = Math.max(8, Math.min(64, resolution)); // Limit resolution for WebGPU
    
    // Clean up previous
    if (mcRef.current) {
      groupRef.current.remove(mcRef.current as any);
      (mcRef.current as any).geometry?.dispose?.();
    }
    
    // Create new MarchingCubes
    const mc = new MarchingCubes(targetRes, materialRef.current, true, true);
    mc.enableUvs = false;
    mc.enableColors = false;
    mc.isolation = 80;
    mc.castShadow = true;
    mc.receiveShadow = true;
    
    mcRef.current = mc;
    groupRef.current.add(mc);
    
    // Force initial update
    prevStateRef.current = { blobs: [], resolution: 0, iso: 0 };
  }, [resolution]);

  // Check if we need to update the surface
  const needsUpdate = useMemo(() => {
    const prev = prevStateRef.current;
    
    // Check resolution or iso changes
    if (resolution !== prev.resolution || Math.abs(iso - prev.iso) > 0.001) {
      return true;
    }
    
    // Check blob count
    if (blobs.length !== prev.blobs.length) {
      return true;
    }
    
    // Check individual blob changes with higher precision
    for (let i = 0; i < blobs.length; i++) {
      const current = blobs[i];
      const previous = prev.blobs[i];
      
      if (!previous ||
          Math.abs(current.worldPos.x - previous.worldPos.x) > 0.001 ||
          Math.abs(current.worldPos.y - previous.worldPos.y) > 0.001 ||
          Math.abs(current.worldPos.z - previous.worldPos.z) > 0.001 ||
          Math.abs(current.radius - previous.radius) > 0.001 ||
          Math.abs(current.strength - previous.strength) > 0.001) {
        return true;
      }
    }
    
    return false;
  }, [blobs, resolution, iso]);

  // Update surface only when needed
  useEffect(() => {
    if (!needsUpdate || !mcRef.current) return;
    
    const mc = mcRef.current as any;
    
    // Store current state
    prevStateRef.current = {
      blobs: blobs.map(b => ({ 
        worldPos: { ...b.worldPos }, 
        radius: b.radius, 
        strength: b.strength 
      })),
      resolution,
      iso
    };
    
    // Update the marching cubes surface
    updateMarchingCubesSurface(mc, blobs, iso);
  }, [needsUpdate, blobs, resolution, iso]);

  return <group ref={groupRef} />;
};

function updateMarchingCubesSurface(mc: any, blobs: CPUBlob[], iso: number) {
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
  const pad = maxExtent * 0.15;
  
  minX -= pad; minY -= pad; minZ -= pad;
  maxX += pad; maxY += pad; maxZ += pad;
  
  const finalSizeX = maxX - minX;
  const finalSizeY = maxY - minY;
  const finalSizeZ = maxZ - minZ;

  // Position and scale the marching cubes field
  mc.position.set(minX, minY, minZ);
  mc.scale.set(finalSizeX, finalSizeY, finalSizeZ);
  mc.isolation = THREE.MathUtils.clamp(iso * 40, 5, 200);

  // Add metaballs
  const subtract = 12;
  for (const blob of blobs) {
    const nx = (blob.worldPos.x - minX) / finalSizeX;
    const ny = (blob.worldPos.y - minY) / finalSizeY;
    const nz = (blob.worldPos.z - minZ) / finalSizeZ;
    const strength = (blob.radius / maxExtent) * blob.strength * 1.2 + 0.0001;
    mc.addBall(nx, ny, nz, strength, subtract);
  }

  // Update the surface - this is the expensive operation
  mc.update();

  // Fallback if no surface was generated
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

export default WebGPUOptimizedMarchingCubesField;

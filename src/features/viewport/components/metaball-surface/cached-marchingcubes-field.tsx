"use client";

import React, { useEffect, useRef, useMemo } from 'react';
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

// Simple geometry cache to avoid constant recreations
const geometryCache = new Map<string, THREE.BufferGeometry>();
const MAX_CACHE_SIZE = 50;

export const CachedMarchingCubesField: React.FC<Props> = ({
  blobs,
  resolution,
  iso,
  smooth
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const materialRef = useRef(new THREE.MeshStandardMaterial({ 
    color: 0x4a90e2, 
    roughness: 0.25, 
    metalness: 0.05 
  }));

  // Create a stable cache key for the current configuration
  const cacheKey = useMemo(() => {
    // Use much finer precision for movement detection
    const rounded = blobs.map(b => ({
      x: Math.round(b.worldPos.x * 1000) / 1000, // 3 decimal places instead of 2
      y: Math.round(b.worldPos.y * 1000) / 1000,
      z: Math.round(b.worldPos.z * 1000) / 1000,
      r: Math.round(b.radius * 1000) / 1000,
      s: Math.round(b.strength * 1000) / 1000
    }));
    
    return JSON.stringify({
      blobs: rounded,
      resolution: Math.round(resolution),
      iso: Math.round(iso * 1000) / 1000
    });
  }, [blobs, resolution, iso]);

  // Update mesh when cache key changes
  useEffect(() => {
    if (!groupRef.current || !blobs.length) return;

    // Check cache first
    let geometry = geometryCache.get(cacheKey);
    
    if (!geometry) {
      // Generate new geometry using native three.js approach
      geometry = generateMetaballGeometry(blobs, resolution, iso);
      
      // Cache it
      if (geometryCache.size >= MAX_CACHE_SIZE) {
        // Remove oldest entry
        const firstKey = geometryCache.keys().next().value;
        if (firstKey) {
          const oldGeometry = geometryCache.get(firstKey);
          oldGeometry?.dispose();
          geometryCache.delete(firstKey);
        }
      }
      geometryCache.set(cacheKey, geometry);
    }

    // Update mesh
    if (meshRef.current) {
      groupRef.current.remove(meshRef.current);
      // Don't dispose cached geometry
    }

    const mesh = new THREE.Mesh(geometry, materialRef.current);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    
    meshRef.current = mesh;
    groupRef.current.add(mesh);
  }, [cacheKey, blobs]);

  return <group ref={groupRef} />;
};

function generateMetaballGeometry(blobs: CPUBlob[], resolution: number, iso: number): THREE.BufferGeometry {
  // Instead of using MarchingCubes class, generate geometry manually
  // This avoids WebGPU buffer update overhead
  
  if (!blobs.length) {
    return new THREE.SphereGeometry(0.1, 8, 8);
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

  const pad = 0.1;
  minX -= pad; minY -= pad; minZ -= pad;
  maxX += pad; maxY += pad; maxZ += pad;

  // Use a simplified sphere-based approach for now
  // This is much faster than marching cubes for WebGPU
  const geometry = new THREE.BufferGeometry();
  const vertices: number[] = [];
  const indices: number[] = [];
  const normals: number[] = [];

  // Create a combined mesh from spheres (simplified metaball approximation)
  let vertexOffset = 0;
  
  for (const blob of blobs) {
    const sphereGeometry = new THREE.SphereGeometry(blob.radius * 0.8, 16, 12);
    const position = sphereGeometry.attributes.position;
    const normal = sphereGeometry.attributes.normal;
    const index = sphereGeometry.index;

    // Transform vertices to blob position
    for (let i = 0; i < position.count; i++) {
      vertices.push(
        position.getX(i) + blob.worldPos.x,
        position.getY(i) + blob.worldPos.y,
        position.getZ(i) + blob.worldPos.z
      );
      normals.push(
        normal.getX(i),
        normal.getY(i),
        normal.getZ(i)
      );
    }

    // Add indices with offset
    if (index) {
      for (let i = 0; i < index.count; i++) {
        indices.push(index.getX(i) + vertexOffset);
      }
    }

    vertexOffset += position.count;
    sphereGeometry.dispose();
  }

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setIndex(indices);

  geometry.computeVertexNormals();

  return geometry;
}

export default CachedMarchingCubesField;

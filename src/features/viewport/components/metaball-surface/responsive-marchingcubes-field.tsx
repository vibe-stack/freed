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

export const ResponsiveMarchingCubesField: React.FC<Props> = ({
  blobs,
  resolution,
  iso,
  smooth // eslint-disable-line @typescript-eslint/no-unused-vars
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const materialRef = useRef(new THREE.MeshStandardMaterial({ 
    color: 0x4a90e2, 
    roughness: 0.25, 
    metalness: 0.05 
  }));

  // Track last values for change detection
  const lastBlobsRef = useRef<CPUBlob[]>([]);
  const lastResolutionRef = useRef<number>(0);
  const lastIsoRef = useRef<number>(0);

  // Check if we need to update (much more sensitive than caching approach)
  const needsUpdate = useMemo(() => {
    // Check resolution/iso changes
    if (resolution !== lastResolutionRef.current || Math.abs(iso - lastIsoRef.current) > 0.001) {
      return true;
    }

    // Check blob count change
    if (blobs.length !== lastBlobsRef.current.length) {
      return true;
    }

    // Check individual blob changes (very sensitive)
    for (let i = 0; i < blobs.length; i++) {
      const current = blobs[i];
      const last = lastBlobsRef.current[i];
      
      if (!last || 
          Math.abs(current.worldPos.x - last.worldPos.x) > 0.01 ||
          Math.abs(current.worldPos.y - last.worldPos.y) > 0.01 ||
          Math.abs(current.worldPos.z - last.worldPos.z) > 0.01 ||
          Math.abs(current.radius - last.radius) > 0.01 ||
          Math.abs(current.strength - last.strength) > 0.01) {
        return true;
      }
    }

    return false;
  }, [blobs, resolution, iso]);

  // Update mesh when needed
  useEffect(() => {
    if (!needsUpdate || !groupRef.current) return;

    // Store current values
    lastBlobsRef.current = blobs.map(b => ({ 
      worldPos: { ...b.worldPos }, 
      radius: b.radius, 
      strength: b.strength 
    }));
    lastResolutionRef.current = resolution;
    lastIsoRef.current = iso;

    // Generate new geometry
    const geometry = generateMetaballGeometry(blobs, resolution, iso);

    // Update mesh
    if (meshRef.current) {
      groupRef.current.remove(meshRef.current);
      meshRef.current.geometry.dispose();
    }

    if (blobs.length > 0) {
      const mesh = new THREE.Mesh(geometry, materialRef.current);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      
      meshRef.current = mesh;
      groupRef.current.add(mesh);
    }
  }, [needsUpdate, blobs, resolution, iso]);

  return <group ref={groupRef} />;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function generateMetaballGeometry(blobs: CPUBlob[], resolution: number, iso: number): THREE.BufferGeometry {
  if (!blobs.length) {
    return new THREE.SphereGeometry(0.1, 8, 8);
  }

  // Compute bounds
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  
  for (const blob of blobs) {
    const { x, y, z } = blob.worldPos;
    const r = blob.radius * 1.2; // Slightly larger bounds for blending
    
    minX = Math.min(minX, x - r);
    minY = Math.min(minY, y - r);
    minZ = Math.min(minZ, z - r);
    maxX = Math.max(maxX, x + r);
    maxY = Math.max(maxY, y + r);
    maxZ = Math.max(maxZ, z + r);
  }

  const pad = 0.2;
  minX -= pad; minY -= pad; minZ -= pad;
  maxX += pad; maxY += pad; maxZ += pad;

  // Create a better metaball approximation using multiple overlapping spheres
  const geometry = new THREE.BufferGeometry();
  const vertices: number[] = [];
  const indices: number[] = [];
  const normals: number[] = [];

  let vertexOffset = 0;
  
  for (const blob of blobs) {
    // Create main sphere
    const mainRadius = blob.radius * 0.7;
    const sphereGeometry = new THREE.SphereGeometry(mainRadius, 16, 12);
    
    addSphereToGeometry(sphereGeometry, blob.worldPos, vertices, normals, indices, vertexOffset);
    vertexOffset += sphereGeometry.attributes.position.count;
    
    // Add smaller spheres around the main one for more organic shape
    const numSubSpheres = Math.min(6, Math.max(3, Math.floor(blob.strength * 4)));
    for (let i = 0; i < numSubSpheres; i++) {
      const angle1 = (i / numSubSpheres) * Math.PI * 2;
      const angle2 = Math.sin(i * 1.7) * Math.PI * 0.5;
      
      const offset = blob.radius * 0.4;
      const subPos = {
        x: blob.worldPos.x + Math.cos(angle1) * Math.cos(angle2) * offset,
        y: blob.worldPos.y + Math.sin(angle2) * offset,
        z: blob.worldPos.z + Math.sin(angle1) * Math.cos(angle2) * offset
      };
      
      const subRadius = mainRadius * (0.3 + 0.2 * Math.sin(i * 2.3));
      const subSphereGeometry = new THREE.SphereGeometry(subRadius, 8, 6);
      
      addSphereToGeometry(subSphereGeometry, subPos, vertices, normals, indices, vertexOffset);
      vertexOffset += subSphereGeometry.attributes.position.count;
      
      subSphereGeometry.dispose();
    }
    
    sphereGeometry.dispose();
  }

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setIndex(indices);

  geometry.computeVertexNormals();

  return geometry;
}

function addSphereToGeometry(
  sphereGeometry: THREE.SphereGeometry,
  position: { x: number; y: number; z: number },
  vertices: number[],
  normals: number[],
  indices: number[],
  vertexOffset: number
) {
  const positionAttr = sphereGeometry.attributes.position;
  const normalAttr = sphereGeometry.attributes.normal;
  const indexAttr = sphereGeometry.index;

  // Add vertices and normals
  for (let i = 0; i < positionAttr.count; i++) {
    vertices.push(
      positionAttr.getX(i) + position.x,
      positionAttr.getY(i) + position.y,
      positionAttr.getZ(i) + position.z
    );
    normals.push(
      normalAttr.getX(i),
      normalAttr.getY(i),
      normalAttr.getZ(i)
    );
  }

  // Add indices with offset
  if (indexAttr) {
    for (let i = 0; i < indexAttr.count; i++) {
      indices.push(indexAttr.getX(i) + vertexOffset);
    }
  }
}

export default ResponsiveMarchingCubesField;

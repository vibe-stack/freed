"use client";

// MarchingCubes-based metaball surface using Three's built-in implementation.
// This replaces the hand-rolled marching cubes which exhibited cracks.

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three'; // use core three for examples compatibility
import { useFrame } from '@react-three/fiber';
import { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js';

interface CPUBlob { worldPos: { x: number; y: number; z: number }; radius: number; strength: number; color?: string | number; }

interface Props {
  blobs: CPUBlob[];
  resolution: number; // requested base resolution
  iso: number;
  smooth: boolean; // reserved
  maxUpdatesPerSecond?: number; // throttle expensive surface rebuilds (default 20)
  autoLOD?: boolean; // dynamically adapt resolution to frame time
  minResolution?: number; // floor for LOD (default 12)
  maxResolution?: number; // cap (default = resolution prop)
  targetFrameMS?: number; // desired avg frame time (default 20ms ~50fps)
  hysteresisMS?: number; // hysteresis band to avoid oscillation (default 4ms)
}

// Heuristic mapping of metaball params to MarchingCubes addBall params.
// addBall expects position in [0,1]^3, strength ~ contribution, subtract ~ baseline / iso.

export const MarchingCubesField: React.FC<Props> = ({
  blobs,
  resolution,
  iso,
  smooth, // eslint keeps param unused safe
  maxUpdatesPerSecond = 2,
  autoLOD = true,
  minResolution = 6,
  maxResolution,
  targetFrameMS = 60,
  hysteresisMS = 4
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const mcRef = useRef<typeof MarchingCubes.prototype | null>(null);
  const materialRef = useRef(new THREE.MeshStandardMaterial({ color: 0x4a90e2, roughness: 0.25, metalness: 0.05 }));
  // Lightweight change detection & perf state
  const lastBlobSig = useRef<number>(NaN);
  const lastIso = useRef<number>(NaN);
  const lastBounds = useRef<[number, number, number, number, number, number] | null>(null);
  const lastUpdateTime = useRef<number>(0);
  const avgFrameMS = useRef<number>(16.7);
  const currentResolution = useRef<number>(Math.max(8, resolution | 0));
  const desiredResolution = useRef<number>(currentResolution.current);
  const rebuilding = useRef<boolean>(false);
//   const effectiveMaxRes = maxResolution ? Math.max(minResolution, maxResolution) : resolution;
const effectiveMaxRes = 16;

  // Track desired resolution updates from props
  useEffect(() => { desiredResolution.current = Math.max(8, resolution | 0); }, [resolution]);

  // Helper to (re)construct MarchingCubes when resolution changes
  const rebuildMCObject = (res: number) => {
    if (!groupRef.current) return;
    const targetRes = Math.max(8, res | 0);
    currentResolution.current = targetRes;
    if (mcRef.current) {
      groupRef.current.remove(mcRef.current as any);
      (mcRef.current as any).geometry?.dispose?.();
    }
    const mc = new MarchingCubes(targetRes, materialRef.current, true, true);
    mc.enableUvs = false;
    mc.enableColors = false;
    mc.isolation = 80;
    mc.castShadow = true;
    mc.receiveShadow = true;
    mcRef.current = mc;
    groupRef.current.add(mc);
    lastBlobSig.current = NaN; // force first surface rebuild
    lastBounds.current = null;
  };

  useEffect(() => { rebuildMCObject(currentResolution.current); }, []);

  // Rebuild in render loop when inputs change (ensures dynamic metaball movement works without remount).
  useFrame((state) => {
    const mc = mcRef.current as any;
    if (!mc) return;

    // Frame timing & adaptive resolution
    const dt = state.clock.getDelta();
    const frameMS = dt * 1000;
    avgFrameMS.current = THREE.MathUtils.lerp(avgFrameMS.current, frameMS, 0.05);

    if (autoLOD) {
      const over = avgFrameMS.current > (targetFrameMS + hysteresisMS);
      const under = avgFrameMS.current < (targetFrameMS - hysteresisMS);
      if (over && desiredResolution.current > minResolution) {
        desiredResolution.current = Math.max(minResolution, Math.floor(desiredResolution.current * 0.8));
      } else if (under && desiredResolution.current < effectiveMaxRes) {
        desiredResolution.current = Math.min(effectiveMaxRes, Math.ceil(desiredResolution.current * 1.15));
      }
      if (desiredResolution.current !== currentResolution.current && !rebuilding.current) {
        rebuilding.current = true;
        rebuildMCObject(desiredResolution.current);
        rebuilding.current = false;
      }
    }

    // Throttle expensive surface rebuilds
    const now = state.clock.elapsedTime;
    const minInterval = 1 / maxUpdatesPerSecond;
    if (now - lastUpdateTime.current < minInterval) return;

    // Cheap signature (sum-hash) for blob set
    let sum = 0;
    for (let i = 0; i < blobs.length; i++) {
      const b = blobs[i];
      sum += b.worldPos.x * 3.17 + b.worldPos.y * 7.31 + b.worldPos.z * 11.23 + b.radius * 13.7 + b.strength * 17.9;
    }
    const blobSig = sum + blobs.length * 23.57;

    // Compute bounds
    let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (let i = 0; i < blobs.length; i++) {
      const b = blobs[i];
      const r = b.radius;
      const { x, y, z } = b.worldPos;
      if (x - r < minX) minX = x - r; if (y - r < minY) minY = y - r; if (z - r < minZ) minZ = z - r;
      if (x + r > maxX) maxX = x + r; if (y + r > maxY) maxY = y + r; if (z + r > maxZ) maxZ = z + r;
    }
    if (minX === Infinity) { minX = -1; minY = -1; minZ = -1; maxX = 1; maxY = 1; maxZ = 1; }
    const bounds: [number, number, number, number, number, number] = [minX, minY, minZ, maxX, maxY, maxZ];

    const boundsChanged = (() => {
      const prev = lastBounds.current;
      if (!prev) return true;
      const eps = 1e-3;
      for (let i = 0; i < 6; i++) if (Math.abs(prev[i] - bounds[i]) > eps) return true;
      return false;
    })();

    if (!boundsChanged && blobSig === lastBlobSig.current && iso === lastIso.current) {
      return; // No significant change
    }

    lastBlobSig.current = blobSig;
    lastIso.current = iso;
    lastBounds.current = bounds;
    lastUpdateTime.current = now;

    mc.reset();

    if (!blobs.length) {
      mc.isolation = 10;
      mc.update();
      return;
    }

    // Expand bounds by padding
    const sizeX = bounds[3] - bounds[0], sizeY = bounds[4] - bounds[1], sizeZ = bounds[5] - bounds[2];
    const maxExtent = Math.max(sizeX, sizeY, sizeZ) || 1;
    const pad = maxExtent * 0.1;
    const minXp = bounds[0] - pad, minYp = bounds[1] - pad, minZp = bounds[2] - pad;
    const maxXp = bounds[3] + pad, maxYp = bounds[4] + pad, maxZp = bounds[5] + pad;
    const finalSizeX = maxXp - minXp, finalSizeY = maxYp - minYp, finalSizeZ = maxZp - minZp;
    mc.position.set(minXp, minYp, minZp);
    mc.scale.set(finalSizeX, finalSizeY, finalSizeZ);

    const subtract = 12;
    mc.isolation = THREE.MathUtils.clamp(iso * 40, 5, 200);

    for (let i = 0; i < blobs.length; i++) {
      const b = blobs[i];
      const nx = (b.worldPos.x - minXp) / finalSizeX;
      const ny = (b.worldPos.y - minYp) / finalSizeY;
      const nz = (b.worldPos.z - minZp) / finalSizeZ;
      const strength = (b.radius / maxExtent) * b.strength * 1.2 + 0.0001;
      mc.addBall(nx, ny, nz, strength, subtract);
    }

    mc.update();

    // Fallback if empty
    const posAttr = mc.geometry.getAttribute('position');
    if (!posAttr || posAttr.count === 0) {
      mc.reset();
      mc.isolation = 30;
      for (let i = 0; i < blobs.length; i++) {
        const b = blobs[i];
        const nx = (b.worldPos.x - minXp) / finalSizeX;
        const ny = (b.worldPos.y - minYp) / finalSizeY;
        const nz = (b.worldPos.z - minZp) / finalSizeZ;
        const strength = (b.radius / maxExtent) * b.strength * 1.5 + 0.0001;
        mc.addBall(nx, ny, nz, strength, subtract);
      }
      mc.update();
    }
  });

  return <group ref={groupRef} />;
};

export default MarchingCubesField;

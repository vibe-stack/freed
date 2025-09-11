"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BufferGeometry, Color, InstancedMesh, Material, Object3D, Quaternion, Vector3 as T3V, Euler, Box3, SphereGeometry, MeshBasicMaterial, DoubleSide } from 'three/webgpu';
import { useFluidStore } from '@/stores/fluid-store';
import { useAnimationStore } from '@/stores/animation-store';
import { useSceneStore } from '@/stores/scene-store';
import { getObject3D } from '@/features/viewport/hooks/object3d-registry';
import { useFrame } from '@react-three/fiber';
import { useViewportStore } from '@/stores/viewport-store';
import { useGeometryStore } from '@/stores/geometry-store';
import * as THREE from "three/webgpu";
import { useMaterialNodes } from '@/features/materials/hooks/use-material-nodes';
// Basic particle representation (CPU fallback / simplified) – placeholder until GPU MLS-MPM variant
interface FluidParticle { alive: boolean; pos: T3V; vel: T3V; age: number; life: number; }

function makeParticle(): FluidParticle { return { alive: false, pos: new T3V(), vel: new T3V(), age: 0, life: 0 }; }

// Simple RNG
function makeRng(seed: number) { let t = seed >>> 0; return () => { t += 0x6D2B79F5; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; }; }

// Sample random point in unit cube then remap to bounds
function randomInBox(rng: () => number, min: T3V, max: T3V, out: T3V) { out.set(min.x + (max.x - min.x) * rng(), min.y + (max.y - min.y) * rng(), min.z + (max.z - min.z) * rng()); return out; }

// Derive world AABB from a volume object; fallback to centered unit cube around system object
function computeVolumeBounds(volumeObj3D: any | null, systemObj3D: any | null): Box3 {
  const box = new Box3();
  if (volumeObj3D) {
    volumeObj3D.updateWorldMatrix(true, false);
    box.setFromObject(volumeObj3D);
    if (!isFinite(box.min.x)) box.set(new T3V(-0.5, -0.5, -0.5), new T3V(0.5, 0.5, 0.5));
    return box;
  }
  if (systemObj3D) {
    systemObj3D.updateWorldMatrix(true, false);
    const p = systemObj3D.getWorldPosition(new T3V());
    box.min.set(p.x - 0.5, p.y - 0.5, p.z - 0.5);
    box.max.set(p.x + 0.5, p.y + 0.5, p.z + 0.5);
    return box;
  }
  box.min.set(-0.5, -0.5, -0.5); box.max.set(0.5, 0.5, 0.5); return box;
}

// Helper geometry cache
const helperGeom = new SphereGeometry(0.02, 6, 6);
const helperMat = new MeshBasicMaterial({ color: new Color('#3399ff'), wireframe: true });

// Acquire instanced geometry & material from particleObject mesh; fallback sphere
function useSourceGeometry(objectId: string | null): { geom: BufferGeometry; material: Material } {
  const [result, setResult] = useState<{ geom: BufferGeometry; material: Material }>(() => ({ geom: helperGeom, material: helperMat } as any));
  useEffect(() => {
    if (!objectId) { setResult({ geom: helperGeom, material: helperMat } as any); return; }
    const src = getObject3D(objectId);
    if (!src) return;
    let found: any = null;
    src.traverse((c: any) => { if (!found && c.isMesh && c.geometry) found = c; });
    if (found) setResult({ geom: found.geometry, material: Array.isArray(found.material) ? found.material[0] : found.material });
  }, [objectId]);
  return result;
}

export const FluidSystemNode: React.FC<{ objectId: string; systemId: string }> = ({ objectId, systemId }) => {
  const fluidSys = useFluidStore((s) => s.systems[systemId]);
  const playing = useAnimationStore((s) => s.playing);
  const fps = useAnimationStore((s) => s.fps || 30);
  const playhead = useAnimationStore((s) => s.playhead);
  const shadingMode = useViewportStore((s) => s.shadingMode);
  const scene = useSceneStore();
  const { geom, material } = useSourceGeometry(fluidSys?.particleObjectId || null);
  // Determine the materialId of the particle object (if it's a mesh resource) so we can prefer node-materials
  const geometryStore = useGeometryStore();
  const particleMeshId = fluidSys?.particleObjectId ? scene.objects[fluidSys.particleObjectId]?.meshId : undefined;
  const particleMaterialId = particleMeshId ? geometryStore.meshes.get(particleMeshId)?.materialId : undefined;
  const nodeMat = useMaterialNodes(particleMaterialId);
  const meshRef = useRef<InstancedMesh>(null!);
  const particlesRef = useRef<FluidParticle[]>([]);
  const deadRef = useRef<number[]>([]);
  const rngRef = useRef<() => number>(() => Math.random());
  const tempObj = useMemo(() => new Object3D(), []);
  const tmpV = useMemo(() => new T3V(), []);
  const tmpQ = useMemo(() => new Quaternion(), []);
  const volumeBoxRef = useRef<Box3>(new Box3());
  const lastSimFrameRef = useRef<number | null>(null);

  // Reset buffers on config changes
  useEffect(() => {
    if (!fluidSys) return;
    const cap = Math.min(200_000, Math.max(256, fluidSys.capacity));
    particlesRef.current = Array.from({ length: cap }, () => makeParticle());
    deadRef.current = Array.from({ length: cap }, (_, i) => cap - 1 - i);
    rngRef.current = makeRng(fluidSys.seed);
    if (meshRef.current) { meshRef.current.count = 0; }
    //eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fluidSys?.capacity, fluidSys?.seed, systemId]);

  // Simulation step (very simplified: gravity, damping, bounce in volume, optional lifetime)
  const stepSim = (steps: number) => {
    if (!fluidSys) return;
    const cap = particlesRef.current.length;
    // Determine world box each batch
    const volObj = fluidSys.volumeObjectId ? scene.objects[fluidSys.volumeObjectId] : null;
    const vol3D = volObj ? getObject3D(volObj.id) : null;
    const sysObj = scene.objects[objectId];
    const sys3D = sysObj ? getObject3D(sysObj.id) : null;
    const emitterObj = fluidSys.emitterObjectId ? scene.objects[fluidSys.emitterObjectId] : null;
    const emitter3D = emitterObj ? getObject3D(emitterObj.id) : sys3D;
    volumeBoxRef.current = computeVolumeBounds(vol3D, sys3D);
    const box = volumeBoxRef.current;
    const gravity = new T3V(fluidSys.gravity.x, fluidSys.gravity.y, fluidSys.gravity.z).multiplyScalar(fluidSys.speed);
    const damping = Math.max(0, fluidSys.damping);
    const bounce = Math.max(0, Math.min(1, fluidSys.bounce));
    const lifetime = Math.max(0, Math.floor(fluidSys.particleLifetime));
    const emitPerFrame = Math.max(0, fluidSys.emissionRate);
    const rng = rngRef.current;
    for (let s = 0; s < steps; s++) {
      // Emit
      const toEmit = Math.min(emitPerFrame, deadRef.current.length);
      for (let n = 0; n < toEmit; n++) {
        const idx = deadRef.current.pop(); if (idx === undefined) break;
        const p = particlesRef.current[idx];
        p.alive = true; p.age = 0; p.life = lifetime || 0;
        if (emitter3D) {
          // Spawn near emitter position with small jitter
          emitter3D.updateWorldMatrix(true, false);
          const epos = emitter3D.getWorldPosition(tmpV);
          p.pos.copy(epos);
          p.pos.x += (rng() - 0.5) * 0.05;
          p.pos.y += (rng() - 0.5) * 0.05;
          p.pos.z += (rng() - 0.5) * 0.05;
        } else {
          randomInBox(rng, box.min, box.max, p.pos);
          p.pos.y = box.max.y - (box.max.y - box.min.y) * rng() * 0.2;
        }
        // Base initial velocity + small random spread
        p.vel.set(
          fluidSys.initialVelocity.x + (rng() - 0.5) * 0.02,
          fluidSys.initialVelocity.y + (rng() - 0.5) * 0.02,
          fluidSys.initialVelocity.z + (rng() - 0.5) * 0.02
        );
      }
      // Integrate
      for (let i = 0; i < cap; i++) {
        const p = particlesRef.current[i];
        if (!p.alive) continue;
        if (lifetime > 0 && p.age >= p.life) { p.alive = false; deadRef.current.push(i); continue; }
        // Gravity
        p.vel.add(gravity);
        // Damping
        p.vel.multiplyScalar(1 - damping);
        // Move
        p.pos.add(p.vel.clone().multiplyScalar(fluidSys.speed));
        // Collide with bounds (AABB)
        if (p.pos.x < box.min.x) { p.pos.x = box.min.x; p.vel.x *= -bounce; }
        else if (p.pos.x > box.max.x) { p.pos.x = box.max.x; p.vel.x *= -bounce; }
        if (p.pos.y < box.min.y) { p.pos.y = box.min.y; p.vel.y *= -bounce; }
        else if (p.pos.y > box.max.y) { p.pos.y = box.max.y; p.vel.y *= -bounce; }
        if (p.pos.z < box.min.z) { p.pos.z = box.min.z; p.vel.z *= -bounce; }
        else if (p.pos.z > box.max.z) { p.pos.z = box.max.z; p.vel.z *= -bounce; }
        p.age++;
      }
    }
  };

  // Runtime progression
  const accumRef = useRef(0);
  useFrame((_, delta) => {
    if (!fluidSys) return;
    if (!playing) return;
    const frameDt = 1 / fps;
    accumRef.current += delta;
    let steps = 0;
    while (accumRef.current >= frameDt) { accumRef.current -= frameDt; steps++; }
    if (steps > 0) { stepSim(steps); writeInstances(); }
  });

  // Deterministic resim when paused/scrubbing
  useEffect(() => {
    if (!fluidSys) return;
    if (playing) return;
    const frame = Math.round(playhead * fps);
    if (lastSimFrameRef.current === frame) return;
    lastSimFrameRef.current = frame;
    // Reset
    particlesRef.current.forEach(p => { p.alive = false; });
    deadRef.current = Array.from({ length: particlesRef.current.length }, (_, i) => particlesRef.current.length - 1 - i);
    rngRef.current = makeRng(fluidSys.seed);
    stepSim(frame); // brute force to frame
    writeInstances();
    //eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fluidSys, playing, playhead, fps]);

  function writeInstances() {
    const mesh = meshRef.current; if (!mesh) return;
    let count = 0;
    const size = fluidSys?.size ?? 0.05;
    for (let i = 0; i < particlesRef.current.length; i++) {
      const p = particlesRef.current[i]; if (!p.alive) continue;
      tempObj.position.copy(p.pos);
      tempObj.quaternion.copy(tmpQ.setFromEuler(new Euler(0, 0, 0)));
      tempObj.scale.set(size, size, size);
      tempObj.updateMatrix();
      mesh.setMatrixAt(count, tempObj.matrix);
      count++;
      if (count >= particlesRef.current.length) break;
    }
    mesh.count = count;
    if ((mesh as any).instanceMatrix) (mesh as any).instanceMatrix.needsUpdate = true;
  }

  // Helper: draw bounding box when in non-material shading
  const showHelper = shadingMode === 'wireframe' || shadingMode === 'solid';

  // Choose particle material: use the particle object's material when in 'material' shading,
  // otherwise fall back to the simple helper material.
  // Prefer node material when available and shading mode is 'material'. Fallback chain: nodeMat -> material -> helperMat
  const particleMaterial = useMemo<Material>(() => {
    if (shadingMode === 'material' && (nodeMat as Material | null)) return nodeMat as Material;
    if (shadingMode === 'material' && material) return material;
    // Ensure helper uses consistent side
    (helperMat as any).side = DoubleSide;
    return helperMat;
  }, [shadingMode, material, nodeMat]);

  if (!fluidSys) return null;
  return (
    <group>
      <instancedMesh ref={meshRef} args={[geom, particleMaterial, Math.min(particlesRef.current.length || fluidSys.capacity, fluidSys.capacity)]} frustumCulled={false} />
      {showHelper && <BoxHelper volumeBoxRef={volumeBoxRef} />}
    </group>
  );
};

const BoxHelper = ({ volumeBoxRef }: { volumeBoxRef: React.RefObject<THREE.Box3> }) => {
    const [verts, setVerts] = useState<Float32Array>(() => new Float32Array(0));
    useEffect(() => {
      const box = volumeBoxRef.current;
      const v: number[] = [];
      const pts = [
        [box.min.x, box.min.y, box.min.z], [box.max.x, box.min.y, box.min.z],
        [box.max.x, box.min.y, box.min.z], [box.max.x, box.min.y, box.max.z],
        [box.max.x, box.min.y, box.max.z], [box.min.x, box.min.y, box.max.z],
        [box.min.x, box.min.y, box.max.z], [box.min.x, box.min.y, box.min.z],
        [box.min.x, box.max.y, box.min.z], [box.max.x, box.max.y, box.min.z],
        [box.max.x, box.max.y, box.min.z], [box.max.x, box.max.y, box.max.z],
        [box.max.x, box.max.y, box.max.z], [box.min.x, box.max.y, box.max.z],
        [box.min.x, box.max.y, box.max.z], [box.min.x, box.max.y, box.min.z],
        [box.min.x, box.min.y, box.min.z], [box.min.x, box.max.y, box.min.z],
        [box.max.x, box.min.y, box.min.z], [box.max.x, box.max.y, box.min.z],
        [box.max.x, box.min.y, box.max.z], [box.max.x, box.max.y, box.max.z],
        [box.min.x, box.min.y, box.max.z], [box.min.x, box.max.y, box.max.z],
      ];
      pts.forEach(p => v.push(p[0], p[1], p[2]));
      setVerts(new Float32Array(v));
    }, [volumeBoxRef]);

    return (
      <line>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[verts, 3]} count={verts.length / 3} array={verts} itemSize={3} />
        </bufferGeometry>
        <lineBasicMaterial color="#3399ff" linewidth={1} />
      </line>
    );
  };

export default FluidSystemNode;

'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { InstancedMesh, Object3D, Matrix4, Quaternion, Vector3 as T3V, Euler, Material, BufferGeometry } from 'three/webgpu';
import { useFrame } from '@react-three/fiber';
import { useSceneStore } from '@/stores/scene-store';
import { useParticlesStore } from '@/stores/particles-store';
import { useAnimationStore } from '@/stores/animation-store';
import { getObject3D } from '@/features/viewport/hooks/object3d-registry';

type Particle = {
  alive: boolean;
  t: number; // age in frames
  lifetime: number; // frames
  position: T3V;
  velocity: T3V; // per frame
  rotation: Euler;
  angularVelocity: T3V; // radians per frame
  scale: number;
};

function makeParticle(lifetime: number): Particle {
  return {
    alive: false,
    t: 0,
    lifetime,
    position: new T3V(),
    velocity: new T3V(),
    rotation: new Euler(),
    angularVelocity: new T3V(),
    scale: 1,
  };
}

// Simple seeded RNG (Mulberry32)
function makeRng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function randUnitSphere(rng: () => number): T3V {
  // Uniform on sphere surface
  const u = rng();
  const v = rng();
  const z = 2 * u - 1; // [-1,1]
  const theta = 2 * Math.PI * v;
  const r = Math.sqrt(Math.max(0, 1 - z * z));
  return new T3V(r * Math.cos(theta), r * Math.sin(theta), z);
}

function randDisk2D(rng: () => number, radius: number): [number, number] {
  const u = rng();
  const v = rng();
  const r = Math.sqrt(u) * radius; // uniform disk
  const theta = 2 * Math.PI * v;
  return [r * Math.cos(theta), r * Math.sin(theta)];
}

// Surface sampler cache per geometry
const surfCache = new WeakMap<BufferGeometry, { cum: Float32Array; hasIndex: boolean }>();

function buildSurfaceCdf(geom: BufferGeometry) {
  const posAttr: any = (geom as any).attributes?.position;
  if (!posAttr) return null;
  const index: any = (geom as any).index;
  const hasIndex = !!index;
  const idx = hasIndex ? (index.array as Uint32Array | Uint16Array) : null;
  const positions = posAttr.array as Float32Array;
  const triCount = hasIndex ? (idx!.length / 3) : (positions.length / 9);
  const cum = new Float32Array(triCount);
  let acc = 0;
  const a = new T3V(), b = new T3V(), c = new T3V();
  for (let i = 0; i < triCount; i++) {
    if (hasIndex) {
      const i0 = idx![i * 3 + 0];
      const i1 = idx![i * 3 + 1];
      const i2 = idx![i * 3 + 2];
      a.set(positions[i0 * 3 + 0], positions[i0 * 3 + 1], positions[i0 * 3 + 2]);
      b.set(positions[i1 * 3 + 0], positions[i1 * 3 + 1], positions[i1 * 3 + 2]);
      c.set(positions[i2 * 3 + 0], positions[i2 * 3 + 1], positions[i2 * 3 + 2]);
    } else {
      a.set(positions[i * 9 + 0], positions[i * 9 + 1], positions[i * 9 + 2]);
      b.set(positions[i * 9 + 3], positions[i * 9 + 4], positions[i * 9 + 5]);
      c.set(positions[i * 9 + 6], positions[i * 9 + 7], positions[i * 9 + 8]);
    }
    const area = b.clone().sub(a).cross(c.clone().sub(a)).length() * 0.5;
    acc += Math.max(1e-8, area);
    cum[i] = acc;
  }
  return { cum, hasIndex } as const;
}

function sampleSurfacePosition(emitter3D: any, rng: () => number): T3V | null {
  let mesh: any = null;
  emitter3D?.traverse?.((child: any) => { if (!mesh && child.isMesh && child.geometry && (child.geometry as any).attributes?.position) mesh = child; });
  if (!mesh) return null;
  const geom = mesh.geometry as BufferGeometry;
  let entry = surfCache.get(geom);
  if (!entry) {
    const built = buildSurfaceCdf(geom);
    if (!built) return null;
    entry = built as any;
    surfCache.set(geom, entry as any);
  }
  if (!entry) return null;
  const cum = entry.cum; const hasIndex = entry.hasIndex;
  const posAttr: any = (geom as any).attributes.position; const positions = posAttr.array as Float32Array;
  const index: any = (geom as any).index; const idx = hasIndex ? (index.array as Uint32Array | Uint16Array) : null;
  const total = cum[cum.length - 1];
  let r = rng() * total;
  // binary search
  let lo = 0, hi = cum.length - 1, mid = 0;
  while (lo < hi) { mid = (lo + hi) >>> 1; if (r <= cum[mid]) hi = mid; else lo = mid + 1; }
  const i = lo;
  const a = new T3V(), b = new T3V(), c = new T3V();
  if (hasIndex) {
    const i0 = idx![i * 3 + 0];
    const i1 = idx![i * 3 + 1];
    const i2 = idx![i * 3 + 2];
    a.set(positions[i0 * 3 + 0], positions[i0 * 3 + 1], positions[i0 * 3 + 2]);
    b.set(positions[i1 * 3 + 0], positions[i1 * 3 + 1], positions[i1 * 3 + 2]);
    c.set(positions[i2 * 3 + 0], positions[i2 * 3 + 1], positions[i2 * 3 + 2]);
  } else {
    a.set(positions[i * 9 + 0], positions[i * 9 + 1], positions[i * 9 + 2]);
    b.set(positions[i * 9 + 3], positions[i * 9 + 4], positions[i * 9 + 5]);
    c.set(positions[i * 9 + 6], positions[i * 9 + 7], positions[i * 9 + 8]);
  }
  // barycentric sample
  const u1 = rng();
  const u2 = rng();
  const su1 = Math.sqrt(u1);
  const w0 = 1 - su1;
  const w1 = su1 * (1 - u2);
  const w2 = su1 * u2;
  const p = new T3V().addScaledVector(a, w0).addScaledVector(b, w1).addScaledVector(c, w2);
  return p.applyMatrix4(mesh.matrixWorld);
}

// Build a simple geometry+material cache from a source mesh object id
function useSourceGeometry(objectId: string | null | undefined): { geom: BufferGeometry | null; material: Material | null } {
  const ref = useRef<{ geom: BufferGeometry | null; mat: Material | null; srcMesh: any | null; matVersion: number }>(
    { geom: null, mat: null, srcMesh: null, matVersion: -1 }
  );
  const [, setTick] = useState(0);

  useEffect(() => {
    // Initial capture of source mesh, geometry, and material
    ref.current = { geom: null, mat: null, srcMesh: null, matVersion: -1 };
    if (!objectId) return;
    const obj3d = getObject3D(objectId);
    if (!obj3d) return;
    let found: any = null;
    obj3d.traverse((child: any) => { if (!found && child.isMesh && child.geometry) found = child; });
    if (found) {
      const geom = found.geometry as BufferGeometry;
      const mAny = found.material as any;
      const mat: Material | null = Array.isArray(mAny) ? (mAny[0] as Material) ?? null : (mAny && mAny.isMaterial ? (mAny as Material) : null);
      ref.current = { geom, mat, srcMesh: found, matVersion: (mat as any)?.version ?? -1 };
      // Trigger a render to apply initial values
      setTick((t) => t + 1);
    }
  }, [objectId]);

  // Poll for changes in material/geometry pointer or material version to reflect updates
  useFrame(() => {
    const src = ref.current.srcMesh;
    if (!src) return;
    const g = src.geometry as BufferGeometry | null;
    const mAny = src.material as any;
    const m: Material | null = Array.isArray(mAny) ? (mAny[0] as Material) ?? null : (mAny && mAny.isMaterial ? (mAny as Material) : null);
    const matVersion = (m as any)?.version ?? -1;
    const changed = (g !== ref.current.geom) || (m !== ref.current.mat) || (matVersion !== ref.current.matVersion);
    if (changed) {
      ref.current.geom = g;
      ref.current.mat = m;
      ref.current.matVersion = matVersion;
      setTick((t) => t + 1);
    }
  });

  return { geom: ref.current.geom, material: ref.current.mat };
}

export const ParticleSystemNode: React.FC<{ objectId: string; systemId: string }>
  = ({ objectId, systemId }) => {
    const scene = useSceneStore();
  const { systems } = useParticlesStore();
  const sys = systems[systemId];
  const playing = useAnimationStore((s) => s.playing);
  const fps = useAnimationStore((s) => s.fps);
  const playhead = useAnimationStore((s) => s.playhead);

  // Source geom/material from selected particle object (the thing each particle instances)
    const { geom, material } = useSourceGeometry(sys?.particleObjectId || null);
    // Clamp capacity to a conservative range to avoid WebGPU uniform/storage buffer limits
    const capacity = Math.max(1, Math.min(sys?.capacity ?? 512, 2048));
  const particlesRef = useRef<Particle[]>(Array.from({ length: capacity }, () => makeParticle(sys?.particleLifetime ?? 60)));
    const tempObj = useMemo(() => new Object3D(), []);
    const mat4 = useMemo(() => new Matrix4(), []);
    const quat = useMemo(() => new Quaternion(), []);
    const v3 = useMemo(() => new T3V(), []);

    // Reset particle pool when system changes
    const rngRef = useRef<() => number>(() => Math.random());
    useEffect(() => {
      // Rebuild pool when system, capacity, or lifetime changes
      particlesRef.current = Array.from({ length: capacity }, () => makeParticle(sys?.particleLifetime ?? 60));
      rngRef.current = makeRng(sys?.seed ?? 1);
      // Also clear any instance matrices on reset
      const mesh = meshRef.current;
      if (mesh) {
        mesh.count = 0;
        if ((mesh as any).instanceMatrix) (mesh as any).instanceMatrix.needsUpdate = true;
      }
    }, [systemId, capacity, sys?.particleLifetime, sys?.seed]);

    // Accumulator to step in whole frames at animation fps
  const accumRef = useRef(0);
  const emitAccumRef = useRef(0); // fractional emission accumulator
    // Emit and simulate in lockstep with animation fps while playing
    useFrame((_, delta) => {
      if (!sys) return;
      if (!playing) return;
      const stepFps = Math.max(1, fps || 24);
      accumRef.current += delta * stepFps;
      let steps = Math.floor(accumRef.current);
      if (steps <= 0) return;
      accumRef.current -= steps;
      const emitterObj = sys.emitterObjectId ? scene.objects[sys.emitterObjectId] : scene.objects[objectId];
      const emitter3D = emitterObj ? getObject3D(emitterObj.id) : null;
      const emitterPos = emitter3D ? emitter3D.getWorldPosition(new T3V()) : new T3V();
      const emitterQuat = emitter3D ? emitter3D.getWorldQuaternion(new Quaternion()) : new Quaternion();

      const gravity = new T3V(sys.gravity.x, sys.gravity.y, sys.gravity.z);
      const wind = new T3V(sys.wind.x, sys.wind.y, sys.wind.z);
      while (steps-- > 0) {
        // Emit N new particles per frame
        emitAccumRef.current += Math.max(0, sys.emissionRate);
        const toEmit = Math.max(0, Math.floor(emitAccumRef.current));
        emitAccumRef.current -= toEmit;
        const rng = rngRef.current;
        for (let n = 0; n < toEmit; n++) {
          const p = particlesRef.current.find((pp) => !pp.alive);
          if (!p) break;
          p.alive = true;
          p.t = 0;
          p.lifetime = Math.max(1, Math.floor(sys.particleLifetime));
          // Spawn position
          let spawnPos: T3V | null = null;
          if (sys.spawnMode === 'surface') spawnPos = sampleSurfacePosition(emitter3D, rng);
          if (!spawnPos) {
            // point with optional local XY jitter
            const [dx, dy] = sys.positionJitter > 0 ? randDisk2D(rng, sys.positionJitter) : [0, 0];
            const bx = new T3V(1, 0, 0).applyQuaternion(emitterQuat);
            const by = new T3V(0, 1, 0).applyQuaternion(emitterQuat);
            spawnPos = emitterPos.clone().addScaledVector(bx, dx).addScaledVector(by, dy);
          }
          p.position.copy(spawnPos);
          // Initial velocity in chosen space plus jitter
          const base = new T3V(sys.velocity.x, sys.velocity.y, sys.velocity.z);
          if (sys.velocityLocal) base.applyQuaternion(emitterQuat);
          const jit = sys.velocityJitter > 0 ? randUnitSphere(rng).multiplyScalar(sys.velocityJitter) : new T3V();
          p.velocity.copy(base.add(jit));
          // Scale random between min/max
          const s = sys.minScale + (rng() as number) * Math.max(0, sys.maxScale - sys.minScale);
          p.scale = s;
          // Angular state
          p.rotation.set(0, 0, 0);
          p.angularVelocity.set(sys.angularVelocity.x, sys.angularVelocity.y, sys.angularVelocity.z);
        }
        // Integrate alive particles by one frame step
        for (const p of particlesRef.current) {
          if (!p.alive) continue;
          if (p.t >= p.lifetime) { p.alive = false; continue; }
          // v += (gravity + wind)
          p.velocity.add(gravity).add(wind);
          // x += v
          p.position.add(p.velocity);
          // rotation
          p.rotation.x += p.angularVelocity.x;
          p.rotation.y += p.angularVelocity.y;
          p.rotation.z += p.angularVelocity.z;
          p.t += 1;
        }
      }
      // After stepping, update instance matrices
      const mesh = meshRef.current;
      if (!mesh) return;
      let i = 0;
      const obj = tempObj;
  for (const p of particlesRef.current) {
        if (!p.alive) continue;
        obj.position.copy(p.position);
        obj.rotation.copy(p.rotation);
        obj.scale.setScalar(p.scale);
        obj.updateMatrix();
        mesh.setMatrixAt(i++, obj.matrix);
      }
      mesh.count = i;
      if ((mesh as any).instanceMatrix) (mesh as any).instanceMatrix.needsUpdate = true;
    });

    // Re-simulate deterministically when scrubbing/paused to match playhead time
    const lastSimFrameRef = useRef<number | null>(null);
    useEffect(() => {
      if (!sys) return;
      if (playing) return; // runtime loop handles updates
      const stepFps = Math.max(1, fps || 24);
      const frame = Math.max(0, Math.round(playhead * stepFps));
      if (lastSimFrameRef.current === frame) return;
      lastSimFrameRef.current = frame;
      // Reset pool
      particlesRef.current.forEach((p) => { p.alive = false; p.t = 0; p.lifetime = Math.max(1, Math.floor(sys.particleLifetime)); });
      emitAccumRef.current = 0;
      // Get current emitter pose (use present world transform; not historical to keep it light)
      const emitterObj = sys.emitterObjectId ? scene.objects[sys.emitterObjectId] : scene.objects[objectId];
      const emitter3D = emitterObj ? getObject3D(emitterObj.id) : null;
      const emitterPos = emitter3D ? emitter3D.getWorldPosition(new T3V()) : new T3V();
      const emitterQuat = emitter3D ? emitter3D.getWorldQuaternion(new Quaternion()) : new Quaternion();
      const gravity = new T3V(sys.gravity.x, sys.gravity.y, sys.gravity.z);
      const wind = new T3V(sys.wind.x, sys.wind.y, sys.wind.z);
      const rng = makeRng(sys.seed ?? 1);
      // Simulate from frame 0 -> frame (inclusive-exclusive)
      for (let f = 0; f < frame; f++) {
        emitAccumRef.current += Math.max(0, sys.emissionRate);
        const toEmit = Math.max(0, Math.floor(emitAccumRef.current));
        emitAccumRef.current -= toEmit;
        for (let n = 0; n < toEmit; n++) {
          const p = particlesRef.current.find((pp) => !pp.alive);
          if (!p) break;
          p.alive = true;
          p.t = 0;
          p.lifetime = Math.max(1, Math.floor(sys.particleLifetime));
          let spawnPos: T3V | null = null;
          if (sys.spawnMode === 'surface') spawnPos = sampleSurfacePosition(emitter3D, rng);
          if (!spawnPos) {
            const [dx, dy] = sys.positionJitter > 0 ? randDisk2D(rng, sys.positionJitter) : [0, 0];
            const bx = new T3V(1, 0, 0).applyQuaternion(emitterQuat);
            const by = new T3V(0, 1, 0).applyQuaternion(emitterQuat);
            spawnPos = emitterPos.clone().addScaledVector(bx, dx).addScaledVector(by, dy);
          }
          p.position.copy(spawnPos);
          const base = new T3V(sys.velocity.x, sys.velocity.y, sys.velocity.z);
          if (sys.velocityLocal) base.applyQuaternion(emitterQuat);
          const jit = sys.velocityJitter > 0 ? randUnitSphere(rng).multiplyScalar(sys.velocityJitter) : new T3V();
          p.velocity.copy(base.add(jit));
          const s = sys.minScale + (rng() as number) * Math.max(0, sys.maxScale - sys.minScale);
          p.scale = s;
          p.rotation.set(0, 0, 0);
          p.angularVelocity.set(sys.angularVelocity.x, sys.angularVelocity.y, sys.angularVelocity.z);
        }
        // Integrate alive particles by one frame step
        for (const p of particlesRef.current) {
          if (!p.alive) continue;
          if (p.t >= p.lifetime) { p.alive = false; continue; }
          p.velocity.add(gravity).add(wind);
          p.position.add(p.velocity);
          p.rotation.x += p.angularVelocity.x;
          p.rotation.y += p.angularVelocity.y;
          p.rotation.z += p.angularVelocity.z;
          p.t += 1;
        }
      }
      // Write instance matrices now
      const mesh = meshRef.current;
      if (!mesh) return;
      let i = 0;
      const obj = tempObj;
  for (const p of particlesRef.current) {
        if (!p.alive) continue;
        obj.position.copy(p.position);
        obj.rotation.copy(p.rotation);
        obj.scale.setScalar(p.scale);
        obj.updateMatrix();
        mesh.setMatrixAt(i++, obj.matrix);
      }
      mesh.count = i;
      if ((mesh as any).instanceMatrix) (mesh as any).instanceMatrix.needsUpdate = true;
    }, [playing, playhead, fps, sys, scene.objects, objectId]);

    // Render instanced mesh
  const meshRef = useRef<InstancedMesh>(null!);

    // Propagate live material/geometry pointer changes to the instanced mesh without remounting
    useEffect(() => {
      const mesh = meshRef.current;
      if (!mesh) return;
      if (material && (mesh.material as any) !== material) {
        (mesh as any).material = material as any;
  (material as any).needsUpdate = true;
      }
      if (geom && mesh.geometry !== geom) {
        mesh.geometry = geom;
        if ((mesh as any).instanceMatrix) (mesh as any).instanceMatrix.needsUpdate = true;
      }
    }, [geom, material]);

    if (!geom || !material) return null;
    return (
      // InstancedMesh signature in R3F: <instancedMesh args={[geometry, material, count]} />
      // Key the mesh by capacity to force a safe reallocation when capacity changes
      <instancedMesh key={`psys-${systemId}-${capacity}`} ref={meshRef} args={[geom, material, capacity]} frustumCulled={false} />
    );
  };

export default ParticleSystemNode;

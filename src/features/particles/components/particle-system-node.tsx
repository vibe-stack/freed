'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { InstancedMesh, Object3D, Matrix4, Quaternion, Vector3 as T3V, Euler, Material, BufferGeometry } from 'three/webgpu';
import { useFrame } from '@react-three/fiber';
import { useSceneStore } from '@/stores/scene-store';
import { useParticlesStore } from '@/stores/particles-store';
import { useAnimationStore } from '@/stores/animation-store';
import { getObject3D } from '@/features/viewport/hooks/object3d-registry';
import { useForceFieldStore } from '@/stores/force-field-store';

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
  const r = rng() * total;
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
    const forceFields = useForceFieldStore((s) => s.fields);

    // Source geom/material from selected particle object (the thing each particle instances)
    const { geom, material } = useSourceGeometry(sys?.particleObjectId || null);
    // Chunked instancing to avoid WebGPU 64KB UBO limits
    const CHUNK_SIZE = 1024; // 64KB / 64B per instance
    const totalCapacity = Math.max(1, Math.min(sys?.capacity ?? 1024, 200_000));
    const chunkCount = Math.max(1, Math.ceil(totalCapacity / CHUNK_SIZE));
    const particlesRef = useRef<Particle[]>(Array.from({ length: totalCapacity }, () => makeParticle(sys?.particleLifetime ?? 60)));
    const deadStackRef = useRef<number[]>(Array.from({ length: totalCapacity }, (_, i) => totalCapacity - 1 - i)); // LIFO of dead indices
    const tempObj = useMemo(() => new Object3D(), []);
    const tmpV1 = useMemo(() => new T3V(), []);
    const tmpV2 = useMemo(() => new T3V(), []);
    const tmpQ = useMemo(() => new Quaternion(), []);

    function writeTRSMatrix(arr: Float32Array, offset16: number, pos: T3V, rotEuler: Euler, scale: number) {
      // q = quat(rotEuler)
      tmpQ.setFromEuler(rotEuler);
      const x = tmpQ.x, y = tmpQ.y, z = tmpQ.z, w = tmpQ.w;
      const x2 = x + x, y2 = y + y, z2 = z + z;
      const xx = x * x2, xy = x * y2, xz = x * z2;
      const yy = y * y2, yz = y * z2, zz = z * z2;
      const wx = w * x2, wy = w * y2, wz = w * z2;
      // Rotation matrix, then scale
      const sx = scale, sy = scale, sz = scale;
      const m00 = (1 - (yy + zz)) * sx;
      const m01 = (xy - wz) * sy;
      const m02 = (xz + wy) * sz;
      const m10 = (xy + wz) * sx;
      const m11 = (1 - (xx + zz)) * sy;
      const m12 = (yz - wx) * sz;
      const m20 = (xz - wy) * sx;
      const m21 = (yz + wx) * sy;
      const m22 = (1 - (xx + yy)) * sz;
      // Write column-major 4x4
      arr[offset16 + 0] = m00; arr[offset16 + 4] = m01; arr[offset16 + 8] = m02; arr[offset16 + 12] = pos.x;
      arr[offset16 + 1] = m10; arr[offset16 + 5] = m11; arr[offset16 + 9] = m12; arr[offset16 + 13] = pos.y;
      arr[offset16 + 2] = m20; arr[offset16 + 6] = m21; arr[offset16 + 10] = m22; arr[offset16 + 14] = pos.z;
      arr[offset16 + 3] = 0; arr[offset16 + 7] = 0; arr[offset16 + 11] = 0; arr[offset16 + 15] = 1;
    }

    // Cache a mapping from forceFieldId -> Object3D to avoid repeated Object.values(...).find per particle
    const forceFieldObjMap = useMemo(() => {
      const map = new Map<string, any>();
      // scene.objects is a dictionary; scan once when it changes
      for (const oid in scene.objects) {
        const o: any = (scene.objects as any)[oid];
        const fid = o?.forceFieldId as string | undefined;
        if (!fid) continue;
        const obj3d = getObject3D(o.id);
        if (obj3d) map.set(fid, obj3d);
      }
      return map;
    }, [scene.objects]);

    // Reset particle pool when system changes
    const rngRef = useRef<() => number>(() => Math.random());
    useEffect(() => {
      // Rebuild pool when system, capacity, or lifetime/seed changes
      particlesRef.current = Array.from({ length: totalCapacity }, () => makeParticle(sys?.particleLifetime ?? 60));
      deadStackRef.current = Array.from({ length: totalCapacity }, (_, i) => totalCapacity - 1 - i);
      // Reset accumulators to avoid weird transients after capacity changes
      accumRef.current = 0;
      emitAccumRef.current = 0;
      rngRef.current = makeRng(sys?.seed ?? 1);
      // Also clear any instance matrices on reset
      for (const mesh of meshRefs.current) {
        if (mesh) {
          mesh.count = 0;
          if ((mesh as any).instanceMatrix) (mesh as any).instanceMatrix.needsUpdate = true;
        }
      }
    }, [systemId, totalCapacity, sys?.particleLifetime, sys?.seed]);

    // Handle capacity changes by updating each mesh chunk
    useEffect(() => {
      for (let ci = 0; ci < meshRefs.current.length; ci++) {
        const mesh = meshRefs.current[ci];
        if (!mesh) continue;
        const cap = Math.min(CHUNK_SIZE, totalCapacity - ci * CHUNK_SIZE);
        (mesh as any).maxInstancedCount = cap;
        if (mesh.count > cap) mesh.count = cap;
        if ((mesh as any).instanceMatrix) (mesh as any).instanceMatrix.needsUpdate = true;
      }
    }, [totalCapacity]);

    // Accumulator to step in whole frames at animation fps
    const accumRef = useRef(0);
    const emitAccumRef = useRef(0); // fractional emission accumulator
    // Emit and simulate in lockstep with animation fps while playing
    useFrame((_, delta) => {
      if (!sys) return;
      if (!playing) return;
      const stepFps = Math.max(1, fps || 30);
      accumRef.current += delta * stepFps;
      let steps = Math.floor(accumRef.current);
      if (steps <= 0) return;
      accumRef.current -= steps;
      const emitterObj = sys.emitterObjectId ? scene.objects[sys.emitterObjectId] : scene.objects[objectId];
      const emitter3D = emitterObj ? getObject3D(emitterObj.id) : null;
      const emitterPos = emitter3D ? emitter3D.getWorldPosition(new T3V()) : new T3V();
      const emitterQuat = emitter3D ? emitter3D.getWorldQuaternion(new Quaternion()) : new Quaternion();
      // Precompute emitter local basis axes in world space for position jitter
      const basisX = new T3V(1, 0, 0).applyQuaternion(emitterQuat);
      const basisY = new T3V(0, 1, 0).applyQuaternion(emitterQuat);

      // Snapshot active force fields' world data once per step batch
      const activeFields: Array<{
        id: string;
        type: string;
        strength: number;
        radius: number;
        pos: T3V;
        zAxis: T3V | null; // for vortex
      }> = [];
      try {
        for (const fid in forceFields) {
          const f: any = (forceFields as any)[fid];
          if (!f?.enabled) continue;
          const f3d = forceFieldObjMap.get(f.id);
          if (!f3d) continue;
          const pos = f3d.getWorldPosition(new T3V());
          let zAxis: T3V | null = null;
          if (f.type === 'vortex') {
            const fquat = f3d.getWorldQuaternion(new Quaternion());
            zAxis = new T3V(0, 0, 1).applyQuaternion(fquat).normalize();
          }
          activeFields.push({ id: f.id, type: f.type, strength: f.strength, radius: f.radius, pos, zAxis });
        }
      } catch { /* noop */ }

      const gravity = new T3V(sys.gravity.x, sys.gravity.y, sys.gravity.z);
      const wind = new T3V(sys.wind.x, sys.wind.y, sys.wind.z);
      while (steps-- > 0) {
        // Emit N new particles per frame
        emitAccumRef.current += Math.max(0, sys.emissionRate);
        // Respect available free slots so we don't thrash searching for dead entries
        let toEmit = Math.max(0, Math.floor(emitAccumRef.current));
        if (toEmit > 0) toEmit = Math.min(toEmit, deadStackRef.current.length);
        emitAccumRef.current -= toEmit;
        const rng = rngRef.current;
        for (let n = 0; n < toEmit; n++) {
          const idx = deadStackRef.current.pop();
          if (idx === undefined) break;
          const p = particlesRef.current[idx];
          p.alive = true;
          p.t = 0;
          p.lifetime = Math.max(1, Math.floor(sys.particleLifetime));
          // Spawn position
          let spawnPos: T3V | null = null;
          if (sys.spawnMode === 'surface') spawnPos = sampleSurfacePosition(emitter3D, rng);
          if (!spawnPos) {
            // point with optional local XY jitter
            const [dx, dy] = sys.positionJitter > 0 ? randDisk2D(rng, sys.positionJitter) : [0, 0];
            spawnPos = emitterPos.clone().addScaledVector(basisX, dx).addScaledVector(basisY, dy);
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
        for (let pi = 0; pi < particlesRef.current.length; pi++) {
          const p = particlesRef.current[pi];
          if (!p.alive) continue;
          if (p.t >= p.lifetime) { p.alive = false; deadStackRef.current.push(pi); continue; }
          // v += (gravity + wind)
          p.velocity.add(gravity).add(wind);
          // Apply force fields
          if (activeFields.length > 0) {
            for (let i = 0; i < activeFields.length; i++) {
              const f = activeFields[i];
              const toP = tmpV1.copy(p.position).sub(f.pos);
              const dist = toP.length();
              if (dist > f.radius || dist < 1e-4) continue;
              const dir = toP.normalize();
              const k = Math.max(0, 1 - dist / Math.max(1e-4, f.radius));
              if (f.type === 'attractor' || f.type === 'repulsor') {
                // Gravity-like inverse-square falloff with softening and radius cutoff
                const R = Math.max(1e-4, f.radius);
                const soft = 0.05 * R; // softening length to avoid singularity
                const inv = 1.0 / Math.max(1e-8, (dist * dist + soft * soft));
                const sign = f.type === 'attractor' ? -1 : 1; // -dir pulls toward center
                const accel = sign * f.strength * inv;
                p.velocity.addScaledVector(dir, accel);
              } else if (f.type === 'vortex' && f.zAxis) {
                // Project radial direction onto plane orthogonal to zAxis to get tangential direction
                const radialOnPlane = tmpV2.copy(dir).sub(tmpV1.copy(f.zAxis).multiplyScalar(dir.dot(f.zAxis)));
                if (radialOnPlane.lengthSq() > 1e-8) {
                  const tangential = tmpV1.copy(f.zAxis).cross(radialOnPlane).normalize();
                  p.velocity.add(tangential.multiplyScalar(f.strength * k));
                }
              }
            }
          }
          // x += v
          p.position.add(p.velocity);
          // rotation
          p.rotation.x += p.angularVelocity.x;
          p.rotation.y += p.angularVelocity.y;
          p.rotation.z += p.angularVelocity.z;
          p.t += 1;
        }
      }
      // After stepping, update instance matrices across chunks
      if (meshRefs.current.length === 0) return;
      // Reset chunk counts
      for (let ci = 0; ci < meshRefs.current.length; ci++) {
        const m = meshRefs.current[ci];
        if (m) m.count = 0;
      }
      let writeIndex = 0;
      for (let pi = 0; pi < particlesRef.current.length; pi++) {
        const p = particlesRef.current[pi];
        if (!p.alive) continue;
        const ci = Math.floor(writeIndex / CHUNK_SIZE);
        const li = writeIndex % CHUNK_SIZE;
        const mesh = meshRefs.current[ci];
        if (!mesh) break;
        const attr: any = (mesh as any).instanceMatrix;
        const array = attr?.array as Float32Array | undefined;
        if (array) {
          writeTRSMatrix(array, li * 16, p.position, p.rotation, p.scale);
          if (attr.updateRange) {
            attr.updateRange.offset = 0;
            attr.updateRange.count = Math.min((li + 1) * 16, array.length);
          }
          attr.needsUpdate = true;
        } else {
          tempObj.position.copy(p.position);
          tempObj.rotation.copy(p.rotation);
          tempObj.scale.setScalar(p.scale);
          tempObj.updateMatrix();
          mesh.setMatrixAt(li, tempObj.matrix);
          if ((mesh as any).instanceMatrix) (mesh as any).instanceMatrix.needsUpdate = true;
        }
        mesh.count = li + 1;
        writeIndex++;
        if (writeIndex >= totalCapacity) break;
      }
    });

    // Re-simulate deterministically when scrubbing/paused to match playhead time
    const lastSimFrameRef = useRef<number | null>(null);
    useEffect(() => {
      if (!sys) return;
      if (playing) return; // runtime loop handles updates
      const stepFps = Math.max(1, fps || 30);
      const frame = Math.max(0, Math.round(playhead * stepFps));
      if (lastSimFrameRef.current === frame) return;
      lastSimFrameRef.current = frame;
      // Reset pool
      particlesRef.current.forEach((p) => { p.alive = false; p.t = 0; p.lifetime = Math.max(1, Math.floor(sys.particleLifetime)); });
      deadStackRef.current = Array.from({ length: totalCapacity }, (_, i) => totalCapacity - 1 - i);
      emitAccumRef.current = 0;
      // Get current emitter pose (use present world transform; not historical to keep it light)
      const emitterObj = sys.emitterObjectId ? scene.objects[sys.emitterObjectId] : scene.objects[objectId];
      const emitter3D = emitterObj ? getObject3D(emitterObj.id) : null;
      const emitterPos = emitter3D ? emitter3D.getWorldPosition(new T3V()) : new T3V();
      const emitterQuat = emitter3D ? emitter3D.getWorldQuaternion(new Quaternion()) : new Quaternion();
      const basisX = new T3V(1, 0, 0).applyQuaternion(emitterQuat);
      const basisY = new T3V(0, 1, 0).applyQuaternion(emitterQuat);
      const gravity = new T3V(sys.gravity.x, sys.gravity.y, sys.gravity.z);
      const wind = new T3V(sys.wind.x, sys.wind.y, sys.wind.z);
      const rng = makeRng(sys.seed ?? 1);

      // Snapshot active fields once for this resim
      const activeFields: Array<{
        id: string;
        type: string;
        strength: number;
        radius: number;
        pos: T3V;
        zAxis: T3V | null;
      }> = [];
      try {
        for (const fid in useForceFieldStore.getState().fields) {
          const f: any = (useForceFieldStore.getState().fields as any)[fid];
          if (!f?.enabled) continue;
          const f3d = forceFieldObjMap.get(f.id);
          if (!f3d) continue;
          const pos = f3d.getWorldPosition(new T3V());
          let zAxis: T3V | null = null;
          if (f.type === 'vortex') {
            const fquat = f3d.getWorldQuaternion(new Quaternion());
            zAxis = new T3V(0, 0, 1).applyQuaternion(fquat).normalize();
          }
          activeFields.push({ id: f.id, type: f.type, strength: f.strength, radius: f.radius, pos, zAxis });
        }
      } catch { /* noop */ }
      // Simulate from frame 0 -> frame (inclusive-exclusive)
      for (let f = 0; f < frame; f++) {
        emitAccumRef.current += Math.max(0, sys.emissionRate);
        let toEmit = Math.max(0, Math.floor(emitAccumRef.current));
        if (toEmit > 0) toEmit = Math.min(toEmit, deadStackRef.current.length);
        emitAccumRef.current -= toEmit;
        for (let n = 0; n < toEmit; n++) {
          const idx = deadStackRef.current.pop();
          if (idx === undefined) break;
          const p = particlesRef.current[idx];
          p.alive = true;
          p.t = 0;
          p.lifetime = Math.max(1, Math.floor(sys.particleLifetime));
          let spawnPos: T3V | null = null;
          if (sys.spawnMode === 'surface') spawnPos = sampleSurfacePosition(emitter3D, rng);
          if (!spawnPos) {
            const [dx, dy] = sys.positionJitter > 0 ? randDisk2D(rng, sys.positionJitter) : [0, 0];
            spawnPos = emitterPos.clone().addScaledVector(basisX, dx).addScaledVector(basisY, dy);
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
        for (let pi = 0; pi < particlesRef.current.length; pi++) {
          const p = particlesRef.current[pi];
          if (!p.alive) continue;
          if (p.t >= p.lifetime) { p.alive = false; deadStackRef.current.push(pi); continue; }
          p.velocity.add(gravity).add(wind);
          if (activeFields.length > 0) {
            for (let i = 0; i < activeFields.length; i++) {
              const f = activeFields[i];
              const toP = tmpV1.copy(p.position).sub(f.pos);
              const dist = toP.length();
              if (dist > f.radius || dist < 1e-4) continue;
              const dir = toP.normalize();
              const k = Math.max(0, 1 - dist / Math.max(1e-4, f.radius));
              if (f.type === 'attractor' || f.type === 'repulsor') {
                // Gravity-like inverse-square falloff with softening and radius cutoff
                const R = Math.max(1e-4, f.radius);
                const soft = 0.05 * R;
                const inv = 1.0 / Math.max(1e-8, (dist * dist + soft * soft));
                const sign = f.type === 'attractor' ? -1 : 1;
                const accel = sign * f.strength * inv;
                p.velocity.addScaledVector(dir, accel);
              } else if (f.type === 'vortex' && f.zAxis) {
                const radialOnPlane = tmpV2.copy(dir).sub(tmpV1.copy(f.zAxis).multiplyScalar(dir.dot(f.zAxis)));
                if (radialOnPlane.lengthSq() > 1e-8) {
                  const tangential = tmpV1.copy(f.zAxis).cross(radialOnPlane).normalize();
                  p.velocity.add(tangential.multiplyScalar(f.strength * k));
                }
              }
            }
          }
          p.position.add(p.velocity);
          p.rotation.x += p.angularVelocity.x;
          p.rotation.y += p.angularVelocity.y;
          p.rotation.z += p.angularVelocity.z;
          p.t += 1;
        }
      }
      // Write instance matrices now across chunks
      if (meshRefs.current.length === 0) return;
      for (let ci = 0; ci < meshRefs.current.length; ci++) {
        const m = meshRefs.current[ci];
        if (m) m.count = 0;
      }
      let writeIndex = 0;
      for (let pi = 0; pi < particlesRef.current.length; pi++) {
        const p = particlesRef.current[pi];
        if (!p.alive) continue;
        const ci = Math.floor(writeIndex / CHUNK_SIZE);
        const li = writeIndex % CHUNK_SIZE;
        const mesh = meshRefs.current[ci];
        if (!mesh) break;
        const attr: any = (mesh as any).instanceMatrix;
        const array = attr?.array as Float32Array | undefined;
        if (array) {
          writeTRSMatrix(array, li * 16, p.position, p.rotation, p.scale);
          if (attr.updateRange) {
            attr.updateRange.offset = 0;
            attr.updateRange.count = Math.min((li + 1) * 16, array.length);
          }
          attr.needsUpdate = true;
        } else {
          tempObj.position.copy(p.position);
          tempObj.rotation.copy(p.rotation);
          tempObj.scale.setScalar(p.scale);
          tempObj.updateMatrix();
          mesh.setMatrixAt(li, tempObj.matrix);
          if ((mesh as any).instanceMatrix) (mesh as any).instanceMatrix.needsUpdate = true;
        }
        mesh.count = li + 1;
        writeIndex++;
        if (writeIndex >= totalCapacity) break;
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [playing, playhead, fps, sys, scene.objects, objectId]);

    // Render instanced mesh chunks
    const meshRefs = useRef<InstancedMesh[]>([]);

    // Propagate live material/geometry pointer changes to the instanced mesh without remounting
    useEffect(() => {
      for (const mesh of meshRefs.current) {
        if (!mesh) continue;
        if (material && (mesh.material as any) !== material) {
          (mesh as any).material = material as any;
          (material as any).needsUpdate = true;
        }
        if (geom && mesh.geometry !== geom) {
          mesh.geometry = geom;
          if ((mesh as any).instanceMatrix) (mesh as any).instanceMatrix.needsUpdate = true;
        }
      }
    }, [geom, material, ]);

    if (!geom || !material) return null;
    return (
      <>
        {Array.from({ length: chunkCount }).map((_, ci) => (
          <instancedMesh
            key={`psys-${systemId}-chunk-${ci}`}
            ref={(ref) => { if (ref) meshRefs.current[ci] = ref; }}
            args={[geom, material, Math.min(CHUNK_SIZE, totalCapacity - ci * CHUNK_SIZE)]}
            frustumCulled={false}
          />
        ))}
      </>
    );
  };

export default ParticleSystemNode;

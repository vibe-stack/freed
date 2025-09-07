'use client';
import React, { useEffect, useMemo, useRef } from 'react';
import { InstancedMesh, Object3D, Quaternion, Vector3 as T3V, Material, BufferGeometry } from 'three/webgpu';
import { useFrame } from '@react-three/fiber';
import { useSceneStore } from '@/stores/scene-store';
import { useFluidStore } from '@/stores/fluid-store';
import { useAnimationStore } from '@/stores/animation-store';
import { getObject3D } from '@/features/viewport/hooks/object3d-registry';
import { FluidGPUSolver } from '../gpu/solver';
import { buildMeshSDF } from '../gpu/sdf-builder';

// PBF parameters and buffers managed on CPU (initial implementation)
// CPU fallback particle definition (minimal)
interface FluidParticle { alive: boolean; position: T3V; prev: T3V; vel: T3V }
function makeParticle(): FluidParticle { return { alive: false, position: new T3V(), prev: new T3V(), vel: new T3V() }; }

// Simple deterministic RNG (Mulberry32)
function makeRng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// Spatial hash grid for neighbor search
interface GridEntry { cell: number; index: number }

export const FluidSystemNode: React.FC<{ objectId: string; systemId: string }> = ({ objectId, systemId }) => {
  const scene = useSceneStore();
  const sys = useFluidStore((s) => s.systems[systemId]);
  const playing = useAnimationStore((s) => s.playing);
  const fps = useAnimationStore((s) => s.fps);
  const playhead = useAnimationStore((s) => s.playhead);

  // Source geometry + material for instancing
  const geomMatRef = useRef<{ geom: BufferGeometry | null; mat: Material | null }>({ geom: null, mat: null });
  const [, forceRerender] = React.useState(0);
  useEffect(() => {
    if (!sys?.particleObjectId) return;
    const obj3d = getObject3D(sys.particleObjectId);
    if (!obj3d) return;
    let found: any = null;
    obj3d.traverse((c: any) => { if (!found && c.isMesh && c.geometry) found = c; });
    if (found) {
      geomMatRef.current = { geom: found.geometry, mat: Array.isArray(found.material) ? found.material[0] : found.material };
      forceRerender((x) => x + 1);
    }
  }, [sys?.particleObjectId]);
  // Poll for runtime changes
  useFrame(() => {
    const po = sys?.particleObjectId ? getObject3D(sys.particleObjectId) : null;
    if (!po) return;
    let found: any = null; po.traverse((c: any) => { if (!found && c.isMesh && c.geometry) found = c; });
    if (!found) return;
    const cur = geomMatRef.current;
    if (cur.geom !== found.geometry || (Array.isArray(found.material) ? found.material[0] : found.material) !== cur.mat) {
      geomMatRef.current = { geom: found.geometry, mat: Array.isArray(found.material) ? found.material[0] : found.material };
      forceRerender((x) => x + 1);
    }
  });

  const CHUNK_SIZE = 1024;
  const capacity = Math.max(1, Math.min(sys?.capacity ?? 1024, 100000));
  const chunkCount = Math.ceil(capacity / CHUNK_SIZE);
  const accumRef = useRef(0); const emitAccumRef = useRef(0);
  const meshRefs = useRef<InstancedMesh[]>([]);
  const tmpObj = useMemo(() => new Object3D(), []);
  const gpuSolverRef = useRef<FluidGPUSolver | null>(null);
  const sdfKeyRef = useRef<string | null>(null);
  const lastScrubFrame = useRef<number>(-1);
  const cpuPartsRef = useRef<FluidParticle[]>(Array.from({ length: capacity }, () => makeParticle()));

  // Re-init when system changes
  useEffect(() => { accumRef.current = 0; emitAccumRef.current = 0; gpuSolverRef.current = null; }, [systemId, capacity]);

  // Helper to write matrix (uniform scale only from system's particle mesh scale already baked)
  function writeMatrix(arr: Float32Array, offset16: number, pos: T3V) {
    // Identity rotation and uniform scale 1
    arr[offset16 + 0] = 1; arr[offset16 + 4] = 0; arr[offset16 + 8] = 0; arr[offset16 + 12] = pos.x;
    arr[offset16 + 1] = 0; arr[offset16 + 5] = 1; arr[offset16 + 9] = 0; arr[offset16 + 13] = pos.y;
    arr[offset16 + 2] = 0; arr[offset16 + 6] = 0; arr[offset16 + 10] = 1; arr[offset16 + 14] = pos.z;
    arr[offset16 + 3] = 0; arr[offset16 + 7] = 0; arr[offset16 + 11] = 0; arr[offset16 + 15] = 1;
  }

  // Compute AABB for volume object (world space)
  function ensureGPUSolver() {
    if (!sys) return;
    const renderer: any = (globalThis as any).__r3f?.root?.getState?.().gl;
    const device: GPUDevice | undefined = renderer?.device || renderer?._device;
    if (!device) return;
    if (!gpuSolverRef.current) gpuSolverRef.current = new FluidGPUSolver(device, { capacity, gridResolution: [64,64,64], radius: sys.radius });
    if (sys.volumeObjectId) {
      const vol = getObject3D(sys.volumeObjectId);
      if (vol && (vol as any).isMesh) {
        const key = sys.volumeObjectId + ':' + ((vol as any).geometry?.uuid || '');
        if (sdfKeyRef.current !== key) {
          const geom = (vol as any).geometry as BufferGeometry;
          const sdf = buildMeshSDF(device, geom, (vol as any).matrixWorld.elements, { resolution: 48 });
          if (sdf) { gpuSolverRef.current.setSDF(sdf); sdfKeyRef.current = key; }
        }
      }
    }
  }

  // Neighborhood search via spatial hash
  // Removed CPU hash; GPU handles neighbors.

  // PBF kernel helpers
  // Removed CPU kernels

  useFrame((_, delta) => {
    if (!sys) return; const geom = geomMatRef.current.geom; const material = geomMatRef.current.mat; if (!geom || !material) return;
    ensureGPUSolver(); const solver = gpuSolverRef.current; if (!solver) return;
    const stepFps = Math.max(1, fps || 30);
    if (playing) accumRef.current += delta * stepFps;
    const steps = playing ? Math.floor(accumRef.current) : 0;
    if (steps <= 0 && playing) return; if (playing) accumRef.current -= steps;
    const dtFrame = 1 / stepFps;
    for (let s = 0; s < steps; s++) {
  emitAccumRef.current += sys.emissionRate; const toEmit = Math.floor(emitAccumRef.current); emitAccumRef.current -= toEmit; if (toEmit > 0) {
        const emitterObj = sys.emitterObjectId ? scene.objects[sys.emitterObjectId] : scene.objects[objectId]; const emitter3D = emitterObj ? getObject3D(emitterObj.id) : null; const ePos = emitter3D ? emitter3D.getWorldPosition(new T3V()) : new T3V(); solver.emit(toEmit, [ePos.x, ePos.y, ePos.z]); }
      solver.step(sys, dtFrame);
    }
    if (steps > 0) {
      solver.readPositions().then((arr) => {
        for (let ci = 0; ci < meshRefs.current.length; ci++) { const m = meshRefs.current[ci]; if (m) m.count = 0; }
        const total = solver.aliveCount; let writeIndex = 0;
        for (let i = 0; i < total; i++) { const ci = Math.floor(writeIndex / CHUNK_SIZE); const li = writeIndex % CHUNK_SIZE; const mesh = meshRefs.current[ci]; if (!mesh) break; const attr: any = (mesh as any).instanceMatrix; const array = attr?.array as Float32Array | undefined; const px = arr[i*4+0], py = arr[i*4+1], pz = arr[i*4+2]; if (array) { writeMatrix(array, li*16, new T3V(px,py,pz)); attr.needsUpdate = true; } else { tmpObj.position.set(px,py,pz); tmpObj.rotation.set(0,0,0); tmpObj.scale.setScalar(1); tmpObj.updateMatrix(); mesh.setMatrixAt(li, tmpObj.matrix); (mesh as any).instanceMatrix.needsUpdate = true; } mesh.count = li+1; writeIndex++; if (writeIndex >= capacity) break; }
      });
    }
  });

  // Scrubbing deterministic re-sim
  useEffect(() => {
    if (!sys) return; if (playing) return; ensureGPUSolver(); const solver = gpuSolverRef.current; if (!solver) return;
  const stepFps = Math.max(1, fps || 30); const frame = Math.max(0, Math.round(playhead * stepFps)); if (lastScrubFrame.current === frame) return; lastScrubFrame.current = frame; solver.aliveCount = 0; emitAccumRef.current = 0; const dtFrame = 1 / stepFps; for (let f = 0; f < frame; f++) { emitAccumRef.current += sys.emissionRate; const toEmit = Math.floor(emitAccumRef.current); emitAccumRef.current -= toEmit; if (toEmit > 0) { const emitterObj = sys.emitterObjectId ? scene.objects[sys.emitterObjectId] : scene.objects[objectId]; const emitter3D = emitterObj ? getObject3D(emitterObj.id) : null; const ePos = emitter3D ? emitter3D.getWorldPosition(new T3V()) : new T3V(); solver.emit(toEmit, [ePos.x, ePos.y, ePos.z]); } solver.step(sys, dtFrame); }
    solver.readPositions().then((arr) => { for (let ci = 0; ci < meshRefs.current.length; ci++) { const m = meshRefs.current[ci]; if (m) m.count = 0; } let writeIndex = 0; const total = solver.aliveCount; for (let i = 0; i < total; i++) { const ci = Math.floor(writeIndex / CHUNK_SIZE); const li = writeIndex % CHUNK_SIZE; const mesh = meshRefs.current[ci]; if (!mesh) break; const attr: any = (mesh as any).instanceMatrix; const array = attr?.array as Float32Array | undefined; const px = arr[i*4+0], py = arr[i*4+1], pz = arr[i*4+2]; if (array) { writeMatrix(array, li*16, new T3V(px,py,pz)); attr.needsUpdate = true; } else { tmpObj.position.set(px,py,pz); tmpObj.rotation.set(0,0,0); tmpObj.scale.setScalar(1); tmpObj.updateMatrix(); mesh.setMatrixAt(li, tmpObj.matrix); (mesh as any).instanceMatrix.needsUpdate = true; } mesh.count = li+1; writeIndex++; if (writeIndex >= capacity) break; } });
  }, [playing, playhead, fps, sys, objectId, capacity]);

  const geom = geomMatRef.current.geom; const material = geomMatRef.current.mat;
  if (!geom || !material) return null;
  return (
    <>
      {Array.from({ length: chunkCount }).map((_, ci) => (
        <instancedMesh
          key={`fluid-${systemId}-chunk-${ci}`}
          ref={(ref) => { if (ref) meshRefs.current[ci] = ref; }}
          args={[geom, material, Math.min(CHUNK_SIZE, capacity - ci * CHUNK_SIZE)]}
          frustumCulled={false}
        />
      ))}
    </>
  );
};

export default FluidSystemNode;

'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { Euler, Matrix4, Quaternion, Vector3 } from 'three/webgpu';
import { useToolStore } from '@/stores/tool-store';
import { useGeometryStore } from '@/stores/geometry-store';
import { useBrushRay } from '../hooks/use-brush';
import { brushDraw, brushInflate, brushSmooth, brushPinch, brushGrab, brushFlatten, brushFillDeepen, brushScrapePeaks, brushBlob, brushSnakeHook, brushNudge, brushRotate, brushSimplify, buildSpatialIndex, queryRadius, applySymmetry } from '../utils/sculpt';

interface SculptHandlerProps {
  meshId: string;
  objectRotation: { x: number; y: number; z: number };
  objectScale: { x: number; y: number; z: number };
  objectPosition: { x: number; y: number; z: number };
}

export const SculptHandler: React.FC<SculptHandlerProps> = ({ meshId, objectPosition, objectRotation, objectScale }) => {
  const tools = useToolStore();
  const geo = useGeometryStore();
  const mesh = geo.meshes.get(meshId) || null;
  const obj = { position: objectPosition, rotation: objectRotation, scale: objectScale };

  const avgLocalScale = (Math.abs(objectScale.x) + Math.abs(objectScale.y) + Math.abs(objectScale.z)) / 3;
  const radiusLocalApprox = tools.brushRadius / Math.max(1e-6, avgLocalScale);
  const hover = useBrushRay(mesh, obj, tools.brushRadius);
  const { camera } = useThree();
  const [isDragging, setDragging] = useState(false);
  const grabAnchorLocal = useRef<Vector3 | null>(null);
  const spatialRef = useRef<ReturnType<typeof buildSpatialIndex> | null>(null);
  const normalsTimer = useRef<number | null>(null);
  const normalsPending = useRef(false);

  // Apply brush on drag or single click
  useEffect(() => {
    if (!mesh) return;
    if (!tools.isActive) return;
    const kind = tools.tool;
    const isSculpt = String(kind).startsWith('sculpt-');
    if (!isSculpt) return;

    const applyStrokeOnce = () => {
      if (!hover) return;
      const out = new Map<string, typeof mesh.vertices[number]>();
      if (!spatialRef.current) spatialRef.current = buildSpatialIndex(mesh, Math.max(0.25, radiusLocalApprox * 0.75));
      const ctx = {
        mesh,
        hitLocal: hover.hitPointLocal,
        radius: radiusLocalApprox,
        strength: tools.brushStrength,
        falloff: tools.brushFalloff,
        perVertexWorldScale: avgLocalScale,
        spatial: spatialRef.current,
      } as const;
      // optional: rebuild spatial on significant movement
      if (kind === 'sculpt-draw') {
        brushDraw(ctx, out);
      } else if (kind === 'sculpt-clay') {
        brushFlatten(ctx, out, false, useToolStore.getState().planeOffset);
        brushDraw(ctx, out);
      } else if (kind === 'sculpt-flatten') {
        brushFlatten(ctx, out, false, useToolStore.getState().planeOffset);
      } else if (kind === 'sculpt-blob') {
        brushBlob(ctx, out, useToolStore.getState().pinchFactor);
      } else if (kind === 'sculpt-crease') {
        brushPinch(ctx, out, false);
        brushDraw(ctx, out);
      } else if (kind === 'sculpt-contrast') {
        brushFlatten(ctx, out, true, useToolStore.getState().planeOffset);
      } else if (kind === 'sculpt-fill') {
        brushFillDeepen(ctx, out, false, useToolStore.getState().planeOffset);
      } else if (kind === 'sculpt-deepen') {
        brushFillDeepen(ctx, out, true, useToolStore.getState().planeOffset);
      } else if (kind === 'sculpt-scrape') {
        brushScrapePeaks(ctx, out, false, useToolStore.getState().planeOffset);
      } else if (kind === 'sculpt-peaks') {
        brushScrapePeaks(ctx, out, true, useToolStore.getState().planeOffset);
      } else if (kind === 'sculpt-inflate') {
        brushInflate(ctx, out, false);
      } else if (kind === 'sculpt-smooth') {
        brushSmooth(ctx, out);
      } else if (kind === 'sculpt-pinch' || kind === 'sculpt-magnify') {
        brushPinch(ctx, out, kind === 'sculpt-magnify');
      }
      useGeometryStore.getState().updateMesh(meshId, (m) => {
        const idxById = new Map(m.vertices.map((v, i) => [v.id, i] as const));
        for (const [id, vv] of out) {
          const idx = idxById.get(id);
          if (idx != null) m.vertices[idx].position = vv.position;
        }
      });
      // Apply symmetry mirroring by finding counterpart vertices
      if (useToolStore.getState().symmetryEnabled && spatialRef.current) {
        const axis = useToolStore.getState().symmetryAxis;
        const used = new Set<string>();
        for (const [id, vv] of Array.from(out.entries())) {
          const original = mesh.vertices.find(v => v.id === id)!;
          const origP = new Vector3(original.position.x, original.position.y, original.position.z);
          const targetCounterPos = applySymmetry(origP, axis);
          const candidates = queryRadius(spatialRef.current, targetCounterPos, Math.max(0.25, radiusLocalApprox * 0.5), mesh);
          if (!candidates.length) continue;
          let best: { id: string; d2: number } | null = null;
          for (const c of candidates) {
            const p = c.position;
            const d2 = (p.x - targetCounterPos.x) ** 2 + (p.y - targetCounterPos.y) ** 2 + (p.z - targetCounterPos.z) ** 2;
            if (!best || d2 < best.d2) best = { id: c.id, d2 };
          }
          if (best && best.id !== id && !used.has(best.id)) {
            const mirrored = applySymmetry(new Vector3(vv.position.x, vv.position.y, vv.position.z), axis);
            // clamp seam to plane
            if (axis === 'x') mirrored.x = Math.abs(mirrored.x) < 1e-6 ? 0 : mirrored.x;
            if (axis === 'y') mirrored.y = Math.abs(mirrored.y) < 1e-6 ? 0 : mirrored.y;
            if (axis === 'z') mirrored.z = Math.abs(mirrored.z) < 1e-6 ? 0 : mirrored.z;
            const counter = mesh.vertices.find(v => v.id === best!.id)!;
            out.set(counter.id, { ...counter, position: { x: mirrored.x, y: mirrored.y, z: mirrored.z } });
            used.add(counter.id);
          }
        }
      }
      // throttle normals to next animation frame
      if (!normalsPending.current) {
        normalsPending.current = true;
        normalsTimer.current = requestAnimationFrame(() => {
          normalsPending.current = false;
          useGeometryStore.getState().recalculateNormals(meshId);
        });
      }
    };

    const onDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      // Only engage sculpting (and disable orbit) if the brush is actually over the mesh
      if (!hover) {
        setDragging(false);
        return;
      }
      setDragging(true);
      useToolStore.getState().setSculptStrokeActive(true);
      if (kind === 'sculpt-grab' && hover) {
        grabAnchorLocal.current = hover.hitPointLocal.clone();
      }
      // Single click sample
      applyStrokeOnce();
    };
    const onUp = (e: MouseEvent) => {
      if (e.button !== 0) return;
      setDragging(false);
      grabAnchorLocal.current = null;
      useToolStore.getState().setSculptStrokeActive(false);
      // final normals
      useGeometryStore.getState().recalculateNormals(meshId);
      // Keep brush selected for subsequent strokes
    };
    const onMove = (e: MouseEvent) => {
      if (!isDragging || !hover) return;
      const out = new Map<string, typeof mesh.vertices[number]>();
      const ctx = {
        mesh,
        hitLocal: hover.hitPointLocal,
        radius: radiusLocalApprox,
        strength: tools.brushStrength,
        falloff: tools.brushFalloff,
        perVertexWorldScale: avgLocalScale,
        spatial: spatialRef.current,
      } as const;
      if (kind === 'sculpt-draw') {
        brushDraw(ctx, out);
      } else if (kind === 'sculpt-clay') {
        brushFlatten(ctx, out, false, useToolStore.getState().planeOffset);
        brushDraw(ctx, out);
      } else if (kind === 'sculpt-flatten') {
        brushFlatten(ctx, out, false, useToolStore.getState().planeOffset);
      } else if (kind === 'sculpt-blob') {
        brushBlob(ctx, out, useToolStore.getState().pinchFactor);
      } else if (kind === 'sculpt-crease') {
        brushPinch(ctx, out, false);
        brushDraw(ctx, out);
      } else if (kind === 'sculpt-contrast') {
        brushFlatten(ctx, out, true, useToolStore.getState().planeOffset);
      } else if (kind === 'sculpt-fill') {
        brushFillDeepen(ctx, out, false, useToolStore.getState().planeOffset);
      } else if (kind === 'sculpt-deepen') {
        brushFillDeepen(ctx, out, true, useToolStore.getState().planeOffset);
      } else if (kind === 'sculpt-scrape') {
        brushScrapePeaks(ctx, out, false, useToolStore.getState().planeOffset);
      } else if (kind === 'sculpt-peaks') {
        brushScrapePeaks(ctx, out, true, useToolStore.getState().planeOffset);
      } else if (kind === 'sculpt-inflate') {
        brushInflate(ctx, out, false);
      } else if (kind === 'sculpt-smooth') {
        brushSmooth(ctx, out);
      } else if (kind === 'sculpt-pinch' || kind === 'sculpt-magnify') {
        brushPinch(ctx, out, kind === 'sculpt-magnify');
      } else if (kind === 'sculpt-grab' && grabAnchorLocal.current) {
        // Move along camera plane based on cursor movement
        // Convert pixel delta to object-local delta roughly
        const dist = camera.position.distanceTo(new Vector3(objectPosition.x, objectPosition.y, objectPosition.z));
        const pxScale = dist * 0.0025; // reuse move sensitivity feel
        // project onto camera right/up
        const right = new Vector3();
        const up = new Vector3();
        camera.getWorldDirection(right); // forward
        right.crossVectors(new Vector3(0, 1, 0), right).normalize();
        up.crossVectors(right, camera.getWorldDirection(new Vector3())).normalize();
        const w = new Vector3().addScaledVector(right, e.movementX * pxScale).addScaledVector(up, -e.movementY * pxScale);
        // world -> local
        const m = new Matrix4();
        const q = new Quaternion().setFromEuler(new Euler(objectRotation.x, objectRotation.y, objectRotation.z, 'XYZ'));
        m.compose(new Vector3(), q, new Vector3(Math.max(1e-6, objectScale.x), Math.max(1e-6, objectScale.y), Math.max(1e-6, objectScale.z))).invert();
        const localDelta = w.applyMatrix4(m);
        brushGrab(ctx, out, localDelta);
      } else if (kind === 'sculpt-snake-hook') {
        const right = new Vector3();
        const up = new Vector3();
        camera.getWorldDirection(right);
        right.crossVectors(new Vector3(0, 1, 0), right).normalize();
        up.crossVectors(right, camera.getWorldDirection(new Vector3())).normalize();
        const world = new Vector3().addScaledVector(right, e.movementX * 0.0025).addScaledVector(up, -e.movementY * 0.0025);
        const m = new Matrix4();
        const q = new Quaternion().setFromEuler(new Euler(objectRotation.x, objectRotation.y, objectRotation.z, 'XYZ'));
        m.compose(new Vector3(), q, new Vector3(Math.max(1e-6, objectScale.x), Math.max(1e-6, objectScale.y), Math.max(1e-6, objectScale.z))).invert();
        const localDir = world.applyMatrix4(m);
        brushSnakeHook(ctx, out, localDir, useToolStore.getState().pinchFactor);
      } else if (kind === 'sculpt-thumb') {
        // Thumb: flatten while pushing along stroke direction
        const right = new Vector3();
        const up = new Vector3();
        camera.getWorldDirection(right);
        right.crossVectors(new Vector3(0, 1, 0), right).normalize();
        up.crossVectors(right, camera.getWorldDirection(new Vector3())).normalize();
        const world = new Vector3().addScaledVector(right, e.movementX * 0.0015).addScaledVector(up, -e.movementY * 0.0015);
        const m = new Matrix4();
        const q = new Quaternion().setFromEuler(new Euler(objectRotation.x, objectRotation.y, objectRotation.z, 'XYZ'));
        m.compose(new Vector3(), q, new Vector3(Math.max(1e-6, objectScale.x), Math.max(1e-6, objectScale.y), Math.max(1e-6, objectScale.z))).invert();
        const localDir = world.applyMatrix4(m);
        brushFlatten(ctx, out, false, 0);
        brushNudge(ctx, out, localDir.multiplyScalar(0.5));
      } else if (kind === 'sculpt-nudge') {
        const right = new Vector3();
        const up = new Vector3();
        camera.getWorldDirection(right);
        right.crossVectors(new Vector3(0, 1, 0), right).normalize();
        up.crossVectors(right, camera.getWorldDirection(new Vector3())).normalize();
        const world = new Vector3().addScaledVector(right, e.movementX * 0.0025).addScaledVector(up, -e.movementY * 0.0025);
        const m = new Matrix4();
        const q = new Quaternion().setFromEuler(new Euler(objectRotation.x, objectRotation.y, objectRotation.z, 'XYZ'));
        m.compose(new Vector3(), q, new Vector3(Math.max(1e-6, objectScale.x), Math.max(1e-6, objectScale.y), Math.max(1e-6, objectScale.z))).invert();
        const localDir = world.applyMatrix4(m);
        brushNudge(ctx, out, localDir);
      } else if (kind === 'sculpt-rotate') {
        const angle = (e.movementX + e.movementY) * 0.01;
        brushRotate(ctx, out, angle);
      } else if (kind === 'sculpt-simplify') {
        brushSimplify(ctx, out);
      }
      // Apply symmetry mirroring by finding counterpart vertices (drag path)
      if (useToolStore.getState().symmetryEnabled && spatialRef.current) {
        const axis = useToolStore.getState().symmetryAxis;
        const used = new Set<string>();
        for (const [id, vv] of Array.from(out.entries())) {
          const original = mesh.vertices.find(v => v.id === id)!;
          const origP = new Vector3(original.position.x, original.position.y, original.position.z);
          const targetCounterPos = applySymmetry(origP, axis);
          const candidates = queryRadius(spatialRef.current, targetCounterPos, Math.max(0.25, radiusLocalApprox * 0.5), mesh);
          if (!candidates.length) continue;
          let best: { id: string; d2: number } | null = null;
          for (const c of candidates) {
            const p = c.position;
            const d2 = (p.x - targetCounterPos.x) ** 2 + (p.y - targetCounterPos.y) ** 2 + (p.z - targetCounterPos.z) ** 2;
            if (!best || d2 < best.d2) best = { id: c.id, d2 };
          }
          if (best && best.id !== id && !used.has(best.id)) {
            const mirrored = applySymmetry(new Vector3(vv.position.x, vv.position.y, vv.position.z), axis);
            if (axis === 'x') mirrored.x = Math.abs(mirrored.x) < 1e-6 ? 0 : mirrored.x;
            if (axis === 'y') mirrored.y = Math.abs(mirrored.y) < 1e-6 ? 0 : mirrored.y;
            if (axis === 'z') mirrored.z = Math.abs(mirrored.z) < 1e-6 ? 0 : mirrored.z;
            const counter = mesh.vertices.find(v => v.id === best!.id)!;
            out.set(counter.id, { ...counter, position: { x: mirrored.x, y: mirrored.y, z: mirrored.z } });
            used.add(counter.id);
          }
        }
      }
      // commit continuous updates (stroke)
      useGeometryStore.getState().updateMesh(meshId, (m) => {
        const idxById = new Map(m.vertices.map((v, i) => [v.id, i] as const));
        for (const [id, vv] of out) {
          const idx = idxById.get(id);
          if (idx != null) m.vertices[idx].position = vv.position;
        }
      });
      if (!normalsPending.current) {
        normalsPending.current = true;
        normalsTimer.current = requestAnimationFrame(() => {
          normalsPending.current = false;
          useGeometryStore.getState().recalculateNormals(meshId);
        });
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('mousemove', onMove);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('mousemove', onMove);
    };
  }, [mesh, isDragging, tools.isActive, tools.tool, tools.brushStrength, tools.brushFalloff, tools.brushRadius, hover, meshId, avgLocalScale, radiusLocalApprox, camera, objectPosition.x, objectPosition.y, objectPosition.z, objectRotation.x, objectRotation.y, objectRotation.z, objectScale.x, objectScale.y, objectScale.z]);

  // Visual brush circle in 3D: draw in the surface tangent plane at the hit point.
  const circle = useMemo(() => {
    if (!hover) return null;
    // Build circle basis using tangent/bitangent from ray hit when available
    const segments = 64;
    const verts: number[] = [];
    const n = hover.hitNormalWorld.clone().normalize();
    let right = hover.tangentWorld?.clone();
    let up = hover.bitangentWorld?.clone();
    if (!right || !up || right.lengthSq() < 1e-10 || up.lengthSq() < 1e-10) {
      // Fallback: build an arbitrary basis from normal
      const tmp = Math.abs(n.x) > 0.9 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0);
      right = tmp.clone().cross(n).normalize();
      up = new Vector3().crossVectors(n, right).normalize();
    }
    for (let i = 0; i <= segments; i++) {
      const t = (i / segments) * Math.PI * 2;
      const p = hover.hitPointWorld
        .clone()
        .addScaledVector(right, Math.cos(t) * tools.brushRadius)
        .addScaledVector(up, Math.sin(t) * tools.brushRadius);
      verts.push(p.x, p.y, p.z);
    }
    return new Float32Array(verts);
  }, [hover, tools.brushRadius]);

  if (!tools.isActive || !String(tools.tool).startsWith('sculpt-') || !hover) return null;
  return (
    <line>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[circle || new Float32Array(), 3]} />
      </bufferGeometry>
      <lineBasicMaterial color={0xffffff} transparent opacity={0.6} depthTest={false} depthWrite={false} />
    </line>
  );
};

export default SculptHandler;

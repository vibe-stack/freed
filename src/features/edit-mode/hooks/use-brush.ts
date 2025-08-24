import { useEffect, useMemo, useRef, useState } from 'react';
import { Matrix4, Matrix3, Euler, Quaternion, Raycaster, Vector2, Vector3, BufferGeometry, Float32BufferAttribute, Mesh as ThreeMesh } from 'three';
import { useThree } from '@react-three/fiber';
import type { Mesh as AppMesh } from '@/types/geometry';

export interface ObjectTransform {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
}

export interface BrushHit {
  hitPointWorld: Vector3;
  hitNormalWorld: Vector3;
  hitPointLocal: Vector3;
  radiusWorld: number;
  tangentWorld?: Vector3;
  bitangentWorld?: Vector3;
}

export function useBrushRay(mesh: AppMesh | null, obj: ObjectTransform | null, radiusWorld: number) {
  const { camera, gl } = useThree();
  const [hover, setHover] = useState<BrushHit | null>(null);
  const [bvhReady, setBvhReady] = useState(false);
  const mObj = useMemo(() => {
    if (!obj) return null;
    const m = new Matrix4();
    const q = new Quaternion().setFromEuler(new Euler(obj.rotation.x, obj.rotation.y, obj.rotation.z, 'XYZ'));
    m.compose(new Vector3(obj.position.x, obj.position.y, obj.position.z), q, new Vector3(Math.max(1e-6, obj.scale.x), Math.max(1e-6, obj.scale.y), Math.max(1e-6, obj.scale.z)));
    const inv = new Matrix4().copy(m).invert();
    return { m, inv };
  }, [obj?.position.x, obj?.position.y, obj?.position.z, obj?.rotation.x, obj?.rotation.y, obj?.rotation.z, obj?.scale.x, obj?.scale.y, obj?.scale.z]);

  // Precompute triangle indices once per mesh topology
  const triIndex = useMemo(() => {
    if (!mesh) return null;
    const idToIdx = new Map<string, number>();
    mesh.vertices.forEach((v, i) => idToIdx.set(v.id, i));
    const tris: [number, number, number][] = [];
    for (const f of mesh.faces) {
      const ids = f.vertexIds;
      for (let i = 1; i + 1 < ids.length; i++) {
        const a = idToIdx.get(ids[0]);
        const b = idToIdx.get(ids[i]);
        const c = idToIdx.get(ids[i + 1]);
        if (a == null || b == null || c == null) continue;
        tris.push([a, b, c]);
      }
    }
    return { tris };
  }, [mesh?.id, mesh?.vertices.length, mesh?.faces.length]);

  // BVH geometry and mesh
  const geomRef = useRef<BufferGeometry | null>(null);
  const posAttrRef = useRef<Float32BufferAttribute | null>(null);
  const threeMeshRef = useRef<ThreeMesh | null>(null);
  const lastRefit = useRef<number>(0);

  // Build BVH geometry when topology changes
  useEffect(() => {
    // Cleanup previous
    if (!mesh || !triIndex) {
      if (threeMeshRef.current) threeMeshRef.current = null;
      if (geomRef.current) { geomRef.current.dispose(); geomRef.current = null; }
      posAttrRef.current = null;
      setBvhReady(false);
      return;
    }
    const triCount = triIndex.tris.length;
    const positions = new Float32Array(triCount * 9);
    const geom = new BufferGeometry();
    const posAttr = new Float32BufferAttribute(positions, 3);
    geom.setAttribute('position', posAttr);
    // Initialize with current positions
    for (let i = 0; i < triCount; i++) {
      const [ia, ib, ic] = triIndex.tris[i];
      const a = mesh.vertices[ia].position;
      const b = mesh.vertices[ib].position;
      const c = mesh.vertices[ic].position;
      const o = i * 9;
      positions[o + 0] = a.x; positions[o + 1] = a.y; positions[o + 2] = a.z;
      positions[o + 3] = b.x; positions[o + 4] = b.y; positions[o + 5] = b.z;
      positions[o + 6] = c.x; positions[o + 7] = c.y; positions[o + 8] = c.z;
    }
    geom.computeBoundingBox();
    geom.computeBoundingSphere();
    geomRef.current = geom;
    posAttrRef.current = posAttr;
    const threeMesh = new ThreeMesh(geom);
    threeMesh.matrixAutoUpdate = false;
    threeMeshRef.current = threeMesh;

    let cancelled = false;
    (async () => {
      try {
  const mod = await import('three-mesh-bvh');
  // three-mesh-bvh augments ThreeMesh.raycast at runtime
        (ThreeMesh as any).prototype.raycast = mod.acceleratedRaycast;
  // boundsTree is injected by three-mesh-bvh at runtime
        (geom as any).boundsTree = new mod.MeshBVH(geom);
        if (!cancelled) setBvhReady(true);
      } catch (e) {
        console.warn('[useBrushRay] BVH not available, falling back to brute-force raycast:', e);
        if (!cancelled) setBvhReady(false);
      }
    })();

    return () => {
      cancelled = true;
      if (geomRef.current) { (geomRef.current as any).boundsTree = null; geomRef.current.dispose(); geomRef.current = null; }
      posAttrRef.current = null;
      threeMeshRef.current = null;
    };
  }, [mesh?.id, triIndex?.tris.length]);

  useEffect(() => {
    if (!mesh || !obj || !mObj || !triIndex) { setHover(null); return; }
    const onMove = (e: MouseEvent) => {
      const rect = gl.domElement.getBoundingClientRect();
      const ndc = new Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -(((e.clientY - rect.top) / rect.height) * 2 - 1));
      const raycaster = new Raycaster();
      raycaster.setFromCamera(ndc, camera);

      // Update BVH geometry positions periodically while sculpting/editing
      const now = performance.now();
      if (bvhReady && geomRef.current && posAttrRef.current && triIndex) {
        // Throttle refit to ~30ms
        if (now - lastRefit.current > 30) {
          const positions = posAttrRef.current.array as Float32Array;
          const triCount = triIndex.tris.length;
          for (let i = 0; i < triCount; i++) {
            const [ia, ib, ic] = triIndex.tris[i];
            const a = mesh.vertices[ia].position;
            const b = mesh.vertices[ib].position;
            const c = mesh.vertices[ic].position;
            const o = i * 9;
            positions[o + 0] = a.x; positions[o + 1] = a.y; positions[o + 2] = a.z;
            positions[o + 3] = b.x; positions[o + 4] = b.y; positions[o + 5] = b.z;
            positions[o + 6] = c.x; positions[o + 7] = c.y; positions[o + 8] = c.z;
          }
          posAttrRef.current.needsUpdate = true;
          // boundsTree.refit provided by three-mesh-bvh when present
          if ((geomRef.current as any).boundsTree?.refit) (geomRef.current as any).boundsTree.refit();
          lastRefit.current = now;
        }
      }

      // Intersect via BVH if ready
      if (bvhReady && threeMeshRef.current && mObj) {
        const meshObj = threeMeshRef.current;
        meshObj.matrixWorld.copy(mObj.m);
        const hits = raycaster.intersectObject(meshObj, false);
        if (hits && hits.length) {
          const h = hits[0];
          const worldP = h.point.clone();
          const localP = worldP.clone().applyMatrix4(mObj.inv);
          // Prefer triangle-derived normal and tangent basis if available
          let worldN: Vector3 | undefined;
          let tangent: Vector3 | undefined;
          let bitangent: Vector3 | undefined;
          if (typeof h.faceIndex === 'number' && posAttrRef.current) {
            const i = h.faceIndex;
            const arr = posAttrRef.current.array as Float32Array;
            const o = i * 9;
            const aW = new Vector3(arr[o+0], arr[o+1], arr[o+2]).applyMatrix4(mObj.m);
            const bW = new Vector3(arr[o+3], arr[o+4], arr[o+5]).applyMatrix4(mObj.m);
            const cW = new Vector3(arr[o+6], arr[o+7], arr[o+8]).applyMatrix4(mObj.m);
            const e1 = bW.clone().sub(aW);
            const e2 = cW.clone().sub(aW);
            worldN = new Vector3().crossVectors(e1, e2).normalize();
            tangent = e1.clone().sub(worldN.clone().multiplyScalar(e1.dot(worldN)));
            if (tangent.lengthSq() < 1e-10) tangent = e2.clone().sub(worldN.clone().multiplyScalar(e2.dot(worldN)));
            tangent.normalize();
            bitangent = new Vector3().crossVectors(worldN, tangent).normalize();
          }
          if (!worldN) {
            // Fallback to face normal if present, or default up
            const localN = (h.face && h.face.normal ? h.face.normal.clone() : new Vector3(0, 1, 0));
            const normalMatrix = new Matrix3().getNormalMatrix(mObj.m as any);
            worldN = localN.applyMatrix3(normalMatrix).normalize();
          }
          setHover({ hitPointWorld: worldP, hitNormalWorld: worldN, hitPointLocal: localP, radiusWorld, tangentWorld: tangent, bitangentWorld: bitangent });
          return;
        }
      }

      // Fallback brute force (if BVH not available)
      const ray = new Raycaster();
      ray.setFromCamera(ndc, camera);
      const origWorld = ray.ray.origin.clone();
      const dirWorld = ray.ray.direction.clone();
      const oLocal = origWorld.clone().applyMatrix4(mObj!.inv);
      const p1Local = origWorld.clone().add(dirWorld).applyMatrix4(mObj!.inv);
      const dLocal = p1Local.sub(oLocal).normalize();
      let bestD = Infinity;
      let bestP: Vector3 | null = null;
      let bestN: Vector3 | null = null;
      let bestTriIdx = -1;
      let bestTri: { a: Vector3; b: Vector3; c: Vector3 } | null = null;
      for (let t = 0; t < (triIndex?.tris.length || 0); t++) {
        const [ia, ib, ic] = triIndex!.tris[t];
        const va = mesh.vertices[ia].position;
        const vb = mesh.vertices[ib].position;
        const vc = mesh.vertices[ic].position;
        const a = new Vector3(va.x, va.y, va.z);
        const b = new Vector3(vb.x, vb.y, vb.z);
        const c = new Vector3(vc.x, vc.y, vc.z);
        const edge1 = new Vector3().subVectors(b, a);
        const edge2 = new Vector3().subVectors(c, a);
        const normal = new Vector3().crossVectors(edge1, edge2);
        const DdN = dLocal.dot(normal);
        if (Math.abs(DdN) < 1e-8) continue;
        const diff = new Vector3().subVectors(oLocal, a);
        const DdQxE2 = dLocal.dot(new Vector3().crossVectors(diff, edge2));
        const DdE1xQ = dLocal.dot(new Vector3().crossVectors(edge1, diff));
        const inv = 1 / DdN;
        const u = DdQxE2 * inv;
        const v = DdE1xQ * inv;
        if (u < 0 || v < 0 || u + v > 1) continue;
        const tHit = -diff.dot(normal) * inv;
        if (tHit < 0) continue;
        const hitP = new Vector3().copy(dLocal).multiplyScalar(tHit).add(oLocal);
        const dist = hitP.distanceToSquared(oLocal);
        if (dist < bestD) { bestD = dist; bestP = hitP.clone(); bestN = normal.clone().normalize(); bestTriIdx = t; bestTri = { a, b, c }; }
      }
      if (!bestP || !bestN) { setHover(null); return; }
      const worldP = bestP.clone().applyMatrix4(mObj!.m);
      const worldN = bestN.clone().applyMatrix4(new Matrix4().copy(mObj!.inv).transpose()).normalize();
      // Build tangent basis from the winning triangle in world
      let tangent: Vector3 | undefined;
      let bitangent: Vector3 | undefined;
      if (bestTri) {
        const aW = bestTri.a.clone().applyMatrix4(mObj!.m);
        const bW = bestTri.b.clone().applyMatrix4(mObj!.m);
        const cW = bestTri.c.clone().applyMatrix4(mObj!.m);
        const e1 = bW.clone().sub(aW);
        const e2 = cW.clone().sub(aW);
        tangent = e1.clone().sub(worldN.clone().multiplyScalar(e1.dot(worldN)));
        if (tangent.lengthSq() < 1e-10) tangent = e2.clone().sub(worldN.clone().multiplyScalar(e2.dot(worldN)));
        tangent.normalize();
        bitangent = new Vector3().crossVectors(worldN, tangent).normalize();
      }
      setHover({ hitPointWorld: worldP, hitNormalWorld: worldN, hitPointLocal: bestP, radiusWorld, tangentWorld: tangent, bitangentWorld: bitangent });
    };
    document.addEventListener('mousemove', onMove, { passive: true });
    return () => document.removeEventListener('mousemove', onMove as any);
  }, [mesh, obj, mObj, triIndex, camera, gl.domElement, radiusWorld, bvhReady]);

  return hover;
}

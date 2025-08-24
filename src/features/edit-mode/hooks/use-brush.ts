import { useEffect, useMemo, useRef, useState } from 'react';
import { Matrix4, Euler, Quaternion, Raycaster, Vector2, Vector3 } from 'three';
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
}

export function useBrushRay(mesh: AppMesh | null, obj: ObjectTransform | null, radiusWorld: number) {
  const { camera, gl } = useThree();
  const [hover, setHover] = useState<BrushHit | null>(null);
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

  useEffect(() => {
    if (!mesh || !obj || !mObj || !triIndex) { setHover(null); return; }
    const onMove = (e: MouseEvent) => {
      const rect = gl.domElement.getBoundingClientRect();
      const ndc = new Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -(((e.clientY - rect.top) / rect.height) * 2 - 1));
      const ray = new Raycaster();
      ray.setFromCamera(ndc, camera);
      // Transform ray to object-local space to avoid per-triangle world transforms
      const origWorld = ray.ray.origin.clone();
      const dirWorld = ray.ray.direction.clone();
      const oLocal = origWorld.clone().applyMatrix4(mObj.inv);
      const p1Local = origWorld.clone().add(dirWorld).applyMatrix4(mObj.inv);
      const dLocal = p1Local.sub(oLocal).normalize();
      let bestD = Infinity;
      let bestP: Vector3 | null = null;
      let bestN: Vector3 | null = null;
      for (let t = 0; t < triIndex.tris.length; t++) {
        const [ia, ib, ic] = triIndex.tris[t];
        const va = mesh.vertices[ia].position;
        const vb = mesh.vertices[ib].position;
        const vc = mesh.vertices[ic].position;
        const a = new Vector3(va.x, va.y, va.z);
        const b = new Vector3(vb.x, vb.y, vb.z);
        const c = new Vector3(vc.x, vc.y, vc.z);
        const tmp = new Vector3();
        // Recreate a local-space ray object rapidly
        const hit = { point: tmp };
        // three's Ray has intersectTriangle method; emulate by using a temp Ray-like call
        const inter = (orig: Vector3, dir: Vector3, a: Vector3, b: Vector3, c: Vector3): Vector3 | null => {
          // Using the same algorithm as Ray.intersectTriangle (not importing to keep light)
          const edge1 = new Vector3().subVectors(b, a);
          const edge2 = new Vector3().subVectors(c, a);
          const normal = new Vector3().crossVectors(edge1, edge2);
          // Backface culling off
          const DdN = dir.dot(normal);
          if (Math.abs(DdN) < 1e-8) return null;
          const diff = new Vector3().subVectors(orig, a);
          const DdQxE2 = dir.dot(new Vector3().crossVectors(diff, edge2));
          const DdE1xQ = dir.dot(new Vector3().crossVectors(edge1, diff));
          const inv = 1 / DdN;
          const u = DdQxE2 * inv;
          const v = DdE1xQ * inv;
          if (u < 0 || v < 0 || u + v > 1) return null;
          const tHit = -diff.dot(normal) * inv;
          if (tHit < 0) return null;
          return new Vector3().copy(dir).multiplyScalar(tHit).add(orig);
        };
        const hitP = inter(oLocal, dLocal, a, b, c);
        if (hitP) {
          const dist = hitP.distanceToSquared(oLocal);
          if (dist < bestD) {
            bestD = dist; bestP = hitP.clone(); bestN = new Vector3().crossVectors(new Vector3().subVectors(b, a), new Vector3().subVectors(c, a)).normalize();
          }
        }
      }
      if (!bestP || !bestN) { setHover(null); return; }
      // bestP is in local space now; convert to world for display
      const worldP = bestP.clone().applyMatrix4(mObj.m);
      const worldN = bestN.clone().applyMatrix4(new Matrix4().copy(mObj.inv).transpose()).normalize();
      setHover({ hitPointWorld: worldP, hitNormalWorld: worldN, hitPointLocal: bestP, radiusWorld });
    };
    document.addEventListener('mousemove', onMove, { passive: true });
    return () => document.removeEventListener('mousemove', onMove as any);
  }, [mesh, obj, mObj, triIndex, camera, gl.domElement, radiusWorld]);

  return hover;
}

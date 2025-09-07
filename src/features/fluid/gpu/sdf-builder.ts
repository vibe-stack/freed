import { BufferGeometry, Box3, Vector3 as T3V } from 'three/webgpu';

export interface MeshSDF { texture: GPUTexture; worldToGrid: Float32Array; bboxMin: [number, number, number]; bboxMax: [number, number, number]; }

export function buildMeshSDF(device: GPUDevice, geom: BufferGeometry, worldMatrix: number[] | Float32Array, opts?: { resolution?: number; padding?: number }): MeshSDF | null {
  const posAttr: any = (geom as any).attributes?.position; if (!posAttr) return null; const indexAttr: any = (geom as any).index; const positions = posAttr.array as Float32Array; const idx = indexAttr ? indexAttr.array as Uint32Array | Uint16Array : null; const triCount = idx ? idx.length / 3 : positions.length / 9;
  const tris: T3V[] = [];
  function transform(x: number, y: number, z: number): T3V { const m: any = worldMatrix; return new T3V(m[0]*x + m[4]*y + m[8]*z + m[12], m[1]*x + m[5]*y + m[9]*z + m[13], m[2]*x + m[6]*y + m[10]*z + m[14]); }
  for (let i = 0; i < triCount; i++) {
    if (idx) { const a = idx[i*3+0]*3; const b = idx[i*3+1]*3; const c = idx[i*3+2]*3; tris.push(transform(positions[a],positions[a+1],positions[a+2])); tris.push(transform(positions[b],positions[b+1],positions[b+2])); tris.push(transform(positions[c],positions[c+1],positions[c+2])); }
    else { const a = i*9; tris.push(transform(positions[a],positions[a+1],positions[a+2])); tris.push(transform(positions[a+3],positions[a+4],positions[a+5])); tris.push(transform(positions[a+6],positions[a+7],positions[a+8])); }
  }
  const bbox = new Box3(); bbox.setFromPoints(tris);
  const padding = opts?.padding ?? 0.01 * bbox.getSize(new T3V()).length(); bbox.min.addScalar(-padding); bbox.max.addScalar(padding);
  const res = opts?.resolution ?? 48; const sx = res, sy = res, sz = res; const size = bbox.getSize(new T3V());
  const distances = new Float32Array(sx * sy * sz);
  const tmp = new T3V();
  function pointTriDist(p: T3V, a: T3V, b: T3V, c: T3V): number { // very coarse
    const ab = b.clone().sub(a); const ac = c.clone().sub(a); const ap = p.clone().sub(a); const d1 = ab.dot(ap); const d2 = ac.dot(ap); if (d1 <=0 && d2 <=0) return ap.length(); const bp = p.clone().sub(b); const d3 = ab.dot(bp); const d4 = ac.dot(bp); if (d3>=0 && d4<=d3) return bp.length(); const cp = p.clone().sub(c); const d5 = ab.dot(cp); const d6 = ac.dot(cp); if (d6>=0 && d5<=d6) return cp.length(); const vc = d1*d4 - d3*d2; if (vc<=0 && d1>=0 && d3<=0) { const v = d1 / (d1 - d3); return ap.clone().sub(ab.multiplyScalar(v)).length(); } const vb = d5*d2 - d1*d6; if (vb<=0 && d2>=0 && d6<=0) { const w = d2 / (d2 - d6); return ap.clone().sub(ac.multiplyScalar(w)).length(); } const va = d3*d6 - d5*d4; if (va<=0 && (d4-d3)>=0 && (d5-d6)>=0) { const w = (d4-d3)/((d4-d3)+(d5-d6)); const bc = c.clone().sub(b); return bp.clone().sub(bc.multiplyScalar(w)).length(); } const n = ab.clone().cross(ac).normalize(); return Math.abs(n.dot(ap)); }
  // naive inside heuristic: average plane sign
  for (let z = 0; z < sz; z++) for (let y = 0; y < sy; y++) for (let x = 0; x < sx; x++) { const gx = (x+0.5)/sx; const gy = (y+0.5)/sy; const gz = (z+0.5)/sz; tmp.set(bbox.min.x + gx*size.x, bbox.min.y + gy*size.y, bbox.min.z + gz*size.z); let minD = 1e9; let acc = 0; const sample = Math.min(64, tris.length/3|0); for (let t = 0; t < tris.length; t+=3) { const a = tris[t], b = tris[t+1], c = tris[t+2]; const d = pointTriDist(tmp,a,b,c); if (d < minD) minD = d; if (t/3 < sample) { const n = b.clone().sub(a).cross(c.clone().sub(a)).normalize(); acc += n.dot(tmp.clone().sub(a)); } } const inside = acc / sample < 0; distances[x + y*sx + z*sx*sy] = inside ? -minD : minD; }
  const texture = device.createTexture({ size: { width: sx, height: sy, depthOrArrayLayers: sz }, format: 'r32float', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.STORAGE_BINDING, dimension: '3d' });
  device.queue.writeTexture({ texture }, distances, { bytesPerRow: sx * 4, rowsPerImage: sy }, { width: sx, height: sy, depthOrArrayLayers: sz });
  const worldToGrid = new Float32Array([
    1/size.x,0,0,-bbox.min.x/size.x,
    0,1/size.y,0,-bbox.min.y/size.y,
    0,0,1/size.z,-bbox.min.z/size.z,
    0,0,0,1,
  ]);
  return { texture, worldToGrid, bboxMin: [bbox.min.x, bbox.min.y, bbox.min.z], bboxMax: [bbox.max.x, bbox.max.y, bbox.max.z] };
}

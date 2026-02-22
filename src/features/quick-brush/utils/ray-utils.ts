import * as THREE from 'three';

const _raycaster = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const _groundTarget = new THREE.Vector3();
const _groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

export interface RayHit {
  point: THREE.Vector3;
  normal: THREE.Vector3;
  /** Tangent orthogonal to normal, aligned roughly with camera right */
  tangent: THREE.Vector3;
}

/**
 * Cast a ray from the camera through screen position (clientX, clientY).
 * First tries to hit scene meshes; falls back to the Y=0 ground plane.
 * Returns null only if the ray misses everything (e.g. looking straight up away from ground).
 */
export function castToGroundOrSurface(
  clientX: number,
  clientY: number,
  camera: THREE.Camera,
  domElement: HTMLElement,
  sceneMeshes: THREE.Mesh[],
): RayHit | null {
  const rect = domElement.getBoundingClientRect();
  _ndc.set(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -(((clientY - rect.top) / rect.height) * 2 - 1),
  );

  _raycaster.setFromCamera(_ndc, camera);

  // 1. Try scene meshes first
  const hits = _raycaster.intersectObjects(sceneMeshes, false);
  if (hits.length > 0) {
    const h = hits[0];
    const rawNormal = h.face?.normal ?? new THREE.Vector3(0, 1, 0);
    const normal = rawNormal.clone().transformDirection(h.object.matrixWorld).normalize();
    const tangent = computeTangent(normal, camera);
    return { point: h.point.clone(), normal, tangent };
  }

  // 2. Fallback: intersect with Y=0 ground plane
  const hit = _raycaster.ray.intersectPlane(_groundPlane, _groundTarget);
  if (hit) {
    const normal = new THREE.Vector3(0, 1, 0);
    const tangent = computeTangent(normal, camera);
    return { point: _groundTarget.clone(), normal, tangent };
  }

  return null;
}

function computeTangent(normal: THREE.Vector3, camera: THREE.Camera): THREE.Vector3 {
  // Use camera right vector as a hint, then orthogonalize against the normal
  const cameraRight = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
  const tangent = cameraRight.clone().sub(
    normal.clone().multiplyScalar(normal.dot(cameraRight))
  );
  if (tangent.lengthSq() < 1e-6) {
    // Degenerate case (looking straight down the normal) — use world X instead
    const worldX = new THREE.Vector3(1, 0, 0);
    return worldX.sub(normal.clone().multiplyScalar(normal.dot(worldX))).normalize();
  }
  return tangent.normalize();
}

/**
 * Projects a world point onto the plane defined by (origin, normal).
 */
export function projectOntoPlane(
  point: THREE.Vector3,
  origin: THREE.Vector3,
  normal: THREE.Vector3,
): THREE.Vector3 {
  const diff = point.clone().sub(origin);
  const dist = diff.dot(normal);
  return point.clone().sub(normal.clone().multiplyScalar(dist));
}

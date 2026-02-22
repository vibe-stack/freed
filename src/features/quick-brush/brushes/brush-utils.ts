import * as THREE from 'three';
import type { BrushParams } from './types';

export interface RectFootprint {
  /** Width along surface tangent */
  width: number;
  /** Depth along surface bitangent */
  depth: number;
  /** World-space center of the footprint base (on the surface) */
  center: THREE.Vector3;
  /** Quaternion aligning Y-up geometry to the surface normal */
  quaternion: THREE.Quaternion;
}

/**
 * Compute the footprint for rect-type brushes.
 *
 * The anchor is one fixed corner. `current` is the dragged opposite corner,
 * projected onto the anchor's surface plane. Width grows along the tangent,
 * depth along the bitangent — so the anchor stays perfectly stationary.
 */
export function computeRectFootprint(params: BrushParams): RectFootprint {
  const anchor = new THREE.Vector3(params.anchor.x, params.anchor.y, params.anchor.z);
  const current = new THREE.Vector3(params.current.x, params.current.y, params.current.z);
  const normal = new THREE.Vector3(params.normal.x, params.normal.y, params.normal.z).normalize();
  const tangentRaw = new THREE.Vector3(params.tangent.x, params.tangent.y, params.tangent.z).normalize();
  const tangent = tangentRaw.clone().sub(normal.clone().multiplyScalar(tangentRaw.dot(normal))).normalize();
  const bitangent = new THREE.Vector3().crossVectors(tangent, normal).normalize();

  // Project current onto surface plane at anchor
  const diff = current.clone().sub(anchor);
  const t = diff.dot(tangent);   // signed extent along tangent
  const b = diff.dot(bitangent); // signed extent along bitangent

  const width = Math.max(0.01, Math.abs(t));
  const depth = Math.max(0.01, Math.abs(b));

  // Center of the footprint base: anchor + half-extents in each axis
  // (sign follows the drag direction so anchor stays fixed)
  const center = anchor.clone()
    .addScaledVector(tangent, t / 2)
    .addScaledVector(bitangent, b / 2);

  // Quaternion from full local basis: X=tangent, Y=normal, Z=bitangent
  const basis = new THREE.Matrix4().makeBasis(tangent, normal, bitangent);
  const quaternion = new THREE.Quaternion().setFromRotationMatrix(basis);

  return { width, depth, center, quaternion };
}

export interface RadialFootprint {
  radius: number;
  /** World-space center at the anchor (on the surface) */
  center: THREE.Vector3;
  /** Quaternion aligning Y-up geometry to the surface normal */
  quaternion: THREE.Quaternion;
}

/**
 * Compute the radius for radial-type brushes.
 * Anchor is the center; radius = distance to current projected on surface plane.
 */
export function computeRadialFootprint(params: BrushParams): RadialFootprint {
  const anchor = new THREE.Vector3(params.anchor.x, params.anchor.y, params.anchor.z);
  const current = new THREE.Vector3(params.current.x, params.current.y, params.current.z);
  const normal = new THREE.Vector3(params.normal.x, params.normal.y, params.normal.z).normalize();

  const diff = current.clone().sub(anchor);
  const projected = diff.clone().sub(normal.clone().multiplyScalar(diff.dot(normal)));
  const radius = Math.max(0.05, projected.length());

  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    normal,
  );

  return { radius, center: anchor.clone(), quaternion };
}

/** Decompose a quaternion to Euler XYZ for setTransform (which takes rotation in radians) */
export function quaternionToEuler(q: THREE.Quaternion): { x: number; y: number; z: number } {
  const e = new THREE.Euler().setFromQuaternion(q, 'XYZ');
  return { x: e.x, y: e.y, z: e.z };
}

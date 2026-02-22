'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { castToGroundOrSurface } from '../utils/ray-utils';
import { useQuickBrushStore } from '../stores/quick-brush-store';
import { useSelectionStore } from '@/stores/selection-store';
import { useGeometryStore } from '@/stores/geometry-store';
import { useSceneStore } from '@/stores/scene-store';
import { createFace, createMeshFromGeometry, createVertex, vec3 } from '@/utils/geometry';

type PolygonPhase = 'idle' | 'drawing' | 'extruding';

interface PolygonState {
  phase: PolygonPhase;
  points: THREE.Vector3[];
  hoverPoint: THREE.Vector3 | null;
  plane: THREE.Plane | null;
  normal: THREE.Vector3;
  extrusion: number;
}

const INITIAL: PolygonState = {
  phase: 'idle',
  points: [],
  hoverPoint: null,
  plane: null,
  normal: new THREE.Vector3(0, 1, 0),
  extrusion: 0.5,
};

function buildExtrudedPolygonGeometry(points: THREE.Vector3[], normal: THREE.Vector3, extrusion: number): THREE.BufferGeometry {
  const n = points.length;
  const geo = new THREE.BufferGeometry();
  if (n < 3) {
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0]), 3));
    return geo;
  }

  const top = points.map((p) => p.clone().addScaledVector(normal, extrusion));
  const positions: number[] = [];
  for (const p of points) positions.push(p.x, p.y, p.z);
  for (const p of top) positions.push(p.x, p.y, p.z);

  // Robust concave triangulation in polygon local 2D space
  const origin = points[0].clone();
  const tangent = points[1].clone().sub(points[0]).normalize();
  const bitangent = new THREE.Vector3().crossVectors(normal, tangent).normalize();
  const contour2D = points.map((p) => {
    const d = p.clone().sub(origin);
    return new THREE.Vector2(d.dot(tangent), d.dot(bitangent));
  });
  const capTris = THREE.ShapeUtils.triangulateShape(contour2D, []);

  const polyNormal = new THREE.Vector3()
    .subVectors(points[1], points[0])
    .cross(new THREE.Vector3().subVectors(points[2], points[0]))
    .normalize();
  const extrudeDir = normal.clone().multiplyScalar(extrusion).normalize();
  const topAligns = polyNormal.dot(extrudeDir) >= 0;

  const originalOrder = Array.from({ length: n }, (_, i) => i);
  const reversedOrder = [...originalOrder].reverse();

  const topOrder = topAligns ? originalOrder : reversedOrder;
  const bottomOrder = topAligns ? reversedOrder : originalOrder;

  const indices: number[] = [];

  for (const tri of capTris) {
    const [a, b, c] = tri;
    if (topAligns) {
      indices.push(n + a, n + b, n + c);
      indices.push(c, b, a);
    } else {
      indices.push(n + c, n + b, n + a);
      indices.push(a, b, c);
    }
  }

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const bi = i;
    const bj = j;
    const ti = n + i;
    const tj = n + j;
    if (topAligns) {
      indices.push(bi, bj, tj, bi, tj, ti);
    } else {
      indices.push(bi, ti, tj, bi, tj, bj);
    }
  }

  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function commitPolygon(points: THREE.Vector3[], normal: THREE.Vector3, extrusion: number): string | null {
  if (points.length < 3) return null;

  const n = points.length;
  const top = points.map((p) => p.clone().addScaledVector(normal, extrusion));

  const polyNormal = new THREE.Vector3()
    .subVectors(points[1], points[0])
    .cross(new THREE.Vector3().subVectors(points[2], points[0]))
    .normalize();
  const extrudeDir = normal.clone().multiplyScalar(extrusion).normalize();
  const topAligns = polyNormal.dot(extrudeDir) >= 0;

  const vertices = [
    ...points.map((p) => createVertex(vec3(p.x, p.y, p.z))),
    ...top.map((p) => createVertex(vec3(p.x, p.y, p.z))),
  ];

  // Robust concave triangulation in polygon local 2D space
  const origin = points[0].clone();
  const tangent = points[1].clone().sub(points[0]).normalize();
  const bitangent = new THREE.Vector3().crossVectors(normal, tangent).normalize();
  const contour2D = points.map((p) => {
    const d = p.clone().sub(origin);
    return new THREE.Vector2(d.dot(tangent), d.dot(bitangent));
  });
  const capTris = THREE.ShapeUtils.triangulateShape(contour2D, []);

  const faces = [] as ReturnType<typeof createFace>[];

  for (const tri of capTris) {
    const [a, b, c] = tri;
    if (topAligns) {
      faces.push(createFace([vertices[n + a].id, vertices[n + b].id, vertices[n + c].id]));
      faces.push(createFace([vertices[c].id, vertices[b].id, vertices[a].id]));
    } else {
      faces.push(createFace([vertices[n + c].id, vertices[n + b].id, vertices[n + a].id]));
      faces.push(createFace([vertices[a].id, vertices[b].id, vertices[c].id]));
    }
  }

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const bi = vertices[i].id;
    const bj = vertices[j].id;
    const ti = vertices[n + i].id;
    const tj = vertices[n + j].id;
    if (topAligns) {
      faces.push(createFace([bi, bj, tj, ti]));
    } else {
      faces.push(createFace([bi, ti, tj, bj]));
    }
  }

  const mesh = createMeshFromGeometry('Polygon', vertices, faces, { shading: 'flat' });
  useGeometryStore.getState().addMesh(mesh);
  const scene = useSceneStore.getState();
  const objId = scene.createMeshObject('Polygon', mesh.id);
  scene.setTransform(objId, {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
  });
  scene.selectObject(objId);
  useSelectionStore.getState().selectObjects([objId], false);
  return objId;
}

const PolygonBrushHandler: React.FC = () => {
  const { camera, gl, scene } = useThree();
  const viewMode = useSelectionStore((s) => s.selection.viewMode);
  const activeBrush = useQuickBrushStore((s) => s.activeBrush);
  const [state, setState] = useState<PolygonState>(INITIAL);
  const stateRef = useRef<PolygonState>(INITIAL);
  const isOverUIRef = useRef(false);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const getViewMode = () => useSelectionStore.getState().selection.viewMode;
    const isPolygonActive = () => getViewMode() === 'brush' && useQuickBrushStore.getState().activeBrush === 'polygon';

    const getSceneMeshes = (): THREE.Mesh[] => {
      const meshes: THREE.Mesh[] = [];
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh && obj.visible) meshes.push(obj);
      });
      return meshes;
    };

    const castToPlane = (clientX: number, clientY: number, plane: THREE.Plane): THREE.Vector3 | null => {
      const rect = gl.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1,
      );
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(ndc, camera);
      const target = new THREE.Vector3();
      return raycaster.ray.intersectPlane(plane, target) ? target : null;
    };

    const onMouseDown = (e: MouseEvent) => {
      if (!isPolygonActive()) return;
      if (e.button !== 0) return;
      if (isOverUIRef.current) return;
      if (e.target !== gl.domElement) return;

      const current = stateRef.current;

      if (current.phase === 'idle') {
        const hit = castToGroundOrSurface(e.clientX, e.clientY, camera, gl.domElement, getSceneMeshes());
        if (!hit) return;
        const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(hit.normal, hit.point);
        setState({
          phase: 'drawing',
          points: [hit.point.clone()],
          hoverPoint: hit.point.clone(),
          plane,
          normal: hit.normal.clone().normalize(),
          extrusion: 0.5,
        });
        return;
      }

      if (current.phase === 'drawing') {
        if (!current.plane) return;
        const point = castToPlane(e.clientX, e.clientY, current.plane);
        if (!point) return;
        const prev = current.points[current.points.length - 1];
        if (prev && prev.distanceTo(point) < 1e-4) return;
        setState({ ...current, points: [...current.points, point.clone()], hoverPoint: point.clone() });
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isPolygonActive()) return;
      const current = stateRef.current;
      if (current.phase === 'drawing') {
        if (!current.plane) return;
        const point = castToPlane(e.clientX, e.clientY, current.plane);
        if (!point) return;
        setState({ ...current, hoverPoint: point.clone() });
      } else if (current.phase === 'extruding') {
        const sensitivity = e.shiftKey ? 0.002 : 0.01;
        setState({ ...current, extrusion: current.extrusion + e.movementY * sensitivity });
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (!isPolygonActive()) return;
      const current = stateRef.current;

      if (e.key === 'Escape') {
        setState(INITIAL);
        return;
      }

      if (e.key === 'Enter') {
        if (current.phase === 'drawing') {
          if (current.points.length >= 3) {
            setState({ ...current, phase: 'extruding' });
          }
        } else if (current.phase === 'extruding') {
          commitPolygon(current.points, current.normal, current.extrusion);
          setState(INITIAL);
        }
      }
    };

    const onBrushChange = useQuickBrushStore.subscribe((s) => {
      if (s.activeBrush !== 'polygon') setState(INITIAL);
    });

    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      onBrushChange();
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [camera, gl, scene]);

  useEffect(() => {
    const onEnter = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      isOverUIRef.current = target !== gl.domElement;
    };
    document.addEventListener('mouseover', onEnter);
    return () => document.removeEventListener('mouseover', onEnter);
  }, [gl]);

  const linePositions = useMemo(() => {
    const points = state.points;
    if (points.length < 2) return new Float32Array(0);
    const arr: number[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      arr.push(points[i].x, points[i].y, points[i].z, points[i + 1].x, points[i + 1].y, points[i + 1].z);
    }
    arr.push(points[points.length - 1].x, points[points.length - 1].y, points[points.length - 1].z, points[0].x, points[0].y, points[0].z);
    return new Float32Array(arr);
  }, [state.points]);

  const nextLinePositions = useMemo(() => {
    if (state.phase !== 'drawing') return new Float32Array(0);
    if (!state.hoverPoint || state.points.length === 0) return new Float32Array(0);
    const last = state.points[state.points.length - 1];
    return new Float32Array([
      last.x, last.y, last.z,
      state.hoverPoint.x, state.hoverPoint.y, state.hoverPoint.z,
    ]);
  }, [state.phase, state.points, state.hoverPoint]);

  const pointPositions = useMemo(() => {
    if (state.points.length === 0) return new Float32Array(0);
    const arr: number[] = [];
    for (const p of state.points) arr.push(p.x, p.y, p.z);
    return new Float32Array(arr);
  }, [state.points]);

  const extrusionGeometry = useMemo(() => {
    if (state.phase !== 'extruding' || state.points.length < 3) return null;
    return buildExtrudedPolygonGeometry(state.points, state.normal, state.extrusion);
  }, [state.phase, state.points, state.normal, state.extrusion]);

  useEffect(() => {
    return () => {
      extrusionGeometry?.dispose();
    };
  }, [extrusionGeometry]);

  const active = viewMode === 'brush' && activeBrush === 'polygon';
  if (!active) return null;

  return (
    <group>
      {linePositions.length > 0 && (
        <lineSegments>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[linePositions, 3]} />
          </bufferGeometry>
          <lineBasicMaterial color="#ffffff" transparent opacity={0.9} />
        </lineSegments>
      )}

      {nextLinePositions.length > 0 && (
        <lineSegments>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[nextLinePositions, 3]} />
          </bufferGeometry>
          <lineBasicMaterial color="#8ecae6" transparent opacity={0.95} />
        </lineSegments>
      )}

      {pointPositions.length > 0 && (
        <points>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[pointPositions, 3]} />
          </bufferGeometry>
          <pointsMaterial color="#ffd166" size={8} sizeAttenuation={false} />
        </points>
      )}

      {extrusionGeometry && (
        <mesh geometry={extrusionGeometry}>
          <meshStandardMaterial color="#ffffff" transparent opacity={0.2} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
};

export default PolygonBrushHandler;

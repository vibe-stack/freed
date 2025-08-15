'use client';

import React, { useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, GizmoHelper, GizmoViewport } from '@react-three/drei';
import { Color, DoubleSide, BufferGeometry, Float32BufferAttribute, MeshStandardMaterial, Vector3 } from 'three';
import { useViewportStore } from '../stores/viewport-store';
import { useGeometryStore } from '../stores/geometry-store';
import { useSceneStore } from '../stores/scene-store';
import { useSelection, useSelectionStore } from '../stores/selection-store';
import { convertQuadToTriangles } from '../utils/geometry';
import EditModeOverlay from './edit-mode-overlay';

const CalmBg: React.FC = () => {
  // Hardcode Blender-like dark gray for test
  return <color attach="background" args={[new Color('#232323')]} />;
};

function CameraController() {
  const cameraState = useViewportStore(s => s.camera);
  const setCamera = useViewportStore(s => s.setCamera);
  const { camera } = useThree();

  React.useEffect(() => {
    camera.position.set(cameraState.position.x, cameraState.position.y, cameraState.position.z);
    camera.lookAt(cameraState.target.x, cameraState.target.y, cameraState.target.z);
    // @ts-ignore
    camera.fov = cameraState.fov;
    camera.near = cameraState.near;
    camera.far = cameraState.far;
    camera.updateProjectionMatrix();
  }, [camera, cameraState]);

  useFrame(() => {
    const current = useViewportStore.getState().camera.position;
    const x = camera.position.x, y = camera.position.y, z = camera.position.z;
    // Only update if camera actually moved beyond a tiny threshold
    if (Math.abs(current.x - x) > 1e-5 || Math.abs(current.y - y) > 1e-5 || Math.abs(current.z - z) > 1e-5) {
      setCamera({ position: { x, y, z } as any });
    }
  });

  return null;
}

function MeshView({ objectId }: { objectId: string }) {
  const scene = useSceneStore();
  const geometryStore = useGeometryStore();
  const selection = useSelection();
  const selectionActions = useSelectionStore();
  const obj = scene.objects[objectId];
  const mesh = obj?.meshId ? geometryStore.meshes.get(obj.meshId) : undefined;
  const shading = useViewportStore(s => s.shadingMode);
  const isSelected = selection.objectIds.includes(objectId);

  const { geom, mat } = useMemo(() => {
    if (!mesh) return { geom: undefined, mat: undefined } as any;

    const geo = new BufferGeometry();

    const vertexMap = new Map(mesh.vertices.map(v => [v.id, v] as const));
  const positions: number[] = [];
  const normals: number[] = [];

    mesh.faces.forEach(face => {
      const tris = convertQuadToTriangles(face.vertexIds);
      tris.forEach(tri => {
        const v0 = vertexMap.get(tri[0])!;
        const v1 = vertexMap.get(tri[1])!;
        const v2 = vertexMap.get(tri[2])!;
        const p0 = new Vector3(v0.position.x, v0.position.y, v0.position.z);
        const p1 = new Vector3(v1.position.x, v1.position.y, v1.position.z);
        const p2 = new Vector3(v2.position.x, v2.position.y, v2.position.z);
        const faceNormal = new Vector3().subVectors(p1, p0).cross(new Vector3().subVectors(p2, p0)).normalize();
        // Push triangle with flat normals
        positions.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
        for (let i = 0; i < 3; i++) normals.push(faceNormal.x, faceNormal.y, faceNormal.z);
      });
    });

    geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new Float32BufferAttribute(normals, 3));
    geo.computeBoundingSphere();

    const material = new MeshStandardMaterial({
      color: new Color(isSelected ? 0.45 : 0.8, isSelected ? 0.65 : 0.8, isSelected ? 1.0 : 0.85),
      roughness: 0.8,
      metalness: 0.05,
      wireframe: shading === 'wireframe',
      side: DoubleSide,
      flatShading: true,
    });

    return { geom: geo, mat: material };
  }, [mesh, shading, isSelected]);

  if (!obj || !mesh || !geom || !mat) return null as any;

  const onPointerDown = (e: any) => {
    if (selection.viewMode === 'object') {
      e.stopPropagation();
      scene.selectObject(objectId);
      selectionActions.selectObjects([objectId]);
    }
  };

  const onDoubleClick = (e: any) => {
    e.stopPropagation();
    if (selection.viewMode === 'object' && obj.meshId) {
      selectionActions.enterEditMode(obj.meshId);
    }
  };

  return (
    <group
      position={[obj.transform.position.x, obj.transform.position.y, obj.transform.position.z]}
      rotation={[obj.transform.rotation.x, obj.transform.rotation.y, obj.transform.rotation.z]}
      scale={[obj.transform.scale.x, obj.transform.scale.y, obj.transform.scale.z]}
      visible={obj.visible}
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
    >
      {/* In edit mode, keep mesh visible but disable raycasting so overlay receives events */}
      {/* @ts-ignore */}
      <mesh
        geometry={geom}
        material={mat as any}
        raycast={selection.viewMode === 'edit' ? ((_: any, __: any) => {}) : undefined}
      />
    </group>
  );
}

const SceneContent: React.FC = () => {
  const scene = useSceneStore();
  const viewport = useViewportStore();
  const selection = useSelection();

  return (
    <>
      {viewport.showGrid && (
        <Grid
          infiniteGrid
          args={[10, 10]}
          position={[0, -0.001, 0]}
          cellColor="rgba(60, 60, 60, 0.35)" // minor lines, subtle gray
          sectionColor="rgba(100, 100, 100, 0.6)" // major lines, slightly lighter
        />
      )}
      {viewport.showAxes && (
        <GizmoHelper alignment="top-left" margin={[80, 80]}>
          <GizmoViewport labelColor="white" axisHeadScale={1} />
        </GizmoHelper>
      )}
      {scene.rootObjects.map(id => (
        <MeshView key={id} objectId={id} />
      ))}
      
      {/* Edit Mode Overlay - only show when in edit mode */}
      {selection.viewMode === 'edit' && <EditModeOverlay />}
    </>
  );
};

const EditorViewport: React.FC = () => {
  const camera = useViewportStore(s => s.camera);

  return (
    <div className="absolute inset-0">
      <Canvas
        camera={{ fov: camera.fov, near: camera.near, far: camera.far, position: [camera.position.x, camera.position.y, camera.position.z] }}
        dpr={[0.2, 2]}
        raycaster={{ params: { Line2: { threshold: 0.1 }, Line: { threshold: 0.1 } } as any }}
      >
        <CalmBg />
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 8, 3]} intensity={0.8} />
        <CameraController />
        <OrbitControls makeDefault target={[camera.target.x, camera.target.y, camera.target.z]} enableDamping dampingFactor={0.1} />
        <SceneContent />
      </Canvas>
    </div>
  );
};

export default EditorViewport;

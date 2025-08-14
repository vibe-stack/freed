'use client';

import React, { useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, GizmoHelper, GizmoViewport } from '@react-three/drei';
import { Color, DoubleSide, BufferGeometry, Float32BufferAttribute, MeshStandardMaterial } from 'three';
import { useViewportStore } from '../stores/viewportStore';
import { useGeometryStore } from '../stores/geometryStore';
import { useSceneStore } from '../stores/sceneStore';
import { useSelection, useSelectionStore } from '../stores/selectionStore';
import { convertQuadToTriangles } from '../utils/geometry';

const CalmBg: React.FC = () => {
  const bg = useViewportStore(s => s.backgroundColor);
  return <color attach="background" args={[new Color(bg.x, bg.y, bg.z)]} />;
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
    const pos = { x: camera.position.x, y: camera.position.y, z: camera.position.z } as any;
    setCamera({ position: pos });
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
        tri.forEach(vId => {
          const v = vertexMap.get(vId)!;
          positions.push(v.position.x, v.position.y, v.position.z);
          normals.push(v.normal.x, v.normal.y, v.normal.z);
        });
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
    });

    return { geom: geo, mat: material };
  }, [mesh, shading, isSelected]);

  if (!obj || !mesh || !geom || !mat) return null as any;

  const onPointerDown = (e: any) => {
    e.stopPropagation();
    if (selection.viewMode === 'object') {
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
      {/* @ts-ignore */}
      <mesh geometry={geom} material={mat as any} />
    </group>
  );
}

const SceneContent: React.FC = () => {
  const scene = useSceneStore();
  const viewport = useViewportStore();

  return (
    <>
      {viewport.showGrid && (
        <Grid infiniteGrid args={[10, 10]} position={[0, -0.001, 0]} cellColor="#2a2f38" sectionColor="#3a414f" />
      )}
      {viewport.showAxes && (
        <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
          <GizmoViewport labelColor="white" axisHeadScale={1} />
        </GizmoHelper>
      )}
      {scene.rootObjects.map(id => (
        <MeshView key={id} objectId={id} />
      ))}
    </>
  );
};

const EditorViewport: React.FC = () => {
  const camera = useViewportStore(s => s.camera);

  return (
    <div className="absolute inset-0">
      <Canvas camera={{ fov: camera.fov, near: camera.near, far: camera.far, position: [camera.position.x, camera.position.y, camera.position.z] }} dpr={[1, 2]}>
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

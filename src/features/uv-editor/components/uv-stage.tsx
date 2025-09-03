"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { Mesh as MeshType } from '@/types/geometry';
import { getOrCreateDownloadUrl } from '@/stores/files-store';

type StageProps = {
  mesh?: MeshType;
  selected: Set<string>;
  pan: { x: number; y: number };
  zoom: number; // pixels per UV unit
  textureFileId?: string;
  className?: string;
  style?: React.CSSProperties;
};

function OrthoSizer() {
  const { camera, size } = useThree((s) => ({ camera: s.camera as THREE.OrthographicCamera, size: s.size }));
  // Configure camera to pixel space so 1 world unit == 1 CSS pixel
  if ((camera as any).isOrthographicCamera) {
    camera.left = -size.width / 2;
    camera.right = size.width / 2;
    camera.top = size.height / 2;
    camera.bottom = -size.height / 2;
    camera.near = -1000;
    camera.far = 1000;
    camera.position.set(0, 0, 10);
    camera.updateProjectionMatrix();
  }
  return null;
}

function GridLines({ zoom }: { zoom: number }) {
  // Build simple grid -10..10 in UV units; group scaling maps to pixels
  const { positions, colors } = useMemo(() => {
    const verts: number[] = [];
    const cols: number[] = [];
    const pushLine = (x1: number, y1: number, x2: number, y2: number, a: number) => {
      verts.push(x1, y1, 0, x2, y2, 0);
      for (let i = 0; i < 2; i++) cols.push(1, 1, 1, a);
    };
    for (let i = -10; i <= 10; i++) {
      pushLine(i, -10, i, 10, 0.1); // vertical
      pushLine(-10, i, 10, i, 0.1); // horizontal
    }
    // 0..1 box highlighted
    pushLine(0, 0, 1, 0, 0.8);
    pushLine(1, 0, 1, 1, 0.8);
    pushLine(1, 1, 0, 1, 0.8);
    pushLine(0, 1, 0, 0, 0.8);
    return { positions: new Float32Array(verts), colors: new Float32Array(cols) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom]);

  return (
    <lineSegments>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 4]} />
      </bufferGeometry>
      <lineBasicMaterial vertexColors transparent />
    </lineSegments>
  );
}

function MeshUV({ mesh, selected, zoom }: { mesh?: MeshType; selected: Set<string>; zoom: number }) {
  const linesPos = useMemo(() => {
    if (!mesh) return new Float32Array();
    // Prefer unique edges to avoid double draw
    const vmap = new Map(mesh.vertices.map((v) => [v.id, v] as const));
    const verts: number[] = [];
    if (mesh.edges && mesh.edges.length) {
      for (const e of mesh.edges) {
        const a = vmap.get(e.vertexIds[0]);
        const b = vmap.get(e.vertexIds[1]);
        if (!a || !b) continue;
        verts.push(a.uv.x, a.uv.y, 0, b.uv.x, b.uv.y, 0);
      }
    } else {
      // Fallback: build from faces
      for (const f of mesh.faces) {
        for (let i = 0; i < f.vertexIds.length; i++) {
          const a = vmap.get(f.vertexIds[i])!;
          const b = vmap.get(f.vertexIds[(i + 1) % f.vertexIds.length])!;
          verts.push(a.uv.x, a.uv.y, 0, b.uv.x, b.uv.y, 0);
        }
      }
    }
    return new Float32Array(verts);
  }, [mesh]);

  const points = useMemo(() => {
    if (!mesh) return { sel: new Float32Array(), rest: new Float32Array() };
    const sel: number[] = [];
    const rest: number[] = [];
    for (const v of mesh.vertices) {
      const arr = selected.has(v.id) ? sel : rest;
      arr.push(v.uv.x, v.uv.y, 0);
    }
    return { sel: new Float32Array(sel), rest: new Float32Array(rest) };
  }, [mesh, selected, zoom]);

  return (
    <>
      {/* Edges */}
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[linesPos, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color="#cbd5e1" linewidth={1} transparent opacity={0.85} />
      </lineSegments>
      {/* Vertices: rest */}
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[points.rest, 3]} />
        </bufferGeometry>
        {/* Keep point size stable in pixels regardless of zoom */}
        <pointsMaterial color="#e5e7eb" size={Math.max(3, 9 / Math.max(1, zoom))} sizeAttenuation={false} />
      </points>
      {/* Vertices: selected */}
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[points.sel, 3]} />
        </bufferGeometry>
        <pointsMaterial color="#ff6d00" size={Math.max(4, 11 / Math.max(1, zoom))} sizeAttenuation={false} />
      </points>
    </>
  );
}

function TextureTiled({ fileId }: { fileId?: string }) {
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    if (!fileId) { setTex(null); return; }
    const url = getOrCreateDownloadUrl(fileId);
    if (!url) { setTex(null); return; }
    const t = new THREE.Texture();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(40, 40);
    t.magFilter = THREE.LinearFilter as any;
    t.minFilter = (THREE as any).LinearMipmapLinearFilter ?? THREE.LinearFilter;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { (t as any).image = img; t.needsUpdate = true; setTex(t); };
    img.src = url;
    return () => { setTex(null); };
  }, [fileId]);
  if (!tex) return null;
  return (
    <mesh position={[0, 0, -0.1]}>
      <planeGeometry args={[40, 40, 1, 1]} />
      <meshBasicMaterial map={tex} transparent opacity={0.28} />
    </mesh>
  );
}

export const UVStageInner: React.FC<Omit<StageProps, 'className' | 'style'>> = ({ mesh, selected, pan, zoom, textureFileId }) => {
  return (
    // Root in pixel space; child group maps UV units -> pixels and flips Y
    <group position={[pan.x, pan.y, 0]} scale={[zoom, -zoom, 1]}>
      <TextureTiled fileId={textureFileId} />
      <GridLines zoom={zoom} />
      <MeshUV mesh={mesh} selected={selected} zoom={zoom} />
    </group>
  );
};

export const UVStage: React.FC<StageProps> = ({ mesh, selected, pan, zoom, textureFileId, className, style }) => {
  return (
    <Canvas
      className={className}
      style={{ pointerEvents: 'none', ...(style || {}) }}
      orthographic
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      frameloop="always"
    >
      <OrthoSizer />
      <UVStageInner mesh={mesh} selected={selected} pan={pan} zoom={zoom} textureFileId={textureFileId} />
    </Canvas>
  );
};

export default UVStage;

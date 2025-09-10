"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import * as THREE from 'three/webgpu';
import type { Mesh as MeshType } from '@/types/geometry';
import { getOrCreateDownloadUrl } from '@/stores/files-store';

type StageProps = {
  mesh?: MeshType;
  selected: Set<string>;
  pan: { x: number; y: number };
  zoom: number; // pixels per UV unit
  textureFileId?: string;
  // Incrementing number to force recomputation of memoized buffers when geometry mutates in-place
  revision?: number;
  className?: string;
  style?: React.CSSProperties;
};

function OrthoSizer() {
  const { camera, size } = useThree((s) => ({ camera: s.camera as THREE.OrthographicCamera, size: s.size }));
  // Configure camera to match CSS coordinates: Y+ down, origin at top-left
  if ((camera as any).isOrthographicCamera) {
    camera.left = 0;
    camera.right = size.width;
    camera.top = 0;
    camera.bottom = size.height;
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

function MeshUV({ mesh, selected, zoom, revision }: { mesh?: MeshType; selected: Set<string>; zoom: number; revision?: number }) {
  // Edge lines still use face-loop ordering so seams remain visible
  const linesPos = useMemo(() => {
    if (!mesh) return new Float32Array();
    const verts: number[] = [];
    for (const f of mesh.faces) {
      if (!f.uvs) continue;
      const loopCount = f.vertexIds.length;
      for (let i = 0; i < loopCount; i++) {
        const uvA = f.uvs[i];
        const ni = (i + 1) % loopCount;
        const uvB = f.uvs[ni];
        verts.push(uvA.x, uvA.y, 0, uvB.x, uvB.y, 0);
      }
    }
    return new Float32Array(verts);
    //eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesh, revision]);

  // Deduplicate multiple loop UVs that reference the same vertex id (common after introducing per-loop UVs) by
  // collapsing to a single representative point per vertex id (average of contributing loops). This matches
  // Blender's default display where coincident UV loops share a location unless explicitly split by a seam.
  const points = useMemo(() => {
    if (!mesh) return { sel: new Float32Array(), rest: new Float32Array() };
    interface Acc { x: number; y: number; n: number; selected: boolean }
    const acc = new Map<string, Acc>();
    for (const f of mesh.faces) {
      if (!f.uvs) continue;
      for (let i = 0; i < f.vertexIds.length; i++) {
        const vid = f.vertexIds[i];
        const uv = f.uvs[i];
        const a = acc.get(vid);
        if (a) {
          a.x += uv.x; a.y += uv.y; a.n++; // keep selected flag if already selected
        } else {
          acc.set(vid, { x: uv.x, y: uv.y, n: 1, selected: selected.has(vid) });
        }
      }
    }
    const sel: number[] = []; const rest: number[] = [];
    acc.forEach((a) => {
      const x = a.x / a.n; const y = a.y / a.n;
      (a.selected ? sel : rest).push(x, y, 0);
    });
    return { sel: new Float32Array(sel), rest: new Float32Array(rest) };
    //eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesh, selected, revision]);

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

export const UVStageInner: React.FC<Omit<StageProps, 'className' | 'style'>> = ({ mesh, selected, pan, zoom, textureFileId, revision }) => {
  const { size } = useThree();
  // Position UV origin at canvas center, add pan offset, apply zoom
  const groupX = size.width / 2 + pan.x;
  const groupY = size.height / 2 + pan.y;

  return (
    <group position={[groupX, groupY, 0]} scale={[zoom, zoom, 1]}>
      <TextureTiled fileId={textureFileId} />
      <GridLines zoom={zoom} />
      <MeshUV mesh={mesh} selected={selected} zoom={zoom} revision={revision} />
    </group>
  );
}; export const UVStage: React.FC<StageProps> = ({ mesh, selected, pan, zoom, textureFileId, revision, className, style }) => {
  return (
    <Canvas
      className={className}
      style={{ pointerEvents: 'none', ...(style || {}) }}
      orthographic
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
    >

      <OrthoSizer />
      <UVStageInner mesh={mesh} selected={selected} pan={pan} zoom={zoom} textureFileId={textureFileId} revision={revision} />
    </Canvas>
  );
};

export default UVStage;

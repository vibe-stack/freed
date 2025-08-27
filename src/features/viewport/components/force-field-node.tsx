'use client';

import React, { useEffect, useMemo } from 'react';
import { Color, Vector3 as T3V, BufferGeometry, Float32BufferAttribute, LineBasicMaterial, Line as TLine } from 'three/webgpu';
import { useViewportStore } from '@/stores/viewport-store';
import { useForceFieldStore } from '@/stores/force-field-store';

function PolyLine({ points, color, opacity = 0.95 }: { points: [number, number, number][]; color: string | Color; opacity?: number }) {
  const positions = useMemo(() => new Float32Array(points.flat()), [points]);
  const c = typeof color === 'string' ? color : color.getStyle();
  const line = useMemo(() => {
    const geom = new BufferGeometry();
    geom.setAttribute('position', new Float32BufferAttribute(positions, 3));
    const mat = new LineBasicMaterial({ color: c as any, transparent: true, opacity });
    const l = new TLine(geom, mat);
    l.frustumCulled = false;
    return l;
  }, [positions, c, opacity]);
  useEffect(() => () => {
    (line.geometry as BufferGeometry).dispose();
    (line.material as LineBasicMaterial).dispose();
  }, [line]);
  return <primitive object={line} />;
}

function SphereWire({ radius = 1, segments = 12, color = new Color('#66ccff') }: { radius?: number; segments?: number; color?: Color }) {
  const mkRing = (axis: 'x'|'y'|'z') => {
    const points: [number, number, number][] = [];
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      const x = Math.cos(a) * radius;
      const y = Math.sin(a) * radius;
      const p = new T3V();
      if (axis === 'x') p.set(0, x, y);
      else if (axis === 'y') p.set(x, 0, y);
      else p.set(x, y, 0);
      points.push([p.x, p.y, p.z]);
    }
    return <PolyLine key={axis} points={points} color={color.getStyle()} opacity={0.85} />;
  };
  return <group>
    {mkRing('x')}
    {mkRing('y')}
    {mkRing('z')}
  </group>;
}

function VortexGizmo({ radius = 1, height = 1.6, turns = 3, color = new Color('#66ff99') }: { radius?: number; height?: number; turns?: number; color?: Color }) {
  const helixPoints: [number, number, number][] = [];
  const segments = 96;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const ang = t * turns * Math.PI * 2;
    const x = Math.cos(ang) * radius * (1 - 0.4 * t);
    const y = Math.sin(ang) * radius * (1 - 0.4 * t);
    const z = t * height; // spiral along +Z to match local Z axis
    helixPoints.push([x, y, z]);
  }
  const arrowPoints: [number, number, number][] = [ [0, 0, height], [0, 0, height + 0.4] ];
  const c = color.getStyle();
  return (
    <group>
  <PolyLine points={helixPoints} color={c} opacity={0.95} />
  <PolyLine points={arrowPoints} color={c} opacity={0.95} />
    </group>
  );
}

const ForceFieldNode: React.FC<{ fieldId: string }> = ({ fieldId }) => {
  const shading = useViewportStore((s) => s.shadingMode);
  const field = useForceFieldStore((s) => s.fields[fieldId]);
  if (!field || !field.enabled) return null;
  // Hide in material shading per requirement
  if (shading === 'material') return null;
  if (field.type === 'vortex') {
    return <VortexGizmo radius={field.radius} height={Math.max(1, field.radius * 1.5)} />;
  }
  // Attractor/Repulsor share sphere preview; color differs
  const color = new Color(field.type === 'attractor' ? '#66ccff' : '#ff6699');
  return <SphereWire radius={field.radius} color={color} segments={16} />;
};

export default ForceFieldNode;

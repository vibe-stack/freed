"use client";

// Thin wrapper: groups metaballs and delegates heavy work to colocated components.
import React, { useMemo } from 'react';
import { useMetaballStore } from '@/stores/metaball-store';
import { useSceneStore } from '@/stores/scene-store';
import { useThree } from '@react-three/fiber';
import { WebGPUOptimizedMarchingCubesField } from './metaball-surface/webgpu-optimized-marchingcubes-field';
import { WebGPURenderer } from 'three/webgpu';

const MetaballSurface: React.FC = () => {
    const metaballs = useMetaballStore((s) => s.metaballs);
    const settings = useMetaballStore((s) => s.settings);
    const sceneObjects = useSceneStore((s) => s.objects);
    const { gl } = useThree();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const supportsCompute = (gl as unknown as WebGPURenderer).isWebGPURenderer;

    // Aggregate all systems keyed by material (currently materialId may be undefined => group default)
    const groups = useMemo(() => {
        const map: Record<string, { blobs: any[]; resolution: number; iso: number; smooth: boolean }> = {};
        Object.values(sceneObjects).forEach((o) => {
            if (o.type !== 'metaball' || !o.metaballId) return;
            const m = metaballs[o.metaballId];
            if (!m) return;
            const key = m.materialId || 'default';
            const g = (map[key] ||= { blobs: [], resolution: settings.resolution, iso: settings.isoLevel, smooth: settings.smoothNormals });
            g.blobs.push({ worldPos: { x: o.transform.position.x, y: o.transform.position.y, z: o.transform.position.z }, radius: m.radius, strength: m.strength, color: m.color });
        });
        // console.log('MetaballSurface groups:', Object.keys(map).length, 'total blobs:', Object.values(map).reduce((sum, g) => sum + g.blobs.length, 0));
        return map;
    }, [metaballs, sceneObjects, settings]);

    return (
        <group>
            {Object.entries(groups).map(([key, g]) => (
                <WebGPUOptimizedMarchingCubesField key={key} blobs={g.blobs as any} resolution={g.resolution} iso={g.iso} smooth={g.smooth} />
            ))}
        </group>
    );
};

export default MetaballSurface;

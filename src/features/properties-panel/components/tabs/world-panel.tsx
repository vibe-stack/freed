"use client";

import React from 'react';
import { ColorInput } from '@/components/color-input';
import { DragInput } from '@/components/drag-input';
import Switch from '@/components/switch';
import {
  useWorldStore,
  useEnvironment,
  useBloom,
  useDoF,
  useFog,
  useRendererSettings,
  type EnvPreset,
} from '@/stores/world-store';
import { useViewportStore } from '@/stores/viewport-store';

const Section: React.FC<{ title: string } & React.HTMLAttributes<HTMLDivElement>> = ({ title, children, className = '', ...rest }) => (
  <div className={className} {...rest}>
    <div className="text-xs uppercase tracking-wide text-gray-400 mb-2">{title}</div>
    <div className="bg-white/5 border border-white/10 rounded p-2 space-y-2">{children}</div>
  </div>
);

const Row: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = '', children, ...rest }) => (
  <div className={`flex items-center gap-2 ${className}`} {...rest}>{children}</div>
);

export const WorldPanel: React.FC = () => {
  const env = useEnvironment();
  const bloom = useBloom();
  const dof = useDoF();
  const fog = useFog();
  const renderer = useRendererSettings();
  const world = useWorldStore();
  const bg = useViewportStore((s) => s.backgroundColor);
  const setBg = useViewportStore((s) => s.setBackgroundColor);

  const envPresets: { label: string; value: EnvPreset }[] = [
    { label: 'None', value: 'none' },
    { label: 'Apartment', value: 'apartment' },
    { label: 'City', value: 'city' },
    { label: 'Dawn', value: 'dawn' },
    { label: 'Forest', value: 'forest' },
    { label: 'Lobby', value: 'lobby' },
    { label: 'Night', value: 'night' },
    { label: 'Park', value: 'park' },
    { label: 'Studio', value: 'studio' },
    { label: 'Sunset', value: 'sunset' },
    { label: 'Warehouse', value: 'warehouse' },
  ];

  const kernelSizes: Array<{ label: string; value: typeof bloom.kernelSize }> = [
    { label: 'Very Small', value: 'VERY_SMALL' },
    { label: 'Small', value: 'SMALL' },
    { label: 'Medium', value: 'MEDIUM' },
    { label: 'Large', value: 'LARGE' },
    { label: 'Huge', value: 'HUGE' },
  ];

  const blendFunctions: Array<{ label: string; value: typeof bloom.blendFunction }> = [
    { label: 'Normal', value: 'NORMAL' },
    { label: 'Screen', value: 'SCREEN' },
    { label: 'Add', value: 'ADD' },
    { label: 'Multiply', value: 'MULTIPLY' },
    { label: 'Overlay', value: 'OVERLAY' },
    { label: 'Soft Light', value: 'SOFT_LIGHT' },
    { label: 'Darken', value: 'DARKEN' },
    { label: 'Lighten', value: 'LIGHTEN' },
    { label: 'Color Dodge', value: 'COLOR_DODGE' },
    { label: 'Color Burn', value: 'COLOR_BURN' },
    { label: 'Hard Light', value: 'HARD_LIGHT' },
    { label: 'Difference', value: 'DIFFERENCE' },
    { label: 'Exclusion', value: 'EXCLUSION' },
    { label: 'Hue', value: 'HUE' },
    { label: 'Saturation', value: 'SATURATION' },
    { label: 'Color', value: 'COLOR' },
    { label: 'Luminosity', value: 'LUMINOSITY' },
    { label: 'Alpha', value: 'ALPHA' },
    { label: 'Negation', value: 'NEGATION' },
    { label: 'Subtract', value: 'SUBTRACT' },
    { label: 'Divide', value: 'DIVIDE' },
    { label: 'Vivid Light', value: 'VIVID_LIGHT' },
  ];

  const toneMappings = [
    'None',
    'Linear',
    'Reinhard',
    'Cineon',
    'ACESFilmic',
  ] as const;

  const shadowTypes = ['Basic', 'PCF', 'PCFSoft'] as const;

  return (
    <div className="p-3 space-y-4 text-gray-200 text-sm">
      <Section title="Environment">
        <Row>
          <div className="w-24 text-xs text-gray-400">Preset</div>
          <select
            value={env}
            onChange={(e) => world.setEnvironment(e.target.value as EnvPreset)}
            className="flex-1 h-7 bg-black/40 border border-white/10 rounded px-2 text-xs"
          >
            {envPresets.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </Row>
      </Section>

      <Section title="Background">
        <ColorInput label="Color" value={bg} onChange={(v) => setBg([v.x, v.y, v.z])} />
      </Section>

      <Section title="Bloom">
        <Row>
          <div className="w-24 text-xs text-gray-400">Enabled</div>
          <Switch checked={bloom.enabled} onCheckedChange={(v) => world.setBloom({ enabled: v })} />
        </Row>
        <DragInput label="Intensity" value={bloom.intensity} onChange={(v) => world.setBloom({ intensity: v })} step={0.05} precision={2} />
        <DragInput label="Threshold" value={bloom.luminanceThreshold} onChange={(v) => world.setBloom({ luminanceThreshold: Math.min(1, Math.max(0, v)) })} step={0.01} precision={3} />
        <DragInput label="Smoothing" value={bloom.luminanceSmoothing} onChange={(v) => world.setBloom({ luminanceSmoothing: Math.min(1, Math.max(0, v)) })} step={0.01} precision={3} />
        <Row>
          <div className="w-24 text-xs text-gray-400">Mipmap Blur</div>
          <Switch checked={bloom.mipmapBlur} onCheckedChange={(v) => world.setBloom({ mipmapBlur: v })} />
        </Row>
        <Row>
          <div className="w-24 text-xs text-gray-400">Kernel</div>
          <select
            value={bloom.kernelSize}
            onChange={(e) => world.setBloom({ kernelSize: e.target.value as any })}
            className="flex-1 h-7 bg-black/40 border border-white/10 rounded px-2 text-xs"
          >
            {kernelSizes.map((k) => (
              <option key={k.value} value={k.value}>{k.label}</option>
            ))}
          </select>
        </Row>
  <DragInput label="Res X" value={bloom.resolutionX} onChange={(v) => world.setBloom({ resolutionX: Math.max(0, Math.round(v)) })} step={8} precision={0} />
  <DragInput label="Res Y" value={bloom.resolutionY} onChange={(v) => world.setBloom({ resolutionY: Math.max(0, Math.round(v)) })} step={8} precision={0} />
        <Row>
          <div className="w-24 text-xs text-gray-400">Blend</div>
          <select
            value={bloom.blendFunction}
            onChange={(e) => world.setBloom({ blendFunction: e.target.value as any })}
            className="flex-1 h-7 bg-black/40 border border-white/10 rounded px-2 text-xs"
          >
            {blendFunctions.map((b) => (
              <option key={b.value} value={b.value}>{b.label}</option>
            ))}
          </select>
        </Row>
      </Section>

      <Section title="Depth of Field">
        <Row>
          <div className="w-24 text-xs text-gray-400">Enabled</div>
          <Switch checked={dof.enabled} onCheckedChange={(v) => world.setDoF({ enabled: v })} />
        </Row>
        <DragInput label="Focus Dist" value={dof.focusDistance} onChange={(v) => world.setDoF({ focusDistance: Math.min(1, Math.max(0, v)) })} step={0.01} precision={3} />
        <DragInput label="Focal Len" value={dof.focalLength} onChange={(v) => world.setDoF({ focalLength: Math.min(1, Math.max(0, v)) })} step={0.001} precision={3} />
        <DragInput label="Bokeh" value={dof.bokehScale} onChange={(v) => world.setDoF({ bokehScale: Math.max(0, v) })} step={0.1} precision={2} />
        <Row>
          <div className="w-24 text-xs text-gray-400">Blend</div>
          <select
            value={dof.blendFunction}
            onChange={(e) => world.setDoF({ blendFunction: e.target.value as any })}
            className="flex-1 h-7 bg-black/40 border border-white/10 rounded px-2 text-xs"
          >
            {blendFunctions.map((b) => (
              <option key={b.value} value={b.value}>{b.label}</option>
            ))}
          </select>
        </Row>
      </Section>

      <Section title="Fog">
        <Row>
          <div className="w-24 text-xs text-gray-400">Type</div>
          <select
            value={fog.type}
            onChange={(e) => world.setFog({ type: e.target.value as any })}
            className="flex-1 h-7 bg-black/40 border border-white/10 rounded px-2 text-xs"
          >
            <option value="none">None</option>
            <option value="linear">Linear</option>
            <option value="exp2">Exponential²</option>
          </select>
        </Row>
        <ColorInput label="Color" value={fog.color} onChange={(v) => world.setFog({ color: v })} />
        {fog.type === 'linear' && (
          <>
            <DragInput label="Near" value={fog.near} onChange={(v) => world.setFog({ near: Math.max(0, v) })} step={0.1} precision={2} />
            <DragInput label="Far" value={fog.far} onChange={(v) => world.setFog({ far: Math.max(0, v) })} step={0.1} precision={2} />
          </>
        )}
        {fog.type === 'exp2' && (
          <DragInput label="Density" value={fog.density} onChange={(v) => world.setFog({ density: Math.max(0, v) })} step={0.001} precision={3} />
        )}
      </Section>

      <Section title="Renderer">
        <Row>
          <div className="w-24 text-xs text-gray-400">Tone Map</div>
          <select
            value={renderer.toneMapping}
            onChange={(e) => world.setRenderer({ toneMapping: e.target.value as any })}
            className="flex-1 h-7 bg-black/40 border border-white/10 rounded px-2 text-xs"
          >
            {toneMappings.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </Row>
        <DragInput label="Exposure" value={renderer.exposure} onChange={(v) => world.setRenderer({ exposure: Math.max(0, v) })} step={0.05} precision={2} />
        <Row>
          <div className="w-24 text-xs text-gray-400">Phys Lights</div>
          <Switch checked={renderer.physicallyCorrectLights} onCheckedChange={(v) => world.setRenderer({ physicallyCorrectLights: v })} />
        </Row>
        <Row>
          <div className="w-24 text-xs text-gray-400">Shadows</div>
          <Switch checked={renderer.shadows} onCheckedChange={(v) => world.setRenderer({ shadows: v })} />
        </Row>
        <Row>
          <div className="w-24 text-xs text-gray-400">Shadow Type</div>
          <select
            value={renderer.shadowType}
            onChange={(e) => world.setRenderer({ shadowType: e.target.value as any })}
            className="flex-1 h-7 bg-black/40 border border-white/10 rounded px-2 text-xs"
          >
            {shadowTypes.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </Row>
      </Section>
    </div>
  );
};

export default WorldPanel;

'use client';

import React, { useEffect } from 'react';
import { useShapeCreationStore } from '@/stores/shape-creation-store';

const NumInput: React.FC<{
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
}> = ({ value, min = 1, max = 256, step = 1, onChange }) => {
  const [text, setText] = React.useState<string>(String(value));
  React.useEffect(() => {
    // Sync external value if it changes from store updates
    setText(String(value));
  }, [value]);

  const commit = (raw: string) => {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) {
      let v = parsed;
      if (min !== undefined) v = Math.max(min, v);
      if (max !== undefined) v = Math.min(max, v);
      onChange(v);
      setText(String(v));
    } else {
      // Restore last valid value
      setText(String(value));
    }
  };

  return (
    <input
      type="number"
      min={min}
      max={max}
      step={step}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit((e.target as HTMLInputElement).value);
      }}
      className="w-20 px-2 py-1 text-xs bg-black/30 border border-white/10 rounded text-gray-100"
    />
  );
};

const PanelRow: React.FC<{children: React.ReactNode}> = ({ children }) => (
  <div className="flex items-end gap-3">{children}</div>
);

const ShapeAdjustPanel: React.FC = () => {
  const { active, shape, params, applyParams, finalize, cancel } = useShapeCreationStore();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!active) return;
      if (e.key === 'Enter') { e.preventDefault(); finalize(); }
      if (e.key === 'Escape') { e.preventDefault(); cancel(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [active, finalize, cancel]);

  if (!active || !shape) return null;

  return (
    <div className="pointer-events-auto bg-black/50 backdrop-blur-md border border-white/10 rounded-xl shadow-lg shadow-black/30 px-3 py-2">
      <div className="flex items-center gap-4">
        <div className="text-xs text-gray-200/90 min-w-[90px]">{shape.toUpperCase()}</div>

        {shape === 'cube' && (
          <PanelRow>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-gray-300/80 mb-1">Size</div>
              <NumInput value={params.size ?? 1.5} min={0.1} step={0.1} onChange={(v) => applyParams({ size: v })} />
            </div>
          </PanelRow>
        )}

        {shape === 'plane' && (
          <PanelRow>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-gray-300/80 mb-1">Width</div>
              <NumInput value={params.width ?? 2} min={0.01} step={0.1} onChange={(v) => applyParams({ width: Math.max(0.01, v) })} />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-gray-300/80 mb-1">Height</div>
              <NumInput value={params.height ?? 2} min={0.01} step={0.1} onChange={(v) => applyParams({ height: Math.max(0.01, v) })} />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-gray-300/80 mb-1">Width Segments</div>
              <NumInput value={params.widthSegments ?? 1} onChange={(v) => applyParams({ widthSegments: Math.max(1, Math.floor(v)) })} />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-gray-300/80 mb-1">Height Segments</div>
              <NumInput value={params.heightSegments ?? 1} onChange={(v) => applyParams({ heightSegments: Math.max(1, Math.floor(v)) })} />
            </div>
          </PanelRow>
        )}

        {shape === 'cylinder' && (
          <PanelRow>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-gray-300/80 mb-1">Top Radius</div>
              <NumInput value={params.radiusTop ?? 0.75} min={0} step={0.05} onChange={(v) => applyParams({ radiusTop: Math.max(0, v) })} />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-gray-300/80 mb-1">Bottom Radius</div>
              <NumInput value={params.radiusBottom ?? 0.75} min={0} step={0.05} onChange={(v) => applyParams({ radiusBottom: Math.max(0, v) })} />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-gray-300/80 mb-1">Height</div>
              <NumInput value={params.cylHeight ?? 2} min={0.01} step={0.1} onChange={(v) => applyParams({ cylHeight: Math.max(0.01, v) })} />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-gray-300/80 mb-1">Radial Segments</div>
              <NumInput value={params.radialSegments ?? 24} onChange={(v) => applyParams({ radialSegments: Math.max(3, Math.floor(v)) })} />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-gray-300/80 mb-1">Height Segments</div>
              <NumInput value={params.cylHeightSegments ?? 1} onChange={(v) => applyParams({ cylHeightSegments: Math.max(1, Math.floor(v)) })} />
            </div>
          </PanelRow>
        )}

        {shape === 'cone' && (
          <PanelRow>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-gray-300/80 mb-1">Radius</div>
              <NumInput value={params.radius ?? 0.9} min={0} step={0.05} onChange={(v) => applyParams({ radius: Math.max(0, v) })} />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-gray-300/80 mb-1">Height</div>
              <NumInput value={params.cylHeight ?? 2} min={0.01} step={0.1} onChange={(v) => applyParams({ cylHeight: Math.max(0.01, v) })} />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-gray-300/80 mb-1">Radial Segments</div>
              <NumInput value={params.radialSegments ?? 24} onChange={(v) => applyParams({ radialSegments: Math.max(3, Math.floor(v)) })} />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-gray-300/80 mb-1">Height Segments</div>
              <NumInput value={params.cylHeightSegments ?? 1} onChange={(v) => applyParams({ cylHeightSegments: Math.max(1, Math.floor(v)) })} />
            </div>
          </PanelRow>
        )}

        {shape === 'uvsphere' && (
          <PanelRow>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-gray-300/80 mb-1">Radius</div>
              <NumInput value={params.radius ?? 1} min={0.01} step={0.05} onChange={(v) => applyParams({ radius: Math.max(0.01, v) })} />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-gray-300/80 mb-1">Width Segments</div>
              <NumInput value={params.sphereWidthSegments ?? 24} onChange={(v) => applyParams({ sphereWidthSegments: Math.max(3, Math.floor(v)) })} />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-gray-300/80 mb-1">Height Segments</div>
              <NumInput value={params.sphereHeightSegments ?? 16} onChange={(v) => applyParams({ sphereHeightSegments: Math.max(2, Math.floor(v)) })} />
            </div>
          </PanelRow>
        )}

        {shape === 'icosphere' && (
          <PanelRow>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-gray-300/80 mb-1">Radius</div>
              <NumInput value={params.radius ?? 1} min={0.01} step={0.05} onChange={(v) => applyParams({ radius: Math.max(0.01, v) })} />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-gray-300/80 mb-1">Subdivisions</div>
              <NumInput value={params.subdivisions ?? 1} onChange={(v) => applyParams({ subdivisions: Math.max(0, Math.floor(v)) })} />
            </div>
          </PanelRow>
        )}

        {shape === 'torus' && (
          <PanelRow>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-gray-300/80 mb-1">Ring Radius</div>
              <NumInput value={params.ringRadius ?? 1.2} min={0.01} step={0.05} onChange={(v) => applyParams({ ringRadius: Math.max(0.01, v) })} />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-gray-300/80 mb-1">Tube Radius</div>
              <NumInput value={params.tubeRadius ?? 0.35} min={0.01} step={0.05} onChange={(v) => applyParams({ tubeRadius: Math.max(0.01, v) })} />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-gray-300/80 mb-1">Radial Segments</div>
              <NumInput value={params.torusRadialSegments ?? 16} onChange={(v) => applyParams({ torusRadialSegments: Math.max(3, Math.floor(v)) })} />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-gray-300/80 mb-1">Tubular Segments</div>
              <NumInput value={params.torusTubularSegments ?? 24} onChange={(v) => applyParams({ torusTubularSegments: Math.max(3, Math.floor(v)) })} />
            </div>
          </PanelRow>
        )}

        <div className="ml-2 flex items-center gap-2">
          <button onClick={finalize} className="px-2 py-1 text-xs rounded bg-white/10 hover:bg-white/15 text-gray-100">Apply (Enter)</button>
          <button onClick={cancel} className="px-2 py-1 text-xs rounded bg-white/5 hover:bg-white/10 text-gray-300">✕</button>
        </div>
      </div>
    </div>
  );
};

export default ShapeAdjustPanel;

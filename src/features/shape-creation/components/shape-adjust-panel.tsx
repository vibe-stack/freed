'use client';

import React, { useEffect } from 'react';
import { useShapeCreationStore } from '@/stores/shape-creation-store';
import { DragInput } from '@/components/drag-input';

// ...removed one-off NumInput in favor of shared DragInput

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
              <DragInput compact value={params.size ?? 1.5} min={0.1} step={0.1} precision={2} onChange={(v) => applyParams({ size: Math.max(0.1, v) })} />
            </div>
          </PanelRow>
        )}

        {shape === 'plane' && (
          <PanelRow>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-gray-300/80 mb-1">Width</div>
              <DragInput compact value={params.width ?? 2} min={0.01} step={0.1} precision={2} onChange={(v) => applyParams({ width: Math.max(0.01, v) })} />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-gray-300/80 mb-1">Height</div>
              <DragInput compact value={params.height ?? 2} min={0.01} step={0.1} precision={2} onChange={(v) => applyParams({ height: Math.max(0.01, v) })} />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-gray-300/80 mb-1">Width Segments</div>
              <DragInput compact value={params.widthSegments ?? 1} step={1} precision={0} onChange={(v) => applyParams({ widthSegments: Math.max(1, Math.floor(v)) })} />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-gray-300/80 mb-1">Height Segments</div>
              <DragInput compact value={params.heightSegments ?? 1} step={1} precision={0} onChange={(v) => applyParams({ heightSegments: Math.max(1, Math.floor(v)) })} />
            </div>
          </PanelRow>
        )}

        {shape === 'cylinder' && (
          <PanelRow>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-gray-300/80 mb-1">Top Radius</div>
              <DragInput compact value={params.radiusTop ?? 0.75} min={0} step={0.05} precision={2} onChange={(v) => applyParams({ radiusTop: Math.max(0, v) })} />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-gray-300/80 mb-1">Bottom Radius</div>
              <DragInput compact value={params.radiusBottom ?? 0.75} min={0} step={0.05} precision={2} onChange={(v) => applyParams({ radiusBottom: Math.max(0, v) })} />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-gray-300/80 mb-1">Height</div>
              <DragInput compact value={params.cylHeight ?? 2} min={0.01} step={0.1} precision={2} onChange={(v) => applyParams({ cylHeight: Math.max(0.01, v) })} />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-gray-300/80 mb-1">Radial Segments</div>
              <DragInput compact value={params.radialSegments ?? 24} step={1} precision={0} onChange={(v) => applyParams({ radialSegments: Math.max(3, Math.floor(v)) })} />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-gray-300/80 mb-1">Height Segments</div>
              <DragInput compact value={params.cylHeightSegments ?? 1} step={1} precision={0} onChange={(v) => applyParams({ cylHeightSegments: Math.max(1, Math.floor(v)) })} />
            </div>
          </PanelRow>
        )}

        {shape === 'cone' && (
          <PanelRow>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-gray-300/80 mb-1">Radius</div>
              <DragInput compact value={params.radius ?? 0.9} min={0} step={0.05} precision={2} onChange={(v) => applyParams({ radius: Math.max(0, v) })} />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-gray-300/80 mb-1">Height</div>
              <DragInput compact value={params.cylHeight ?? 2} min={0.01} step={0.1} precision={2} onChange={(v) => applyParams({ cylHeight: Math.max(0.01, v) })} />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-gray-300/80 mb-1">Radial Segments</div>
              <DragInput compact value={params.radialSegments ?? 24} step={1} precision={0} onChange={(v) => applyParams({ radialSegments: Math.max(3, Math.floor(v)) })} />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-gray-300/80 mb-1">Height Segments</div>
              <DragInput compact value={params.cylHeightSegments ?? 1} step={1} precision={0} onChange={(v) => applyParams({ cylHeightSegments: Math.max(1, Math.floor(v)) })} />
            </div>
          </PanelRow>
        )}

        {shape === 'uvsphere' && (
          <PanelRow>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-gray-300/80 mb-1">Radius</div>
              <DragInput compact value={params.radius ?? 1} min={0.01} step={0.05} precision={2} onChange={(v) => applyParams({ radius: Math.max(0.01, v) })} />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-gray-300/80 mb-1">Width Segments</div>
              <DragInput compact value={params.sphereWidthSegments ?? 24} step={1} precision={0} onChange={(v) => applyParams({ sphereWidthSegments: Math.max(3, Math.floor(v)) })} />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-gray-300/80 mb-1">Height Segments</div>
              <DragInput compact value={params.sphereHeightSegments ?? 16} step={1} precision={0} onChange={(v) => applyParams({ sphereHeightSegments: Math.max(2, Math.floor(v)) })} />
            </div>
          </PanelRow>
        )}

        {shape === 'icosphere' && (
          <PanelRow>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-gray-300/80 mb-1">Radius</div>
              <DragInput compact value={params.radius ?? 1} min={0.01} step={0.05} precision={2} onChange={(v) => applyParams({ radius: Math.max(0.01, v) })} />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-gray-300/80 mb-1">Subdivisions</div>
              <DragInput compact value={params.subdivisions ?? 1} step={1} precision={0} onChange={(v) => applyParams({ subdivisions: Math.max(0, Math.floor(v)) })} />
            </div>
          </PanelRow>
        )}

        {shape === 'torus' && (
          <PanelRow>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-gray-300/80 mb-1">Ring Radius</div>
              <DragInput compact value={params.ringRadius ?? 1.2} min={0.01} step={0.05} precision={2} onChange={(v) => applyParams({ ringRadius: Math.max(0.01, v) })} />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-gray-300/80 mb-1">Tube Radius</div>
              <DragInput compact value={params.tubeRadius ?? 0.35} min={0.01} step={0.05} precision={2} onChange={(v) => applyParams({ tubeRadius: Math.max(0.01, v) })} />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-gray-300/80 mb-1">Radial Segments</div>
              <DragInput compact value={params.torusRadialSegments ?? 16} step={1} precision={0} onChange={(v) => applyParams({ torusRadialSegments: Math.max(3, Math.floor(v)) })} />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-gray-300/80 mb-1">Tubular Segments</div>
              <DragInput compact value={params.torusTubularSegments ?? 24} step={1} precision={0} onChange={(v) => applyParams({ torusTubularSegments: Math.max(3, Math.floor(v)) })} />
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

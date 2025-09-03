'use client';

import React, { useMemo } from 'react';
import { Color, GridHelper, Object3D, type ColorRepresentation } from 'three/webgpu';

type GridProps = {
  // Compatibility props (subset used)
  args?: [number, number]; // [size, divisions]
  infiniteGrid?: boolean; // if true, make it very large
  cellColor?: ColorRepresentation; // maps to grid color
  sectionColor?: ColorRepresentation; // maps to center line color
  // Placement
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number] | number;
  renderOrder?: number;
  frustumCulled?: boolean;
  // Unused drei Grid props accepted as no-ops for API parity
  cellSize?: number;
  sectionSize?: number;
  cellThickness?: number;
  sectionThickness?: number;
  fadeDistance?: number;
  fadeStrength?: number;
  fadeFrom?: number;
  followCamera?: boolean;
};

const toColor = (c: ColorRepresentation | undefined, fallback: string): Color => new Color((c ?? fallback) as any);

const WebGPUGrid = React.forwardRef<Object3D, GridProps>(
  (
    {
      args = [10, 10],
      infiniteGrid = false,
      cellColor = '#3c3c3c',
      sectionColor = '#646464',
      position = [0, 0, 0],
      rotation = [0, 0, 0],
      scale = 1,
      renderOrder = 0,
      frustumCulled = false,
      // no-op props for parity
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      cellSize,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      sectionSize,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      cellThickness,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      sectionThickness,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      fadeDistance,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      fadeStrength,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      fadeFrom,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      followCamera,
      ...rest
    }: GridProps,
  ref: React.ForwardedRef<Object3D>
  ) => {
    const [sizeIn, divisions] = args;
    const size = infiniteGrid ? Math.max(1000, sizeIn) * 100 : sizeIn;

    const helper = useMemo(() => {
WebGPUGrid.displayName = "WebGPUGrid";
      const grid = new GridHelper(size, Math.max(1, divisions), toColor(sectionColor, '#646464'), toColor(cellColor, '#3c3c3c'));
      // Make it a little more overlay-friendly
      const mat = grid.material as any;
      if (mat) {
        mat.transparent = true;
        mat.opacity = 0.9;
        mat.depthWrite = false;
      }
      grid.renderOrder = renderOrder;
      grid.frustumCulled = frustumCulled;
      return grid;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [size, divisions, (sectionColor as any)?.toString?.() ?? sectionColor, (cellColor as any)?.toString?.() ?? cellColor, renderOrder, frustumCulled]);

    return (
      <primitive
        object={helper}
        ref={ref as any}
        position={position as any}
        rotation={rotation as any}
        scale={scale as any}
        renderOrder={renderOrder}
        {...rest}
      />
    );
  }
);

export default WebGPUGrid;
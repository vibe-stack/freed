'use client';

import React, { useMemo } from 'react';
import { Color } from 'three';
import { useViewportStore } from '@/stores/viewport-store';

export const CalmBg: React.FC = () => {
  const bg = useViewportStore((s) => s.backgroundColor);
  const color = useMemo(() => new Color(bg.x, bg.y, bg.z), [bg.x, bg.y, bg.z]);
  return <color attach="background" args={[color]} />;
};

export default CalmBg;

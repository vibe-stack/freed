'use client';

import React from 'react';
import { Color } from 'three';

export const CalmBg: React.FC = () => {
  return <color attach="background" args={[new Color('#232323')]} />;
};

export default CalmBg;

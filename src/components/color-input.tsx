"use client";

import React from 'react';
import type { Vector3 } from '@/types/geometry';

type Props = {
  value: Vector3;
  onChange: (v: Vector3) => void;
  label?: string;
  className?: string;
};

const toHex = (v: Vector3): string => {
  const r = Math.round(Math.max(0, Math.min(1, v.x)) * 255)
    .toString(16)
    .padStart(2, '0');
  const g = Math.round(Math.max(0, Math.min(1, v.y)) * 255)
    .toString(16)
    .padStart(2, '0');
  const b = Math.round(Math.max(0, Math.min(1, v.z)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `#${r}${g}${b}`;
};

const fromHex = (hex: string): Vector3 => {
  const m = /^#?([\da-fA-F]{2})([\da-fA-F]{2})([\da-fA-F]{2})$/.exec(hex);
  if (!m) return { x: 1, y: 1, z: 1 };
  const to01 = (v: string) => parseInt(v, 16) / 255;
  return { x: to01(m[1]), y: to01(m[2]), z: to01(m[3]) };
};

export const ColorInput: React.FC<Props> = ({ value, onChange, label, className = '' }) => {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {label && <div className="text-xs text-gray-400 w-16">{label}</div>}
      <input
        type="color"
        value={toHex(value)}
        onChange={(e) => onChange(fromHex(e.target.value))}
        className="h-6 w-10 bg-transparent border border-white/10 rounded cursor-pointer"
        aria-label={label}
      />
      <div className="text-[10px] text-gray-400">{toHex(value)}</div>
    </div>
  );
};

export default ColorInput;

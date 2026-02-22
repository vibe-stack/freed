import { SelectBrush } from './select-brush';
import { PolygonBrush } from './polygon-brush';
import { CubeBrush } from './cube-brush';
import { SlopeBrush } from './slope-brush';
import { SphereBrush } from './sphere-brush';
import { CylinderBrush } from './cylinder-brush';
import { ConeBrush } from './cone-brush';
import { StairsBrush } from './stairs-brush';
import { ClosedStairsBrush } from './closed-stairs-brush';
import { DoorBrush } from './door-brush';
import { ArchBrush } from './arch-brush';
import type { BrushDefinition, BrushShape } from './types';

export const BRUSH_REGISTRY: BrushDefinition[] = [
  SelectBrush,
  PolygonBrush,
  CubeBrush,
  SlopeBrush,
  SphereBrush,
  CylinderBrush,
  ConeBrush,
  StairsBrush,
  ClosedStairsBrush,
  DoorBrush,
  ArchBrush,
];

export function getBrush(id: BrushShape): BrushDefinition {
  const brush = BRUSH_REGISTRY.find((b) => b.id === id);
  if (!brush) throw new Error(`Unknown brush: ${id}`);
  return brush;
}

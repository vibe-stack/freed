import type React from 'react';
import type * as THREE from 'three';
import type { useGeometryStore } from '@/stores/geometry-store';
import type { useSceneStore } from '@/stores/scene-store';
import type { useSelectionStore } from '@/stores/selection-store';

export type BrushShape =
  | 'select'
  | 'cube'
  | 'slope'
  | 'sphere'
  | 'cylinder'
  | 'cone'
  | 'stairs'
  | 'door'
  | 'arch';

export type FootprintType = 'rect' | 'radial';

export interface BrushParams {
  /** World-space anchor point (corner for rect, center for radial) */
  anchor: THREE.Vector3;
  /** World-space drag endpoint */
  current: THREE.Vector3;
  /** Surface normal at anchor (Y-up for ground) */
  normal: THREE.Vector3;
  /** Surface tangent at anchor (orthogonal to normal) */
  tangent: THREE.Vector3;
  /** Height accumulated in phase 2 */
  height: number;
}

export interface CommitStores {
  geometry: ReturnType<typeof useGeometryStore.getState>;
  scene: ReturnType<typeof useSceneStore.getState>;
  selection: ReturnType<typeof useSelectionStore.getState>;
}

export interface PreviewTransform {
  position: [number, number, number];
  quaternion: [number, number, number, number];
  scale: [number, number, number];
}

export interface BrushDefinition {
  id: BrushShape;
  label: string;
  /** Keyboard shortcut '1'–'8' */
  shortcut: string;
  /** Small SVG icon node */
  icon: React.ReactNode;
  footprintType: FootprintType;

  /**
   * Build a THREE.BufferGeometry for the ghost preview.
   * Called only when dimensions change significantly (throttled by handler).
   */
  buildPreviewGeometry(params: BrushParams): THREE.BufferGeometry;

  /**
   * Compute the preview mesh transform from current params.
   * Called every frame — must be fast and allocation-free when possible.
   */
  computePreviewTransform(params: BrushParams): PreviewTransform;

  /**
   * Create the actual scene object, wire it into stores, and return its objectId.
   */
  commit(params: BrushParams, stores: CommitStores): string;
}

'use client';

import React from 'react';
import { useSelection } from '@/stores/selection-store';
import { useToolStore } from '@/stores/tool-store';
import type { ToolMode } from '@/stores/tool-store';

type SculptBtn = {
  tool: ToolMode;
  label: string;
  tip: string;
  icon: string;
  shortcut?: string;
};

const sculptButtons: SculptBtn[] = [
  { tool: 'sculpt-draw', label: 'Draw', tip: 'Displace along avg normal (D)', icon: '✎', shortcut: 'D' },
  { tool: 'sculpt-clay', label: 'Clay', tip: 'Clay build-up / plane-based (C)', icon: '🧱', shortcut: 'C' },
  { tool: 'sculpt-inflate', label: 'Inflate', tip: 'Inflate/Deflate along vertex normals (I)', icon: '⤢', shortcut: 'I' },
  { tool: 'sculpt-blob', label: 'Blob', tip: 'Spherical blob push/pull', icon: '⚪' },
  { tool: 'sculpt-crease', label: 'Crease', tip: 'Sharp indent/ridge (Shift+C)', icon: '⌇', shortcut: 'Shift+C' },
  { tool: 'sculpt-smooth', label: 'Smooth', tip: 'Relax vertices (S)', icon: '〰', shortcut: 'S' },
  { tool: 'sculpt-flatten', label: 'Flatten', tip: 'Pull towards plane (Shift+T)', icon: '▱', shortcut: 'Shift+T' },
  { tool: 'sculpt-contrast', label: 'Contrast', tip: 'Push away from plane', icon: '▰' },
  { tool: 'sculpt-fill', label: 'Fill', tip: 'Fill up to plane', icon: '▤' },
  { tool: 'sculpt-deepen', label: 'Deepen', tip: 'Deepen below plane', icon: '▥' },
  { tool: 'sculpt-scrape', label: 'Scrape', tip: 'Scrape down to plane', icon: '⟂' },
  { tool: 'sculpt-peaks', label: 'Peaks', tip: 'Raise above plane', icon: '⟂+' },
  { tool: 'sculpt-pinch', label: 'Pinch', tip: 'Pinch toward center (P)', icon: '⌖', shortcut: 'P' },
  { tool: 'sculpt-magnify', label: 'Magnify', tip: 'Push away from center', icon: '⦿' },
  { tool: 'sculpt-grab', label: 'Grab', tip: 'Drag region (G)', icon: '✊', shortcut: 'G' },
  { tool: 'sculpt-snake-hook', label: 'Snake', tip: 'Snake hook (K)', icon: '🐍', shortcut: 'K' },
  { tool: 'sculpt-thumb', label: 'Thumb', tip: 'Flatten while pushing', icon: '👍' },
  { tool: 'sculpt-nudge', label: 'Nudge', tip: 'Move along stroke', icon: '➡' },
  { tool: 'sculpt-rotate', label: 'Rotate', tip: 'Rotate within brush', icon: '⟲' },
  { tool: 'sculpt-simplify', label: 'Simplify', tip: 'Collapse short edges (dyn topo)', icon: '▦' },
];

export const SculptToolsToolbar: React.FC = () => {
  const selection = useSelection();
  const tools = useToolStore();

  if (selection.viewMode !== 'edit' || tools.editPalette !== 'sculpt') return null;

  const start = (tool: typeof sculptButtons[number]['tool']) => {
    if (tools.isActive && tools.tool === tool) return;
    tools.startOperation(tool, null);
  };

  return (
    <div className="pointer-events-auto max-w-[90vw] space-y-2">
      {/* Row 1: Brush selection */}
      <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-xl shadow-lg shadow-black/30 px-2 py-1">
        <div className="flex items-center gap-1 flex-wrap">
          {sculptButtons.map((b) => {
            const active = tools.isActive && tools.tool === b.tool;
            return (
              <button
                key={b.tool}
                className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                  active ? 'bg-white/10 text-white' : 'text-gray-300 hover:text-white hover:bg-white/5'
                }`}
                title={`${b.label}${b.shortcut ? ` (${b.shortcut})` : ''}`}
                onClick={() => start(b.tool)}
              >
                <span className="mr-1 opacity-80">{b.icon}</span>
                {b.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Row 2: Brush controls */}
      <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-xl shadow-lg shadow-black/30 px-3 py-2">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-[10px] opacity-70">Size</label>
            <input
              type="range"
              min={0.05}
              max={3}
              step={0.01}
              value={tools.brushRadius}
              onChange={(e) => tools.setBrushRadius(parseFloat(e.target.value))}
              className="h-1 w-32 bg-white/10 rounded appearance-none outline-none [accent-color:#9aa0a6]"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[10px] opacity-70">Strength</label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={tools.brushStrength}
              onChange={(e) => tools.setBrushStrength(parseFloat(e.target.value))}
              className="h-1 w-32 bg-white/10 rounded appearance-none outline-none [accent-color:#9aa0a6]"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[10px] opacity-70">Falloff</label>
            <select
              className="bg-black/20 border border-white/10 rounded px-2 py-1 text-xs"
              value={tools.brushFalloff}
              onChange={(e) => tools.setBrushFalloff(e.target.value as any)}
            >
              <option value="smooth">Smooth</option>
              <option value="linear">Linear</option>
              <option value="sharp">Sharp</option>
            </select>
          </div>

          {/* Conditional brush options */}
          {(tools.tool === 'sculpt-pinch' || tools.tool === 'sculpt-magnify') && (
            <div className="flex items-center gap-2">
              <label className="text-[10px] opacity-70">Pinch</label>
              <input
                type="range"
                min={0}
                max={2}
                step={0.01}
                value={tools.pinchFactor}
                onChange={(e) => useToolStore.getState().setPinchFactor(parseFloat(e.target.value))}
                className="h-1 w-28 bg-white/10 rounded appearance-none outline-none [accent-color:#9aa0a6]"
              />
            </div>
          )}

          {(tools.tool === 'sculpt-clay' || tools.tool === 'sculpt-flatten' || tools.tool === 'sculpt-contrast' || tools.tool === 'sculpt-fill' || tools.tool === 'sculpt-deepen' || tools.tool === 'sculpt-scrape' || tools.tool === 'sculpt-peaks') && (
            <div className="flex items-center gap-2">
              <label className="text-[10px] opacity-70">Plane</label>
              <input
                type="range"
                min={-1}
                max={1}
                step={0.01}
                value={tools.planeOffset}
                onChange={(e) => useToolStore.getState().setPlaneOffset(parseFloat(e.target.value))}
                className="h-1 w-28 bg-white/10 rounded appearance-none outline-none [accent-color:#9aa0a6]"
              />
            </div>
          )}

          {/* Symmetry controls */}
          <div className="flex items-center gap-2">
            <label className="text-[10px] opacity-70">Symmetry</label>
            <input
              type="checkbox"
              checked={tools.symmetryEnabled}
              onChange={(e) => tools.setSymmetryEnabled(e.target.checked)}
              className="accent-white/80"
            />
            <select
              className="bg-black/20 border border-white/10 rounded px-2 py-1 text-xs"
              value={tools.symmetryAxis}
              onChange={(e) => tools.setSymmetryAxis(e.target.value as any)}
              disabled={!tools.symmetryEnabled}
            >
              <option value="x">X</option>
              <option value="y">Y</option>
              <option value="z">Z</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SculptToolsToolbar;

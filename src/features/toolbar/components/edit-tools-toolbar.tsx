'use client';

import React from 'react';
import { useSelection } from '@/stores/selection-store';
import { useToolStore } from '@/stores/tool-store';

type Btn = {
  id: 'move' | 'rotate' | 'scale' | 'extrude' | 'inset' | 'bevel' | 'loopcut';
  label: string;
  tip: string;
  icon: string;
  shortcut: string;
};

const buttons: Btn[] = [
  { id: 'move', label: 'Move', tip: 'Translate selection (G)', icon: '↔️', shortcut: 'G' },
  { id: 'rotate', label: 'Rotate', tip: 'Rotate selection (R)', icon: '⟳', shortcut: 'R' },
  { id: 'scale', label: 'Scale', tip: 'Scale selection (S)', icon: '⤧', shortcut: 'S' },
  { id: 'extrude', label: 'Extrude', tip: 'Extrude (E / Alt+E)', icon: '⤴︎', shortcut: 'E' },
  { id: 'inset', label: 'Inset', tip: 'Inset faces (I)', icon: '⬒', shortcut: 'I' },
  { id: 'bevel', label: 'Bevel', tip: 'Bevel (Ctrl+B / Ctrl+Shift+B)', icon: '◠', shortcut: 'Ctrl+B' },
  { id: 'loopcut', label: 'Loop Cut', tip: 'Loop Cut (Ctrl+R)', icon: '╱╲', shortcut: 'Ctrl+R' },
];

export const EditToolsToolbar: React.FC = () => {
  const selection = useSelection();
  const tool = useToolStore();

  if (selection.viewMode !== 'edit') return null;

  // Whether we have any edit selection is inferred inline where needed.

  const start = (id: Btn['id']) => {
    if (tool.isActive && tool.tool === id) return;
    // Allow object-space move/rotate/scale in Edit Mode even without a component selection (acts on all verts)
    if ((id === 'move' || id === 'rotate' || id === 'scale')) {
      if (selection.viewMode !== 'edit') return;
      tool.startOperation(id, null);
      return;
    }
    if (id === 'extrude') {
      // For now support face extrude only
      if (selection.viewMode !== 'edit' || selection.faceIds.length === 0) return;
      tool.startOperation(id, null);
      return;
    }
    if (id === 'inset') {
      if (selection.viewMode !== 'edit' || selection.faceIds.length === 0) return;
      tool.startOperation(id, null);
      return;
    }
    if (id === 'bevel') {
      if (selection.viewMode !== 'edit' || selection.faceIds.length === 0) return;
      tool.startOperation(id, null);
      return;
    }
    if (id === 'loopcut') {
      if (selection.viewMode !== 'edit') return;
      tool.startOperation(id, null);
      return;
    }
    // Unimplemented tools: no-op for now
    console.info(`[EditTools] ${id} is not implemented yet`);
  };

  return (
    <div className="pointer-events-auto bg-black/40 backdrop-blur-md border border-white/10 rounded-xl shadow-lg shadow-black/30 px-2 py-1">
      <div className="flex items-center gap-1">
        {buttons.map((b) => {
          const active = tool.isActive && tool.tool === b.id;
          const isTransform = b.id === 'move' || b.id === 'rotate' || b.id === 'scale';
          const disabled =
            isTransform ? selection.viewMode !== 'edit' :
            b.id === 'extrude' ? selection.faceIds.length === 0 :
            b.id === 'inset' ? selection.faceIds.length === 0 :
            b.id === 'bevel' ? selection.faceIds.length === 0 :
            b.id === 'loopcut' ? selection.viewMode !== 'edit' :
            true;
          return (
            <button
              key={b.id}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                disabled
                  ? 'text-gray-500/70 cursor-not-allowed'
                  : active
                  ? 'bg-white/10 text-white'
                  : 'text-gray-300 hover:text-white hover:bg-white/5'
              }`}
              title={`${b.label} (${b.shortcut})`}
              onClick={() => start(b.id)}
              disabled={disabled}
            >
              <span className="mr-1 opacity-80">{b.icon}</span>
              {b.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default EditToolsToolbar;

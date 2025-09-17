'use client';

import React, { ReactNode } from 'react';
import { useSelection } from '@/stores/selection-store';
import { useToolStore } from '@/stores/tool-store';
import * as motion from 'motion/react-client';
import { Move3DIcon, Rotate3DIcon, Scale3DIcon } from 'lucide-react';

// Small, lucide-style inline icons for edit tools that previously used emojis.
export const ExtrudeIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg stroke="currentColor" strokeWidth={1} strokeLinecap="round" strokeLinejoin="round" fill="none" viewBox="0 0 18 18" className={className} xmlns="http://www.w3.org/2000/svg">
    {/* top face (diamond) */}
    <path d="M7 10 L12 7 L17 10 L12 13 Z" />
    {/* arrow pointing up */}
    <path d="M12 3v4" />
    <path d="M9 6l3-3 3 3" />
  </svg>
);

export const InsetIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg">
    <rect x="3.5" y="3.5" width="17" height="17" rx="1" />
    <rect x="8.5" y="8.5" width="7" height="7" rx="0.5" />
  </svg>
);

export const BevelIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg">
    {/* square */}
    <rect x="3.5" y="3.5" width="17" height="17" rx="1" />
    {/* diagonal bevel cut at top-right */}
    <path d="M14 4 L20 10" />
  </svg>
);

export const LoopCutIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg">
    {/* outer loop */}
    <rect x="3.5" y="6" width="17" height="12" rx="2" />
    {/* center dashed cut line */}
    <path strokeDasharray="2 3" d="M12 6v12" />
  </svg>
);

export const KnifeIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg">
    {/* blade */}
    <path d="M3 21c4-4 8-8 12-12l3-3" />
    <path d="M13 11l7-7" />
    {/* handle */}
    <path d="M10 14l4 4" />
  </svg>
);

// Extra small icons for chamfer/fillet
export const ChamferIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg">
    {/* square with chamfered corner */}
    <path d="M4 8V6a2 2 0 0 1 2-2h6" />
    <path d="M20 16v2a2 2 0 0 1-2 2h-6" />
    <path d="M20 8l-4 4" />
  </svg>
);

export const FilletIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg">
    {/* rounded corner */}
    <path d="M4 12V6a2 2 0 0 1 2-2h6" />
    <path d="M20 12c0-4.418-3.582-8-8-8" />
  </svg>
);

type Btn = {
  id: 'move' | 'rotate' | 'scale' | 'extrude' | 'inset' | 'bevel' | 'chamfer' | 'fillet' | 'loopcut' | 'knife';
  label: string;
  tip: string;
  icon: ReactNode;
  shortcut: string;
};

const buttons: Btn[] = [
  { id: 'move', label: 'Move', tip: 'Translate selection (G)', icon: <Move3DIcon className='w-4 h-4' />, shortcut: 'G' },
  { id: 'rotate', label: 'Rotate', tip: 'Rotate selection (R)', icon: <Rotate3DIcon className='w-4 h-4' />, shortcut: 'R' },
  { id: 'scale', label: 'Scale', tip: 'Scale selection (S)', icon: <Scale3DIcon className='w-4 h-4' />, shortcut: 'S' },
  { id: 'extrude', label: 'Extrude', tip: 'Extrude (E / Alt+E)', icon: <ExtrudeIcon className='w-4 h-4' />, shortcut: 'E' },
  { id: 'inset', label: 'Inset', tip: 'Inset faces (I)', icon: <InsetIcon className='w-4 h-4' />, shortcut: 'I' },
  { id: 'bevel', label: 'Bevel', tip: 'Bevel edges/faces (Ctrl+B)', icon: <BevelIcon className='w-4 h-4' />, shortcut: 'Ctrl+B' },
  { id: 'chamfer', label: 'Chamfer', tip: 'Chamfer selected edges; drag to set angle', icon: <ChamferIcon className='w-4 h-4' />, shortcut: '' },
  { id: 'fillet', label: 'Fillet', tip: 'Fillet selected edges; drag radius; mousewheel segments', icon: <FilletIcon className='w-4 h-4' />, shortcut: '' },
  { id: 'loopcut', label: 'Loop Cut', tip: 'Loop Cut (Ctrl+R)', icon: <LoopCutIcon className='w-4 h-4' />, shortcut: 'Ctrl+R' },
  { id: 'knife', label: 'Knife', tip: 'Knife tool (Shift+K)', icon: <KnifeIcon className='w-4 h-4' />, shortcut: 'Shift+K' },
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
      if (selection.viewMode !== 'edit') return;
      const hasFacesOrEdges = selection.faceIds.length > 0 || selection.edgeIds.length > 0;
      if (!hasFacesOrEdges) return;
      tool.startOperation(id, null);
      return;
    }
    if (id === 'chamfer') {
      if (selection.viewMode !== 'edit' || selection.edgeIds.length === 0) return;
      tool.startOperation(id, null);
      return;
    }
    if (id === 'fillet') {
      if (selection.viewMode !== 'edit' || selection.edgeIds.length === 0) return;
      tool.startOperation(id, null);
      return;
    }
    if (id === 'loopcut') {
      if (selection.viewMode !== 'edit') return;
      tool.startOperation(id, null);
      return;
    }
    if (id === 'knife') {
      if (selection.viewMode !== 'edit') return;
      tool.startOperation(id, null);
      return;
    }
    // Unimplemented tools: no-op for now
    console.info(`[EditTools] ${id} is not implemented yet`);
  };

  return (
    <motion.div initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
      exit={{ y: -10, opacity: 0 }}
      className="pointer-events-auto bg-black/40 backdrop-blur-md border border-white/10 rounded-xl shadow-lg shadow-black/30 px-2 py-1">
      <div className="flex items-center gap-1">
        {buttons.map((b) => {
          const active = tool.isActive && tool.tool === b.id;
          const isTransform = b.id === 'move' || b.id === 'rotate' || b.id === 'scale';
          const disabled =
            isTransform ? selection.viewMode !== 'edit' :
              b.id === 'extrude' ? selection.faceIds.length === 0 :
                b.id === 'inset' ? selection.faceIds.length === 0 :
                  b.id === 'bevel' ? (selection.faceIds.length === 0 && selection.edgeIds.length === 0) :
                    b.id === 'chamfer' ? selection.edgeIds.length === 0 :
                      b.id === 'fillet' ? selection.edgeIds.length === 0 :
                        b.id === 'loopcut' ? selection.viewMode !== 'edit' :
                          b.id === 'knife' ? selection.viewMode !== 'edit' :
                            true;
          return (
            <button
              key={b.id}
              className={`px-3 py-1.5 text-xs rounded-md flex transition-colors ${disabled
                  ? 'text-gray-500/70 cursor-not-allowed'
                  : active
                    ? 'bg-white/10 text-white'
                    : 'text-gray-300 hover:text-white hover:bg-white/5'
                }`}
              title={`${b.label} (${b.shortcut})`}
              onClick={() => start(b.id)}
              disabled={disabled}
            >
              <span className="mr-1 opacity-80 inline-block self-center">{b.icon}</span>
              {b.label}
            </button>
          );
        })}
      </div>
    </motion.div>
  );
};

export default EditToolsToolbar;

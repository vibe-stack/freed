'use client';

import React, { useEffect } from 'react';
import * as motion from 'motion/react-client';
import { AnimatePresence } from 'motion/react';
import { useViewMode } from '@/stores/selection-store';
import { useQuickBrushStore } from '../stores/quick-brush-store';
import { BRUSH_REGISTRY } from '../brushes/registry';
import type { BrushShape } from '../brushes/types';

const QuickBrushBar: React.FC = () => {
  const viewMode = useViewMode();
  const activeBrush = useQuickBrushStore((s) => s.activeBrush);
  const setActiveBrush = useQuickBrushStore((s) => s.setActiveBrush);

  // Keyboard shortcuts 1–8
  useEffect(() => {
    if (viewMode !== 'brush') return;
    const handler = (e: KeyboardEvent) => {
      // Don't fire inside input fields
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      const brush = BRUSH_REGISTRY.find((b) => b.shortcut === e.key);
      if (brush) setActiveBrush(brush.id as BrushShape);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [viewMode, setActiveBrush]);

  if (viewMode !== 'brush') return null;

  return (
    <motion.div
      key="quick-brush-bar"
      initial={{ y: -8, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -8, opacity: 0 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className="pointer-events-auto bg-black/40 backdrop-blur-md border border-white/8 rounded-xl shadow-lg shadow-black/30 px-1.5 py-1"
    >
      <div className="flex items-center gap-0.5">
        {BRUSH_REGISTRY.map((brush) => {
          const isActive = activeBrush === brush.id;
          return (
            <button
              key={brush.id}
              onClick={() => setActiveBrush(brush.id as BrushShape)}
              title={`${brush.label} (${brush.shortcut})`}
              className={[
                'flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-all duration-100 border',
                isActive
                  ? 'bg-white/10 border-white/20 text-white'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-white/4 border-transparent',
              ].join(' ')}
            >
              <span className={`transition-opacity ${isActive ? 'opacity-100' : 'opacity-60'}`}>
                {brush.icon}
              </span>
              <span className="text-[9px] font-mono leading-none opacity-50">
                {brush.shortcut}
              </span>
            </button>
          );
        })}
      </div>
    </motion.div>
  );
};

export default QuickBrushBar;

import React from 'react';
import { useToolStore } from '@/stores/tool-store';

const ToolIndicator: React.FC = () => {
  const toolStore = useToolStore();
  
  if (!toolStore.isActive) return null;
  const implemented = toolStore.tool === 'move' || toolStore.tool === 'rotate' || toolStore.tool === 'scale' || toolStore.tool === 'extrude' || toolStore.tool === 'inset' || toolStore.tool === 'bevel';
  
  const getToolIcon = () => {
    switch (toolStore.tool) {
      case 'move': return '↔️';
      case 'rotate': return '🔄';
      case 'scale': return '📏';
  case 'extrude': return '⤴︎';
  case 'inset': return '⬒';
  case 'bevel': return '◠';
  case 'loopcut': return '╱╲';
      default: return '🔧';
    }
  };
  
  const getToolName = () => {
    switch (toolStore.tool) {
      case 'move': return 'Move';
      case 'rotate': return 'Rotate';
      case 'scale': return 'Scale';
  case 'extrude': return 'Extrude';
  case 'inset': return 'Inset';
  case 'bevel': return 'Bevel';
  case 'loopcut': return 'Loop Cut';
      default: return 'Tool';
    }
  };
  
  const getAxisLockDisplay = () => {
    if (toolStore.axisLock === 'none') return '';
    return ` (${toolStore.axisLock.toUpperCase()}-axis)`;
  };
  
  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
      <div className="bg-black/50 text-white/90 px-3 py-1.5 rounded-md border border-white/10 text-xs flex items-center gap-2">
        <span className="opacity-80">{getToolIcon()}</span>
        <span className="font-medium">{getToolName()}{implemented ? getAxisLockDisplay() : ''}</span>
        {implemented ? (
          <span className="opacity-70">• LMB confirm • ESC cancel • X/Y/Z lock</span>
        ) : (
          <span className="opacity-70">• Preview only • ESC to exit</span>
        )}
      </div>
    </div>
  );
};

export default ToolIndicator;

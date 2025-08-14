import React from 'react';
import { useToolStore } from '../stores/toolStore';

const ToolIndicator: React.FC = () => {
  const toolStore = useToolStore();
  
  if (!toolStore.isActive) return null;
  
  const getToolIcon = () => {
    switch (toolStore.tool) {
      case 'move': return '↔️';
      case 'rotate': return '🔄';
      case 'scale': return '📏';
      default: return '🔧';
    }
  };
  
  const getToolName = () => {
    switch (toolStore.tool) {
      case 'move': return 'Move';
      case 'rotate': return 'Rotate';
      case 'scale': return 'Scale';
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
        <span className="font-medium">{getToolName()}{getAxisLockDisplay()}</span>
        <span className="opacity-70">• LMB confirm • ESC cancel • X/Y/Z lock</span>
      </div>
    </div>
  );
};

export default ToolIndicator;

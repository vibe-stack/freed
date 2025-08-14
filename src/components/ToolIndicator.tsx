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
    <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50">
      <div className="bg-orange-500 text-white px-6 py-3 rounded-lg shadow-lg border-2 border-orange-600">
        <div className="flex items-center space-x-2">
          <span className="text-2xl">{getToolIcon()}</span>
          <div>
            <div className="font-bold text-lg">
              {getToolName()}{getAxisLockDisplay()}
            </div>
            <div className="text-sm opacity-90">
              Left click to confirm • ESC to cancel • X/Y/Z to lock axis
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ToolIndicator;

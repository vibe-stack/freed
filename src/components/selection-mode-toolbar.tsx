'use client';

import React from 'react';
import { useSelection, useSelectionStore } from '../stores/selection-store';
import { SelectionMode } from '../types/geometry';
import { ShortcutHelp } from './shortcut-help';

interface SelectionModeButtonProps {
  mode: SelectionMode;
  currentMode: SelectionMode;
  onClick: () => void;
  shortcut: string;
  icon: string;
  label: string;
}

const SelectionModeButton: React.FC<SelectionModeButtonProps> = ({
  mode,
  currentMode,
  onClick,
  shortcut,
  icon,
  label,
}) => {
  const isActive = currentMode === mode;
  
  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all duration-200 min-w-[80px] ${
        isActive
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
          : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/10'
      }`}
      title={`${label} (${shortcut})`}
    >
      <span className="text-lg mb-1">{icon}</span>
      <span className="text-xs font-medium">{label}</span>
      <span className="absolute top-1 right-1 text-xs opacity-60">{shortcut}</span>
    </button>
  );
};

export const SelectionModeToolbar: React.FC = () => {
  const selection = useSelection();
  const { setSelectionMode } = useSelectionStore();

  // Only show in edit mode
  if (selection.viewMode !== 'edit') {
    return null;
  }

  const modes: Array<{
    mode: SelectionMode;
    shortcut: string;
    icon: string;
    label: string;
  }> = [
    { mode: 'vertex', shortcut: '1', icon: '•', label: 'Vertex' },
    { mode: 'edge', shortcut: '2', icon: '│', label: 'Edge' },
    { mode: 'face', shortcut: '3', icon: '▢', label: 'Face' },
  ];

  return (
    <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Selection Mode (Edit Mode)
        </h3>
        <div className="relative">
          <ShortcutHelp />
        </div>
      </div>
      <div className="flex gap-2">
        {modes.map(({ mode, shortcut, icon, label }) => (
          <SelectionModeButton
            key={mode}
            mode={mode}
            currentMode={selection.selectionMode}
            onClick={() => setSelectionMode(mode)}
            shortcut={shortcut}
            icon={icon}
            label={label}
          />
        ))}
      </div>
    </div>
  );
};

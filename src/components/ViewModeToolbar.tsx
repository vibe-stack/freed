'use client';

import React from 'react';
import { useSelection, useSelectionStore } from '../stores/selectionStore';
import { ViewMode } from '../types/geometry';
import { useSceneStore } from '../stores/sceneStore';

interface ViewModeButtonProps {
  mode: ViewMode;
  currentMode: ViewMode;
  onClick: () => void;
  shortcut: string;
  icon: string;
  label: string;
}

const ViewModeButton: React.FC<ViewModeButtonProps> = ({
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
      className={`relative flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all duration-200 min-w-[100px] ${
        isActive
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
          : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/10'
      }`}
      title={`${label} Mode (${shortcut})`}
    >
      <span className="text-xl mb-2">{icon}</span>
      <span className="text-sm font-medium">{label} Mode</span>
      <span className="absolute top-2 right-2 text-xs opacity-60">
        {shortcut}
      </span>
    </button>
  );
};

export const ViewModeToolbar: React.FC = () => {
  const selection = useSelection();
  const { setViewMode, enterEditMode, exitEditMode } = useSelectionStore();
  const scene = useSceneStore();

  const modes: Array<{
    mode: ViewMode;
    shortcut: string;
    icon: string;
    label: string;
  }> = [
    { mode: 'object', shortcut: 'Tab', icon: '🎯', label: 'Object' },
    { mode: 'edit', shortcut: 'Tab', icon: '✏️', label: 'Edit' },
  ];

  const handleModeChange = (mode: ViewMode) => {
    if (mode === 'edit' && selection.viewMode === 'object') {
      // When entering edit mode, use the first selected object
      if (selection.objectIds.length > 0) {
        // Use the first selected object's mesh ID
        const firstObjectId = selection.objectIds[0];
        const meshId = scene.objects[firstObjectId]?.meshId;
        if (meshId) enterEditMode(meshId);
        return;
      } else {
        // Show a message or do nothing if no object is selected
        alert('Please select an object first to enter Edit Mode');
        return;
      }
    } else if (mode === 'object' && selection.viewMode === 'edit') {
      exitEditMode();
    } else {
      setViewMode(mode);
    }
  };

  return (
    <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          View Mode
        </h3>
        <div className="text-xs text-gray-500">
          Press Tab to switch between modes
        </div>
      </div>
      <div className="flex gap-3">
        {modes.map(({ mode, shortcut, icon, label }) => (
          <ViewModeButton
            key={mode}
            mode={mode}
            currentMode={selection.viewMode}
            onClick={() => handleModeChange(mode)}
            shortcut={shortcut}
            icon={icon}
            label={label}
          />
        ))}
      </div>

      {selection.viewMode === 'edit' && (
        <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-xs text-blue-700 dark:text-blue-300">
          <div className="flex items-center gap-2">
            <span>✏️</span>
            <span>Edit Mode Active - Select vertices, edges, or faces</span>
          </div>
          {selection.meshId && (
            <div className="mt-1 text-blue-600 dark:text-blue-400">
              Editing: {selection.meshId.slice(-8)}
            </div>
          )}
        </div>
      )}

      {selection.viewMode === 'object' && (
        <div className="mt-3 p-2 bg-green-50 dark:bg-green-900/20 rounded text-xs text-green-700 dark:text-green-300">
          <div className="flex items-center gap-2">
            <span>🎯</span>
            <span>Object Mode Active - Select entire objects</span>
          </div>
          {selection.objectIds.length === 0 && (
            <div className="mt-1 text-amber-600 dark:text-amber-400 text-xs">
              💡 Select an object to enter Edit Mode (Tab key or double-click)
            </div>
          )}
          {selection.objectIds.length > 0 && (
            <div className="mt-1 text-green-600 dark:text-green-400 text-xs">
              ✓ {selection.objectIds.length} object
              {selection.objectIds.length !== 1 ? 's' : ''} selected - Press Tab or
              click Edit Mode
            </div>
          )}
        </div>
      )}
    </div>
  );
};

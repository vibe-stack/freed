'use client';

import React from 'react';
import { useSelection, useSelectionStore } from '../stores/selectionStore';
import { useMeshes } from '../stores/geometryStore';

export const SelectionSummary: React.FC = () => {
  const selection = useSelection();
  const meshes = useMeshes();
  const { clearSelection } = useSelectionStore();

  const selectedMesh = meshes.find(m => m.id === selection.meshId);
  const totalSelected = selection.vertexIds.length + selection.edgeIds.length + selection.faceIds.length + selection.objectIds.length;

  if (totalSelected === 0) {
    return (
      <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
        <div className="text-center text-gray-500 dark:text-gray-400">
          <div className="text-sm">No selection</div>
          <div className="text-xs mt-1">
            {selection.viewMode === 'object' 
              ? 'Click on objects to select them'
              : 'Click on vertices, edges, or faces to select them'
            }
          </div>
        </div>
      </div>
    );
  }

  const getSelectionText = () => {
    const parts: string[] = [];
    
    if (selection.objectIds.length > 0) {
      parts.push(`${selection.objectIds.length} object${selection.objectIds.length !== 1 ? 's' : ''}`);
    }
    if (selection.vertexIds.length > 0) {
      parts.push(`${selection.vertexIds.length} vertex${selection.vertexIds.length !== 1 ? 'es' : ''}`);
    }
    if (selection.edgeIds.length > 0) {
      parts.push(`${selection.edgeIds.length} edge${selection.edgeIds.length !== 1 ? 's' : ''}`);
    }
    if (selection.faceIds.length > 0) {
      parts.push(`${selection.faceIds.length} face${selection.faceIds.length !== 1 ? 's' : ''}`);
    }

    return parts.join(', ');
  };

  const getModeColor = (viewMode: string, selectionMode?: string) => {
    if (viewMode === 'object') {
      return 'text-purple-600 dark:text-purple-400';
    }
    
    switch (selectionMode) {
      case 'vertex': return 'text-yellow-600 dark:text-yellow-400';
      case 'edge': return 'text-green-600 dark:text-green-400';
      case 'face': return 'text-blue-600 dark:text-blue-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getModeIcon = (viewMode: string, selectionMode?: string) => {
    if (viewMode === 'object') {
      return '🎯';
    }
    
    switch (selectionMode) {
      case 'vertex': return '•';
      case 'edge': return '│';
      case 'face': return '▢';
      default: return '?';
    }
  };

  const getCurrentModeLabel = () => {
    if (selection.viewMode === 'object') {
      return 'OBJECT';
    }
    return `${selection.selectionMode.toUpperCase()} (EDIT)`;
  };

  return (
    <div className="p-3 bg-white dark:bg-gray-700 rounded-lg border">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`text-lg ${getModeColor(selection.viewMode, selection.selectionMode)}`}>
            {getModeIcon(selection.viewMode, selection.selectionMode)}
          </span>
          <div>
            <div className="font-medium text-sm">
              {getSelectionText()} selected
            </div>
            {selectedMesh && (
              <div className="text-xs text-gray-600 dark:text-gray-400">
                in {selectedMesh.name}
              </div>
            )}
          </div>
        </div>
        
        <div className="flex gap-2">
          <div className={`px-2 py-1 rounded text-xs font-medium ${getModeColor(selection.viewMode, selection.selectionMode)} bg-gray-100 dark:bg-gray-800`}>
            {getCurrentModeLabel()}
          </div>
          <button
            onClick={clearSelection}
            className="px-2 py-1 text-xs bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded hover:bg-red-200 dark:hover:bg-red-900/50"
            title="Clear selection (Alt+A or Esc)"
          >
            Clear
          </button>
        </div>
      </div>
      
      {/* Selected items preview */}
      {totalSelected > 0 && (
        <div className="mt-2 pt-2 border-t dark:border-gray-600">
          <div className="text-xs text-gray-600 dark:text-gray-400">
            {selection.vertexIds.length > 0 && (
              <div>Vertices: {selection.vertexIds.map(id => id.slice(-4)).join(', ')}</div>
            )}
            {selection.edgeIds.length > 0 && (
              <div>Edges: {selection.edgeIds.map(id => id.slice(-4)).join(', ')}</div>
            )}
            {selection.faceIds.length > 0 && (
              <div>Faces: {selection.faceIds.map(id => id.slice(-4)).join(', ')}</div>
            )}
            {selection.objectIds.length > 0 && (
              <div>Objects: {selection.objectIds.map(id => id.slice(-4)).join(', ')}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

'use client';

import React from 'react';
import { useSelection, useSelectionStore } from '../stores/selectionStore';
import { useViewportStore } from '../stores/viewportStore';
import { useSceneStore } from '../stores/sceneStore';
import { useGeometryStore } from '../stores/geometryStore';

const Pill: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = '', children, ...rest }) => (
  <div
    className={`pointer-events-auto bg-black/40 backdrop-blur-md border border-white/10 rounded-xl shadow-lg shadow-black/30 ${className}`}
    {...rest}
  >
    {children}
  </div>
);

const SegButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }>
  = ({ className = '', active = false, children, ...rest }) => (
  <button
    className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
      active
        ? 'bg-white/10 text-white'
        : 'text-gray-300 hover:text-white hover:bg-white/5'
    } ${className}`}
    {...rest}
  >
    {children}
  </button>
);

const TopToolbar: React.FC = () => {
  const selection = useSelection();
  const selectionActions = useSelectionStore();
  const viewport = useViewportStore();
  const scene = useSceneStore();
  const geometry = useGeometryStore();

  const createCube = () => {
    const id = geometry.createCube(1.5);
    const objId = scene.createMeshObject(`Cube ${id.slice(-4)}`, id);
    scene.selectObject(objId);
    if (selection.viewMode === 'object') {
      selectionActions.selectObjects([objId]);
    }
  };

  const enterEdit = () => {
    if (selection.objectIds.length > 0) {
      const objId = selection.objectIds[0];
      const meshId = scene.objects[objId]?.meshId;
      if (meshId) selectionActions.enterEditMode(meshId);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Pill className="px-2 py-1">
        <div className="flex items-center gap-1">
          <SegButton active={selection.viewMode === 'object'} onClick={() => selectionActions.setViewMode('object')}>Object</SegButton>
          <SegButton active={selection.viewMode === 'edit'} onClick={enterEdit}>Edit</SegButton>
          <div className="mx-1 w-px h-4 bg-white/10" />
          <SegButton active={selection.selectionMode === 'vertex'} onClick={() => selectionActions.setSelectionMode('vertex')}>V</SegButton>
          <SegButton active={selection.selectionMode === 'edge'} onClick={() => selectionActions.setSelectionMode('edge')}>E</SegButton>
          <SegButton active={selection.selectionMode === 'face'} onClick={() => selectionActions.setSelectionMode('face')}>F</SegButton>
        </div>
      </Pill>

      <Pill className="px-2 py-1">
        <div className="flex items-center gap-1">
          <SegButton active={viewport.showGrid} onClick={() => viewport.toggleGrid()}>Grid</SegButton>
          <SegButton active={viewport.showAxes} onClick={() => viewport.toggleAxes()}>Axes</SegButton>
          <div className="mx-1 w-px h-4 bg-white/10" />
          <SegButton active={viewport.shadingMode === 'wireframe'} onClick={() => viewport.setShadingMode('wireframe')}>Wire</SegButton>
          <SegButton active={viewport.shadingMode === 'solid'} onClick={() => viewport.setShadingMode('solid')}>Solid</SegButton>
          <SegButton active={viewport.shadingMode === 'material'} onClick={() => viewport.setShadingMode('material')}>Mat</SegButton>
        </div>
      </Pill>

      <Pill className="px-2 py-1">
        <div className="flex items-center gap-1">
          <SegButton onClick={createCube}>+ Cube</SegButton>
        </div>
      </Pill>
    </div>
  );
};

export default TopToolbar;

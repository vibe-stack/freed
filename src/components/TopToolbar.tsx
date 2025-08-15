'use client';

import React from 'react';
import { useSelection, useSelectionStore } from '../stores/selectionStore';
import { useViewportStore } from '../stores/viewportStore';
import { useSceneStore } from '../stores/sceneStore';
import { useGeometryStore } from '../stores/geometryStore';
import { useShapeCreationStore } from '../stores/shapeCreationStore';

const Pill = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className = '', children, ...rest }, ref) => (
  <div
    ref={ref}
    className={`pointer-events-auto bg-black/40 backdrop-blur-md border border-white/10 rounded-xl shadow-lg shadow-black/30 ${className}`}
    {...rest}
  >
    {children}
  </div>
));
Pill.displayName = 'Pill';

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
  const shapeCreation = useShapeCreationStore();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    if (menuOpen) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  const beginShape = (shape: 'cube' | 'plane' | 'cylinder' | 'cone' | 'uvsphere' | 'icosphere' | 'torus') => {
    let id = '';
    let name = '';
    switch (shape) {
      case 'cube':
        id = geometry.createCube(1.5); name = 'Cube'; break;
      case 'plane':
        id = geometry.createPlane(2, 2, 1, 1); name = 'Plane'; break;
      case 'cylinder':
        id = geometry.createCylinder(0.75, 0.75, 2, 24, 1); name = 'Cylinder'; break;
      case 'cone':
        id = geometry.createCone(0.9, 2, 24, 1); name = 'Cone'; break;
      case 'uvsphere':
        id = geometry.createUVSphere(1, 24, 16); name = 'UV Sphere'; break;
      case 'icosphere':
        id = geometry.createIcoSphere(1, 1); name = 'Ico Sphere'; break;
      case 'torus':
        id = geometry.createTorus(1.2, 0.35, 16, 24); name = 'Torus'; break;
    }
    const objId = scene.createMeshObject(`${name} ${id.slice(-4)}`, id);
    scene.selectObject(objId);
    if (selection.viewMode === 'object') {
      selectionActions.selectObjects([objId]);
    }
    // Start shape creation panel
    shapeCreation.start(shape, id);
    setMenuOpen(false);
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

  <Pill className="px-2 py-1 relative" ref={menuRef as any}>
        <div className="flex items-center gap-1">
          <SegButton onClick={() => setMenuOpen((v) => !v)}>+ Add</SegButton>
        </div>
        {menuOpen && (
          <div className="absolute left-0 mt-2 w-44 pointer-events-auto z-30 bg-black/60 backdrop-blur-md border border-white/10 rounded-lg shadow-lg p-1">
            <button className="w-full text-left px-3 py-1.5 text-xs rounded hover:bg-white/5" onClick={() => beginShape('cube')}>Cube</button>
            <button className="w-full text-left px-3 py-1.5 text-xs rounded hover:bg-white/5" onClick={() => beginShape('plane')}>Plane</button>
            <button className="w-full text-left px-3 py-1.5 text-xs rounded hover:bg-white/5" onClick={() => beginShape('cylinder')}>Cylinder</button>
            <button className="w-full text-left px-3 py-1.5 text-xs rounded hover:bg-white/5" onClick={() => beginShape('cone')}>Cone</button>
            <button className="w-full text-left px-3 py-1.5 text-xs rounded hover:bg-white/5" onClick={() => beginShape('uvsphere')}>UV Sphere</button>
            <button className="w-full text-left px-3 py-1.5 text-xs rounded hover:bg-white/5" onClick={() => beginShape('icosphere')}>Sphere</button>
            <button className="w-full text-left px-3 py-1.5 text-xs rounded hover:bg-white/5" onClick={() => beginShape('torus')}>Torus</button>
          </div>
        )}
      </Pill>
    </div>
  );
};

export default TopToolbar;

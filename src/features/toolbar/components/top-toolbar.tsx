'use client';

import React from 'react';
import { Menu } from '@base-ui-components/react/menu';
import AddObjectMenu from '@/features/shared/add-object-menu';
import { useSelection, useSelectionStore } from '@/stores/selection-store';
import { useViewportStore } from '@/stores/viewport-store';
import { useSceneStore } from '@/stores/scene-store';
import { useGeometryStore } from '@/stores/geometry-store';
import { useShapeCreationStore } from '@/stores/shape-creation-store';
import { useToolStore } from '@/stores/tool-store';

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
      className={`px-3 py-1.5 text-xs rounded-md transition-colors ${active
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
  const tools = useToolStore();
  const viewport = useViewportStore();
  const scene = useSceneStore();
  const geometry = useGeometryStore();
  const shapeCreation = useShapeCreationStore();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [portalContainer, setPortalContainer] = React.useState<HTMLElement | null>(null);
  React.useEffect(() => { setPortalContainer(document.body); }, []);

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

  const addLight = (type: 'directional' | 'spot' | 'point' | 'ambient') => {
    const id = scene.createLightObject(
      `${type.charAt(0).toUpperCase() + type.slice(1)} Light`,
      type
    );
    scene.selectObject(id);
    if (selection.viewMode === 'object') selectionActions.selectObjects([id]);
  };

  const addCamera = (type: 'perspective' | 'orthographic') => {
    const id = scene.createCameraObject(
      type === 'perspective' ? 'Perspective Camera' : 'Orthographic Camera',
      type
    );
    scene.selectObject(id);
    if (selection.viewMode === 'object') selectionActions.selectObjects([id]);
  };

  const addParticleSystem = () => {
    const id = scene.createParticleSystemObject('Particle System');
    scene.selectObject(id);
    if (selection.viewMode === 'object') selectionActions.selectObjects([id]);
    setMenuOpen(false);
  };

  const addForce = (type: 'attractor'|'repulsor'|'vortex') => {
    const pretty = type.charAt(0).toUpperCase() + type.slice(1);
    const id = scene.createForceFieldObject(pretty, type);
    scene.selectObject(id);
    if (selection.viewMode === 'object') selectionActions.selectObjects([id]);
    setMenuOpen(false);
  };

  const enterEdit = () => {
    if (selection.objectIds.length > 0) {
      const objId = selection.objectIds[0];
      const meshId = scene.objects[objId]?.meshId;
      const locked = scene.objects[objId]?.locked;
      if (locked) return;
      if (meshId) selectionActions.enterEditMode(meshId);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Pill className="px-2 py-1">
        <div className="flex items-center gap-1">
          <SegButton
            active={selection.viewMode === 'object'}
            onClick={() => {
              if (selection.viewMode === 'edit') selectionActions.exitEditMode();
              else selectionActions.setViewMode('object');
            }}
          >
            Object
          </SegButton>
          <SegButton active={selection.viewMode === 'edit'} onClick={enterEdit}>Edit</SegButton>
          {selection.viewMode === 'edit' && (
            <div className="ml-1 flex items-center">
              <div className="mx-1 w-px h-4 bg-white/10" />
              <SegButton active={tools.editPalette === 'mesh'} onClick={() => tools.setEditPalette('mesh')}>Mesh</SegButton>
              <SegButton active={tools.editPalette === 'sculpt'} onClick={() => tools.setEditPalette('sculpt')}>Sculpt</SegButton>
            </div>
          )}
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

  <Pill className="px-1 py-1 relative">
        <AddObjectMenu
          portalContainer={portalContainer}
          controlledOpen={menuOpen}
          onOpenChange={setMenuOpen}
          triggerLabel={"Add"}
          triggerClassName={"px-2 py-1 text-xs rounded text-gray-300 hover:text-white hover:bg-white/5 data-[open]:bg-white/10 data-[open]:text-white"}
          onCreateShape={beginShape}
          onAddLight={addLight}
          onAddCamera={addCamera}
          onAddForce={addForce}
          onAddParticleSystem={addParticleSystem}
          onAddFluidSystem={() => { /* top toolbar: no fluid UI, create via scene API */ const id = scene.createFluidSystemObject('Fluid System'); scene.selectObject(id); if (selection.viewMode === 'object') selectionActions.selectObjects([id]); setMenuOpen(false); }}
        />
      </Pill>
    </div>
  );
};

export default TopToolbar;

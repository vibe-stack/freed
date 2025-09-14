"use client";

import React from 'react';
import { Menu } from '@base-ui-components/react/menu';

type Shape = 'cube' | 'plane' | 'cylinder' | 'cone' | 'uvsphere' | 'icosphere' | 'torus';

type Props = {
  portalContainer?: HTMLElement | null;
  openOnHover?: boolean;
  controlledOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  triggerLabel?: React.ReactNode;
  triggerClassName?: string;
  onCreateShape: (shape: Shape) => void;
  onCreateText?: () => void;
  onAddLight: (type: 'directional' | 'spot' | 'point' | 'ambient') => void;
  onAddCamera: (type: 'perspective' | 'orthographic') => void;
  onAddForce: (type: 'attractor' | 'repulsor' | 'vortex') => void;
  onAddParticleSystem: () => void;
  onAddFluidSystem?: () => void;
  onAddMetaball?: () => void;
  onCreateTerrain?: (type: 'perlin' | 'voronoi' | 'mountain') => void;
};

const AddObjectMenu: React.FC<Props> = ({
  portalContainer,
  openOnHover = false,
  controlledOpen,
  onOpenChange,
  triggerLabel = 'Add',
  triggerClassName = 'px-2 py-1 text-xs rounded text-gray-300 hover:text-white hover:bg-white/5',
  onCreateShape,
  onCreateText,
  onAddLight,
  onAddCamera,
  onAddForce,
  onAddParticleSystem,
  onAddFluidSystem,
  onAddMetaball,
  onCreateTerrain,
}) => {
  const closeIfControlled = () => { if (typeof onOpenChange === 'function') onOpenChange(false); };

  return (
    <Menu.Root modal={false} openOnHover={openOnHover} {...(controlledOpen !== undefined ? { open: controlledOpen, onOpenChange } : {})}>
      <Menu.Trigger className={triggerClassName}>{triggerLabel}</Menu.Trigger>
      <Menu.Portal container={portalContainer}>
        <Menu.Positioner sideOffset={6} className="z-90">
          <Menu.Popup className="mt-0 min-w-48 rounded border border-white/10 bg-[#0b0e13]/95 shadow-lg py-1 text-xs z-90" style={{ zIndex: 10050 }}>
            <Menu.Item className="w-full text-left px-3 py-1.5 hover:bg-white/10 text-gray-200" onClick={() => { onAddParticleSystem(); closeIfControlled(); }}>Particle System</Menu.Item>
            {onCreateText && (
              <Menu.Item className="w-full text-left px-3 py-1.5 hover:bg-white/10 text-gray-200" onClick={() => { onCreateText(); closeIfControlled(); }}>Text</Menu.Item>
            )}
            {onAddFluidSystem && (
              <Menu.Item className="w-full text-left px-3 py-1.5 hover:bg-white/10 text-gray-200" onClick={() => { onAddFluidSystem(); closeIfControlled(); }}>Fluid System</Menu.Item>
            )}
            {onAddMetaball && (
              <Menu.Item className="w-full text-left px-3 py-1.5 hover:bg-white/10 text-gray-200" onClick={() => { onAddMetaball(); closeIfControlled(); }}>Metaballs</Menu.Item>
            )}
            <Menu.Separator className="my-1 h-px bg-white/10" />

            {/* Force Field submenu */}
            <Menu.SubmenuRoot>
              <Menu.SubmenuTrigger className="w-full text-left px-3 py-1.5 hover:bg-white/10 text-gray-200">Force Field</Menu.SubmenuTrigger>
              <Menu.Portal container={portalContainer}>
                <Menu.Positioner sideOffset={6} className="z-90">
                  <Menu.Popup className="min-w-44 rounded border border-white/10 bg-[#0b0e13]/95 shadow-lg py-1 text-xs z-90" style={{ zIndex: 10050 }}>
                    <Menu.Item className="w-full text-left px-3 py-1.5 hover:bg-white/10 text-gray-200" onClick={() => { onAddForce('attractor'); closeIfControlled(); }}>Attractor</Menu.Item>
                    <Menu.Item className="w-full text-left px-3 py-1.5 hover:bg-white/10 text-gray-200" onClick={() => { onAddForce('repulsor'); closeIfControlled(); }}>Repulsor</Menu.Item>
                    <Menu.Item className="w-full text-left px-3 py-1.5 hover:bg-white/10 text-gray-200" onClick={() => { onAddForce('vortex'); closeIfControlled(); }}>Vortex</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.SubmenuRoot>

            <Menu.Separator className="my-1 h-px bg-white/10" />

            {/* Terrain submenu */}
            {onCreateTerrain && (
              <Menu.SubmenuRoot>
                <Menu.SubmenuTrigger className="w-full text-left px-3 py-1.5 hover:bg-white/10 text-gray-200">Terrain</Menu.SubmenuTrigger>
                <Menu.Portal container={portalContainer}>
                  <Menu.Positioner sideOffset={6} className="z-90">
                    <Menu.Popup className="min-w-44 rounded border border-white/10 bg-[#0b0e13]/95 shadow-lg py-1 text-xs z-90" style={{ zIndex: 10050 }}>
                      <Menu.Item className="w-full text-left px-3 py-1.5 hover:bg-white/10 text-gray-200" onClick={() => { onCreateTerrain('perlin'); closeIfControlled(); }}>Perlin</Menu.Item>
                      <Menu.Item className="w-full text-left px-3 py-1.5 hover:bg-white/10 text-gray-200" onClick={() => { onCreateTerrain('voronoi'); closeIfControlled(); }}>Voronoi</Menu.Item>
                      <Menu.Item className="w-full text-left px-3 py-1.5 hover:bg-white/10 text-gray-200" onClick={() => { onCreateTerrain('mountain'); closeIfControlled(); }}>Mountain</Menu.Item>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.SubmenuRoot>
            )}

            <Menu.Separator className="my-1 h-px bg-white/10" />

            {/* Mesh submenu */}
            <Menu.SubmenuRoot>
              <Menu.SubmenuTrigger className="w-full text-left px-3 py-1.5 hover:bg-white/10 text-gray-200">Mesh</Menu.SubmenuTrigger>
              <Menu.Portal container={portalContainer}>
                <Menu.Positioner sideOffset={6} className="z-90">
                  <Menu.Popup className="min-w-44 rounded border border-white/10 bg-[#0b0e13]/95 shadow-lg py-1 text-xs z-90" style={{ zIndex: 10050 }}>
                    <Menu.Item className="w-full text-left px-3 py-1.5 hover:bg-white/10 text-gray-200" onClick={() => { onCreateShape('cube'); closeIfControlled(); }}>Cube</Menu.Item>
                    <Menu.Item className="w-full text-left px-3 py-1.5 hover:bg-white/10 text-gray-200" onClick={() => { onCreateShape('plane'); closeIfControlled(); }}>Plane</Menu.Item>
                    <Menu.Item className="w-full text-left px-3 py-1.5 hover:bg-white/10 text-gray-200" onClick={() => { onCreateShape('cylinder'); closeIfControlled(); }}>Cylinder</Menu.Item>
                    <Menu.Item className="w-full text-left px-3 py-1.5 hover:bg-white/10 text-gray-200" onClick={() => { onCreateShape('cone'); closeIfControlled(); }}>Cone</Menu.Item>
                    <Menu.Item className="w-full text-left px-3 py-1.5 hover:bg-white/10 text-gray-200" onClick={() => { onCreateShape('uvsphere'); closeIfControlled(); }}>UV Sphere</Menu.Item>
                    <Menu.Item className="w-full text-left px-3 py-1.5 hover:bg-white/10 text-gray-200" onClick={() => { onCreateShape('icosphere'); closeIfControlled(); }}>Ico Sphere</Menu.Item>
                    <Menu.Item className="w-full text-left px-3 py-1.5 hover:bg-white/10 text-gray-200" onClick={() => { onCreateShape('torus'); closeIfControlled(); }}>Torus</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.SubmenuRoot>

            {/* Light submenu */}
            <Menu.SubmenuRoot>
              <Menu.SubmenuTrigger className="w-full text-left px-3 py-1.5 hover:bg-white/10 text-gray-200">Light</Menu.SubmenuTrigger>
              <Menu.Portal container={portalContainer}>
                <Menu.Positioner sideOffset={6} className="z-90">
                  <Menu.Popup className="min-w-44 rounded border border-white/10 bg-[#0b0e13]/95 shadow-lg py-1 text-xs z-90" style={{ zIndex: 10050 }}>
                    <Menu.Item className="w-full text-left px-3 py-1.5 hover:bg-white/10 text-gray-200" onClick={() => { onAddLight('directional'); closeIfControlled(); }}>Directional</Menu.Item>
                    <Menu.Item className="w-full text-left px-3 py-1.5 hover:bg-white/10 text-gray-200" onClick={() => { onAddLight('spot'); closeIfControlled(); }}>Spot</Menu.Item>
                    <Menu.Item className="w-full text-left px-3 py-1.5 hover:bg-white/10 text-gray-200" onClick={() => { onAddLight('point'); closeIfControlled(); }}>Point</Menu.Item>
                    <Menu.Item className="w-full text-left px-3 py-1.5 hover:bg-white/10 text-gray-200" onClick={() => { onAddLight('ambient'); closeIfControlled(); }}>Ambient</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.SubmenuRoot>

            {/* Camera submenu */}
            <Menu.SubmenuRoot>
              <Menu.SubmenuTrigger className="w-full text-left px-3 py-1.5 hover:bg-white/10 text-gray-200">Camera</Menu.SubmenuTrigger>
              <Menu.Portal container={portalContainer}>
                <Menu.Positioner sideOffset={6} className="z-90">
                  <Menu.Popup className="min-w-44 rounded border border-white/10 bg-[#0b0e13]/95 shadow-lg py-1 text-xs z-90" style={{ zIndex: 10050 }}>
                    <Menu.Item className="w-full text-left px-3 py-1.5 hover:bg-white/10 text-gray-200" onClick={() => { onAddCamera('perspective'); closeIfControlled(); }}>Perspective</Menu.Item>
                    <Menu.Item className="w-full text-left px-3 py-1.5 hover:bg-white/10 text-gray-200" onClick={() => { onAddCamera('orthographic'); closeIfControlled(); }}>Orthographic</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.SubmenuRoot>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
};

export default AddObjectMenu;

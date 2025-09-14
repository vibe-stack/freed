"use client";

import React, { useState } from 'react';
import { ContextMenu } from '@base-ui-components/react/context-menu';
import type { ShaderNodeType } from '@/types/shader';

type Props = {
  onAdd: (type: ShaderNodeType) => void;
};

// Hierarchical context menu content for adding shader nodes
export const ShaderContextMenuContent: React.FC<Props> = ({ onAdd }) => {
  const [openSub, setOpenSub] = useState<string | null>(null);
  const [subRect, setSubRect] = useState<{ top: number; left: number; right: number; height: number } | null>(null);
  const [subFlipX, setSubFlipX] = useState(false);
  const [subFlipY, setSubFlipY] = useState(false);

  const Item: React.FC<React.PropsWithChildren<{ onSelect?: () => void }>> = ({ children, onSelect }) => (
    <ContextMenu.Item onClick={onSelect}>
      <div className="px-2 py-1.5 cursor-default select-none hover:bg-white/10 rounded">{children}</div>
    </ContextMenu.Item>
  );

  const SubTrigger: React.FC<React.PropsWithChildren<{ id: string }>> = ({ id, children }) => (
    <div
      className="px-2 py-1.5 cursor-default select-none hover:bg-white/10 rounded flex items-center justify-between"
      onMouseEnter={(e) => {
        setOpenSub(id);
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
        setSubRect({ top: r.top, left: r.left, right: r.right, height: r.height });
        const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
        const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
        const approxW = 220;
        const approxH = Math.round(vh * 0.6);
        setSubFlipX(vw - r.right < approxW + 8);
        setSubFlipY(vh - r.top < approxH + 8);
      }}
    >
      <span>{children}</span>
      <span className="text-gray-500">▸</span>
    </div>
  );

  const SubMenu: React.FC<React.PropsWithChildren<{ id: string }>> = ({ id, children }) => (
    <ContextMenu.Portal>
      <div
        className={`fixed min-w-44 max-h-64 text-sm overflow-y-auto overscroll-contain rounded-md border border-white/10 bg-zinc-900/90 p-1 shadow-lg shadow-black/40 ${
          openSub === id ? 'block' : 'hidden'
        }`}
        style={{
          left: (subFlipX ? (subRect?.left ?? 0) - 8 : (subRect?.right ?? 0) + 8),
          top: (subRect?.top ?? 0) + (subFlipY ? (subRect?.height ?? 0) : 0),
          transform: `translate(${subFlipX ? '-100%' : '0'}, ${subFlipY ? '-100%' : '0'})`,
          zIndex: 10050,
        }}
        onMouseLeave={() => setOpenSub(null)}
      >
        {children}
      </div>
    </ContextMenu.Portal>
  );

  return (
    <div className="relative" onMouseLeave={() => setOpenSub(null)}>
      {/* Constants */}
      <div className="relative">
        <SubTrigger id="constants">Constants</SubTrigger>
        <SubMenu id="constants">
          <Item onSelect={() => onAdd('const-float')}>Float</Item>
          <Item onSelect={() => onAdd('const-color')}>Color</Item>
        </SubMenu>
      </div>

      {/* Inputs */}
      <div className="relative">
        <SubTrigger id="inputs">Inputs</SubTrigger>
        <SubMenu id="inputs">
          <Item onSelect={() => onAdd('uv')}>UV</Item>
          <Item onSelect={() => onAdd('normal')}>Normal</Item>
          <Item onSelect={() => onAdd('positionAttr')}>Position (Local)</Item>
          <Item onSelect={() => onAdd('worldPosition')}>Position (World)</Item>
          <Item onSelect={() => onAdd('texture')}>Texture</Item>
          <Item onSelect={() => onAdd('uvScale')}>UV Scale</Item>
          <Item onSelect={() => onAdd('uvTransform')}>UV Transform</Item>
        </SubMenu>
      </div>

      {/* Math */}
      <div className="relative">
        <SubTrigger id="math">Math</SubTrigger>
        <SubMenu id="math">
          <Item onSelect={() => onAdd('add')}>Add</Item>
          <Item onSelect={() => onAdd('mul')}>Multiply</Item>
          <Item onSelect={() => onAdd('mix')}>Mix</Item>
        </SubMenu>
      </div>

      {/* Common */}
      <div className="relative">
        <SubTrigger id="common">Common</SubTrigger>
        <SubMenu id="common">
          <Item onSelect={() => onAdd('abs')}>Abs</Item>
          <Item onSelect={() => onAdd('clamp')}>Clamp</Item>
          <Item onSelect={() => onAdd('saturate')}>Saturate</Item>
          <Item onSelect={() => onAdd('min')}>Min</Item>
          <Item onSelect={() => onAdd('max')}>Max</Item>
          <Item onSelect={() => onAdd('step')}>Step</Item>
          <Item onSelect={() => onAdd('smoothstep')}>Smoothstep</Item>
          <Item onSelect={() => onAdd('pow')}>Pow</Item>
          <Item onSelect={() => onAdd('sqrt')}>Sqrt</Item>
          <Item onSelect={() => onAdd('fract')}>Fract</Item>
          <Item onSelect={() => onAdd('sign')}>Sign</Item>
          <Item onSelect={() => onAdd('floor')}>Floor</Item>
          <Item onSelect={() => onAdd('ceil')}>Ceil</Item>
          <Item onSelect={() => onAdd('exp')}>Exp</Item>
          <Item onSelect={() => onAdd('log')}>Log</Item>
          <Item onSelect={() => onAdd('length')}>Length</Item>
          <Item onSelect={() => onAdd('normalize')}>Normalize</Item>
          <Item onSelect={() => onAdd('dot')}>Dot</Item>
          <Item onSelect={() => onAdd('cross')}>Cross</Item>
          <Item onSelect={() => onAdd('distance')}>Distance</Item>
        </SubMenu>
      </div>

      {/* Trig */}
      <div className="relative">
        <SubTrigger id="trig">Trig</SubTrigger>
        <SubMenu id="trig">
          <Item onSelect={() => onAdd('sin')}>Sin</Item>
          <Item onSelect={() => onAdd('cos')}>Cos</Item>
          <Item onSelect={() => onAdd('tan')}>Tan</Item>
          <Item onSelect={() => onAdd('asin')}>Asin</Item>
          <Item onSelect={() => onAdd('acos')}>Acos</Item>
          <Item onSelect={() => onAdd('atan')}>Atan</Item>
        </SubMenu>
      </div>

      {/* Vectors */}
      <div className="relative">
        <SubTrigger id="vectors">Vectors</SubTrigger>
        <SubMenu id="vectors">
          <Item onSelect={() => onAdd('vec2')}>Vec2</Item>
          <Item onSelect={() => onAdd('vec3')}>Vec3</Item>
          <Item onSelect={() => onAdd('vec4')}>Vec4</Item>
          <Item onSelect={() => onAdd('swizzle')}>Swizzle</Item>
          <Item onSelect={() => onAdd('combine')}>Combine</Item>
          <Item onSelect={() => onAdd('unpack')}>Unpack</Item>
        </SubMenu>
      </div>

      {/* Operators */}
      <div className="relative">
        <SubTrigger id="operators">Operators</SubTrigger>
        <SubMenu id="operators">
          <Item onSelect={() => onAdd('add')}>Add</Item>
          <Item onSelect={() => onAdd('sub')}>Subtract</Item>
          <Item onSelect={() => onAdd('mul')}>Multiply</Item>
          <Item onSelect={() => onAdd('div')}>Divide</Item>
          <Item onSelect={() => onAdd('assign')}>Assign</Item>
          <Item onSelect={() => onAdd('mod')}>Mod</Item>
          <div className="px-2 pt-1 text-[10px] uppercase tracking-wide text-gray-500">Comparisons</div>
          <Item onSelect={() => onAdd('equal')}>Equal</Item>
          <Item onSelect={() => onAdd('notEqual')}>Not Equal</Item>
          <Item onSelect={() => onAdd('lessThan')}>Less Than</Item>
          <Item onSelect={() => onAdd('greaterThan')}>Greater Than</Item>
          <Item onSelect={() => onAdd('lessThanEqual')}>Less Than Equal</Item>
          <Item onSelect={() => onAdd('greaterThanEqual')}>Greater Than Equal</Item>
          <div className="px-2 pt-1 text-[10px] uppercase tracking-wide text-gray-500">Logical</div>
          <Item onSelect={() => onAdd('and')}>And</Item>
          <Item onSelect={() => onAdd('or')}>Or</Item>
          <Item onSelect={() => onAdd('not')}>Not</Item>
          <Item onSelect={() => onAdd('xor')}>Xor</Item>
          <div className="px-2 pt-1 text-[10px] uppercase tracking-wide text-gray-500">Bitwise</div>
          <Item onSelect={() => onAdd('bitAnd')}>Bit And</Item>
          <Item onSelect={() => onAdd('bitNot')}>Bit Not</Item>
          <Item onSelect={() => onAdd('bitOr')}>Bit Or</Item>
          <Item onSelect={() => onAdd('bitXor')}>Bit Xor</Item>
          <Item onSelect={() => onAdd('shiftLeft')}>Shift Left</Item>
          <Item onSelect={() => onAdd('shiftRight')}>Shift Right</Item>
        </SubMenu>
      </div>

      {/* Oscillator */}
      <div className="relative">
        <SubTrigger id="oscillator">Oscillator</SubTrigger>
        <SubMenu id="oscillator">
          <Item onSelect={() => onAdd('oscSine')}>Sine</Item>
          <Item onSelect={() => onAdd('oscSquare')}>Square</Item>
          <Item onSelect={() => onAdd('oscTriangle')}>Triangle</Item>
          <Item onSelect={() => onAdd('oscSawtooth')}>Sawtooth</Item>
        </SubMenu>
      </div>

      {/* Model */}
      <div className="relative">
        <SubTrigger id="model">Model</SubTrigger>
        <SubMenu id="model">
          <Item onSelect={() => onAdd('modelDirection')}>Direction</Item>
          <Item onSelect={() => onAdd('modelViewMatrix')}>View Matrix</Item>
          <Item onSelect={() => onAdd('modelNormalMatrix')}>Normal Matrix</Item>
          <Item onSelect={() => onAdd('modelWorldMatrix')}>World Matrix</Item>
          <Item onSelect={() => onAdd('modelPosition')}>Position</Item>
          <Item onSelect={() => onAdd('modelScale')}>Scale</Item>
          <Item onSelect={() => onAdd('modelViewPosition')}>View Position</Item>
          <Item onSelect={() => onAdd('modelWorldMatrixInverse')}>World Matrix Inverse</Item>
          <Item onSelect={() => onAdd('highpModelViewMatrix')}>Highp View Matrix</Item>
          <Item onSelect={() => onAdd('highpModelNormalViewMatrix')}>Highp Normal View Matrix</Item>
        </SubMenu>
      </div>

      {/* Attributes */}
      <div className="relative">
        <SubTrigger id="attrs">Attributes</SubTrigger>
        <SubMenu id="attrs">
          <Item onSelect={() => onAdd('positionAttr')}>Position</Item>
          <Item onSelect={() => onAdd('normalAttr')}>Normal</Item>
          <Item onSelect={() => onAdd('uvAttr')}>UV</Item>
          <Item onSelect={() => onAdd('viewPosition')}>View Position</Item>
          <Item onSelect={() => onAdd('worldPosition')}>World Position</Item>
          <Item onSelect={() => onAdd('cameraPosition')}>Camera Position</Item>
        </SubMenu>
      </div>

      {/* Time */}
      <div className="relative">
        <SubTrigger id="time">Time</SubTrigger>
        <SubMenu id="time">
          <Item onSelect={() => onAdd('time')}>Time</Item>
          <Item onSelect={() => onAdd('timeSine')}>Time Sine</Item>
          <Item onSelect={() => onAdd('timeCos')}>Time Cos</Item>
          <div className="px-2 pt-1 text-[10px] uppercase tracking-wide text-gray-500">Animation</div>
          <Item onSelect={() => onAdd('animTime')}>Animation Time</Item>
          <Item onSelect={() => onAdd('animFrame')}>Animation Frame</Item>
        </SubMenu>
      </div>

      {/* Conditionals */}
      <div className="relative">
        <SubTrigger id="conditionals">Conditionals</SubTrigger>
        <SubMenu id="conditionals">
          <Item onSelect={() => onAdd('select')}>Select (Ternary)</Item>
        </SubMenu>
      </div>

      {/* Camera */}
      <div className="relative">
        <SubTrigger id="camera">Camera</SubTrigger>
        <SubMenu id="camera">
          <Item onSelect={() => onAdd('cameraNear')}>Near</Item>
          <Item onSelect={() => onAdd('cameraFar')}>Far</Item>
          <Item onSelect={() => onAdd('cameraProjectionMatrix')}>Projection Matrix</Item>
          <Item onSelect={() => onAdd('cameraProjectionMatrixInverse')}>Projection Matrix Inverse</Item>
          <Item onSelect={() => onAdd('cameraViewMatrix')}>View Matrix</Item>
          <Item onSelect={() => onAdd('cameraWorldMatrix')}>World Matrix</Item>
          <Item onSelect={() => onAdd('cameraNormalMatrix')}>Normal Matrix</Item>
        </SubMenu>
      </div>

      {/* Screen & Viewport */}
      <div className="relative">
        <SubTrigger id="screen">Screen/Viewport</SubTrigger>
        <SubMenu id="screen">
          <Item onSelect={() => onAdd('screenUV')}>Screen UV</Item>
          <Item onSelect={() => onAdd('screenCoordinate')}>Screen Coordinate</Item>
          <Item onSelect={() => onAdd('screenSize')}>Screen Size</Item>
          <Item onSelect={() => onAdd('viewportUV')}>Viewport UV</Item>
          <Item onSelect={() => onAdd('viewport')}>Viewport</Item>
          <Item onSelect={() => onAdd('viewportCoordinate')}>Viewport Coordinate</Item>
          <Item onSelect={() => onAdd('viewportSize')}>Viewport Size</Item>
        </SubMenu>
      </div>

      {/* UV Utils */}
      <div className="relative">
        <SubTrigger id="uvutils">UV Utils</SubTrigger>
        <SubMenu id="uvutils">
          <Item onSelect={() => onAdd('matcapUV')}>Matcap UV</Item>
          <Item onSelect={() => onAdd('rotateUV')}>Rotate UV</Item>
          <Item onSelect={() => onAdd('spherizeUV')}>Spherize UV</Item>
          <Item onSelect={() => onAdd('spritesheetUV')}>Spritesheet UV</Item>
          <Item onSelect={() => onAdd('equirectUV')}>Equirect UV</Item>
        </SubMenu>
      </div>

      {/* Interpolation */}
      <div className="relative">
        <SubTrigger id="interp">Interpolation</SubTrigger>
        <SubMenu id="interp">
          <Item onSelect={() => onAdd('remap')}>Remap</Item>
          <Item onSelect={() => onAdd('remapClamp')}>Remap Clamp</Item>
        </SubMenu>
      </div>

      {/* Random */}
      <div className="relative">
        <SubTrigger id="random">Random</SubTrigger>
        <SubMenu id="random">
          <Item onSelect={() => onAdd('hash')}>Hash</Item>
        </SubMenu>
      </div>

      {/* Rotate */}
      <div className="relative">
        <SubTrigger id="rotate">Rotate</SubTrigger>
        <SubMenu id="rotate">
          <Item onSelect={() => onAdd('rotate')}>Rotate</Item>
        </SubMenu>
      </div>

      {/* Blend Modes */}
      <div className="relative">
        <SubTrigger id="blend">Blend</SubTrigger>
        <SubMenu id="blend">
          <Item onSelect={() => onAdd('blendBurn')}>Burn</Item>
          <Item onSelect={() => onAdd('blendDodge')}>Dodge</Item>
          <Item onSelect={() => onAdd('blendOverlay')}>Overlay</Item>
          <Item onSelect={() => onAdd('blendScreen')}>Screen</Item>
          <Item onSelect={() => onAdd('blendColor')}>Color</Item>
        </SubMenu>
      </div>

      {/* Packing */}
      <div className="relative">
        <SubTrigger id="pack">Packing</SubTrigger>
        <SubMenu id="pack">
          <Item onSelect={() => onAdd('directionToColor')}>Direction To Color</Item>
          <Item onSelect={() => onAdd('colorToDirection')}>Color To Direction</Item>
        </SubMenu>
      </div>

      {/* Debug/Visualization */}
      <div className="relative">
        <SubTrigger id="debug">Debug</SubTrigger>
        <SubMenu id="debug">
          <Item onSelect={() => onAdd('debugHeight')}>Height Gradient</Item>
          <Item onSelect={() => onAdd('debugWorldY')}>World Y</Item>
          <Item onSelect={() => onAdd('debugLocalY')}>Local Y</Item>
          <div className="px-2 pt-1 text-[10px] uppercase tracking-wide text-gray-500">Direct Access</div>
          <Item onSelect={() => onAdd('vertexPosition')}>Vertex Position</Item>
          <Item onSelect={() => onAdd('vertexY')}>Vertex Y</Item>
          <Item onSelect={() => onAdd('testAllAxes')}>Test All Axes (RGB=XYZ)</Item>
        </SubMenu>
      </div>
    </div>
  );
};

export default ShaderContextMenuContent;

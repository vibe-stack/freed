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

  const Item: React.FC<React.PropsWithChildren<{ onSelect?: () => void }>> = ({ children, onSelect }) => (
    <ContextMenu.Item onClick={onSelect}>
      <div className="px-2 py-1.5 cursor-default select-none hover:bg-white/10 rounded">{children}</div>
    </ContextMenu.Item>
  );

  const SubTrigger: React.FC<React.PropsWithChildren<{ id: string }>> = ({ id, children }) => (
    <div
      className="px-2 py-1.5 cursor-default select-none hover:bg-white/10 rounded flex items-center justify-between"
      onMouseEnter={() => setOpenSub(id)}
    >
      <span>{children}</span>
      <span className="text-gray-500">▸</span>
    </div>
  );

  const SubMenu: React.FC<React.PropsWithChildren<{ id: string }>> = ({ id, children }) => (
    <div
      className={`absolute left-full top-0 ml-1 min-w-44 rounded-md border border-white/10 bg-zinc-900/90 p-1 shadow-lg shadow-black/40 max-h-64 overflow-y-auto ${
        openSub === id ? 'block' : 'hidden'
      }`}
      onMouseLeave={() => setOpenSub(null)}
    >
      {children}
    </div>
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
    </div>
  );
};

export default ShaderContextMenuContent;

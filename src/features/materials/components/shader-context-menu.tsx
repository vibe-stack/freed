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
      className={`absolute left-full top-0 ml-1 min-w-44 rounded-md border border-white/10 bg-zinc-900/90 p-1 shadow-lg shadow-black/40 ${
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
    </div>
  );
};

export default ShaderContextMenuContent;

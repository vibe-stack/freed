"use client";

import MenuBar from '@/features/menu/components/menu-bar';
import SceneHierarchyPanel from '@/features/scene-hierarchy/components/scene-hierarchy-panel';
import { ShapeAdjustPanel } from '@/features/shape-creation';
import { TopToolbar } from '@/features/toolbar';
import { SelectionSummary } from '@/features/toolbar/components/selection-summary';
import { ToolIndicator } from '@/features/tools';
import { EditorViewport } from '@/features/viewport';
import React from 'react';

const EditorLayout: React.FC = () => {
  return (
    <div className="w-screen h-screen overflow-hidden bg-[#0e1116] text-gray-200">
      {/* Top OS-like Menu Bar */}
      <MenuBar />

      {/* Main content area */}
      <div className="relative w-full h-[calc(100vh-32px)]">{/* 32px menu height */}
        {/* 3D Viewport fills area */}
        <EditorViewport />

        {/* Floating Top Toolbar */}
        <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-3 z-20">
          <TopToolbar />
        </div>

        {/* Right Scene Hierarchy Panel */}
        <div className="absolute left-4 top-32 z-20">
          <SceneHierarchyPanel />
        </div>

        {/* Bottom-left selection summary */}
        <div className="absolute left-4 bottom-4 z-20 max-w-md">
          <div className="bg-black/30 backdrop-blur-sm rounded-md border border-white/10 p-3">
            <SelectionSummary />
          </div>
        </div>
        
        {/* Tool Indicator - shows when tools are active */}
        <ToolIndicator />

        {/* Bottom-center shape segmentation panel */}
        <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-4 z-20">
          <ShapeAdjustPanel />
        </div>
      </div>
    </div>
  );
};

export default EditorLayout;

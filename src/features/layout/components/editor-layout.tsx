"use client";

import MenuBar from '@/features/menu/components/menu-bar';
import SceneHierarchyPanel from '@/features/scene-hierarchy/components/scene-hierarchy-panel';
import { ShapeAdjustPanel } from '@/features/shape-creation';
import { TopToolbar } from '@/features/toolbar';
import { EditToolsToolbar } from '@/features/toolbar';
import { SculptToolsToolbar } from '@/features/toolbar/components/sculpt-tools-toolbar';
import { useToolStore } from '@/stores/tool-store';
import { SelectionSummary } from '@/features/toolbar/components/selection-summary';
import { ToolIndicator } from '@/features/tools';
import { EditorViewport } from '@/features/viewport';
import { PropertiesPanel } from '@/features/properties-panel/components/properties-panel';
import React from 'react';
import ShaderEditor from '@/features/materials/components/shader-editor';
import { useShaderEditorStore } from '@/stores/shader-editor-store';

const EditorLayout: React.FC = () => {
  const shaderOpen = useShaderEditorStore((s) => s.open);
  const setShaderOpen = useShaderEditorStore((s) => s.setOpen);
  const editPalette = useToolStore((s) => s.editPalette);
  return (
    <div className="w-screen h-screen overflow-hidden bg-[#0e1116] text-gray-200">
      {/* Top OS-like Menu Bar */}
  <MenuBar onOpenShaderEditor={() => setShaderOpen(true)} />

      {/* Main content area */}
      <div className="relative w-full h-[calc(100vh-32px)]">{/* 32px menu height */}
        {/* 3D Viewport fills area */}
        <EditorViewport />

        {/* Floating Top Toolbar */}
        <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-3 z-20 space-y-2 flex flex-col items-center">
          <TopToolbar />
          {/* Edit/Sculpt toolbars (only one visible based on palette) */}
          {editPalette === 'sculpt' ? <SculptToolsToolbar /> : <EditToolsToolbar />}
        </div>

        {/* Left Scene Hierarchy Panel */}
        <div className="absolute left-4 top-32 z-20">
          <SceneHierarchyPanel />
        </div>

        {/* Right Properties Panel */}
        <div className="absolute right-4 top-32 z-20">
          <PropertiesPanel />
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

  {/* Shader Editor Panel */}
  <ShaderEditor open={shaderOpen} onOpenChange={setShaderOpen} />
      </div>
    </div>
  );
};

export default EditorLayout;

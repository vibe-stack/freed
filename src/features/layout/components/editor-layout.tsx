"use client";

import MenuBar from '@/features/menu/components/menu-bar';
import SceneHierarchyPanel from '@/features/scene-hierarchy/components/scene-hierarchy-panel';
import { ShapeAdjustPanel } from '@/features/shape-creation';
import { TopToolbar } from '@/features/toolbar';
import { EditToolsToolbar } from '@/features/toolbar';
import { SculptToolsToolbar } from '@/features/toolbar/components/sculpt-tools-toolbar';
import { useToolStore } from '@/stores/tool-store';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { ToolIndicator } from '@/features/tools';
import { EditorViewport } from '@/features/viewport';
import { PropertiesPanel } from '@/features/properties-panel/components/properties-panel';
import React from 'react';
import ShaderEditor from '@/features/materials/components/shader-editor';
import { useShaderEditorStore } from '@/stores/shader-editor-store';
import { CameraSwitcher } from '@/features/toolbar';
import BottomBar from '@/features/animation/components/BottomBar';
import Timeline from '@/features/animation/components/Timeline';
import { useAnimationStore } from '@/stores/animation-store';
import UVEditor from '@/features/uv-editor/components/uv-editor';
import { useUVEditorStore } from '@/stores/uv-editor-store';
import { AnimatePresence } from "motion/react"

const EditorLayout: React.FC = () => {
  const shaderOpen = useShaderEditorStore((s) => s.open);
  const setShaderOpen = useShaderEditorStore((s) => s.setOpen);
  const editPalette = useToolStore((s) => s.editPalette);
  const timelineOpen = useAnimationStore((s) => s.timelinePanelOpen);
  const minimalUi = useWorkspaceStore((s) => s.minimalUi ?? false);
  const activeClipId = useAnimationStore((s) => s.activeClipId);
  const uvOpen = useUVEditorStore((s) => s.open);
  const setUVOpen = useUVEditorStore((s) => s.setOpen);
  const createClip = useAnimationStore((s) => s.createClip);
  React.useEffect(() => {
    if (!activeClipId) {
      try { createClip('Clip'); } catch { }
    }
  }, [activeClipId, createClip]);
  return (
    <div className="w-screen h-screen overflow-hidden bg-[#0e1116] text-gray-200">
      {/* Top OS-like Menu Bar */}
      <MenuBar onOpenShaderEditor={() => setShaderOpen(true)} />

      {/* Main content area uses flex so bottom bar reduces viewport height */}
      <div className="flex flex-col w-full h-[calc(100vh-32px)]">{/* 32px menu height */}
        {/* Viewport region (flex-1) with overlays positioned relative to it */}
        <div className="relative flex-1">
          {/* 3D Viewport fills region */}
          <EditorViewport />

          {/* Floating Top Toolbar */}
          <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-3 z-20 space-y-2 flex flex-col items-center">
            <TopToolbar />
            {/* Edit/Sculpt toolbars (only one visible based on palette) */}
            {editPalette === 'sculpt' ? <SculptToolsToolbar /> : <EditToolsToolbar />}
          </div>

          {/* Right slim camera switcher aligned with top toolbar */}
          <div className="absolute right-4 top-3 z-20">
            <div className="pointer-events-auto">
              <CameraSwitcher />
            </div>
          </div>

          {/* Left Scene Hierarchy Panel - shrink when timeline open */}
          <AnimatePresence>
            {!minimalUi && (
              <div className="absolute left-4 z-20" style={{ top: timelineOpen ? 80 : 128 }}>
                <div style={{ height: timelineOpen ? '44dvh' : '60dvh' }}>
                  <SceneHierarchyPanel />
                </div>
              </div>
            )}
          </AnimatePresence>

          {/* Right Properties Panel - shrink when timeline open */}
          <AnimatePresence>
            {!minimalUi && (
              <div className="absolute right-4 z-20" style={{ top: timelineOpen ? 80 : 128 }}>
                <div style={{ height: timelineOpen ? '44dvh' : '60dvh' }}>
                  <PropertiesPanel />
                </div>
              </div>
            )}
          </AnimatePresence>

          {/* Tool Indicator - shows when tools are active */}
          <ToolIndicator />

          {/* Bottom-center shape segmentation panel */}
          <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-4 z-20">
            <ShapeAdjustPanel />
          </div>

          {/* Shader Editor Panel */}
          <ShaderEditor open={shaderOpen} onOpenChange={setShaderOpen} />
          {/* UV Editor Panel */}
          <UVEditor open={uvOpen} onOpenChange={setUVOpen} />

          {/* Timeline overlays inside the viewport region */}
          {timelineOpen && <Timeline />}
        </div>

        {/* Bottom bar now consumes layout height instead of overlapping */}
        <BottomBar />
      </div>
    </div>
  );
};

export default EditorLayout;

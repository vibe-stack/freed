'use client';

import React, { useEffect, useRef, createContext, useContext } from 'react';
import { useSelectionStore } from '../stores/selection-store';
import { useSceneStore } from '../stores/scene-store';
import { useToolStore } from '../stores/tool-store';
import { useClipboardStore } from '@/stores/clipboard-store';

interface ShortcutConfig {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean; // Cmd key on macOS / Meta on others
  action: () => void;
  description: string;
  preventDefault?: boolean;
}

interface ShortcutContextType {
  registerShortcuts: (shortcuts: ShortcutConfig[]) => () => void;
}

const ShortcutContext = createContext<ShortcutContextType | null>(null);

export const useShortcuts = () => {
  const context = useContext(ShortcutContext);
  if (!context) {
    throw new Error('useShortcuts must be used within ShortcutProvider');
  }
  return context;
};

interface ShortcutProviderProps {
  children: React.ReactNode;
}

export const ShortcutProvider: React.FC<ShortcutProviderProps> = ({ children }) => {
  const shortcutsRef = useRef<Map<string, ShortcutConfig>>(new Map());

  // Global shortcuts - Blender-compatible (read current state at press time)
  const globalShortcuts: ShortcutConfig[] = [
    {
      key: 'Tab',
      action: () => {
        const selection = useSelectionStore.getState().selection;
        const scene = useSceneStore.getState();
        const selActions = useSelectionStore.getState();
        if (selection.viewMode === 'object') {
          if (selection.objectIds.length > 0) {
            const objId = selection.objectIds[0];
            const meshId = scene.objects[objId]?.meshId;
            if (meshId) selActions.enterEditMode(meshId);
          }
        } else {
          selActions.exitEditMode();
        }
      },
      description: 'Toggle between Object and Edit mode',
      preventDefault: true,
    },
  // Animation transport
  { key: ' ', action: () => { const a = require('@/stores/animation-store'); const s = a.useAnimationStore.getState(); if (s.activeClipId) s.togglePlay(); }, description: 'Play/Pause (Space)', preventDefault: true },
  { key: ' ', shift: true, action: () => { const a = require('@/stores/animation-store'); const s = a.useAnimationStore.getState(); if (s.activeClipId) s.stop(); }, description: 'Stop (Shift+Space)', preventDefault: true },
  { key: 'Home', action: () => { const a = require('@/stores/animation-store'); const s = a.useAnimationStore.getState(); const clip = s.activeClipId ? s.clips[s.activeClipId] : null; if (clip) s.seekSeconds(clip.start); }, description: 'Seek to In (Home)', preventDefault: true },
  { key: 'End', action: () => { const a = require('@/stores/animation-store'); const s = a.useAnimationStore.getState(); const clip = s.activeClipId ? s.clips[s.activeClipId] : null; if (clip) s.seekSeconds(clip.end); }, description: 'Seek to Out (End)', preventDefault: true },
  { key: 'l', action: () => { const a = require('@/stores/animation-store'); const s = a.useAnimationStore.getState(); const clip = s.activeClipId ? s.clips[s.activeClipId] : null; if (clip) s.toggleLoop(); }, description: 'Toggle Loop (L)', preventDefault: true },
  { key: 'k', action: () => { const a = require('@/stores/animation-store'); const s = a.useAnimationStore.getState(); s.setAutoKey(!s.autoKey); }, description: 'Toggle Auto-key (K)', preventDefault: true },
  { key: 't', action: () => { const a = require('@/stores/animation-store'); const s = a.useAnimationStore.getState(); s.toggleTimelinePanel(); }, description: 'Toggle Timeline Panel (T)', preventDefault: true },
  { key: 'j', action: () => { const a = require('@/stores/animation-store'); const s = a.useAnimationStore.getState(); s.prevKey(); }, description: 'Prev Keyframe (J)', preventDefault: true },
  { key: 'n', action: () => { const a = require('@/stores/animation-store'); const s = a.useAnimationStore.getState(); s.nextKey(); }, description: 'Next Keyframe (N)', preventDefault: true },
    // Selection modes (only work in edit mode)
    { key: '1', action: () => { const s = useSelectionStore.getState().selection; if (s.viewMode === 'edit') useSelectionStore.getState().setSelectionMode('vertex'); }, description: 'Switch to Vertex selection mode (Edit Mode)', preventDefault: true },
    { key: '2', action: () => { const s = useSelectionStore.getState().selection; if (s.viewMode === 'edit') useSelectionStore.getState().setSelectionMode('edge'); }, description: 'Switch to Edge selection mode (Edit Mode)', preventDefault: true },
    { key: '3', action: () => { const s = useSelectionStore.getState().selection; if (s.viewMode === 'edit') useSelectionStore.getState().setSelectionMode('face'); }, description: 'Switch to Face selection mode (Edit Mode)', preventDefault: true },
    { key: 'a', alt: true, action: () => useSelectionStore.getState().clearSelection(), description: 'Clear selection (Alt+A)', preventDefault: true },
    { key: 'Escape', action: () => useSelectionStore.getState().clearSelection(), description: 'Clear selection (Escape)', preventDefault: true },
    // Tool shortcuts - only work in edit mode with selection
    {
      key: 'g',
      action: () => {
        const selection = useSelectionStore.getState().selection;
        const tool = useToolStore.getState();
        if (tool.isActive) return;
        if (selection.viewMode === 'edit') {
          const hasSelection = selection.vertexIds.length > 0 || selection.edgeIds.length > 0 || selection.faceIds.length > 0;
          if (hasSelection) useToolStore.getState().startOperation('move', null);
        } else if (selection.viewMode === 'object') {
          if (selection.objectIds.length > 0) useToolStore.getState().startOperation('move', null);
        }
      },
      description: 'Move tool (G)',
      preventDefault: true,
    },
    {
      key: 'r',
      action: () => {
        const selection = useSelectionStore.getState().selection;
        const tool = useToolStore.getState();
        if (tool.isActive) return;
        if (selection.viewMode === 'edit') {
          const hasSelection = selection.vertexIds.length > 0 || selection.edgeIds.length > 0 || selection.faceIds.length > 0;
          if (hasSelection) useToolStore.getState().startOperation('rotate', null);
        } else if (selection.viewMode === 'object') {
          if (selection.objectIds.length > 0) useToolStore.getState().startOperation('rotate', null);
        }
      },
      description: 'Rotate tool (R)',
      preventDefault: true,
    },
    {
      key: 's',
      action: () => {
        const selection = useSelectionStore.getState().selection;
        const tool = useToolStore.getState();
        if (tool.isActive) return;
        if (selection.viewMode === 'edit') {
          const hasSelection = selection.vertexIds.length > 0 || selection.edgeIds.length > 0 || selection.faceIds.length > 0;
          if (hasSelection) useToolStore.getState().startOperation('scale', null);
        } else if (selection.viewMode === 'object') {
          if (selection.objectIds.length > 0) useToolStore.getState().startOperation('scale', null);
        }
      },
      description: 'Scale tool (S)',
      preventDefault: true,
    },
    {
      key: 'e',
      action: () => {
        const selection = useSelectionStore.getState().selection;
        const tool = useToolStore.getState();
        if (tool.isActive) return;
        if (selection.viewMode === 'edit' && selection.faceIds.length > 0) {
          useToolStore.getState().startOperation('extrude', null);
        }
      },
      description: 'Extrude (E) — faces only for now',
      preventDefault: true,
    },
    {
      key: 'i',
      action: () => {
        const selection = useSelectionStore.getState().selection;
        const tool = useToolStore.getState();
        if (tool.isActive) return;
        if (selection.viewMode === 'edit' && selection.faceIds.length > 0) {
          useToolStore.getState().startOperation('inset', null);
        }
      },
      description: 'Inset (I) — faces only for now',
      preventDefault: true,
    },
    {
      key: 'b',
      ctrl: true,
      action: () => {
        const selection = useSelectionStore.getState().selection;
        const tool = useToolStore.getState();
        if (tool.isActive) return;
        if (selection.viewMode === 'edit' && selection.faceIds.length > 0) {
          useToolStore.getState().startOperation('bevel', null);
        }
      },
      description: 'Bevel (Ctrl+B) — faces only for now',
      preventDefault: true,
    },
    {
      key: 'r',
      ctrl: true,
      action: () => {
        const selection = useSelectionStore.getState().selection;
        const tool = useToolStore.getState();
        if (tool.isActive) return;
        if (selection.viewMode === 'edit') {
          useToolStore.getState().startOperation('loopcut', null);
        }
      },
      description: 'Loop Cut (Ctrl+R) — preview: hover shows yellow ticks, mouse wheel sets segments',
      preventDefault: true,
    },
    // Delete selected objects in Object Mode
    {
      key: 'Delete',
      action: () => {
        const sel = useSelectionStore.getState().selection;
        if (sel.viewMode !== 'object' || sel.objectIds.length === 0) return;
        const scene = useSceneStore.getState();
        sel.objectIds.forEach((id) => scene.removeObject(id));
        useSelectionStore.getState().clearSelection();
      },
      description: 'Delete selected objects',
      preventDefault: true,
    },
    {
      key: 'Backspace',
      action: () => {
        const sel = useSelectionStore.getState().selection;
        if (sel.viewMode !== 'object' || sel.objectIds.length === 0) return;
        const scene = useSceneStore.getState();
        sel.objectIds.forEach((id) => scene.removeObject(id));
        useSelectionStore.getState().clearSelection();
      },
      description: 'Delete selected objects (Backspace)',
      preventDefault: true,
    },
    // Copy/Cut/Paste for Object Mode
    {
      key: 'c',
      meta: true,
      action: () => {
        const sel = useSelectionStore.getState().selection;
        if (sel.viewMode !== 'object') return;
  useClipboardStore.getState().copySelection();
      },
      description: 'Copy selection (Cmd/Ctrl+C)',
      preventDefault: true,
    },
    {
      key: 'c',
      ctrl: true,
      action: () => {
        const sel = useSelectionStore.getState().selection;
        if (sel.viewMode !== 'object') return;
        useClipboardStore.getState().copySelection();
      },
      description: 'Copy selection (Ctrl+C)',
      preventDefault: true,
    },
    {
      key: 'x',
      meta: true,
      action: () => {
        const sel = useSelectionStore.getState().selection;
        if (sel.viewMode !== 'object') return;
        useClipboardStore.getState().cutSelection();
      },
      description: 'Cut selection (Cmd/Ctrl+X)',
      preventDefault: true,
    },
    {
      key: 'x',
      ctrl: true,
      action: () => {
        const sel = useSelectionStore.getState().selection;
        if (sel.viewMode !== 'object') return;
        useClipboardStore.getState().cutSelection();
      },
      description: 'Cut selection (Ctrl+X)',
      preventDefault: true,
    },
    {
      key: 'v',
      meta: true,
      action: () => {
        useClipboardStore.getState().paste();
      },
      description: 'Paste (Cmd/Ctrl+V)',
      preventDefault: true,
    },
    {
      key: 'v',
      ctrl: true,
      action: () => {
        useClipboardStore.getState().paste();
      },
      description: 'Paste (Ctrl+V)',
      preventDefault: true,
    },
  ];

  const createKeyString = (config: ShortcutConfig): string => {
    const parts: string[] = [];
    if (config.ctrl) parts.push('ctrl');
    if (config.shift) parts.push('shift');
    if (config.alt) parts.push('alt');
  if (config.meta) parts.push('meta');
    parts.push(config.key.toLowerCase());
    return parts.join('+');
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
      return;
    }

    // Avoid interfering with Shader Editor shortcuts for these keys when it's focused
  const inShaderEditor = !!(target.closest && target.closest('.shader-flow-root'));
  const keyLower = event.key.toLowerCase();
    const isCopyCutPaste = (keyLower === 'c' || keyLower === 'x' || keyLower === 'v') && (event.metaKey || event.ctrlKey);
    const isDeleteKey = keyLower === 'delete' || keyLower === 'backspace';
    if (inShaderEditor && (isCopyCutPaste || isDeleteKey)) {
      // Let the shader editor handle copy/cut/paste/delete
      return;
    }

    const keyString = createKeyString({
      key: event.key.length === 1 ? event.key.toLowerCase() : event.key,
      ctrl: event.ctrlKey, // don't treat meta as ctrl, to avoid conflicts on macOS
      shift: event.shiftKey,
      alt: event.altKey,
  meta: event.metaKey,
      action: () => {},
      description: '',
    });

    const shortcut = shortcutsRef.current.get(keyString);
    if (shortcut) {
      if (shortcut.preventDefault) {
        event.preventDefault();
        event.stopPropagation();
      }
      shortcut.action();
    }
  };

  const registerShortcuts = (shortcuts: ShortcutConfig[]): (() => void) => {
    shortcuts.forEach(shortcut => {
      const keyString = createKeyString(shortcut);
      shortcutsRef.current.set(keyString, shortcut);
    });

    return () => {
      shortcuts.forEach(shortcut => {
        const keyString = createKeyString(shortcut);
        shortcutsRef.current.delete(keyString);
      });
    };
  };

  useEffect(() => {
    const cleanup = registerShortcuts(globalShortcuts);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      cleanup();
      document.removeEventListener('keydown', handleKeyDown);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const contextValue: ShortcutContextType = {
    registerShortcuts,
  };

  return (
    <ShortcutContext.Provider value={contextValue}>
      {children}
    </ShortcutContext.Provider>
  );
};

export { ShortcutContext };

export const useRegisterShortcuts = (shortcuts: ShortcutConfig[]) => {
  const { registerShortcuts } = useShortcuts();

  useEffect(() => {
    const cleanup = registerShortcuts(shortcuts);
    return cleanup;
  }, [shortcuts, registerShortcuts]);
};

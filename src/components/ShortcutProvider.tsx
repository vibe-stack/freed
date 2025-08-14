'use client';

import React, { useEffect, useRef, createContext, useContext } from 'react';
import { useSelectionStore } from '../stores/selectionStore';
import { useSceneStore } from '../stores/sceneStore';

interface ShortcutConfig {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
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
  const selectionActions = useSelectionStore();
  const sceneStore = useSceneStore();

  // Global shortcuts - Blender-compatible
  const globalShortcuts: ShortcutConfig[] = [
    {
      key: 'Tab',
      action: () => {
        const currentSelection = selectionActions.selection;
        if (currentSelection.viewMode === 'object') {
          // Enter edit mode - require a selected object
          if (currentSelection.objectIds.length > 0) {
            const objId = currentSelection.objectIds[0];
            const meshId = sceneStore.objects[objId]?.meshId;
            if (meshId) selectionActions.enterEditMode(meshId);
          } else {
            console.log('Select an object first to enter Edit Mode');
          }
        } else {
          // Exit edit mode
          selectionActions.exitEditMode();
        }
      },
      description: 'Toggle between Object and Edit mode',
      preventDefault: true,
    },
    // Selection modes (only work in edit mode)
    {
      key: '1',
      action: () => {
        const currentSelection = selectionActions.selection;
        if (currentSelection.viewMode === 'edit') {
          selectionActions.setSelectionMode('vertex');
        }
      },
      description: 'Switch to Vertex selection mode (Edit Mode)',
      preventDefault: true,
    },
    {
      key: '2',
      action: () => {
        const currentSelection = selectionActions.selection;
        if (currentSelection.viewMode === 'edit') {
          selectionActions.setSelectionMode('edge');
        }
      },
      description: 'Switch to Edge selection mode (Edit Mode)',
      preventDefault: true,
    },
    {
      key: '3',
      action: () => {
        const currentSelection = selectionActions.selection;
        if (currentSelection.viewMode === 'edit') {
          selectionActions.setSelectionMode('face');
        }
      },
      description: 'Switch to Face selection mode (Edit Mode)',
      preventDefault: true,
    },
    {
      key: 'a',
      alt: true,
      action: () => selectionActions.clearSelection(),
      description: 'Clear selection (Alt+A)',
      preventDefault: true,
    },
    {
      key: 'Escape',
      action: () => selectionActions.clearSelection(),
      description: 'Clear selection (Escape)',
      preventDefault: true,
    },
  ];

  const createKeyString = (config: ShortcutConfig): string => {
    const parts: string[] = [];
    if (config.ctrl) parts.push('ctrl');
    if (config.shift) parts.push('shift');
    if (config.alt) parts.push('alt');
    parts.push(config.key.toLowerCase());
    return parts.join('+');
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
      return;
    }

    const keyString = createKeyString({
      key: event.key,
      ctrl: event.ctrlKey || event.metaKey,
      shift: event.shiftKey,
      alt: event.altKey,
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

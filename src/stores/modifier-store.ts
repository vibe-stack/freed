// Compatibility layer: re-export modifier hooks and actions from geometry store
import { useGeometryStore } from './geometry-store';
import type { ModifierStackItem, ModifierType } from '../utils/modifiers';

export interface ModifiersActions {
  addModifier: (objectId: string, type: ModifierType) => string; // returns modifier id
  removeModifier: (objectId: string, modifierId: string) => void;
  moveModifier: (objectId: string, fromIndex: number, toIndex: number) => void;
  setModifierEnabled: (objectId: string, modifierId: string, enabled: boolean) => void;
  updateModifierSettings: (objectId: string, modifierId: string, updater: (settings: any) => void) => void;
  applyModifier: (objectId: string, modifierId: string) => void;
  clearAll: (objectId: string) => void;
}

// Provide a hook with same name/shape as before, but backed by geometry store
export const useModifiersStore = () => {
  const addModifier = useGeometryStore((s) => s.addModifier);
  const removeModifier = useGeometryStore((s) => s.removeModifier);
  const moveModifier = useGeometryStore((s) => s.moveModifier);
  const setModifierEnabled = useGeometryStore((s) => s.setModifierEnabled);
  const updateModifierSettings = useGeometryStore((s) => s.updateModifierSettings);
  const applyModifier = useGeometryStore((s) => s.applyModifier);
  const clearAllModifiers = useGeometryStore((s) => s.clearAllModifiers);
  return {
    addModifier,
    removeModifier,
    moveModifier,
    setModifierEnabled,
    updateModifierSettings,
    applyModifier,
    clearAll: clearAllModifiers,
  } as ModifiersActions;
};

// Selector with stable empty reference
const EMPTY_STACK: ReadonlyArray<ModifierStackItem> = Object.freeze([]);
export const useObjectModifiers = (objectId: string) =>
  useGeometryStore((s) => (s.modifierStacks[objectId] ?? (EMPTY_STACK as ModifierStackItem[])));

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { subscribeWithSelector } from 'zustand/middleware';
import { nanoid } from 'nanoid';
import type { Mesh } from '@/types/geometry';
import { useSceneStore } from './scene-store';
import { useGeometryStore } from './geometry-store';
import { applyModifiersToMesh, type ModifierStackItem, type ModifierType, createDefaultSettings } from '../utils/modifiers';

export interface ModifiersState {
  // Map objectId -> array stack top-to-bottom
  stacks: Record<string, ModifierStackItem[]>;
}

export interface ModifiersActions {
  addModifier: (objectId: string, type: ModifierType) => string; // returns modifier id
  removeModifier: (objectId: string, modifierId: string) => void;
  moveModifier: (objectId: string, fromIndex: number, toIndex: number) => void;
  setModifierEnabled: (objectId: string, modifierId: string, enabled: boolean) => void;
  updateModifierSettings: (objectId: string, modifierId: string, updater: (settings: any) => void) => void;
  applyModifier: (objectId: string, modifierId: string) => void;
  clearAll: (objectId: string) => void;
}

type ModifiersStore = ModifiersState & ModifiersActions;

export const useModifiersStore = create<ModifiersStore>()(
  subscribeWithSelector(
    immer((set, get) => ({
      stacks: {},

      addModifier: (objectId, type) => {
        const id = nanoid();
        set((state) => {
          const stack = state.stacks[objectId] ?? [];
          const next = [...stack, { id, type, enabled: true, settings: createDefaultSettings(type) }];
          state.stacks[objectId] = next;
        });
        return id;
      },

      removeModifier: (objectId, modifierId) => {
        set((state) => {
          const stack = state.stacks[objectId];
          if (!stack) return;
          const idx = stack.findIndex((m: ModifierStackItem) => m.id === modifierId);
          if (idx >= 0) {
            const next = stack.slice(0, idx).concat(stack.slice(idx + 1));
            state.stacks[objectId] = next;
          }
        });
      },

      moveModifier: (objectId, fromIndex, toIndex) => {
        set((state) => {
          const stack = state.stacks[objectId];
          if (!stack) return;
          const from = Math.max(0, Math.min(fromIndex, stack.length - 1));
          const to = Math.max(0, Math.min(toIndex, stack.length - 1));
          if (from === to) return;
          const next = stack.slice();
          const [item] = next.splice(from, 1);
          next.splice(to, 0, item);
          state.stacks[objectId] = next;
        });
      },

      setModifierEnabled: (objectId, modifierId, enabled) => {
        set((state) => {
          const stack = state.stacks[objectId];
          if (!stack) return;
          const idx = stack.findIndex((m: ModifierStackItem) => m.id === modifierId);
          if (idx >= 0) {
            const prev = stack[idx];
            stack[idx] = { ...prev, enabled };
            // Force new array reference for selector stability
            state.stacks[objectId] = stack.slice();
          }
        });
      },

      updateModifierSettings: (objectId, modifierId, updater) => {
        set((state) => {
          const stack = state.stacks[objectId];
          if (!stack) return;
          const idx = stack.findIndex((m: ModifierStackItem) => m.id === modifierId);
          if (idx >= 0) {
            const prev = stack[idx];
            const nextSettings = { ...prev.settings };
            updater(nextSettings);
            stack[idx] = { ...prev, settings: nextSettings };
            state.stacks[objectId] = stack.slice();
          }
        });
      },

      applyModifier: (objectId, modifierId) => {
        const scene = useSceneStore.getState();
        const geo = useGeometryStore.getState();
        const obj = scene.objects[objectId];
        if (!obj || obj.type !== 'mesh' || !obj.meshId) return;
        const mesh = geo.meshes.get(obj.meshId);
        if (!mesh) return;

        const stack = get().stacks[objectId] ?? [];
        const idx = stack.findIndex((m) => m.id === modifierId);
        if (idx < 0) return;

        // Compute result of applying the stack up to and including the target modifier
        const toApply = stack.slice(0, idx + 1);
        const evaluated: Mesh = applyModifiersToMesh(mesh, toApply);

        // Bake into base mesh
        geo.replaceGeometry(mesh.id, evaluated.vertices, evaluated.faces);

        // Remove all applied modifiers up to and including target to avoid double-applying later modifiers
        set((state) => {
          const s = state.stacks[objectId];
          if (!s) return;
          const next = s.slice();
          next.splice(0, idx + 1);
          state.stacks[objectId] = next;
        });
      },

      clearAll: (objectId) => {
        set((state) => { delete state.stacks[objectId]; });
      },
    }))
  )
);

// Selectors
// Shared, frozen empty array to keep selector snapshots referentially stable
const EMPTY_STACK: ReadonlyArray<ModifierStackItem> = Object.freeze([]);
export const useObjectModifiers = (objectId: string) =>
  useModifiersStore((s) => (s.stacks[objectId] ?? (EMPTY_STACK as ModifierStackItem[])));

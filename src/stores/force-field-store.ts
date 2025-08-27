import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { nanoid } from 'nanoid';

export type ForceFieldType = 'attractor' | 'repulsor' | 'vortex';

export interface ForceField {
  id: string;
  type: ForceFieldType;
  name?: string;
  enabled: boolean;
  radius: number; // world units
  strength: number; // acceleration units per frame^2
}

interface ForceFieldState {
  fields: Record<string, ForceField>;
}

interface ForceFieldActions {
  addField: (type: ForceFieldType, partial?: Partial<ForceField>) => string; // returns id
  removeField: (id: string) => void;
  updateField: (id: string, partial: Partial<ForceField>) => void;
  getField: (id: string) => ForceField | undefined;
}

export type ForceFieldStore = ForceFieldState & ForceFieldActions;

const defaults = (type: ForceFieldType): ForceField => ({
  id: nanoid(),
  type,
  name: type.charAt(0).toUpperCase() + type.slice(1),
  enabled: true,
  radius: 3,
  strength: type === 'vortex' ? 0.03 : 0.02,
});

export const useForceFieldStore = create<ForceFieldStore>()(
  subscribeWithSelector(
    immer((set, get) => ({
      fields: {},
      addField: (type, partial) => {
        const f = { ...defaults(type), ...(partial || {}), id: nanoid(), type } as ForceField;
        set((s) => { s.fields[f.id] = f; });
        return f.id;
      },
      removeField: (id) => set((s) => { delete s.fields[id]; }),
      updateField: (id, partial) => set((s) => { const f = s.fields[id]; if (f) Object.assign(f, partial); }),
      getField: (id) => get().fields[id],
    }))
  )
);

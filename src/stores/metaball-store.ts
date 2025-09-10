import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { subscribeWithSelector } from 'zustand/middleware';
import { nanoid } from 'nanoid';
import { vec3 } from '@/utils/geometry';
export interface Metaball {
  id: string;
  radius: number;
  strength: number;
  color: { x: number; y: number; z: number };
  materialId?: string; // grouping key; undefined => default
}

interface MetaballGlobalSettings {
  resolution: number; // per-axis grid resolution for compute
  isoLevel: number;
  smoothNormals: boolean;
}

interface MetaballState {
  metaballs: Record<string, Metaball>;
  settings: MetaballGlobalSettings;
}

interface MetaballActions {
  addMetaball: (partial?: Partial<Metaball>) => string;
  removeMetaball: (id: string) => void;
  updateMetaball: (id: string, partial: Partial<Metaball>) => void;
  setSettings: (partial: Partial<MetaballGlobalSettings>) => void;
}

export type MetaballStore = MetaballState & MetaballActions;

const defaultMetaball = (): Metaball => ({
  id: nanoid(),
  radius: 1.0,
  strength: 1.5,
  color: vec3(0.3, 0.6, 1.0),
});

export const useMetaballStore = create<MetaballStore>()(
  subscribeWithSelector(
    immer((set, get) => ({
      metaballs: {},
      settings: { resolution: 32, isoLevel: 0.5, smoothNormals: true },
      addMetaball: (partial) => {
        const m = { ...defaultMetaball(), ...(partial || {}) };
        set((s) => { s.metaballs[m.id] = m; });
        return m.id;
      },
      removeMetaball: (id) => set((s) => { delete s.metaballs[id]; }),
      updateMetaball: (id, partial) => set((s) => { const m = s.metaballs[id]; if (m) Object.assign(m, partial); }),
      setSettings: (partial) => set((s) => { Object.assign(s.settings, partial); }),
    }))
  )
);

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

export type PropertiesTab =
  | 'inspector'
  | 'scene'
  | 'view-layer'
  | 'world'
  | 'modifiers'
  | 'object-data'
  | 'material'
  | 'render'
  | 'output';

interface PropertiesPanelState {
  activeTab: PropertiesTab;
}

interface PropertiesPanelActions {
  setActiveTab: (tab: PropertiesTab) => void;
  reset: () => void;
}

type PropertiesPanelStore = PropertiesPanelState & PropertiesPanelActions;

export const usePropertiesPanelStore = create<PropertiesPanelStore>()(
  subscribeWithSelector((set) => ({
    activeTab: 'inspector',
    setActiveTab: (tab) => set({ activeTab: tab }),
    reset: () => set({ activeTab: 'inspector' }),
  }))
);

export const useActivePropertiesTab = () =>
  usePropertiesPanelStore((s) => s.activeTab);

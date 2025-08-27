"use client";

import React from 'react';
import { useActivePropertiesTab, usePropertiesPanelStore, PropertiesTab } from '@/stores/properties-panel-store';
import { InspectorPanel } from './tabs/inspector-panel';
import { WorldPanel } from './tabs/world-panel';
import type { LucideIcon } from 'lucide-react';
import { Wrench, Box, Layers, Globe, Sliders, Camera, HardDrive } from 'lucide-react';
import ModifiersPanel from '@/features/properties-panel/components/tabs/modifiers-panel';

type TabDef = { key: PropertiesTab; label: string; icon: LucideIcon };

const tabs: TabDef[] = [
  { key: 'inspector', label: 'Inspector', icon: Wrench },
  { key: 'scene', label: 'Scene', icon: Box },
  { key: 'view-layer', label: 'View Layer', icon: Layers },
  { key: 'world', label: 'World', icon: Globe },
  { key: 'modifiers', label: 'Modifiers', icon: Sliders },
  { key: 'render', label: 'Render', icon: Camera },
  { key: 'output', label: 'Output', icon: HardDrive },
];

export const PropertiesPanel: React.FC = () => {
  const active = useActivePropertiesTab();
  const { setActiveTab } = usePropertiesPanelStore();

  return (
    <div className="bg-black/40 h-full backdrop-blur-md border border-white/10 rounded-lg shadow-lg shadow-black/30 w-80 flex flex-col text-[12px]">
      <div className="border-b border-white/10">
        <div className="flex gap-1 px-2 py-0.5">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              className={`px-1.5 py-0.5 rounded flex items-center justify-center ${active === key ? 'bg-white/10 text-white' : 'text-gray-300 hover:bg-white/5'}`}
              onClick={() => setActiveTab(key)}
              title={label}
              aria-label={label}
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
          ))}
        </div>

      </div>
  <div className="flex-1 min-h-0 overflow-auto">
        {active === 'inspector' && <InspectorPanel />}
        {active === 'world' && <WorldPanel />}
        {active === 'modifiers' && <ModifiersPanel />}
        {active !== 'inspector' && active !== 'world' && active !== 'modifiers' && (
          <div className="p-2 text-[11px] text-gray-500">
            {tabs.find((t) => t.key === active)?.label} panel coming soon.
          </div>
        )}
      </div>
    </div>
  );
};

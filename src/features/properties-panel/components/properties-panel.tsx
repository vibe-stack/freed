"use client";

import React from 'react';
import { useActivePropertiesTab, usePropertiesPanelStore, PropertiesTab } from '@/stores/properties-panel-store';
import { InspectorPanel } from './tabs/inspector-panel';
import { ScrollAreaHorizontal } from './scroll-area-horizontal';
import type { LucideIcon } from 'lucide-react';
import { Wrench, Box, Layers, Globe, Sliders, Camera, HardDrive } from 'lucide-react';

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
    <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-lg shadow-lg shadow-black/30 w-64 h-full flex flex-col">
      <div className="border-b border-white/10">
        <ScrollAreaHorizontal>
          <div className="flex gap-1 px-2 py-1">
            {tabs.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                className={`px-2 py-1 rounded flex items-center justify-center ${active === key ? 'bg-white/10 text-white' : 'text-gray-300 hover:bg-white/5'}`}
                onClick={() => setActiveTab(key)}
                title={label}
                aria-label={label}
              >
                <Icon className="h-4 w-4" strokeWidth={1.75} />
              </button>
            ))}
          </div>
        </ScrollAreaHorizontal>
      </div>
  <div className="flex-1 min-h-0 h-[60dvh] overflow-auto">
        {active === 'inspector' && <InspectorPanel />}
        {active !== 'inspector' && (
          <div className="p-3 text-xs text-gray-500">
            {tabs.find((t) => t.key === active)?.label} panel coming soon.
          </div>
        )}
      </div>
    </div>
  );
};

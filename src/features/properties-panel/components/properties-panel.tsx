"use client";

import React from 'react';
import { useActivePropertiesTab, usePropertiesPanelStore, PropertiesTab } from '@/stores/properties-panel-store';
import { InspectorPanel } from './tabs/inspector-panel';
import { ScrollAreaHorizontal } from './scroll-area-horizontal';

const tabs: { key: PropertiesTab; label: string }[] = [
  { key: 'inspector', label: 'Inspector' },
  { key: 'scene', label: 'Scene' },
  { key: 'view-layer', label: 'View Layer' },
  { key: 'world', label: 'World' },
  { key: 'modifiers', label: 'Modifiers' },
  { key: 'object-data', label: 'Object Data' },
  { key: 'material', label: 'Material' },
  { key: 'render', label: 'Render' },
  { key: 'output', label: 'Output' },
];

export const PropertiesPanel: React.FC = () => {
  const active = useActivePropertiesTab();
  const { setActiveTab } = usePropertiesPanelStore();

  return (
    <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-lg shadow-lg shadow-black/30 w-64 h-full flex flex-col">
      <div className="border-b border-white/10">
        <ScrollAreaHorizontal>
          <div className="flex gap-1 px-2 py-1">
            {tabs.map((t) => (
              <button
                key={t.key}
                className={`px-2 py-1 rounded text-xs whitespace-nowrap ${active === t.key ? 'bg-white/10 text-white' : 'text-gray-300 hover:bg-white/5'}`}
                onClick={() => setActiveTab(t.key)}
              >
                {t.label}
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

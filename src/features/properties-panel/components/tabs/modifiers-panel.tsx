"use client";

import React from 'react';
import { useSelectedObject } from '@/stores/scene-store';
import { useModifiersStore, useObjectModifiers } from '@/stores/modifier-store';
import { Eye, EyeOff, GripVertical, Trash2, Plus, ChevronUp, ChevronDown, Wand2 } from 'lucide-react';
import { ArraySettings } from '@/features/properties-panel/components/tabs/modifiers/array-settings';
import { WeldSettings } from '@/features/properties-panel/components/tabs/modifiers/weld-settings';
import { TriangulateSettings } from '@/features/properties-panel/components/tabs/modifiers/triangulate-settings';
import { EdgeSplitSettings } from '@/features/properties-panel/components/tabs/modifiers/edge-split-settings';
import { DecimateSettings } from '@/features/properties-panel/components/tabs/modifiers/decimate-settings';
import { SolidifySettings } from '@/features/properties-panel/components/tabs/modifiers/solidify-settings';
import { ScrewSettings } from '@/features/properties-panel/components/tabs/modifiers/screw-settings';
import { BevelSettings } from '@/features/properties-panel/components/tabs/modifiers/bevel-settings';
import { RemeshSettings } from '@/features/properties-panel/components/tabs/modifiers/remesh-settings';
import { MirrorSettings } from '@/features/properties-panel/components/tabs/modifiers/mirror-settings';
import { SubdivideSettings } from '@/features/properties-panel/components/tabs/modifiers/subdivide-settings';
import { VolumeToMeshSettings } from '@/features/properties-panel/components/tabs/modifiers/volume-to-mesh-settings';

const PanelSection: React.FC<{ title: string } & React.HTMLAttributes<HTMLDivElement>> = ({ title, children, className = '', ...rest }) => (
  <div className={`p-2 bg-white/5 border border-white/10 rounded ${className}`} {...rest}>
    <div className="text-xs uppercase tracking-wide text-gray-400 mb-2">{title}</div>
    {children}
  </div>
);

const SmallButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className = '', children, ...rest }) => (
  <button className={`p-1 rounded hover:bg-white/10 text-gray-300 ${className}`} {...rest}>{children}</button>
);

export const ModifiersPanel: React.FC = () => {
  const selected = useSelectedObject();
  const mods = useObjectModifiers(selected?.id ?? '');
  const actions = useModifiersStore();

  if (!selected || selected.type !== 'mesh') {
    return <div className="p-3 text-xs text-gray-500">Select a mesh object to add modifiers.</div>;
  }

  const add = (type: Parameters<typeof actions.addModifier>[1]) => actions.addModifier(selected.id, type);

  return (
    <div className="p-3 space-y-3 text-gray-200 text-sm">
      <PanelSection title="Stack">
        <div className="flex flex-col gap-1">
          {mods.length === 0 && (
            <div className="text-xs text-gray-500">No modifiers. Add one below.</div>
          )}
      {mods.map((m, i) => (
            <div key={m.id} className="flex items-center gap-2 bg-black/20 rounded px-2 py-1 border border-white/10">
              <GripVertical className="h-4 w-4 text-gray-500" />
              <div className="flex-1 truncate">
        <div className="text-xs font-medium">{labelForType(m.type)}</div>
              </div>
              <SmallButton onClick={() => actions.moveModifier(selected.id, i, Math.max(0, i - 1))} title="Move up" aria-label="Move up"><ChevronUp className="h-4 w-4" /></SmallButton>
              <SmallButton onClick={() => actions.moveModifier(selected.id, i, Math.min(mods.length - 1, i + 1))} title="Move down" aria-label="Move down"><ChevronDown className="h-4 w-4" /></SmallButton>
              <SmallButton onClick={() => actions.setModifierEnabled(selected.id, m.id, !m.enabled)} title={m.enabled ? 'Disable' : 'Enable'} aria-label="Toggle">
                {m.enabled ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </SmallButton>
              <SmallButton onClick={() => actions.applyModifier(selected.id, m.id)} title="Apply" aria-label="Apply"><Wand2 className="h-4 w-4" /></SmallButton>
              <SmallButton onClick={() => actions.removeModifier(selected.id, m.id)} title="Remove" aria-label="Remove"><Trash2 className="h-4 w-4" /></SmallButton>
            </div>
          ))}
        </div>
      </PanelSection>

      {mods.map((m) => (
        <PanelSection key={`settings-${m.id}`} title={`${labelForType(m.type)} Settings`}>
          <div className="flex flex-col gap-2">
            {m.type === 'mirror' && <MirrorSettings objectId={selected.id} id={m.id} />}
            {m.type === 'subdivide' && <SubdivideSettings objectId={selected.id} id={m.id} />} 
            {m.type === 'array' && <ArraySettings objectId={selected.id} id={m.id} />}
            {m.type === 'weld' && <WeldSettings objectId={selected.id} id={m.id} />}
            {m.type === 'triangulate' && <TriangulateSettings objectId={selected.id} id={m.id} />}
            {m.type === 'edge-split' && <EdgeSplitSettings objectId={selected.id} id={m.id} />}
            {m.type === 'decimate' && <DecimateSettings objectId={selected.id} id={m.id} />}
            {m.type === 'solidify' && <SolidifySettings objectId={selected.id} id={m.id} />}
            {m.type === 'screw' && <ScrewSettings objectId={selected.id} id={m.id} />}
            {m.type === 'bevel' && <BevelSettings objectId={selected.id} id={m.id} />}
            {m.type === 'remesh' && <RemeshSettings objectId={selected.id} id={m.id} />}
            {m.type === 'volume-to-mesh' && <VolumeToMeshSettings objectId={selected.id} id={m.id} />}
          </div>
        </PanelSection>
      ))}

      <PanelSection title="Add Modifier">
        <div className="grid grid-cols-2 gap-2">
      {(
            [
        'mirror','subdivide','array','weld','triangulate','edge-split','decimate','solidify','screw','bevel','remesh','volume-to-mesh'
            ] as const
          ).map((t) => (
            <button key={t} className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-gray-100 text-xs" onClick={() => add(t)}>
              <Plus className="inline h-3 w-3 mr-1" />{labelForType(t)}
            </button>
          ))}
        </div>
      </PanelSection>
    </div>
  );
};


export default ModifiersPanel;

function labelForType(type: string) {
  switch (type) {
    case 'mirror': return 'Mirror';
    case 'subdivide': return 'Subdivide';
    case 'array': return 'Array';
    case 'weld': return 'Weld';
    case 'triangulate': return 'Triangulate';
    case 'edge-split': return 'Edge Split';
    case 'decimate': return 'Decimate';
    case 'solidify': return 'Solidify';
    case 'screw': return 'Screw';
    case 'bevel': return 'Bevel';
    case 'remesh': return 'Remesh';
  case 'volume-to-mesh': return 'Volume to Mesh';
    default: return type;
  }
}

"use client";

import React from 'react';
import { useSelectedObject } from '@/stores/scene-store';
import { useModifiersStore, useObjectModifiers } from '@/stores/modifier-store';
import { Eye, EyeOff, GripVertical, Trash2, Plus, ChevronUp, ChevronDown, Wand2 } from 'lucide-react';
import { DragInput } from '@/components/drag-input';

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

  const add = (type: 'mirror' | 'subdivide') => actions.addModifier(selected.id, type);

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
                <div className="text-xs font-medium">{m.type === 'mirror' ? 'Mirror' : 'Subdivide'}</div>
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
        <PanelSection key={`settings-${m.id}`} title={`${m.type === 'mirror' ? 'Mirror' : 'Subdivide'} Settings`}>
          <div className="flex flex-col gap-2">
            {m.type === 'mirror' ? (
              <MirrorSettings objectId={selected.id} id={m.id} />
            ) : (
              <SubdivideSettings objectId={selected.id} id={m.id} />
            )}
          </div>
        </PanelSection>
      ))}

      <PanelSection title="Add Modifier">
        <div className="flex gap-2">
          <button className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-gray-100 text-xs" onClick={() => add('mirror')}><Plus className="inline h-3 w-3 mr-1" />Mirror</button>
          <button className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-gray-100 text-xs" onClick={() => add('subdivide')}><Plus className="inline h-3 w-3 mr-1" />Subdivide</button>
        </div>
      </PanelSection>
    </div>
  );
};

const MirrorSettings: React.FC<{ objectId: string; id: string }> = ({ objectId, id }) => {
  const actions = useModifiersStore();
  const mods = useObjectModifiers(objectId);
  const mod = mods.find((m) => m.id === id);
  if (!mod) return null;
  const s = mod.settings as { axis: 'x'|'y'|'z'; merge?: boolean; mergeThreshold?: number };

  return (
    <div className="flex flex-col gap-2 text-xs">
      <div className="flex items-center justify-between">
        <label className="text-gray-400">Axis</label>
        <select
          className="bg-black/40 border border-white/10 rounded px-2 py-1 text-gray-200"
          value={s.axis}
          onChange={(e) => actions.updateModifierSettings(objectId, id, (st) => { st.axis = e.target.value; })}
        >
          <option value="x">X</option>
          <option value="y">Y</option>
          <option value="z">Z</option>
        </select>
      </div>
      <div className="flex items-center justify-between">
        <label className="text-gray-400">Merge</label>
        <input type="checkbox" checked={!!s.merge} onChange={(e) => actions.updateModifierSettings(objectId, id, (st) => { st.merge = e.target.checked; })} />
      </div>
      <div className="flex items-center justify-between">
        <label className="text-gray-400">Threshold</label>
        <DragInput
          compact
          value={s.mergeThreshold ?? 0.0001}
          precision={4}
          step={0.0001}
          onChange={(v) => actions.updateModifierSettings(objectId, id, (st) => { st.mergeThreshold = v; })}
        />
      </div>
    </div>
  );
};

const SubdivideSettings: React.FC<{ objectId: string; id: string }> = ({ objectId, id }) => {
  const actions = useModifiersStore();
  const mods = useObjectModifiers(objectId);
  const mod = mods.find((m) => m.id === id);
  if (!mod) return null;
  const s = mod.settings as { level: number; smooth?: boolean; smoothIterations?: number; smoothStrength?: number };
  return (
    <div className="flex flex-col gap-2 text-xs">
      <div className="flex items-center justify-between">
        <label className="text-gray-400">Level</label>
        <DragInput
          compact
          min={1}
          max={3}
          step={1}
          value={Math.max(1, Math.min(3, Math.round(s.level ?? 1)))}
          onChange={(v) => actions.updateModifierSettings(objectId, id, (st) => { st.level = Math.max(1, Math.min(3, Math.round(v))); })}
        />
      </div>
      <div className="flex items-center justify-between">
        <label className="text-gray-400">Smooth</label>
        <input type="checkbox" checked={!!s.smooth} onChange={(e) => actions.updateModifierSettings(objectId, id, (st) => { st.smooth = e.target.checked; })} />
      </div>
      <div className="flex items-center justify-between">
        <label className="text-gray-400">Smooth Iterations</label>
        <DragInput
          compact
          min={0}
          max={5}
          step={1}
          value={Math.max(0, Math.min(5, Math.round(s.smoothIterations ?? 1)))}
          onChange={(v) => actions.updateModifierSettings(objectId, id, (st) => { st.smoothIterations = Math.max(0, Math.min(5, Math.round(v))); })}
        />
      </div>
      <div className="flex items-center justify-between">
        <label className="text-gray-400">Smooth Strength</label>
        <DragInput
          compact
          min={0}
          max={1}
          step={0.01}
          precision={2}
          value={Math.max(0, Math.min(1, s.smoothStrength ?? 0.2))}
          onChange={(v) => actions.updateModifierSettings(objectId, id, (st) => { st.smoothStrength = Math.max(0, Math.min(1, v)); })}
        />
      </div>
    </div>
  );
};

export default ModifiersPanel;

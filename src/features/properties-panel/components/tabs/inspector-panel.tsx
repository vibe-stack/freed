"use client";

import React, { useMemo } from 'react';
import { useSelectedObject, useSceneStore } from '@/stores/scene-store';
import { DragInput } from '@/components/drag-input';
import Switch from '@/components/switch';
import { LightSection } from './sections/light-section';
import { CameraSection } from './sections/camera-section';
import { ObjectDataSection } from './sections/object-data-section';
import { useAnimationStore, type PropertyPath } from '@/stores/animation-store';
import { Diamond as DiamondIcon } from 'lucide-react';
import { useParticlesStore } from '@/stores/particles-store';
import { useForceFieldStore } from '@/stores/force-field-store';

const Label: React.FC<{ label: string } & React.HTMLAttributes<HTMLDivElement>> = ({ label, children, className = '', ...rest }) => (
  <div className={`text-xs text-gray-400 ${className}`} {...rest}>
    <div className="uppercase tracking-wide mb-1">{label}</div>
    {children}
  </div>
);

const Row: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = '', children, ...rest }) => (
  <div className={`flex items-center gap-2 py-1 ${className}`} {...rest}>{children}</div>
);


export const InspectorPanel: React.FC = () => {
  const selected = useSelectedObject();
  const scene = useSceneStore();
  const playhead = useAnimationStore((s) => s.playhead);
  const fps = useAnimationStore((s) => s.fps);
  const activeClipId = useAnimationStore((s) => s.activeClipId);
  const ensureTrack = useAnimationStore((s) => s.ensureTrack);
  const toggleKeyAt = useAnimationStore((s) => s.toggleKeyAt);
  const hasKeyAtFn = useAnimationStore((s) => s.hasKeyAt);

  if (!selected) {
    return <div className="p-3 text-xs text-gray-500">No object selected.</div>;
  }

  const updateTransform = (partial: Partial<typeof selected.transform>) => {
    scene.setTransform(selected.id, partial);
  };

  const KeyButton: React.FC<{ property: PropertyPath; value: number; title?: string }>
    = ({ property, value, title }) => {
      // Read has-key reactively from the animation store so UI updates on timeline/keys changes
      const has = useAnimationStore((s) => {
        const f = Math.round(s.playhead * (s.fps || 24));
        const T = f / (s.fps || 24);
        const tid = Object.values(s.tracks).find((tr) => tr.targetId === selected.id && tr.property === property)?.id;
        if (!tid) return false;
        const tr = s.tracks[tid];
        return tr.channel.keys.some((k) => Math.abs(k.t - T) < 1e-6);
      });
      return (
        <button
          className={`-ml-0.5 mr-1 p-0.5 rounded hover:bg-white/10 transition-colors`}
          title={title || 'Toggle keyframe'}
          onClick={(e) => {
            e.stopPropagation();
            if (!activeClipId) return; // require a clip to key
            const s = useAnimationStore.getState();
            const f = Math.round(s.playhead * (s.fps || 24));
            const T = f / (s.fps || 24);
            s.toggleKeyAt(selected.id, property, T, value, 'linear');
          }}
        >
          <DiamondIcon className={`w-3 h-3 ${has ? 'text-amber-400' : 'text-gray-400/70 hover:text-white'}`} strokeWidth={2} />
        </button>
      );
    };

  return (
  <div className="p-2 space-y-3 text-gray-200 text-[12px]">
      <div>
    <div className="text-[11px] uppercase tracking-wide text-gray-400 mb-1">Object</div>
    <div className="bg-white/5 border border-white/10 rounded p-1.5">
          <Row>
      <div className="w-16 text-gray-400 text-[11px]">Name</div>
            <div className="flex-1 truncate">{selected.name}</div>
          </Row>
          <Row>
      <div className="w-16 text-gray-400 text-[11px]">Visible</div>
            <Switch checked={selected.visible} onCheckedChange={(v) => scene.setVisible(selected.id, v)} />
          </Row>
          <Row>
      <div className="w-16 text-gray-400 text-[11px]">Locked</div>
            <Switch checked={selected.locked} onCheckedChange={(v) => scene.setLocked(selected.id, v)} />
          </Row>
        </div>
      </div>

      <div>
    <div className="text-[11px] uppercase tracking-wide text-gray-400 mb-1">Transform</div>
    <div className="bg-white/5 border border-white/10 rounded p-1.5 space-y-1.5">
          <Label label="Location">
      <div className="grid grid-cols-3 gap-1.5">
              <div className="flex items-center">
                <KeyButton property="position.x" value={selected.transform.position.x} title="Key X location" />
                <DragInput compact label="X" value={selected.transform.position.x} precision={2} step={0.05} onChange={(v) => updateTransform({ position: { ...selected.transform.position, x: v } })} />
              </div>
              <div className="flex items-center">
                <KeyButton property="position.y" value={selected.transform.position.y} title="Key Y location" />
                <DragInput compact label="Y" value={selected.transform.position.y} precision={2} step={0.05} onChange={(v) => updateTransform({ position: { ...selected.transform.position, y: v } })} />
              </div>
              <div className="flex items-center">
                <KeyButton property="position.z" value={selected.transform.position.z} title="Key Z location" />
                <DragInput compact label="Z" value={selected.transform.position.z} precision={2} step={0.05} onChange={(v) => updateTransform({ position: { ...selected.transform.position, z: v } })} />
              </div>
            </div>
          </Label>
          <Label label="Rotation">
      <div className="grid grid-cols-3 gap-1.5">
              <div className="flex items-center">
                <KeyButton property="rotation.x" value={selected.transform.rotation.x} title="Key X rotation" />
                <DragInput compact label="X" value={selected.transform.rotation.x} precision={2} step={1} onChange={(v) => updateTransform({ rotation: { ...selected.transform.rotation, x: v } })} />
              </div>
              <div className="flex items-center">
                <KeyButton property="rotation.y" value={selected.transform.rotation.y} title="Key Y rotation" />
                <DragInput compact label="Y" value={selected.transform.rotation.y} precision={2} step={1} onChange={(v) => updateTransform({ rotation: { ...selected.transform.rotation, y: v } })} />
              </div>
              <div className="flex items-center">
                <KeyButton property="rotation.z" value={selected.transform.rotation.z} title="Key Z rotation" />
                <DragInput compact label="Z" value={selected.transform.rotation.z} precision={2} step={1} onChange={(v) => updateTransform({ rotation: { ...selected.transform.rotation, z: v } })} />
              </div>
            </div>
          </Label>
          <Label label="Scale">
      <div className="grid grid-cols-3 gap-1.5">
              <div className="flex items-center">
                <KeyButton property="scale.x" value={selected.transform.scale.x} title="Key X scale" />
                <DragInput compact label="X" value={selected.transform.scale.x} precision={2} step={0.05} onChange={(v) => updateTransform({ scale: { ...selected.transform.scale, x: v } })} />
              </div>
              <div className="flex items-center">
                <KeyButton property="scale.y" value={selected.transform.scale.y} title="Key Y scale" />
                <DragInput compact label="Y" value={selected.transform.scale.y} precision={2} step={0.05} onChange={(v) => updateTransform({ scale: { ...selected.transform.scale, y: v } })} />
              </div>
              <div className="flex items-center">
                <KeyButton property="scale.z" value={selected.transform.scale.z} title="Key Z scale" />
                <DragInput compact label="Z" value={selected.transform.scale.z} precision={2} step={0.05} onChange={(v) => updateTransform({ scale: { ...selected.transform.scale, z: v } })} />
              </div>
            </div>
          </Label>
        </div>
      </div>

      {selected.type === 'mesh' && (
        <div>
          <div className="text-[11px] uppercase tracking-wide text-gray-400 mb-1">Object Data</div>
          <ObjectDataSection objectId={selected.id} />
        </div>
      )}

      {selected.type === 'light' && selected.lightId && (
        <div>
          <LightSection lightId={selected.lightId} />
        </div>
      )}

      {selected.type === 'camera' && selected.cameraId && (
        <div>
          <CameraSection cameraId={selected.cameraId} />
        </div>
      )}

      {selected.type === 'particles' && selected.particleSystemId && (
        <div>
          <div className="text-[11px] uppercase tracking-wide text-gray-400 mb-1">Particle System</div>
          <ParticleSystemSection objectId={selected.id} systemId={selected.particleSystemId} />
        </div>
      )}

      {selected.type === 'force' && selected.forceFieldId && (
        <div>
          <div className="text-[11px] uppercase tracking-wide text-gray-400 mb-1">Force Field</div>
          <ForceFieldSection fieldId={selected.forceFieldId} />
        </div>
      )}
    </div>
  );
};

const XYZ: React.FC<{ label: string; value: { x: number; y: number; z: number }; onChange: (v: { x: number; y: number; z: number }) => void }>
  = ({ label, value, onChange }) => {
    return (
      <Label label={label}>
        <div className="grid grid-cols-3 gap-2">
          <DragInput compact label="X" value={value.x} precision={3} step={0.01} onChange={(x) => onChange({ ...value, x })} />
          <DragInput compact label="Y" value={value.y} precision={3} step={0.01} onChange={(y) => onChange({ ...value, y })} />
          <DragInput compact label="Z" value={value.z} precision={3} step={0.01} onChange={(z) => onChange({ ...value, z })} />
        </div>
      </Label>
    );
  };

const ParticleSystemSection: React.FC<{ objectId: string; systemId: string }>
  = ({ objectId, systemId }) => {
    const scene = useSceneStore();
    const particles = useParticlesStore();
    const sys = useParticlesStore((s) => s.systems[systemId]);
    if (!sys) return null;
    const update = (partial: Partial<typeof sys>) => particles.updateSystem(systemId, partial);

  const sceneObjects = Object.values(scene.objects);
  const allIds = sceneObjects.map((o) => o.id);
  const meshIds = sceneObjects.filter((o) => o.type === 'mesh' && o.meshId).map((o) => o.id);

    return (
      <div className="bg-white/5 border border-white/10 rounded p-2 space-y-2">
        <Label label="Emitter Object">
          <select
            className="w-full bg-transparent text-xs border border-white/10 rounded p-1"
            value={sys.emitterObjectId ?? ''}
            onChange={(e) => update({ emitterObjectId: e.target.value || null })}
          >
            <option value="">Use this object&apos;s transform</option>
            {allIds.map((id) => (
              <option key={id} value={id}>{scene.objects[id]?.name || id}</option>
            ))}
          </select>
        </Label>
        <Label label="Particle Object">
          <select
            className="w-full bg-transparent text-xs border border-white/10 rounded p-1"
            value={sys.particleObjectId ?? ''}
            onChange={(e) => update({ particleObjectId: e.target.value || null })}
          >
            <option value="">-- Select object to instance --</option>
            {meshIds.map((id) => (
              <option key={id} value={id}>{scene.objects[id]?.name || id}</option>
            ))}
          </select>
        </Label>
        <Label label="Emission Rate (per frame)">
          <DragInput compact value={sys.emissionRate} precision={2} step={0.5} onChange={(v) => update({ emissionRate: Math.max(0, v) })} />
        </Label>
        <Label label="Capacity (max particles)">
          <DragInput
            compact
            value={sys.capacity}
            precision={0}
            step={16}
            onChange={(v) => update({ capacity: Math.max(1, Math.min(2048, Math.round(v))) })}
          />
        </Label>
        <div className="grid grid-cols-2 gap-2">
          <Label label="Spawn Mode">
            <select
              className="w-full bg-transparent text-xs border border-white/10 rounded p-1"
              value={sys.spawnMode}
              onChange={(e) => update({ spawnMode: (e.target.value as any) })}
            >
              <option value="point">Point</option>
              <option value="surface">Surface</option>
            </select>
          </Label>
          {sys.spawnMode === 'point' && (
            <Label label="Position Jitter (local units)">
              <DragInput compact value={sys.positionJitter} precision={3} step={0.01} onChange={(v) => update({ positionJitter: Math.max(0, v) })} />
            </Label>
          )}
        </div>
        <XYZ label="Velocity (units/frame)" value={sys.velocity} onChange={(v) => update({ velocity: v })} />
        <Row>
          <div className="w-32 text-gray-400 text-xs">Velocity in Local Space</div>
          <Switch checked={sys.velocityLocal} onCheckedChange={(v) => update({ velocityLocal: !!v })} />
        </Row>
        <Label label="Velocity Jitter (units/frame)">
          <DragInput compact value={sys.velocityJitter} precision={3} step={0.01} onChange={(v) => update({ velocityJitter: Math.max(0, v) })} />
        </Label>
        <Label label="Lifetime (frames)">
          <DragInput compact value={sys.particleLifetime} precision={0} step={1} onChange={(v) => update({ particleLifetime: Math.max(1, Math.round(v)) })} />
        </Label>
        <div className="grid grid-cols-2 gap-2">
          <Label label="Min Scale">
            <DragInput compact value={sys.minScale} precision={3} step={0.01} onChange={(v) => update({ minScale: Math.max(0, v) })} />
          </Label>
          <Label label="Max Scale">
            <DragInput compact value={sys.maxScale} precision={3} step={0.01} onChange={(v) => update({ maxScale: Math.max(sys.minScale, v) })} />
          </Label>
        </div>
        <XYZ label="Angular Velocity (rad/frame)" value={sys.angularVelocity} onChange={(v) => update({ angularVelocity: v })} />
        <XYZ label="Gravity (world/frame^2)" value={sys.gravity} onChange={(v) => update({ gravity: v })} />
        <XYZ label="Wind (world/frame^2)" value={sys.wind} onChange={(v) => update({ wind: v })} />
        <div className="grid grid-cols-2 gap-2">
          <Label label="Seed">
            <DragInput compact value={sys.seed} precision={0} step={1} onChange={(v) => update({ seed: Math.max(0, Math.round(v)) })} />
          </Label>
          <div />
        </div>
      </div>
    );
  };

const ForceFieldSection: React.FC<{ fieldId: string }>
  = ({ fieldId }) => {
    const store = useForceFieldStore();
    const field = useForceFieldStore((s) => s.fields[fieldId]);
    if (!field) return null;
    const update = (partial: Partial<typeof field>) => store.updateField(fieldId, partial);
    return (
      <div className="bg-white/5 border border-white/10 rounded p-2 space-y-2">
        <Row>
          <div className="w-24 text-gray-400 text-xs">Enabled</div>
          <Switch checked={field.enabled} onCheckedChange={(v) => update({ enabled: !!v })} />
        </Row>
        <Label label="Type">
          <select
            className="w-full bg-transparent text-xs border border-white/10 rounded p-1"
            value={field.type}
            onChange={(e) => update({ type: e.target.value as any })}
          >
            <option value="attractor">Attractor</option>
            <option value="repulsor">Repulsor</option>
            <option value="vortex">Vortex</option>
          </select>
        </Label>
        <Label label="Radius (world units)">
          <DragInput compact value={field.radius} precision={2} step={0.05} onChange={(v) => update({ radius: Math.max(0.01, v) })} />
        </Label>
        <Label label={field.type === 'vortex' ? 'Angular Strength (rad/frame^2)' : 'Strength (units/frame^2)'}>
          <DragInput compact value={field.strength} precision={3} step={0.005} onChange={(v) => update({ strength: v })} />
        </Label>
      </div>
    );
  };

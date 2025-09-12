"use client";

import React from 'react';
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
import { useFluidStore } from '@/stores/fluid-store';
import { useTextStore, useTextResource } from '@/stores/text-store';
import { useMetaballStore } from '@/stores/metaball-store';
import { useTerrainStore } from '@/stores/terrain-store';
import { TerrainSection } from '../terrain-section';

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
  const activeClipId = useAnimationStore((s) => s.activeClipId);
  const terrains = useTerrainStore();


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
                <KeyButton property="rotation.x" value={selected.transform.rotation.x * (180 / Math.PI)} title="Key X rotation" />
                <DragInput compact label="X" value={selected.transform.rotation.x * (180 / Math.PI)} precision={1} step={5} onChange={(v) => updateTransform({ rotation: { ...selected.transform.rotation, x: v * (Math.PI / 180) } })} />
              </div>
              <div className="flex items-center">
                <KeyButton property="rotation.y" value={selected.transform.rotation.y * (180 / Math.PI)} title="Key Y rotation" />
                <DragInput compact label="Y" value={selected.transform.rotation.y * (180 / Math.PI)} precision={1} step={5} onChange={(v) => updateTransform({ rotation: { ...selected.transform.rotation, y: v * (Math.PI / 180) } })} />
              </div>
              <div className="flex items-center">
                <KeyButton property="rotation.z" value={selected.transform.rotation.z * (180 / Math.PI)} title="Key Z rotation" />
                <DragInput compact label="Z" value={selected.transform.rotation.z * (180 / Math.PI)} precision={1} step={5} onChange={(v) => updateTransform({ rotation: { ...selected.transform.rotation, z: v * (Math.PI / 180) } })} />
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
          <div className="mt-2">
            <button
              className="px-2 py-1 rounded border border-white/10 hover:bg-white/10 text-xs"
              onClick={() => terrains.createTerrain({ name: 'Terrain' })}
            >
              Create Terrain
            </button>
          </div>
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
          <ParticleSystemSection systemId={selected.particleSystemId} />
        </div>
      )}

      {selected.type === 'force' && selected.forceFieldId && (
        <div>
          <div className="text-[11px] uppercase tracking-wide text-gray-400 mb-1">Force Field</div>
          <ForceFieldSection fieldId={selected.forceFieldId} />
        </div>
      )}
      {selected.type === 'fluid' && selected.fluidSystemId && (
        <div>
          <div className="text-[11px] uppercase tracking-wide text-gray-400 mb-1">Fluid System</div>
          <FluidSystemSection systemId={selected.fluidSystemId} />
        </div>
      )}
    {selected.type === 'metaball' && selected.metaballId && (
        <div>
          <div className="text-[11px] uppercase tracking-wide text-gray-400 mb-1">Metaballs</div>
      <MetaballSection metaballId={selected.metaballId} />
        </div>
      )}
      {selected.type === 'text' && selected.textId && (
        <div>
          <div className="text-[11px] uppercase tracking-wide text-gray-400 mb-1">Text</div>
          <Text3DSection textId={selected.textId} objectId={selected.id} />
        </div>
      )}
      {selected.type === 'terrain' && (selected as any).terrainId && (
        <div>
          <div className="text-[11px] uppercase tracking-wide text-gray-400 mb-1">Object Data</div>
          <ObjectDataSection objectId={selected.id} />
          <div className="mt-4">
            <div className="text-[11px] uppercase tracking-wide text-gray-400 mb-1">Terrain Settings</div>
            <TerrainSection terrainId={(selected as any).terrainId} objectId={selected.id} />
          </div>
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

const ParticleSystemSection: React.FC<{ systemId: string }>
  = ({ systemId }) => {
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
            onChange={(v) => update({ capacity: Math.max(1, Math.min(500000, Math.round(v))) })}
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

const FluidSystemSection: React.FC<{ systemId: string }> = ({ systemId }) => {
  const fluid = useFluidStore();
  const sys = useFluidStore((s) => s.systems[systemId]);
  const scene = useSceneStore();
  if (!sys) return null;
  const update = (partial: Partial<typeof sys>) => fluid.updateSystem(systemId, partial);
  const sceneObjects = Object.values(scene.objects);
  const allIds = sceneObjects.map(o => o.id);
  const meshIds = sceneObjects.filter(o => o.type === 'mesh' && o.meshId).map(o => o.id);
  return (
    <div className="bg-white/5 border border-white/10 rounded p-2 space-y-2">
      <Label label="Emitter Object">
        <select className="w-full bg-transparent text-xs border border-white/10 rounded p-1" value={sys.emitterObjectId ?? ''} onChange={(e) => update({ emitterObjectId: e.target.value || null })}>
          <option value="">Use this object&apos;s transform</option>
          {allIds.map(id => <option key={id} value={id}>{scene.objects[id]?.name || id}</option>)}
        </select>
      </Label>
      <Label label="Particle Object">
        <select className="w-full bg-transparent text-xs border border-white/10 rounded p-1" value={sys.particleObjectId ?? ''} onChange={(e) => update({ particleObjectId: e.target.value || null })}>
          <option value="">-- Select object to instance --</option>
          {meshIds.map(id => <option key={id} value={id}>{scene.objects[id]?.name || id}</option>)}
        </select>
      </Label>
      <Label label="Volume Mesh (bounds)">
        <select className="w-full bg-transparent text-xs border border-white/10 rounded p-1" value={sys.volumeObjectId ?? ''} onChange={(e) => update({ volumeObjectId: e.target.value || null })}>
          <option value="">-- None (auto cube) --</option>
          {meshIds.map(id => <option key={id} value={id}>{scene.objects[id]?.name || id}</option>)}
        </select>
      </Label>
      <Label label="Emission Rate (per frame)">
        <DragInput compact value={sys.emissionRate} precision={0} step={5} onChange={(v) => update({ emissionRate: Math.max(0, Math.round(v)) })} />
      </Label>
      <div className="grid grid-cols-2 gap-2">
        <Label label="Capacity">
          <DragInput compact value={sys.capacity} precision={0} step={256} onChange={(v) => update({ capacity: Math.max(256, Math.min(200000, Math.round(v))) })} />
        </Label>
        <Label label="Seed">
          <DragInput compact value={sys.seed} precision={0} step={1} onChange={(v) => update({ seed: Math.max(0, Math.round(v)) })} />
        </Label>
      </div>
      <Label label="Gravity (Y)">
        <DragInput compact value={sys.gravity.y} precision={4} step={0.0005} onChange={(v) => update({ gravity: { ...sys.gravity, y: v } })} />
      </Label>
      <div className="grid grid-cols-2 gap-2">
        <Label label="Viscosity">
          <DragInput compact value={sys.viscosity} precision={3} step={0.01} onChange={(v) => update({ viscosity: Math.max(0, Math.min(2, v)) })} />
        </Label>
        <Label label="Damping">
          <DragInput compact value={sys.damping} precision={4} step={0.0005} onChange={(v) => update({ damping: Math.max(0, Math.min(0.5, v)) })} />
        </Label>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Label label="Init Vel X">
          <DragInput compact value={sys.initialVelocity.x} precision={3} step={0.01} onChange={(v) => update({ initialVelocity: { ...sys.initialVelocity, x: v } })} />
        </Label>
        <Label label="Init Vel Y">
          <DragInput compact value={sys.initialVelocity.y} precision={3} step={0.01} onChange={(v) => update({ initialVelocity: { ...sys.initialVelocity, y: v } })} />
        </Label>
        <Label label="Init Vel Z">
          <DragInput compact value={sys.initialVelocity.z} precision={3} step={0.01} onChange={(v) => update({ initialVelocity: { ...sys.initialVelocity, z: v } })} />
        </Label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Label label="Speed">
          <DragInput compact value={sys.speed} precision={2} step={0.05} onChange={(v) => update({ speed: Math.max(0.01, Math.min(5, v)) })} />
        </Label>
        <Label label="Bounce">
          <DragInput compact value={sys.bounce} precision={2} step={0.05} onChange={(v) => update({ bounce: Math.max(0, Math.min(1, v)) })} />
        </Label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Label label="Lifetime (frames)">
          <DragInput compact value={sys.particleLifetime} precision={0} step={5} onChange={(v) => update({ particleLifetime: Math.max(0, Math.round(v)) })} />
        </Label>
        <Label label="Size">
          <DragInput compact value={sys.size} precision={3} step={0.005} onChange={(v) => update({ size: Math.max(0.001, v) })} />
        </Label>
      </div>
    </div>
  );
};

// Metaball inspector section (single metaball + global settings)
const MetaballSection: React.FC<{ metaballId: string }> = ({ metaballId }) => {
  const store = useMetaballStore();
  const metaball = useMetaballStore((s) => s.metaballs[metaballId]);
  const settings = useMetaballStore((s) => s.settings);
  if (!metaball) return null;
  return (
    <div className="bg-white/5 border border-white/10 rounded p-2 space-y-3">
      <div className="grid grid-cols-3 gap-1">
        <DragInput compact label="Radius" value={metaball.radius} precision={2} step={0.05} onChange={(v) => store.updateMetaball(metaballId, { radius: v })} />
        <DragInput compact label="Strength" value={metaball.strength} precision={2} step={0.05} onChange={(v) => store.updateMetaball(metaballId, { strength: v })} />
        <DragInput compact label="Hue" value={metaball.color.x} precision={2} step={0.05} onChange={(v) => store.updateMetaball(metaballId, { color: { ...metaball.color, x: v } })} />
      </div>
      <div className="p-1.5 rounded bg-white/5 space-y-1 border border-white/10">
        <div className="text-[10px] uppercase tracking-wide text-gray-400">Global</div>
        <div className="grid grid-cols-3 gap-1">
          <DragInput compact label="Res" value={settings.resolution} min={8} max={160} step={1} onChange={(v) => store.setSettings({ resolution: Math.max(8, Math.min(256, Math.round(v))) })} />
          <DragInput compact label="Iso" value={settings.isoLevel} precision={2} step={0.02} onChange={(v) => store.setSettings({ isoLevel: v })} />
          <div className="flex items-center gap-1 text-[10px]">
            <span>Smooth</span>
            <Switch checked={settings.smoothNormals} onCheckedChange={(v) => store.setSettings({ smoothNormals: v })} />
          </div>
        </div>
      </div>
    </div>
  );
};

const Text3DSection: React.FC<{ textId: string; objectId: string }> = ({ textId }) => {
  const text = useTextResource(textId);
  const { updateText, rasterizeText } = useTextStore();
  // Prepare hooks BEFORE conditional early return
  const commonFonts = React.useMemo(() => ['Inter','Arial','Helvetica','Times New Roman','Courier New','Georgia','Verdana','Tahoma','Trebuchet MS','Impact','Monaco','Menlo'], []);
  const [available, setAvailable] = React.useState<Record<string, boolean>>({});
  React.useEffect(() => {
    if (typeof document === 'undefined') return;
    const detect = (family: string) => {
      const span = document.createElement('span');
      span.style.fontFamily = 'monospace';
      span.style.position = 'absolute';
      span.style.left = '-9999px';
      span.style.fontSize = '72px';
      span.textContent = 'mmmmmmmmmmlli';
      document.body.appendChild(span);
      const baseWidth = span.getBoundingClientRect().width;
      span.style.fontFamily = `${family}, monospace`;
      const newWidth = span.getBoundingClientRect().width;
      document.body.removeChild(span);
      return Math.abs(newWidth - baseWidth) > 0.5; // heuristic
    };
    const res: Record<string, boolean> = {};
    commonFonts.forEach(f => { try { res[f] = detect(f); } catch { res[f] = false; } });
    setAvailable(res);
  }, [commonFonts]);
  if (!text) return null;
  const update = (fn: (t: any) => void) => updateText(textId, fn);
  return (
    <div className="bg-white/5 border border-white/10 rounded p-2 space-y-2">
      <Label label="Text">
        <textarea
          className="w-full bg-black/30 border border-white/10 rounded p-1 text-xs resize-none"
          rows={2}
          value={text.text}
          onChange={(e) => update(t => { t.text = e.target.value; })}
        />
      </Label>
      <div className="grid grid-cols-2 gap-2">
        <Label label="Size">
          <DragInput compact value={text.size} precision={3} step={0.01} onChange={(v) => update(t => { t.size = Math.max(0.01, v); })} />
        </Label>
        <Label label="Depth">
          <DragInput compact value={text.depth} precision={3} step={0.01} onChange={(v) => update(t => { t.depth = Math.max(0, v); })} />
        </Label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Label label="Line Height">
          <DragInput compact value={text.lineHeight} precision={2} step={0.05} onChange={(v) => update(t => { t.lineHeight = Math.max(0.5, v); })} />
        </Label>
        <Label label="Align">
          <select className="w-full bg-transparent text-xs border border-white/10 rounded p-1" value={text.align} onChange={(e) => update(t => { t.align = e.target.value as any; })}>
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </Label>
      </div>
      <Label label="Font">
        <select
          className="w-full bg-transparent text-xs border border-white/10 rounded p-1"
          value={text.fontFamily}
          onChange={(e) => update(t => { t.fontFamily = e.target.value; })}
        >
          {commonFonts.map(f => <option key={f} value={f}>{f}{available[f] === false ? ' (fallback)' : ''}</option>)}
        </select>
      </Label>
      <div className="flex items-center gap-2">
        <button
          className="px-2 py-1 rounded bg-white/10 text-xs hover:bg-white/20 disabled:opacity-50"
          disabled={text.rasterized}
          onClick={() => rasterizeText(textId)}
        >Rasterize to Mesh</button>
        {text.rasterized && <span className="text-[10px] text-emerald-400">Rasterized</span>}
      </div>
      {!text.rasterized && <div className="text-[10px] text-gray-500">Modifiers & materials work pre-rasterization. Enter Edit Mode only after rasterizing.</div>}
    </div>
  );
};

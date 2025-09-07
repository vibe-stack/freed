/* eslint-disable @typescript-eslint/no-require-imports */
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { subscribeWithSelector } from 'zustand/middleware';
import { nanoid } from 'nanoid';

// Animation data types (MVP)
export type Interpolation = 'step' | 'linear' | 'bezier';
export type EasingPreset = 'easeIn' | 'easeOut' | 'easeInOut' | 'backIn' | 'backOut' | 'backInOut' | 'bounce' | 'elastic';
type SegmentEaseType = 'bounce' | 'elastic';
type SegmentEaseMode = 'in' | 'out' | 'inOut';

export interface Key {
  id: string;
  t: number; // seconds
  v: number; // scalar value
  interp: Interpolation;
  // Bezier handles reserved for follow-up
  tanIn?: number;  // dv/dt entering this key
  tanOut?: number; // dv/dt leaving this key
  // Optional per-segment easing applied from this key to the next (like Blender). No extra keys.
  segEase?: { type: SegmentEaseType; mode: SegmentEaseMode; strength?: number };
}

export interface Channel {
  id: string;
  keys: Key[]; // sorted ascending by t
}

// Animatable property identifier. For transforms we use e.g. "position.x".
// For modifier settings we use: "mod.<modifierId>.<settingPath>" (e.g. mod:123.angle, mod:abc.offset.x)
export type PropertyPath = string;

export interface Track {
  id: string;
  targetType: 'sceneObject';
  targetId: string; // SceneObject.id
  property: PropertyPath; // which component of transform
  channel: Channel; // single-channel for MVP
  muted?: boolean;
  locked?: boolean;
}

export interface Clip {
  id: string;
  name: string;
  start: number; // seconds, in-point
  end: number; // seconds, out-point
  loop: boolean;
  speed: number; // playback speed factor
  trackIds: string[]; // references into state.tracks
}

export interface AnimationUIState {
  timelinePanelOpen: boolean;
  barVisible: boolean;
  lastUsedFps: number;
  lastUsedClipId: string | null;
  zoom: number; // pixels-per-second in timeline
  pan: number; // seconds offset of timeline view
  // snapping config
  snapEnabled?: boolean; // global toggle for snapping interactions
  snapToFrames?: boolean; // quantize to frames for playhead/keys
  snapToKeys?: boolean; // attract to nearby keys within threshold
  snapThresholdPx?: number; // pixels threshold for key snap
}

interface AnimationState extends AnimationUIState {
  // runtime
  fps: number;
  playing: boolean;
  playhead: number; // seconds
  selection: { trackIds: string[]; keys: Record<string, Set<string>> };

  // data
  clips: Record<string, Clip>;
  clipOrder: string[]; // deterministic ordering
  activeClipId: string | null;
  tracks: Record<string, Track>;

  // caches
  _sortedCache: Record<string, number[]>; // trackId -> sorted key times array
  _samplingGuard?: boolean; // prevents autokey during sampling
  // markers
  markers: Array<{ id: string; t: number; label?: string; color?: string }>;
  // solo set
  soloTrackIds: Set<string>;
}

interface AnimationActions {
  // transport
  play: () => void;
  pause: () => void;
  stop: () => void; // seek to in-point
  togglePlay: () => void;
  toggleLoop: () => void;
  setFps: (fps: number) => void;
  seekSeconds: (t: number) => void;
  seekFrame: (frame: number) => void;
  prevKey: () => void;
  nextKey: () => void;

  // clip
  createClip: (name?: string) => string; // returns clipId
  setActiveClip: (clipId: string | null) => void;
  setClipRange: (start: number, end: number) => void;
  setClipSpeed: (speed: number) => void;

  // tracks/keys
  ensureTrack: (targetId: string, property: PropertyPath) => string; // returns trackId
  insertKey: (trackId: string, t: number, v: number, interp?: Interpolation) => string; // returns keyId
  removeKey: (trackId: string, keyId: string) => void;
  moveKey: (trackId: string, keyId: string, t: number) => void;
  setKeyValue: (trackId: string, keyId: string, v: number) => void;
  setInterpolation: (trackId: string, keyId: string, interp: Interpolation) => void;
  setKeyTangentIn: (trackId: string, keyId: string, tan?: number) => void;
  setKeyTangentOut: (trackId: string, keyId: string, tan?: number) => void;

  // UI
  toggleTimelinePanel: () => void;
  setBarVisible: (visible: boolean) => void;
  setZoom: (zoom: number) => void;
  setPan: (pan: number) => void;
  toggleAutoKey: () => void;
  setAutoKey: (enabled: boolean) => void;
  setSnapping: (enabled: boolean) => void;
  setSnapToFrames: (enabled: boolean) => void;
  setSnapToKeys: (enabled: boolean) => void;
  setSnapThresholdPx: (px: number) => void;

  // sampling
  sampleAt: (t: number) => Array<{ targetId: string; property: PropertyPath; value: number }>; // independent sampling
  applySampleAt: (t: number) => void; // samples and applies via other stores

  // selection and key editing
  clearSelection: () => void;
  selectTrack: (trackId: string, additive?: boolean) => void;
  selectKey: (trackId: string, keyId: string, additive?: boolean) => void;
  deleteSelectedKeys: () => void;
  nudgeSelectedKeys: (dt: number, dv?: number, snapToFps?: boolean) => void;
  nudgeKeysForTracks: (trackIds: string[], dt: number, snapToFps?: boolean) => void;
  nudgeKeysSubset: (pairs: Array<{ trackId: string; keyId: string }>, dt: number, dv?: number, snapToFps?: boolean) => void;
  copySelectedKeys: () => void;
  cutSelectedKeys: () => void;
  pasteKeysAtPlayhead: () => void;
  applyEasingPreset: (pairs: Array<{ trackId: string; keyId: string }>, preset: EasingPreset, strength?: number) => void;

  // queries/helpers
  getTrackId: (targetId: string, property: PropertyPath) => string | undefined;
  findKeyAt: (trackId: string, t: number) => string | undefined;
  hasKeyAt: (targetId: string, property: PropertyPath, t: number) => boolean;
  toggleKeyAt: (targetId: string, property: PropertyPath, t: number, v: number, interp?: Interpolation) => void;

  // track toggles
  setTrackMuted: (trackId: string, muted: boolean) => void;
  setTrackLocked: (trackId: string, locked: boolean) => void;
  toggleTrackSolo: (trackId: string) => void;

  // markers
  addMarkerAt: (t: number, label?: string) => string;
  moveMarker: (id: string, t: number) => void;
  removeMarker: (id: string) => void;
  setMarkerLabel: (id: string, label: string) => void;

  // cleanup
  removeTracksForTarget: (targetId: string) => void;
}

type AnimationStore = AnimationState & AnimationActions & { autoKey: boolean };

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

function sortKeys(keys: Key[]): void {
  keys.sort((a, b) => a.t - b.t);
}

function evalChannel(channel: Channel, t: number): number | undefined {
  const keys = channel.keys;
  const n = keys.length;
  if (n === 0) return undefined;
  if (n === 1) return keys[0].v;
  // Before first
  if (t <= keys[0].t) return keys[0].v;
  // After last
  if (t >= keys[n - 1].t) return keys[n - 1].v;
  // Find segment (linear scan MVP; can optimize later)
  for (let i = 0; i < n - 1; i++) {
    const k0 = keys[i];
    const k1 = keys[i + 1];
    if (t >= k0.t && t <= k1.t) {
      if (k0.interp === 'step') return k0.v;
      let u = (t - k0.t) / (k1.t - k0.t);
      // Segment easing overrides interpolation shape (like Blender's Bounce/Elastic)
      if (k0.segEase) {
        const strength = Math.max(0, Math.min(3, k0.segEase.strength ?? 1));
        // Bounce helpers
        const easeOutBounce = (x: number) => {
          const n1 = 7.5625; const d1 = 2.75;
          if (x < 1 / d1) return n1 * x * x;
          if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75;
          if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375;
          return n1 * (x -= 2.625 / d1) * x + 0.984375;
        };
        const easeInBounce = (x: number) => 1 - easeOutBounce(1 - x);
        const easeInOutBounce = (x: number) => x < 0.5 ? (1 - easeOutBounce(1 - 2 * x)) / 2 : (1 + easeOutBounce(2 * x - 1)) / 2;
        // Elastic helpers (period scales with strength)
        const easeOutElastic = (x: number) => {
          const c4 = (2 * Math.PI) / (0.3 + 0.2 * (1 - strength));
          return x === 0 ? 0 : x === 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x - 0.075) * c4) + 1;
        };
        const easeInElastic = (x: number) => (x === 0 ? 0 : x === 1 ? 1 : -Math.pow(2, 10 * x - 10) * Math.sin((x - 0.075) * (2 * Math.PI) / (0.3 + 0.2 * (1 - strength))))
        const easeInOutElastic = (x: number) => {
          if (x === 0 || x === 1) return x;
          const c5 = (2 * Math.PI) / (0.45 + 0.2 * (1 - strength));
          return x < 0.5
            ? -(Math.pow(2, 20 * x - 10) * Math.sin((20 * x - 11.125) * c5)) / 2
            : (Math.pow(2, -20 * x + 10) * Math.sin((20 * x - 11.125) * c5)) / 2 + 1;
        };
        const applyEase = (kind: SegmentEaseType, mode: SegmentEaseMode, x: number) => {
          if (kind === 'bounce') {
            if (mode === 'in') return easeInBounce(x);
            if (mode === 'inOut') return easeInOutBounce(x);
            return easeOutBounce(x);
          } else {
            if (mode === 'in') return easeInElastic(x);
            if (mode === 'inOut') return easeInOutElastic(x);
            return easeOutElastic(x);
          }
        };
        u = applyEase(k0.segEase.type, k0.segEase.mode, u);
        return k0.v + (k1.v - k0.v) * u;
      }
      if (k0.interp === 'bezier' || k1.interp === 'bezier') {
        const dt = Math.max(1e-6, k1.t - k0.t);
        const m0 = (k0.tanOut !== undefined) ? k0.tanOut : (k1.v - k0.v) / dt;
        const m1 = (k1.tanIn !== undefined) ? k1.tanIn : (k1.v - k0.v) / dt;
        const h00 = (2 * u ** 3) - (3 * u ** 2) + 1;
        const h10 = (u ** 3) - (2 * u ** 2) + u;
        const h01 = (-2 * u ** 3) + (3 * u ** 2);
        const h11 = (u ** 3) - (u ** 2);
        return h00 * k0.v + h10 * dt * m0 + h01 * k1.v + h11 * dt * m1;
      }
      // linear
      return k0.v * (1 - u) + k1.v * u;
    }
  }
  return keys[n - 1].v;
}

export const useAnimationStore = create<AnimationStore>()(
  subscribeWithSelector(
    immer((set, get) => ({
      // initial state
      fps: 30,
      playing: false,
      playhead: 0,
  autoKey: false,
  selection: { trackIds: [], keys: {} },
      clips: {},
      clipOrder: [],
      activeClipId: null,
      tracks: {},
      _sortedCache: {},
  _samplingGuard: false,
      // UI
      timelinePanelOpen: false,
      barVisible: true,
      lastUsedFps: 30,
      lastUsedClipId: null,
      zoom: 100, // px/sec
  pan: 0,
  markers: [],
  soloTrackIds: new Set<string>(),
  // snapping defaults
  snapEnabled: true,
  snapToFrames: true,
  snapToKeys: true,
  snapThresholdPx: 8,

      // actions
      play: () => set((s) => { s.playing = true; }),
      pause: () => set((s) => { s.playing = false; }),
      stop: () => set((s) => {
        s.playing = false;
        const clip = s.activeClipId ? s.clips[s.activeClipId] : null;
        s.playhead = clip ? clip.start : 0;
      }),
      togglePlay: () => set((s) => { s.playing = !s.playing; }),
      toggleLoop: () => set((s) => {
        const clip = s.activeClipId ? s.clips[s.activeClipId] : null;
        if (clip) clip.loop = !clip.loop;
      }),
      setFps: (fps: number) => set((s) => { s.fps = Math.max(1, Math.min(240, Math.round(fps))); s.lastUsedFps = s.fps; }),
      seekSeconds: (t: number) => set((s) => {
        const clip = s.activeClipId ? s.clips[s.activeClipId] : null;
        const inT = clip ? clip.start : 0;
        const outT = clip ? clip.end : Math.max(inT, t);
        let T = clamp(t, inT, outT);
        // Quantize to frame when enabled
        const fps = s.fps || 30;
        if (s.snapEnabled && s.snapToFrames) {
          T = Math.round(T * fps) / fps;
        }
        s.playhead = T;
      }),
      seekFrame: (frame: number) => {
        const fps = get().fps || 30;
        get().seekSeconds(frame / fps);
      },
      prevKey: () => set((s) => {
        const t = s.playhead;
        let best: number | null = null;
        Object.values(s.tracks).forEach((tr) => {
          tr.channel.keys.forEach((k) => {
            if (k.t < t) best = (best === null || k.t > best) ? k.t : best;
          });
        });
        if (best !== null) s.playhead = best;
      }),
      nextKey: () => set((s) => {
        const t = s.playhead;
        let best: number | null = null;
        Object.values(s.tracks).forEach((tr) => {
          tr.channel.keys.forEach((k) => {
            if (k.t > t) best = (best === null || k.t < best) ? k.t : best;
          });
        });
        if (best !== null) s.playhead = best;
      }),

      createClip: (name?: string) => {
        const id = nanoid();
        const clip: Clip = { id, name: name ?? 'Clip', start: 0, end: 5, loop: true, speed: 1, trackIds: [] };
        set((s) => {
          s.clips[id] = clip;
          s.clipOrder.push(id);
          s.activeClipId = id;
          s.lastUsedClipId = id;
          s.playhead = clip.start;
        });
        return id;
      },
      setActiveClip: (clipId: string | null) => set((s) => { s.activeClipId = clipId; s.lastUsedClipId = clipId; }),
      setClipRange: (start: number, end: number) => set((s) => {
        const clip = s.activeClipId ? s.clips[s.activeClipId] : null;
        if (!clip) return;
        clip.start = Math.max(0, Math.min(start, end));
        clip.end = Math.max(clip.start, end);
        s.playhead = clamp(s.playhead, clip.start, clip.end);
      }),
      setClipSpeed: (speed: number) => set((s) => {
        const clip = s.activeClipId ? s.clips[s.activeClipId] : null;
        if (clip) clip.speed = Math.max(0.001, Math.min(speed, 100));
      }),

      ensureTrack: (targetId: string, property: PropertyPath) => {
        const s = get();
        const existing = Object.values(s.tracks).find((t) => t.targetType === 'sceneObject' && t.targetId === targetId && t.property === property);
        if (existing) return existing.id;
        const id = nanoid();
        const tr: Track = { id, targetType: 'sceneObject', targetId, property, channel: { id: nanoid(), keys: [] } };
        set((state) => {
          state.tracks[id] = tr;
          const clip = state.activeClipId ? state.clips[state.activeClipId] : null;
          if (clip && !clip.trackIds.includes(id)) clip.trackIds.push(id);
        });
        return id;
      },
      getTrackId: (targetId: string, property: PropertyPath) => {
        const s = get();
        const existing = Object.values(s.tracks).find((t) => t.targetType === 'sceneObject' && t.targetId === targetId && t.property === property);
        return existing?.id;
      },
      insertKey: (trackId: string, t: number, v: number, interp: Interpolation = 'linear') => {
        const keyId = nanoid();
        set((s) => {
          const tr = s.tracks[trackId];
          if (!tr) return;
          // Snap to frame to keep consistent
          const fps = s.fps || 30;
          const frame = Math.round(t * fps);
          const T = frame / fps;
          const existing = tr.channel.keys.find((k) => Math.abs(k.t - T) < 1e-6);
          if (existing) {
            existing.v = v;
            existing.interp = interp;
          } else {
            tr.channel.keys.push({ id: keyId, t: T, v, interp });
            sortKeys(tr.channel.keys);
          }
          // Force subscribers relying on s.tracks identity to update
          s.tracks = { ...s.tracks };
        });
        return keyId;
      },
      findKeyAt: (trackId: string, t: number) => {
        const s = get();
        const tr = s.tracks[trackId];
        if (!tr) return undefined;
        const fps = s.fps || 30;
        const frame = Math.round(t * fps);
        const T = frame / fps;
        const k = tr.channel.keys.find((kk) => Math.abs(kk.t - T) < 1e-6);
        return k?.id;
      },
      hasKeyAt: (targetId: string, property: PropertyPath, t: number) => {
        const s = get();
        const tid = Object.values(s.tracks).find((tr) => tr.targetId === targetId && tr.property === property)?.id;
        if (!tid) return false;
        const id = (get().findKeyAt(tid, t));
        return !!id;
      },
      toggleKeyAt: (targetId: string, property: PropertyPath, t: number, v: number, interp: Interpolation = 'linear') => {
        const s = get();
        // Find or create track
        let tid = s.getTrackId(targetId, property);
        if (!tid) tid = s.ensureTrack(targetId, property);
        const existing = s.findKeyAt(tid, t);
        if (existing) {
          s.removeKey(tid, existing);
        } else {
          s.insertKey(tid, t, v, interp);
        }
      },
      removeKey: (trackId: string, keyId: string) => set((s) => {
        const tr = s.tracks[trackId];
        if (!tr) return;
        tr.channel.keys = tr.channel.keys.filter((k) => k.id !== keyId);
  s.tracks = { ...s.tracks };
      }),
      moveKey: (trackId: string, keyId: string, t: number) => set((s) => {
        const tr = s.tracks[trackId];
        if (!tr) return;
        const k = tr.channel.keys.find((kk) => kk.id === keyId);
        if (!k) return;
        k.t = Math.max(0, t);
        sortKeys(tr.channel.keys);
  s.tracks = { ...s.tracks };
      }),
      setKeyValue: (trackId: string, keyId: string, v: number) => set((s) => {
        const tr = s.tracks[trackId];
        if (!tr) return;
        const k = tr.channel.keys.find((kk) => kk.id === keyId);
        if (!k) return;
        k.v = v;
      }),
      setInterpolation: (trackId: string, keyId: string, interp: Interpolation) => set((s) => {
        const tr = s.tracks[trackId];
        if (!tr) return;
        const k = tr.channel.keys.find((kk) => kk.id === keyId);
        if (!k) return;
        k.interp = interp;
        // Changing interpolation clears segment easing for clarity
        if (k.segEase) k.segEase = undefined;
      }),
      setKeyTangentIn: (trackId: string, keyId: string, tan?: number) => set((s) => {
        const tr = s.tracks[trackId]; if (!tr) return;
        const k = tr.channel.keys.find((kk) => kk.id === keyId); if (!k) return;
        k.tanIn = tan;
      }),
      setKeyTangentOut: (trackId: string, keyId: string, tan?: number) => set((s) => {
        const tr = s.tracks[trackId]; if (!tr) return;
        const k = tr.channel.keys.find((kk) => kk.id === keyId); if (!k) return;
        k.tanOut = tan;
      }),

      toggleTimelinePanel: () => set((s) => { s.timelinePanelOpen = !s.timelinePanelOpen; }),
      setBarVisible: (visible: boolean) => set((s) => { s.barVisible = visible; }),
      setZoom: (zoom: number) => set((s) => { s.zoom = Math.max(10, Math.min(1000, zoom)); }),
      setPan: (pan: number) => set((s) => { s.pan = pan; }),
      toggleAutoKey: () => set((s) => { s.autoKey = !s.autoKey; }),
  setAutoKey: (enabled: boolean) => set((s) => { s.autoKey = !!enabled; }),
  setSnapping: (enabled: boolean) => set((s) => { s.snapEnabled = !!enabled; }),
  setSnapToFrames: (enabled: boolean) => set((s) => { s.snapToFrames = !!enabled; }),
  setSnapToKeys: (enabled: boolean) => set((s) => { s.snapToKeys = !!enabled; }),
  setSnapThresholdPx: (px: number) => set((s) => { s.snapThresholdPx = Math.max(0, Math.min(64, Math.round(px))); }),

      sampleAt: (t: number) => {
        const s = get();
        const clip = s.activeClipId ? s.clips[s.activeClipId] : null;
        const time = clip ? clamp(t, clip.start, clip.end) : Math.max(0, t);
        const updates: Array<{ targetId: string; property: PropertyPath; value: number }> = [];
        if (!clip) return updates;
        const solo = s.soloTrackIds;
        clip.trackIds.forEach((tid) => {
          const tr = s.tracks[tid];
          if (!tr) return;
          if (solo.size > 0) {
            if (!solo.has(tid)) return;
          } else if (tr.muted) return;
          const val = evalChannel(tr.channel, time);
          if (val === undefined) return;
          updates.push({ targetId: tr.targetId, property: tr.property, value: val });
        });
        return updates;
      },
      applySampleAt: (t: number) => {
        const { sampleAt } = get();
        const updates = sampleAt(t);
        if (updates.length === 0) return;
        // Apply using scene and geometry store actions only (dynamic import to avoid cycle)
        const { useSceneStore } = require('./scene-store');
        const { useGeometryStore } = require('./geometry-store');
  const { useFluidStore } = require('./fluid-store');
        const scene = useSceneStore.getState();
        const geo = useGeometryStore.getState();
  const fluidStore = useFluidStore.getState();
  // Note: fluid system animatable property path convention:
  //   'fluid.emissionRate', 'fluid.gravityY', 'fluid.size', 'fluid.speed', 'fluid.damping', 'fluid.bounce'
  //   'fluid.initialVelX', 'fluid.initialVelY', 'fluid.initialVelZ'
  // Each path is associated with the fluid scene object targetId.
        // Batch per object for transforms and per-modifier for modifier settings
  const byObj: Record<string, Partial<{ position: Record<string, number>; rotation: Record<string, number>; scale: Record<string, number> }>> = {};
  // Fluid system property buckets keyed by scene object id (owner of fluidSystemId)
  const byFluid: Record<string, Partial<{ emissionRate: number; gravityY: number; size: number; speed: number; damping: number; bounce: number; initialVelX: number; initialVelY: number; initialVelZ: number }>> = {};
        const byObjMods: Record<string, Record<string, Record<string, number>>> = {};
        updates.forEach((u) => {
          if (u.property.startsWith('position.') || u.property.startsWith('rotation.') || u.property.startsWith('scale.')) {
            const bucket = byObj[u.targetId] || (byObj[u.targetId] = {});
            const [prop, axis] = u.property.split('.') as [keyof typeof bucket, 'x'|'y'|'z'];
            const vec = (bucket as any)[prop] || {};
            (vec as any)[axis] = u.value;
            (bucket as any)[prop] = vec;
          } else if (u.property.startsWith('fluid.')) {
            // fluid.<sceneObjectId>.<prop> where <prop> in emissionRate|gravityY|size|speed|damping|bounce
            // targetId is still the scene object id
            const parts = u.property.split('.');
            // parts[0] = fluid, parts[1+] may include object scoped alias but we use targetId directly
            const prop = parts[1];
            const bucket = byFluid[u.targetId] || (byFluid[u.targetId] = {});
            if (prop === 'emissionRate') bucket.emissionRate = u.value;
            else if (prop === 'gravityY') bucket.gravityY = u.value;
            else if (prop === 'size') bucket.size = u.value;
            else if (prop === 'speed') bucket.speed = u.value;
            else if (prop === 'damping') bucket.damping = u.value;
            else if (prop === 'bounce') bucket.bounce = u.value;
            else if (prop === 'initialVelX') bucket.initialVelX = u.value;
            else if (prop === 'initialVelY') bucket.initialVelY = u.value;
            else if (prop === 'initialVelZ') bucket.initialVelZ = u.value;
          } else if (u.property.startsWith('mod.')) {
            // Format: mod.<modifierId>.<path>
            const parts = u.property.split('.');
            const modId = parts[1];
            const settingPath = parts.slice(2).join('.');
            const perObj = byObjMods[u.targetId] || (byObjMods[u.targetId] = {});
            const perMod = perObj[modId] || (perObj[modId] = {});
            perMod[settingPath] = u.value;
          }
        });
        // Helper to set nested path like "offset.x"
        const setPath = (obj: any, path: string, value: number) => {
          const segs = path.split('.');
          let cur: any = obj;
          for (let i = 0; i < segs.length - 1; i++) {
            const key = segs[i];
            cur[key] = cur[key] ?? {};
            cur = cur[key];
          }
          cur[segs[segs.length - 1]] = value;
        };
        // Guard autokey while applying samples
        useAnimationStore.setState((s) => { s._samplingGuard = true; });
        // Apply transforms
        Object.entries(byObj).forEach(([objId, partial]) => {
          const transform: any = {};
          if (partial.position) {
            const prev = scene.objects[objId]?.transform.position;
            transform.position = { ...(prev || {}), ...partial.position };
          }
          if (partial.rotation) {
            const prev = scene.objects[objId]?.transform.rotation;
            transform.rotation = { ...(prev || {}), ...partial.rotation };
          }
          if (partial.scale) {
            const prev = scene.objects[objId]?.transform.scale;
            transform.scale = { ...(prev || {}), ...partial.scale };
          }
          if (Object.keys(transform).length) scene.setTransform(objId, transform);
        });
        // Apply fluid system property updates
        Object.entries(byFluid).forEach(([objId, partial]) => {
          const obj = scene.objects[objId];
          if (!obj || obj.type !== 'fluid' || !obj.fluidSystemId) return;
          const sysId = obj.fluidSystemId;
          const sys = fluidStore.systems[sysId];
          if (!sys) return;
          const patch: any = {};
            if (partial.emissionRate !== undefined) patch.emissionRate = Math.max(0, partial.emissionRate);
            if (partial.gravityY !== undefined) patch.gravity = { ...sys.gravity, y: partial.gravityY };
            if (partial.size !== undefined) patch.size = Math.max(0.0001, partial.size);
            if (partial.speed !== undefined) patch.speed = Math.max(0.001, partial.speed);
            if (partial.damping !== undefined) patch.damping = Math.max(0, Math.min(0.5, partial.damping));
            if (partial.bounce !== undefined) patch.bounce = Math.max(0, Math.min(1, partial.bounce));
            if (partial.initialVelX !== undefined || partial.initialVelY !== undefined || partial.initialVelZ !== undefined) {
              patch.initialVelocity = {
                x: partial.initialVelX !== undefined ? partial.initialVelX : sys.initialVelocity.x,
                y: partial.initialVelY !== undefined ? partial.initialVelY : sys.initialVelocity.y,
                z: partial.initialVelZ !== undefined ? partial.initialVelZ : sys.initialVelocity.z,
              };
            }
          if (Object.keys(patch).length) fluidStore.updateSystem(sysId, patch);
        });
        // Apply modifier settings
        Object.entries(byObjMods).forEach(([objId, mods]) => {
          Object.entries(mods).forEach(([modId, settings]) => {
            geo.updateModifierSettings(objId, modId, (st: any) => {
              Object.entries(settings).forEach(([path, val]) => setPath(st, path, val as number));
            });
          });
        });
        useAnimationStore.setState((s) => { s._samplingGuard = false; });
      },
      // selection and key edit
      clearSelection: () => set((s) => { s.selection.trackIds = []; s.selection.keys = {}; }),
      selectTrack: (trackId: string, additive?: boolean) => set((s) => {
        if (!additive) s.selection.trackIds = [];
        if (!s.selection.trackIds.includes(trackId)) s.selection.trackIds.push(trackId);
      }),
      selectKey: (trackId: string, keyId: string, additive?: boolean) => set((s) => {
        if (!additive) s.selection.keys = {};
        const setFor = s.selection.keys[trackId] || (s.selection.keys[trackId] = new Set<string>());
        setFor.add(keyId);
      }),
      deleteSelectedKeys: () => set((s) => {
        Object.entries(s.selection.keys).forEach(([tid, keySet]) => {
          const tr = s.tracks[tid]; if (!tr) return;
          tr.channel.keys = tr.channel.keys.filter(k => !keySet.has(k.id));
        });
        s.selection.keys = {};
      }),
      nudgeSelectedKeys: (dt: number, dv?: number, snapToFps: boolean = true) => set((s) => {
        const fps = s.fps || 30;
        const snap = (x: number) => snapToFps ? Math.round(x * fps) / fps : x;
        Object.entries(s.selection.keys).forEach(([tid, keySet]) => {
          const tr = s.tracks[tid]; if (!tr || tr.locked) return;
          tr.channel.keys.forEach((k) => {
            if (!keySet.has(k.id)) return;
            k.t = snap(Math.max(0, k.t + dt));
            if (typeof dv === 'number') k.v = k.v + dv;
          });
          sortKeys(tr.channel.keys);
        });
  s.tracks = { ...s.tracks };
      }),
      nudgeKeysForTracks: (trackIds: string[], dt: number, snapToFps: boolean = false) => set((s) => {
        if (!trackIds?.length || !isFinite(dt)) return;
        const fps = s.fps || 30;
        const snap = (x: number) => snapToFps ? Math.round(x * fps) / fps : x;
        trackIds.forEach((tid) => {
          const tr = s.tracks[tid]; if (!tr || tr.locked) return;
          tr.channel.keys.forEach((k) => { k.t = snap(Math.max(0, k.t + dt)); });
          sortKeys(tr.channel.keys);
        });
  s.tracks = { ...s.tracks };
      }),
      nudgeKeysSubset: (pairs: Array<{ trackId: string; keyId: string }>, dt: number, dv?: number, snapToFps: boolean = false) => set((s) => {
        if (!pairs?.length || !isFinite(dt)) return;
        const fps = s.fps || 30;
        const snap = (x: number) => snapToFps ? Math.round(x * fps) / fps : x;
        const byTrack: Record<string, Set<string>> = {};
        pairs.forEach(({ trackId, keyId }) => {
          (byTrack[trackId] ||= new Set()).add(keyId);
        });
        Object.entries(byTrack).forEach(([tid, set]) => {
          const tr = s.tracks[tid]; if (!tr || tr.locked) return;
          tr.channel.keys.forEach((k) => {
            if (!set.has(k.id)) return;
            k.t = Math.max(0, snap(k.t + dt));
            if (typeof dv === 'number') k.v = k.v + dv;
          });
          sortKeys(tr.channel.keys);
        });
        s.tracks = { ...s.tracks };
      }),
      copySelectedKeys: () => set((s) => {
        const payload: any[] = [];
        Object.entries(s.selection.keys).forEach(([tid, keySet]) => {
          const tr = s.tracks[tid]; if (!tr) return;
          tr.channel.keys.forEach((k) => {
            if (keySet.has(k.id)) payload.push({ trackId: tid, key: { ...k } });
          });
        });
        if (typeof window !== 'undefined') {
          try { window.localStorage.setItem('animKeysClipboard', JSON.stringify(payload)); } catch {}
        }
      }),
      cutSelectedKeys: () => { const a = get(); a.copySelectedKeys(); a.deleteSelectedKeys(); },
      pasteKeysAtPlayhead: () => set((s) => {
        if (typeof window === 'undefined') return;
        const text = window.localStorage.getItem('animKeysClipboard');
        if (!text) return;
        let payload: Array<{ trackId: string; key: Key }>|null = null;
        try { payload = JSON.parse(text); } catch { payload = null; }
        if (!payload) return;
        const t0 = payload.reduce((m, p) => Math.min(m, p.key.t), Number.POSITIVE_INFINITY);
        const base = s.playhead - t0;
        payload.forEach(({ trackId, key }) => {
          const tr = s.tracks[trackId]; if (!tr) return;
          const newId = nanoid();
          tr.channel.keys.push({ ...key, id: newId, t: Math.max(0, key.t + base) });
          sortKeys(tr.channel.keys);
        });
      }),
      applyEasingPreset: (pairs, preset, strength = 1) => set((s) => {
        if (!pairs?.length) return;
        const clampV = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
        const ensureBezier = (k: Key) => { if (k.interp !== 'bezier') k.interp = 'bezier'; };
        const slope = (a: Key, b: Key) => {
          const dt = Math.max(1e-6, b.t - a.t);
          return (b.v - a.v) / dt;
        };
        // No more key insertion for dynamic modes
        // Penner-like sit-in-place easing on [0,1]
        const easeOutBounce = (x: number) => {
          const n1 = 7.5625; const d1 = 2.75;
          if (x < 1 / d1) return n1 * x * x;
          if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75;
          if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375;
          return n1 * (x -= 2.625 / d1) * x + 0.984375;
        };
  const easeInBounce = (x: number) => 1 - easeOutBounce(1 - x);
  const easeInOutBounce = (x: number) => x < 0.5 ? (1 - easeOutBounce(1 - 2 * x)) / 2 : (1 + easeOutBounce(2 * x - 1)) / 2;
  const easeOutElastic = (x: number) => {
          const c4 = (2 * Math.PI) / (0.3 + 0.2 * (1 - clampV(strength, 0, 3)));
          return x === 0 ? 0 : x === 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x - 0.075) * c4) + 1;
        };
        const easeInElastic = (x: number) => (x === 0 ? 0 : x === 1 ? 1 : -Math.pow(2, 10 * x - 10) * Math.sin((x - 0.075) * (2 * Math.PI) / (0.3 + 0.2 * (1 - clampV(strength, 0, 3)))));
        const easeInOutElastic = (x: number) => {
          if (x === 0 || x === 1) return x;
          const c5 = (2 * Math.PI) / (0.45 + 0.2 * (1 - clampV(strength, 0, 3)));
          return x < 0.5
            ? -(Math.pow(2, 20 * x - 10) * Math.sin((20 * x - 11.125) * c5)) / 2
            : (Math.pow(2, -20 * x + 10) * Math.sin((20 * x - 11.125) * c5)) / 2 + 1;
        };
  void easeInBounce;
  void easeInOutBounce;
  void easeOutElastic;
  void easeInElastic;
  void easeInOutElastic;
        pairs.forEach(({ trackId, keyId }) => {
          const tr = s.tracks[trackId]; if (!tr) return;
          const keys = tr.channel.keys; const idx = keys.findIndex((kk) => kk.id === keyId);
          if (idx === -1) return;
          const cur = keys[idx]; const prev = keys[idx - 1]; const next = keys[idx + 1];
          if (!prev && !next) return;
          const k = 1 + 1.5 * clampV(strength, 0, 3);
          if (preset === 'easeIn' && prev) {
            ensureBezier(cur); ensureBezier(prev);
            const m = slope(prev, cur); cur.tanIn = 0; prev.tanOut = m * k;
            if (cur.segEase) cur.segEase = undefined;
          } else if (preset === 'easeOut' && next) {
            ensureBezier(cur); ensureBezier(next);
            const m = slope(cur, next); cur.tanOut = 0; next.tanIn = m * 0.75 * k;
            if (cur.segEase) cur.segEase = undefined;
          } else if (preset === 'easeInOut') {
            if (prev) { ensureBezier(cur); ensureBezier(prev); const m = slope(prev, cur); cur.tanIn = 0; prev.tanOut = m * 0.75 * k; }
            if (next) { ensureBezier(cur); ensureBezier(next); const m = slope(cur, next); cur.tanOut = 0; next.tanIn = m * 0.75 * k; }
            if (cur.segEase) cur.segEase = undefined;
          } else if (preset === 'backIn' && prev) {
            ensureBezier(cur); ensureBezier(prev);
            const m = slope(prev, cur); cur.tanIn = m * k; prev.tanOut = m * k;
            if (cur.segEase) cur.segEase = undefined;
          } else if (preset === 'backOut' && next) {
            ensureBezier(cur); ensureBezier(next);
            const m = slope(cur, next); cur.tanOut = m * k; next.tanIn = m * k;
            if (cur.segEase) cur.segEase = undefined;
          } else if (preset === 'backInOut') {
            if (prev) { ensureBezier(cur); ensureBezier(prev); const m = slope(prev, cur); cur.tanIn = m * k; prev.tanOut = m * k; }
            if (next) { ensureBezier(cur); ensureBezier(next); const m = slope(cur, next); cur.tanOut = m * k; next.tanIn = m * k; }
            if (cur.segEase) cur.segEase = undefined;
          } else if (preset === 'bounce' && next) {
            // Store per-segment easing starting at current key
            cur.segEase = { type: 'bounce', mode: 'out', strength };
            // Clear bezier influence to avoid double shaping
            cur.tanOut = undefined; next.tanIn = undefined;
          } else if (preset === 'elastic' && next) {
            cur.segEase = { type: 'elastic', mode: 'out', strength };
            cur.tanOut = undefined; next.tanIn = undefined;
          }
        });
        s.tracks = { ...s.tracks };
      }),

      // track toggles
      setTrackMuted: (trackId: string, muted: boolean) => set((s) => { const tr = s.tracks[trackId]; if (tr) tr.muted = muted; }),
      setTrackLocked: (trackId: string, locked: boolean) => set((s) => { const tr = s.tracks[trackId]; if (tr) tr.locked = locked; }),
      toggleTrackSolo: (trackId: string) => set((s) => {
        if (s.soloTrackIds.has(trackId)) s.soloTrackIds.delete(trackId); else s.soloTrackIds.add(trackId);
        s.soloTrackIds = new Set<string>(Array.from(s.soloTrackIds));
      }),

      // markers
      addMarkerAt: (t: number, label?: string) => {
        const id = nanoid();
        set((s) => { s.markers.push({ id, t: Math.max(0, t), label }); });
        return id;
      },
      moveMarker: (id: string, t: number) => set((s) => { const m = s.markers.find(mm => mm.id === id); if (m) m.t = Math.max(0, t); }),
      removeMarker: (id: string) => set((s) => { s.markers = s.markers.filter(m => m.id !== id); }),
      setMarkerLabel: (id: string, label: string) => set((s) => { const m = s.markers.find(mm => mm.id === id); if (m) m.label = label; }),

      // cleanup
      removeTracksForTarget: (targetId: string) => set((s) => {
        // Find tracks that point to this target
        const toRemove = Object.values(s.tracks)
          .filter((tr) => tr.targetType === 'sceneObject' && tr.targetId === targetId)
          .map((tr) => tr.id);
        if (toRemove.length === 0) return;
        // Remove from tracks map and caches
        toRemove.forEach((tid) => {
          delete s.tracks[tid];
          if (s._sortedCache) delete (s._sortedCache as any)[tid];
          // Selection cleanup
          s.selection.trackIds = s.selection.trackIds.filter((id) => id !== tid);
          delete s.selection.keys[tid];
          // Solo set cleanup
          if (s.soloTrackIds.has(tid)) s.soloTrackIds.delete(tid);
        });
        s.soloTrackIds = new Set<string>(Array.from(s.soloTrackIds));
        // Remove from all clips
        Object.values(s.clips).forEach((clip) => {
          clip.trackIds = clip.trackIds.filter((id) => !toRemove.includes(id));
        });
      }),
    }))
  )
);

// Helpers
export const secondsToTimecode = (sec: number, fps: number): string => {
  const s = Math.max(0, sec);
  const totalFrames = Math.round(s * fps);
  const frames = totalFrames % fps;
  const totalSeconds = Math.floor(totalFrames / fps);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);
  const pad = (n: number, w = 2) => n.toString().padStart(w, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}:${pad(frames)}`;
};

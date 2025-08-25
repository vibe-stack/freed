/* eslint-disable @typescript-eslint/no-require-imports */
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { subscribeWithSelector } from 'zustand/middleware';
import { nanoid } from 'nanoid';

// Animation data types (MVP)
export type Interpolation = 'step' | 'linear' | 'bezier';

export interface Key {
  id: string;
  t: number; // seconds
  v: number; // scalar value
  interp: Interpolation;
  // Bezier handles reserved for follow-up
  tanIn?: number;  // dv/dt entering this key
  tanOut?: number; // dv/dt leaving this key
}

export interface Channel {
  id: string;
  keys: Key[]; // sorted ascending by t
}

export type PropertyPath =
  | 'position.x' | 'position.y' | 'position.z'
  | 'rotation.x' | 'rotation.y' | 'rotation.z'
  | 'scale.x' | 'scale.y' | 'scale.z';

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
  copySelectedKeys: () => void;
  cutSelectedKeys: () => void;
  pasteKeysAtPlayhead: () => void;

  // track toggles
  setTrackMuted: (trackId: string, muted: boolean) => void;
  setTrackLocked: (trackId: string, locked: boolean) => void;
  toggleTrackSolo: (trackId: string) => void;

  // markers
  addMarkerAt: (t: number, label?: string) => string;
  moveMarker: (id: string, t: number) => void;
  removeMarker: (id: string) => void;
  setMarkerLabel: (id: string, label: string) => void;
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
      const u = (t - k0.t) / (k1.t - k0.t);
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
      fps: 24,
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
      lastUsedFps: 24,
      lastUsedClipId: null,
      zoom: 100, // px/sec
  pan: 0,
  markers: [],
  soloTrackIds: new Set<string>(),

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
        s.playhead = clamp(t, inT, outT);
      }),
      seekFrame: (frame: number) => {
        const fps = get().fps || 24;
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
      insertKey: (trackId: string, t: number, v: number, interp: Interpolation = 'linear') => {
        const keyId = nanoid();
        set((s) => {
          const tr = s.tracks[trackId];
          if (!tr) return;
          // Snap to frame to keep consistent
          const fps = s.fps || 24;
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
        });
        return keyId;
      },
      removeKey: (trackId: string, keyId: string) => set((s) => {
        const tr = s.tracks[trackId];
        if (!tr) return;
        tr.channel.keys = tr.channel.keys.filter((k) => k.id !== keyId);
      }),
      moveKey: (trackId: string, keyId: string, t: number) => set((s) => {
        const tr = s.tracks[trackId];
        if (!tr) return;
        const k = tr.channel.keys.find((kk) => kk.id === keyId);
        if (!k) return;
        k.t = Math.max(0, t);
        sortKeys(tr.channel.keys);
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
  setSnapping: (enabled: boolean) => set((s) => { (s as any).snapping = !!enabled; }),

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
        // Apply using scene store actions only (dynamic import to avoid cycle)
        const { useSceneStore } = require('./scene-store');
        const scene = useSceneStore.getState();
        // Batch per object
        const byObj: Record<string, Partial<{ position: any; rotation: any; scale: any }>> = {};
        updates.forEach((u) => {
          const bucket = byObj[u.targetId] || (byObj[u.targetId] = {});
          const [prop, axis] = u.property.split('.') as [keyof typeof bucket, 'x'|'y'|'z'];
          const vec = bucket[prop] || { x: undefined, y: undefined, z: undefined };
          (vec as any)[axis] = u.value;
          (bucket as any)[prop] = vec;
        });
        // Guard autokey while applying samples
        useAnimationStore.setState((s) => { s._samplingGuard = true; });
        Object.entries(byObj).forEach(([objId, partial]) => {
          const transform: any = {};
          if (partial.position) transform.position = { ...(scene.objects[objId]?.transform.position), ...partial.position };
          if (partial.rotation) transform.rotation = { ...(scene.objects[objId]?.transform.rotation), ...partial.rotation };
          if (partial.scale) transform.scale = { ...(scene.objects[objId]?.transform.scale), ...partial.scale };
          scene.setTransform(objId, transform);
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
        const fps = s.fps || 24;
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
      }),
      nudgeKeysForTracks: (trackIds: string[], dt: number, snapToFps: boolean = false) => set((s) => {
        if (!trackIds?.length || !isFinite(dt)) return;
        const fps = s.fps || 24;
        const snap = (x: number) => snapToFps ? Math.round(x * fps) / fps : x;
        trackIds.forEach((tid) => {
          const tr = s.tracks[tid]; if (!tr || tr.locked) return;
          tr.channel.keys.forEach((k) => { k.t = snap(Math.max(0, k.t + dt)); });
          sortKeys(tr.channel.keys);
        });
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

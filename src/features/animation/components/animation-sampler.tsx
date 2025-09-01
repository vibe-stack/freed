"use client";

import { useEffect, useMemo, useRef } from 'react';
import { useAnimationStore, type Track, type Channel, type PropertyPath } from '@/stores/animation-store';
import { useFrame } from '@react-three/fiber';
import { useViewportStore } from '@/stores/viewport-store';
import { getObject3D } from '@/features/viewport/hooks/object3d-registry';
import { useShaderTimeStore } from '@/stores/shader-time-store';
import { updateAnimUniforms } from '@/utils/shader-tsl/nodes/time-nodes';

type SampleUpdate = { targetId: string; property: PropertyPath; value: number };

function evalChannel(channel: Channel, t: number): number | undefined {
  const keys = channel.keys;
  const n = keys.length;
  if (n === 0) return undefined;
  if (n === 1) return keys[0].v;
  if (t <= keys[0].t) return keys[0].v;
  if (t >= keys[n - 1].t) return keys[n - 1].v;
  for (let i = 0; i < n - 1; i++) {
    const k0 = keys[i];
    const k1 = keys[i + 1];
    if (t >= k0.t && t <= k1.t) {
      if (k0.interp === 'step') return k0.v;
      const u = (t - k0.t) / (k1.t - k0.t);
      if (k0.interp === 'bezier' || k1.interp === 'bezier') {
        const dt = Math.max(1e-6, k1.t - k0.t);
        const m0 = k0.tanOut !== undefined ? k0.tanOut : (k1.v - k0.v) / dt;
        const m1 = k1.tanIn !== undefined ? k1.tanIn : (k1.v - k0.v) / dt;
        const h00 = 2 * u ** 3 - 3 * u ** 2 + 1;
        const h10 = u ** 3 - 2 * u ** 2 + u;
        const h01 = -2 * u ** 3 + 3 * u ** 2;
        const h11 = u ** 3 - u ** 2;
        return h00 * k0.v + h10 * dt * m0 + h01 * k1.v + h11 * dt * m1;
      }
      return k0.v * (1 - u) + k1.v * u;
    }
  }
  return keys[n - 1].v;
}

// Build a read-only snapshot of the active clip and its tracks for runtime playback
// no-op placeholder left; snapshotting now done inside AnimationSampler on play start

export default function AnimationSampler() {
  const playing = useAnimationStore((s) => s.playing);
  const fps = useAnimationStore((s) => s.fps);
  const playhead = useAnimationStore((s) => s.playhead);
  const pause = useAnimationStore((s) => s.pause);
  const seekSeconds = useAnimationStore((s) => s.seekSeconds);
  const applySampleAt = useAnimationStore((s) => s.applySampleAt);
  const soloTrackIds = useAnimationStore((s) => s.soloTrackIds);
  const getState = useAnimationStore;
  const clipRef = useRef<ReturnType<typeof getState.getState>['clips'][string] | null>(null);
  const tracksRef = useRef<Record<string, Track>>({});
  const lastPausedApplied = useRef<number | null>(null);
  const setAnimTime = useShaderTimeStore((s) => s.setAnimTime);

  const autoOrbit = useViewportStore((s) => s.autoOrbitIntervalSec ?? 0);
  const setAutoOrbit = useViewportStore((s) => s.setAutoOrbitInterval);
  const autoOrbitSaved = useRef<number>(0);

  // Pause auto-orbit while playing
  useEffect(() => {
    if (playing) {
      autoOrbitSaved.current = autoOrbit;
      setAutoOrbit(0);
    } else {
      setAutoOrbit((autoOrbitSaved.current as 0 | 1 | 5 | 15) || 0);
    }
  }, [playing]);

  // Throttle playhead writes to store while running (for UI), but never per-frame
  const uiSyncAccum = useRef(0);
  const localTime = useRef<number>(playhead);

  // Reset local time when clip changes or when playback starts/stops
  useEffect(() => {
    const s = getState.getState();
    const active = s.activeClipId ? s.clips[s.activeClipId] : null;
    if (active) {
      localTime.current = Math.max(active.start, Math.min(playhead, active.end));
    } else {
      localTime.current = playhead;
    }
  }, [getState.getState().activeClipId]);
  useEffect(() => {
    if (playing) {
      localTime.current = playhead;
    }
  }, [playing]);

  // Build/refresh runtime snapshot when playback starts or when active clip changes
  const lastSnapshotKey = useRef<string | null>(null);
  useEffect(() => {
    const s = getState.getState();
    const active = s.activeClipId ? s.clips[s.activeClipId] : null;
    const key = active ? `${active.id}:${playing ? 'play' : 'pause'}` : 'none';
    if (key === lastSnapshotKey.current) return;
    lastSnapshotKey.current = key;
    clipRef.current = active;
    const map: Record<string, Track> = {};
    if (active) {
      for (const tid of active.trackIds) {
        const tr = s.tracks[tid];
        if (!tr) continue;
        map[tid] = { ...tr, channel: { id: tr.channel.id, keys: [...tr.channel.keys] } };
      }
    }
    tracksRef.current = map;
  }, [playing, getState.getState().activeClipId]);

  useFrame((_, delta) => {
  const clip = clipRef.current;
  if (!clip) return;
    // When not playing, only apply sampling when the playhead changes (scrubbing)
  if (!playing) {
      if (lastPausedApplied.current !== playhead) {
        applySampleAt(playhead);
        lastPausedApplied.current = playhead;
    // keep shader anim time in sync while scrubbing/paused
    setAnimTime(playhead);
        updateAnimUniforms(playhead, fps);
      }
      return;
    }
    // Compute next time using local accumulator
    let t = localTime.current + delta * (clip.speed || 1);
    if (t > clip.end) {
      if (clip.loop) t = clip.start + ((t - clip.start) % Math.max(1e-6, clip.end - clip.start));
      else {
        t = clip.end;
        pause();
        // Immediate sync so UI/store reflect final frame when stopping
        seekSeconds(t);
        applySampleAt(t);
      }
    }
    if (t < clip.start) t = clip.start;
    // Quantize to fps for deterministic sampling
    t = Math.round(t * fps) / fps;
    localTime.current = t;

  // Sample values from snapshot and apply directly to Three objects
    const updates: SampleUpdate[] = [];
  if (clip.trackIds.length) {
      const solo = soloTrackIds;
      for (const tid of clip.trackIds) {
        if (solo.size > 0 && !solo.has(tid)) continue;
    const tr = tracksRef.current[tid];
        if (!tr || tr.muted) continue;
        const val = evalChannel(tr.channel, t);
        if (val === undefined) continue;
        updates.push({ targetId: tr.targetId, property: tr.property, value: val });
      }
    }

    if (updates.length) {
      // Batch to object vectors
      const byObj: Record<string, Partial<{ position: any; rotation: any; scale: any }>> = {};
      for (const u of updates) {
        const bucket = byObj[u.targetId] || (byObj[u.targetId] = {});
        const [prop, axis] = u.property.split('.') as [keyof typeof bucket, 'x' | 'y' | 'z'];
        const vec = (bucket as any)[prop] || { x: undefined, y: undefined, z: undefined };
        vec[axis] = u.value;
        (bucket as any)[prop] = vec;
      }
      // Apply directly to Three.js Object3D when possible
      for (const [objId, partial] of Object.entries(byObj)) {
        const o = getObject3D(objId);
        if (!o) continue;
        if (partial.position) {
          if (partial.position.x !== undefined) o.position.x = partial.position.x;
          if (partial.position.y !== undefined) o.position.y = partial.position.y;
          if (partial.position.z !== undefined) o.position.z = partial.position.z;
        }
        if (partial.rotation) {
          if (partial.rotation.x !== undefined) o.rotation.x = partial.rotation.x;
          if (partial.rotation.y !== undefined) o.rotation.y = partial.rotation.y;
          if (partial.rotation.z !== undefined) o.rotation.z = partial.rotation.z;
        }
        if (partial.scale) {
          if (partial.scale.x !== undefined) o.scale.x = partial.scale.x;
          if (partial.scale.y !== undefined) o.scale.y = partial.scale.y;
          if (partial.scale.z !== undefined) o.scale.z = partial.scale.z;
        }
        o.updateMatrix?.();
      }
    }

    // Sync UI playhead at ~10 Hz while running to reduce global re-renders
    uiSyncAccum.current += delta;
    if (uiSyncAccum.current >= 0.1) {
      uiSyncAccum.current = 0;
      seekSeconds(t);
    }

  // Update shader animation time uniform every frame
  setAnimTime(t);
  updateAnimUniforms(t, fps);
  });

  return null;
}

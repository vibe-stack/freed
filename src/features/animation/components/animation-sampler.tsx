"use client";

import { useEffect, useRef } from 'react';
import { useAnimationStore } from '@/stores/animation-store';
import { useFrame } from '@react-three/fiber';
import { useViewportStore } from '@/stores/viewport-store';

// Runs inside Canvas; advances playhead and applies samples in sync with render loop
export default function AnimationSampler() {
  const playing = useAnimationStore((s) => s.playing);
  const fps = useAnimationStore((s) => s.fps);
  const playhead = useAnimationStore((s) => s.playhead);
  const activeClipId = useAnimationStore((s) => s.activeClipId);
  const clip = useAnimationStore((s) => s.activeClipId ? s.clips[s.activeClipId] : null);
  const seekSeconds = useAnimationStore((s) => s.seekSeconds);
  const applySampleAt = useAnimationStore((s) => s.applySampleAt);
  const pause = useAnimationStore((s) => s.pause);

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

  // Step on each frame when playing; always apply at current playhead
  useFrame((_, delta) => {
    if (!clip) return;
    if (playing) {
      const dt = delta * (clip.speed || 1);
      let t = playhead + dt;
      if (t > clip.end) {
        if (clip.loop) t = clip.start + ((t - clip.start) % (clip.end - clip.start));
        else { t = clip.end; pause(); }
      }
      if (t < clip.start) t = clip.start;
      // Quantize to fps to keep deterministic per-frame evaluation
      const frame = Math.round(t * fps);
      t = frame / fps;
      seekSeconds(t);
    }
    applySampleAt(useAnimationStore.getState().playhead);
  });

  return null;
}

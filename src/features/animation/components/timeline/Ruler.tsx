"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { makeTicks, timeToX, xToTime } from './math';
import { useAnimationStore } from '@/stores/animation-store';

type Marker = { id: string; t: number; label?: string };

export type RulerProps = {
  height: number;
  hasClip: boolean;
  clipStart: number;
  clipEnd: number;
  fps: number;
  zoom: number;
  pan: number;
  playhead: number;
  onSeek: (t: number) => void;
  onWheelZoom: (factor: number, anchorX?: number) => void;
  onWheelPan: (deltaSeconds: number) => void;
  keyTimes?: number[];
  markers: Marker[];
  onBeginDragMarker: (id: string) => void;
  onDragMarker: (id: string, t: number) => void;
  onDoubleClickMarker: (id: string) => void;
  draggingMarkerId?: string | null;
};

export const Ruler: React.FC<RulerProps> = (props) => {
  const {
    height,
    hasClip,
    clipStart,
    clipEnd,
    fps,
    zoom,
    pan,
    playhead,
    onSeek,
    onWheelZoom,
    onWheelPan,
  markers,
  keyTimes = [],
    onBeginDragMarker,
    onDragMarker,
    onDoubleClickMarker,
    draggingMarkerId,
  } = props;

  const ref = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const snapEnabled = useAnimationStore((s) => s.snapEnabled);
  const snapToFrames = useAnimationStore((s) => s.snapToFrames);
  const snapToKeys = useAnimationStore((s) => s.snapToKeys);
  const snapThresholdPx = useAnimationStore((s) => s.snapThresholdPx) ?? 8;

  // Observe size so initial ticks render even before any user interaction
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const RO = (window as any).ResizeObserver;
    const obs = RO ? new RO((entries: any[]) => {
      const w = entries && entries[0] && entries[0].contentRect ? entries[0].contentRect.width : el.clientWidth;
      setContainerWidth(w);
    }) : null;
    if (obs) { obs.observe(el); setContainerWidth(el.clientWidth); }
    else {
      // Fallback: set once on mount
      setContainerWidth(el.clientWidth);
    }
  return () => { try { if (obs) obs.unobserve(el); } catch { /* noop */ } };
  }, []);

  const ticks = useMemo(() => {
    const pxWidth = containerWidth;
    const start = Math.max(clipStart, clipStart + pan);
    const end = Math.min(clipEnd, start + Math.max(pxWidth, 0) / Math.max(zoom, 1));
    return makeTicks({ start, end }, fps, clipStart, pan, zoom);
  }, [clipStart, clipEnd, fps, zoom, pan, containerWidth]);

  const posToTime = (clientX: number): number => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return playhead;
    const x = clientX - rect.left;
    const t = xToTime(x, clipStart, pan, zoom);
    return Math.max(clipStart, Math.min(t, clipEnd));
  };
  const snapTime = (t: number): number => {
    let T = t;
    if (snapEnabled && snapToFrames) {
      T = Math.round(T * fps) / fps;
    }
    if (snapEnabled && snapToKeys && keyTimes?.length) {
      const pxPerS = Math.max(zoom, 1);
      const threshS = (snapThresholdPx) / pxPerS;
      let best = T; let bestD = threshS + 1e-6;
      for (let i = 0; i < keyTimes.length; i++) {
        const d = Math.abs(keyTimes[i] - T);
        if (d <= bestD) { bestD = d; best = keyTimes[i]; }
      }
      T = best;
    }
    return Math.max(clipStart, Math.min(T, clipEnd));
  };
  const clientToLocalX = (clientX: number): number => {
    const rect = ref.current?.getBoundingClientRect();
    return rect ? (clientX - rect.left) : 0;
  };

  const onWheel: React.WheelEventHandler<HTMLDivElement> = (e) => {
    if (!hasClip) return;
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      onWheelZoom(factor, clientToLocalX(e.clientX));
    } else {
      // Pan proportional to pixel scroll and current seconds-per-pixel
      const secondsPerPx = 1 / Math.max(zoom, 1);
      onWheelPan(e.deltaY * secondsPerPx * 20);
    }
  };

  const onMouseDown: React.MouseEventHandler<HTMLDivElement> = (e) => {
    if (!hasClip) return;
    onSeek(posToTime(e.clientX));
  };

  return (
    <div
      className="relative select-none"
      style={{ height }}
      onWheel={onWheel}
      onMouseDown={(e) => {
        if (!hasClip) return;
    if (e.metaKey) {
          // Cmd-drag: zoom around cursor
          const startX = e.clientX;
          const move = (ev: MouseEvent) => {
            const dx = ev.clientX - startX;
            const factor = Math.pow(1.0015, dx);
      onWheelZoom(Math.max(0.1, Math.min(10, factor)), clientToLocalX(ev.clientX));
          };
          const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
          window.addEventListener('mousemove', move);
          window.addEventListener('mouseup', up);
        } else {
          onMouseDown(e);
        }
      }}
      onMouseMove={(e) => {
        if (!hasClip) return;
        if ((e.buttons & 1) === 1) {
          const t = posToTime(e.clientX);
          // Modifiers override: Shift -> frame, Alt -> nearest key
          if (e.shiftKey) onSeek(Math.round(t * fps) / fps);
          else if (e.altKey && keyTimes?.length) {
            let best = keyTimes[0]; let bestD = Math.abs(best - t);
            for (let i = 1; i < keyTimes.length; i++) { const d = Math.abs(keyTimes[i] - t); if (d < bestD) { bestD = d; best = keyTimes[i]; } }
            onSeek(best);
          } else onSeek(snapTime(t));
        }
      }}
      ref={ref}
    >
      {/* Tick marks */}
      <div className="absolute inset-0">
        {ticks.map((t, i) => (
          <div key={i} className="absolute top-0 h-full" style={{ left: t.x }}>
            <div className={`w-px ${t.major ? 'bg-white/50 h-3' : 'bg-white/30 h-2'}`} />
            {t.label && (
              <div className="absolute top-3 left-1 text-[10px] opacity-80 pointer-events-none">
                {t.label}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Playhead (thin at top, TrackLanes will draw full-height line) */}
      {hasClip && (
        <div className="absolute top-0 bottom-0" style={{ left: timeToX(playhead, clipStart, pan, zoom) }}>
          <div className="w-px bg-red-500/80 h-full" />
        </div>
      )}

      {/* Global markers lane */}
      {hasClip && (
        <div className="absolute inset-y-0">
          {markers.map((m) => (
            <div key={m.id} className="absolute top-0 bottom-0" style={{ left: timeToX(m.t, clipStart, pan, zoom) }}>
              <div
                className="w-[2px] h-full bg-yellow-400/80 cursor-ew-resize"
                title={m.label || 'Marker'}
                onMouseDown={(e) => { e.stopPropagation(); onBeginDragMarker(m.id); }}
                onMouseMove={(e) => { if (draggingMarkerId === m.id) onDragMarker(m.id, posToTime(e.clientX)); }}
                onDoubleClick={(e) => { e.stopPropagation(); onDoubleClickMarker(m.id); }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Ruler;

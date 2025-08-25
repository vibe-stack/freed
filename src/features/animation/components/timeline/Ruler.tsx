"use client";

import React, { useMemo, useRef } from 'react';
import { makeTicks, timeToX, xToTime } from './math';

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
  onWheelZoom: (factor: number) => void;
  onWheelPan: (deltaSeconds: number) => void;
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
    onBeginDragMarker,
    onDragMarker,
    onDoubleClickMarker,
    draggingMarkerId,
  } = props;

  const ref = useRef<HTMLDivElement>(null);

  const ticks = useMemo(() => {
    const pxWidth = ref.current?.clientWidth ?? 0;
    const start = Math.max(clipStart, clipStart + pan);
    const end = Math.min(clipEnd, start + Math.max(pxWidth, 0) / Math.max(zoom, 1));
    return makeTicks({ start, end }, fps, clipStart, pan, zoom);
  }, [clipStart, clipEnd, fps, zoom, pan]);

  const posToTime = (clientX: number): number => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return playhead;
    const x = clientX - rect.left;
    const t = xToTime(x, clipStart, pan, zoom);
    return Math.max(clipStart, Math.min(t, clipEnd));
  };

  const onWheel: React.WheelEventHandler<HTMLDivElement> = (e) => {
    if (!hasClip) return;
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      onWheelZoom(factor);
    } else {
      onWheelPan(e.deltaY * 0.001 * Math.max(clipEnd - clipStart, 1));
    }
  };

  const onMouseDown: React.MouseEventHandler<HTMLDivElement> = (e) => {
    if (!hasClip) return;
    onSeek(posToTime(e.clientX));
    // We intentionally don't add dragging logic here; parent can control if needed
  };

  return (
    <div
      className="relative select-none"
      style={{ height }}
      onWheel={onWheel}
      onMouseDown={onMouseDown}
  onMouseMove={(e) => { if (hasClip && (e.buttons & 1) === 1) onSeek(posToTime(e.clientX)); }}
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

      {/* Playhead */}
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

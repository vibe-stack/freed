"use client";

import React, { useEffect, useRef, useState } from 'react';
import { Row } from './TrackList';
import { timeToX } from './math';

export type TrackLanesProps = {
  rows: Row[];
  rowHeight?: number;
  clipStart: number;
  pan: number;
  zoom: number;
  clipEnd: number;
  tracks: Record<string, any>;
  selection: { keys: Record<string, Set<string>>; trackIds: string[] };
  playhead?: number;
  curvesRef: React.RefObject<HTMLDivElement | null>;
  onScrollSync: React.UIEventHandler<HTMLDivElement>;
  onMouseDownKey: (tid: string, keyId: string, e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseMoveKey: (tid: string, keyId: string, clientX: number) => void;
  unionKeyTimes: (trackIds: string[]) => number[];
  gridSeconds?: number; // optional fixed grid spacing in seconds per track
  // group drag
  onMouseDownGroup?: (trackIds: string[], e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseMoveGroup?: (trackIds: string[], clientX: number) => void;
  // panning
  onSetPan?: (pan: number) => void;
};

export const TrackLanes: React.FC<TrackLanesProps> = (props) => {
  const {
    rows,
    rowHeight = 40,
    clipStart,
    pan,
    zoom,
    clipEnd,
    tracks,
    selection,
  playhead,
    curvesRef,
    onScrollSync,
    onMouseDownKey,
    onMouseMoveKey,
    unionKeyTimes,
    gridSeconds = 0.25,
    onMouseDownGroup,
    onMouseMoveGroup,
    onSetPan,
  } = props;

  // Drag-to-pan state
  const panDrag = useRef<{ startX: number; startPan: number } | null>(null);
  const [activeGroupKey, setActiveGroupKey] = useState<string | null>(null);
  useEffect(() => {
    const onUp = () => setActiveGroupKey(null);
    window.addEventListener('mouseup', onUp);
    return () => window.removeEventListener('mouseup', onUp);
  }, []);
  const beginPanDrag = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onSetPan) return;
    // Don't start pan if Shift is held (reserved for group drag)
    if (e.shiftKey) return;
    // Only left button
    if (e.button !== 0) return;
    const current = panDrag.current;
    if (current) return;
    panDrag.current = { startX: e.clientX, startPan: pan };
    const move = (ev: MouseEvent) => {
      const dx = ev.clientX - (panDrag.current?.startX || 0);
      const newPan = (panDrag.current?.startPan || 0) - dx / Math.max(zoom, 1);
      onSetPan(newPan);
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      panDrag.current = null;
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  // Determine visible grid times based on the container width
  const gridLines = (container: HTMLDivElement | null): number[] => {
    if (!container) return [];
    const width = container.clientWidth;
    const visibleStart = Math.max(clipStart, clipStart + pan);
    const visibleEnd = Math.min(clipEnd, visibleStart + width / Math.max(zoom, 1));
    // Choose a pleasant step based on zoom if not fixed
    let step = gridSeconds;
    if (!step || step <= 0) {
      const targetPx = 80; // aim ~80px between lines
      const secondsPerPx = 1 / Math.max(zoom, 1);
      const targetSec = targetPx * secondsPerPx;
      const candidates = [0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 5, 10, 30, 60];
      step = candidates.find((s) => s >= targetSec) || 120;
    }
    const first = Math.floor(visibleStart / step) * step;
    const out: number[] = [];
    for (let t = first; t <= visibleEnd + 1e-6; t += step) out.push(t);
    return out;
  };

  const grids = (gridLines(curvesRef.current) || []);
  return (
    <div className="relative overflow-auto" ref={curvesRef} onScroll={onScrollSync}>
      <div
        className="absolute inset-0"
        onMouseDown={(e) => {
          // Global surface drag-to-pan if not captured by keys/rows
          if (e.button !== 0) return;
          beginPanDrag(e);
        }}
      >
        {/* Global grid lines spanning full height */}
        {grids.map((t) => (
          <div key={`grid:${t}`} className="absolute inset-y-0" style={{ left: timeToX(t, clipStart, pan, zoom) }}>
            <div className="w-px h-full bg-white/12" />
          </div>
        ))}
        {/* Global playhead spanning all lanes */}
        {typeof playhead === 'number' && (
          <div className="absolute top-0 bottom-0" style={{ left: timeToX(playhead, clipStart, pan, zoom) }}>
            <div className="w-px bg-red-500/80 h-full pointer-events-none" />
          </div>
        )}
        {rows.map((row, i) => {
          const rowY = i * rowHeight;
          const evenBg = i % 2 === 0 ? 'bg-black/20' : 'bg-black/10';
          if (row.kind === 'object' || row.kind === 'category') {
            const times = unionKeyTimes(row.childTrackIds);
            return (
              <div
                key={`lane:${row.kind}:${row.id}`}
                className="absolute left-0 right-0"
                style={{ top: rowY, height: rowHeight }}
                onMouseDown={(e) => {
                  // Hold Shift to move the entire group; otherwise start panning
                  if (e.shiftKey) {
                    if (!onMouseDownGroup) return;
                    onMouseDownGroup(row.childTrackIds, e);
                    if (onMouseMoveGroup) {
                      const move = (ev: MouseEvent) => onMouseMoveGroup(row.childTrackIds, ev.clientX);
                      const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
                      window.addEventListener('mousemove', move);
                      window.addEventListener('mouseup', up);
                    }
                  } else {
                    beginPanDrag(e);
                  }
                }}
              >
                <div className={`absolute inset-0 ${evenBg}`} />
                {times.map((t) => {
                  let x = timeToX(t, clipStart, pan, zoom);
                  if (x < 2) x = 2;
                  const keyId = `${row.id}:${t}`;
                  const selected = activeGroupKey === keyId;
                  return (
                    <div
                      key={keyId}
                      className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 md:w-2.5 md:h-2.5 rotate-45 ${selected ? 'bg-amber-400' : 'bg-white'} shadow-[0_0_0_1px_rgba(0,0,0,0.6)] hover:scale-110 transition-transform cursor-ew-resize`}
                      style={{ left: x }}
                      title={`Group key at t=${t.toFixed(3)}`}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setActiveGroupKey(keyId);
                        if (!onMouseDownGroup) return;
                        onMouseDownGroup(row.childTrackIds, e);
                        if (onMouseMoveGroup) {
                          const move = (ev: MouseEvent) => onMouseMoveGroup(row.childTrackIds, ev.clientX);
                          const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
                          window.addEventListener('mousemove', move);
                          window.addEventListener('mouseup', up);
                        }
                      }}
                    />
                  );
                })}
              </div>
            );
          } else {
            const tid = row.id; const tr = tracks[tid]; if (!tr) return null;
            return (
              <div
                key={`lane:track:${tid}`}
                className="absolute left-0 right-0"
                style={{ top: rowY, height: rowHeight }}
                onMouseDown={beginPanDrag}
              >
                <div className={`absolute inset-0 ${evenBg}`} />
                {/* per-track content only; grids are global */}
                {tr.channel.keys.map((k: any) => {
                  let x = timeToX(k.t, clipStart, pan, zoom);
                  // Keep first-at-zero keys fully visible (diamond would be half-cut otherwise)
                  if (x < 2) x = 2;
                  const selected = !!selection.keys[tid]?.has(k.id);
                  return (
                    <div
                      key={k.id}
                      className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 md:w-2.5 md:h-2.5 rotate-45 ${selected ? 'bg-amber-400' : 'bg-white'} shadow-[0_0_0_1px_rgba(0,0,0,0.6)] hover:scale-110 transition-transform cursor-ew-resize`}
                      style={{ left: x }}
                      title={`t=${k.t.toFixed(3)} v=${k.v.toFixed(3)}`}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        onMouseDownKey(tid, k.id, e);
                        const move = (ev: MouseEvent) => onMouseMoveKey(tid, k.id, ev.clientX);
                        const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
                        window.addEventListener('mousemove', move);
                        window.addEventListener('mouseup', up);
                      }}
                    />
                  );
                })}
              </div>
            );
          }
        })}
      </div>
    </div>
  );
};

export default TrackLanes;

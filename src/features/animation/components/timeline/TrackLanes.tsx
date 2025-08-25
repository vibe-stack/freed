"use client";

import React from 'react';
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
  curvesRef: React.RefObject<HTMLDivElement | null>;
  onScrollSync: React.UIEventHandler<HTMLDivElement>;
  onMouseDownKey: (tid: string, keyId: string, e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseMoveKey: (tid: string, keyId: string, clientX: number) => void;
  unionKeyTimes: (trackIds: string[]) => number[];
  gridSeconds?: number; // optional fixed grid spacing in seconds per track
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
    curvesRef,
    onScrollSync,
    onMouseDownKey,
    onMouseMoveKey,
    unionKeyTimes,
    gridSeconds = 0.25,
  } = props;

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

  return (
    <div className="relative overflow-auto" ref={curvesRef} onScroll={onScrollSync}>
      <div className="absolute inset-0">
        {rows.map((row, i) => {
          const rowY = i * rowHeight;
          const evenBg = i % 2 === 0 ? 'bg-black/20' : 'bg-black/10';
          if (row.kind === 'object' || row.kind === 'category') {
            const times = unionKeyTimes(row.childTrackIds);
            return (
              <div key={`lane:${row.kind}:${row.id}`} className="absolute left-0 right-0" style={{ top: rowY, height: rowHeight }}>
                <div className={`absolute inset-0 ${evenBg}`} />
                {/* Grid lines for group lanes (lighter) */}
                {(gridLines(curvesRef.current) || []).map((t) => (
                  <div key={`g:${row.id}:${t}`} className="absolute inset-y-0" style={{ left: timeToX(t, clipStart, pan, zoom) }}>
                    <div className="w-px h-full bg-white/10" />
                  </div>
                ))}
                {times.map((t) => (
                  <div key={t} className="absolute top-1/2 -translate-y-1/2 -ml-[1px] -mt-[3px] w-[2px] h-1.5 bg-white/50" style={{ left: timeToX(t, clipStart, pan, zoom) }} />
                ))}
              </div>
            );
          } else {
            const tid = row.id; const tr = tracks[tid]; if (!tr) return null;
            return (
              <div key={`lane:track:${tid}`} className="absolute left-0 right-0" style={{ top: rowY, height: rowHeight }}>
                <div className={`absolute inset-0 ${evenBg}`} />
                {/* Grid lines for track lanes */}
                {(gridLines(curvesRef.current) || []).map((t) => (
                  <div key={`t:${tid}:${t}`} className="absolute inset-y-0" style={{ left: timeToX(t, clipStart, pan, zoom) }}>
                    <div className="w-px h-full bg-white/15" />
                  </div>
                ))}
                {tr.channel.keys.map((k: any) => {
                  const x = timeToX(k.t, clipStart, pan, zoom);
                  const selected = !!selection.keys[tid]?.has(k.id);
                  return (
                    <div
                      key={k.id}
                      className={`absolute top-1/2 -translate-y-1/2 -ml-1 -mt-1 w-2 h-2 rounded-sm ${selected ? 'bg-amber-400' : 'bg-white'} hover:scale-110 transition-transform cursor-ew-resize`}
                      style={{ left: x }}
                      title={`t=${k.t.toFixed(3)} v=${k.v.toFixed(3)}`}
                      onMouseDown={(e) => onMouseDownKey(tid, k.id, e)}
                      onMouseMove={(e) => onMouseMoveKey(tid, k.id, e.clientX)}
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

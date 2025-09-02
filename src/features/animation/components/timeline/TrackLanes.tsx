"use client";

import React, { useEffect, useRef, useState } from 'react';
import { Row } from './TrackList';
import { timeToX } from './math';
import { useAnimationStore } from '@/stores/animation-store';
import { ContextMenu } from '@base-ui-components/react/context-menu';

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
  // marquee selection state
  const [marqueeBox, setMarqueeBox] = useState<null | { left: number; top: number; width: number; height: number }>(null);
  const marqueeRef = useRef<null | { x0: number; y0: number; x1: number; y1: number; startScrollTop: number }>(null);
  // keyframe context menu state
  const [cmOpen, setCmOpen] = useState(false);
  const [cmPos, setCmPos] = useState<{ x: number; y: number } | null>(null);
  const [cmUp, setCmUp] = useState(false);
  const [cmKey, setCmKey] = useState<{ trackId: string; keyId: string } | null>(null);
  const setInterpolation = useAnimationStore((s) => s.setInterpolation);
  const applyEasingPreset = useAnimationStore((s) => s.applyEasingPreset);
  const clearSelection = useAnimationStore((s) => s.clearSelection);
  const selectKey = useAnimationStore((s) => s.selectKey);
  const selectTrack = useAnimationStore((s) => s.selectTrack);
  const nudgeKeysSubset = useAnimationStore((s) => s.nudgeKeysSubset);
  // open context menu anywhere on the lanes surface
  const openContextMenu = (e: React.MouseEvent, keyCtx?: { trackId: string; keyId: string } | null) => {
    e.preventDefault();
    setCmKey(keyCtx || null);
    const y = e.clientY;
    const vSpace = (typeof window !== 'undefined') ? (window.innerHeight - y) : 9999;
    setCmUp(vSpace < 260);
    setCmPos({ x: e.clientX, y });
    setCmOpen(true);
  };
  return (
  <div className="relative overflow-auto select-none" ref={curvesRef} onScroll={onScrollSync}
      onMouseDown={(e) => {
        // Alt+Shift marquee
        if (e.altKey && e.shiftKey && e.button === 0) {
          const el = curvesRef.current; if (!el) return;
          const rect = el.getBoundingClientRect();
          const x = e.clientX - rect.left; const y = e.clientY - rect.top + el.scrollTop;
          marqueeRef.current = { x0: x, y0: y, x1: x, y1: y, startScrollTop: el.scrollTop };
          setMarqueeBox({ left: x, top: y, width: 1, height: 1 });
          clearSelection();
          const move = (ev: MouseEvent) => {
            if (!marqueeRef.current) return;
            const x1 = ev.clientX - rect.left; const y1 = ev.clientY - rect.top + el.scrollTop;
            marqueeRef.current.x1 = x1; marqueeRef.current.y1 = y1;
            const minX = Math.min(marqueeRef.current.x0, x1);
            const maxX = Math.max(marqueeRef.current.x0, x1);
            const minY = Math.min(marqueeRef.current.y0, y1);
            const maxY = Math.max(marqueeRef.current.y0, y1);
            setMarqueeBox({ left: minX, top: minY, width: maxX - minX, height: maxY - minY });
            rows.forEach((row, i) => {
              if (row.kind !== 'track') return;
              const tid = row.id; const tr = tracks[tid]; if (!tr) return;
              const rowTop = i * rowHeight; const rowBottom = rowTop + rowHeight;
              if (rowBottom < minY || rowTop > maxY) return;
              tr.channel.keys.forEach((k: any) => {
                const x = timeToX(k.t, clipStart, pan, zoom);
                if (x >= minX && x <= maxX) selectKey(tid, k.id, true);
              });
            });
          };
          const up = () => {
            marqueeRef.current = null; setMarqueeBox(null);
            window.removeEventListener('mousemove', move);
            window.removeEventListener('mouseup', up);
          };
          window.addEventListener('mousemove', move);
          window.addEventListener('mouseup', up);
        }
      }}
    >
      <div
        className="absolute inset-0"
        onMouseDown={(e) => {
          // Global surface drag-to-pan if not captured by keys/rows
          if (e.button !== 0) return;
          beginPanDrag(e);
        }}
  onContextMenu={(e) => openContextMenu(e, null)}
      >
        {/* Global grid lines spanning full content height */}
        {grids.map((t) => (
          <div key={`grid:${t}`} className="absolute" style={{ left: timeToX(t, clipStart, pan, zoom), top: 0, height: rows.length * rowHeight }}>
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
                    // Select all tracks in this group for visual feedback
                    if (!(e.metaKey || e.ctrlKey)) clearSelection();
                    row.childTrackIds.forEach((tid) => selectTrack(tid, true));
                    onMouseDownGroup(row.childTrackIds, e);
                    if (onMouseMoveGroup) {
                      const move = (ev: MouseEvent) => onMouseMoveGroup(row.childTrackIds, ev.clientX);
                      const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
                      window.addEventListener('mousemove', move);
                      window.addEventListener('mouseup', up);
                    }
                  } else {
                    // Select group tracks on click (recursive selection semantics)
                    if (!(e.metaKey || e.ctrlKey)) clearSelection();
                    row.childTrackIds.forEach((tid) => selectTrack(tid, true));
                    beginPanDrag(e);
                  }
                }}
              >
                <div className={`absolute inset-0 ${evenBg}`} />
                {times.map((t) => {
                  let x = timeToX(t, clipStart, pan, zoom);
                  if (x < 2) x = 2;
                  const keyId = `${row.id}:${t}`;
                  // Selected if any selected child key matches this time
                  let selected = activeGroupKey === keyId;
                  const EPS = 1e-6;
                  if (!selected) {
                    outer: for (const tid of row.childTrackIds) {
                      const set = selection.keys[tid]; if (!set) continue;
                      const tr = tracks[tid]; if (!tr) continue;
                      for (const k of tr.channel.keys as any[]) {
                        if (!set.has(k.id)) continue;
                        if (Math.abs(k.t - t) < EPS) { selected = true; break outer; }
                      }
                    }
                  }
      return (
                    <div
                      key={keyId}
                      className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 md:w-2.5 md:h-2.5 rotate-45 ${selected ? 'bg-amber-400' : 'bg-white'} shadow-[0_0_0_1px_rgba(0,0,0,0.6)] hover:scale-110 transition-transform cursor-ew-resize`}
                      style={{ left: x }}
                      title={`Group key at t=${t.toFixed(3)}`}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setActiveGroupKey(keyId);
                        // Select keys at this group time across the subtree
                        const EPS = 1e-6;
                        if (!(e.metaKey || e.ctrlKey)) clearSelection();
                        const pairs: Array<{ trackId: string; keyId: string }> = [];
                        row.childTrackIds.forEach((tid) => {
                          const tr = tracks[tid]; if (!tr) return;
                          const k = tr.channel.keys.find((kk: any) => Math.abs(kk.t - t) < EPS);
                          if (k) { selectKey(tid, k.id, true); pairs.push({ trackId: tid, keyId: k.id }); }
                        });
                        // Begin drag to nudge only these keys
                        const startX = e.clientX; let lastDt = 0;
                        const move = (ev: MouseEvent) => {
                          const dx = ev.clientX - startX;
                          let total = dx / Math.max(zoom, 1);
                          // Snap to frames if enabled
                          const st = useAnimationStore.getState();
                          if (st.snapEnabled && st.snapToFrames) {
                            const fps = st.fps || 30;
                            total = Math.round(total * fps) / fps;
                          }
                          const delta = total - lastDt;
                          if (Math.abs(delta) < 1e-6) return;
                          nudgeKeysSubset(pairs, delta, undefined, false);
                          lastDt += delta;
                        };
                        const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
                        window.addEventListener('mousemove', move);
                        window.addEventListener('mouseup', up);
                      }}
                      onContextMenu={(e) => openContextMenu(e, null)}
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
      // Highlight parent category group diamond at this time
      const trk = tracks[tid];
      const parts = (trk?.property || '').split('.');
      const cat = parts[0];
      const catId = `${row.objectId}:transform:${cat}`;
      setActiveGroupKey(`${catId}:${k.t}`);
                        const move = (ev: MouseEvent) => onMouseMoveKey(tid, k.id, ev.clientX);
                        const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
                        window.addEventListener('mousemove', move);
                        window.addEventListener('mouseup', up);
                      }}
                      onContextMenu={(e) => openContextMenu(e, { trackId: tid, keyId: k.id })}
                    />
                  );
                })}
              </div>
            );
          }
        })}
        {marqueeBox && (
          <div className="absolute border border-blue-400/70 bg-blue-400/20 pointer-events-none" style={{ left: marqueeBox.left, top: marqueeBox.top, width: marqueeBox.width, height: marqueeBox.height }} />
        )}
        {/* Keyframe context menu */}
        <ContextMenu.Root open={cmOpen} onOpenChange={setCmOpen}>
          <ContextMenu.Portal>
            <ContextMenu.Positioner>
              <ContextMenu.Popup
                className="z-[200000] min-w-48 rounded-md border border-white/10 bg-zinc-900/95 text-sm text-gray-200 shadow-lg shadow-black/60 relative overflow-hidden"
                style={{ position: 'fixed', left: (cmPos?.x ?? 0) + 8, top: (cmPos?.y ?? 0) + 8, transform: cmUp ? 'translateY(-100%)' : undefined }}
              >
                <div className="p-1 max-h-72 overflow-y-auto overscroll-contain">
                  <div className="px-2 py-1.5 cursor-default select-none opacity-70">Interpolation</div>
                  {[
                    { id: 'step', label: 'Constant (Step)' },
                    { id: 'linear', label: 'Linear' },
                    { id: 'bezier', label: 'Bezier' },
                  ].map((it) => (
                    <ContextMenu.Item key={it.id} onClick={() => {
                      // Apply to all selected keys if any, otherwise to cmKey only
                      const hasSelection = Object.values(selection.keys).some((s) => s && s.size > 0);
                      if (hasSelection) {
                        Object.entries(selection.keys).forEach(([tid2, set]) => {
                          const tr = tracks[tid2]; if (!tr) return;
                          set.forEach((kid) => setInterpolation(tid2, kid, it.id as any));
                        });
                      } else if (cmKey) {
                        setInterpolation(cmKey.trackId, cmKey.keyId, it.id as any);
                      }
                      setCmOpen(false);
                    }}>
                      <div className="px-2 py-1.5 rounded hover:bg-white/10 cursor-default">{it.label}</div>
                    </ContextMenu.Item>
                  ))}
                  <ContextMenu.Separator />
                  <div className="px-2 py-1.5 cursor-default select-none opacity-70">Easing Presets</div>
                  {[
                    { label: 'Ease In', preset: 'easeIn' },
                    { label: 'Ease Out', preset: 'easeOut' },
                    { label: 'Ease In-Out', preset: 'easeInOut' },
                    { label: 'Back In', preset: 'backIn' },
                    { label: 'Back Out', preset: 'backOut' },
                    { label: 'Back In-Out', preset: 'backInOut' },
                    { label: 'Bounce', preset: 'bounce' },
                    { label: 'Elastic', preset: 'elastic' },
                  ].map(({ label, preset }) => (
                    <ContextMenu.Item key={label} onClick={() => {
                      const pairs: Array<{ trackId: string; keyId: string }> = [];
                      const hasSelection = Object.values(selection.keys).some((s) => s && s.size > 0);
                      if (hasSelection) {
                        Object.entries(selection.keys).forEach(([tid2, set]) => {
                          set.forEach((kid) => pairs.push({ trackId: tid2, keyId: kid }));
                        });
                      } else if (cmKey) {
                        pairs.push(cmKey);
                      }
                      if (pairs.length) applyEasingPreset(pairs, preset as any, 1);
                      setCmOpen(false);
                    }}>
                      <div className="px-2 py-1.5 rounded hover:bg-white/10 cursor-default">{label}</div>
                    </ContextMenu.Item>
                  ))}
                </div>
              </ContextMenu.Popup>
            </ContextMenu.Positioner>
          </ContextMenu.Portal>
        </ContextMenu.Root>
      </div>
    </div>
  );
};

export default TrackLanes;

"use client";

import React, { useMemo, useRef, useState } from 'react';
import { useAnimationStore } from '@/stores/animation-store';
import { useSceneStore } from '@/stores/scene-store';
import Ruler from './timeline/Ruler';
import TrackList, { Row as ListRow } from './timeline/TrackList';
import TrackLanes from './timeline/TrackLanes';

const RULER_HEIGHT = 24;

export const Timeline: React.FC = () => {
  const activeClipId = useAnimationStore((s) => s.activeClipId);
  const clip = useAnimationStore((s) => s.activeClipId ? s.clips[s.activeClipId] : null);
  const playhead = useAnimationStore((s) => s.playhead);
  const fps = useAnimationStore((s) => s.fps);
  const seekSeconds = useAnimationStore((s) => s.seekSeconds);
  const zoom = useAnimationStore((s) => s.zoom);
  const pan = useAnimationStore((s) => s.pan);
  const setZoom = useAnimationStore((s) => s.setZoom);
  const setPan = useAnimationStore((s) => s.setPan);
  const tracks = useAnimationStore((s) => s.tracks);
  const selection = useAnimationStore((s) => s.selection);
  const selectTrack = useAnimationStore((s) => s.selectTrack);
  const selectKey = useAnimationStore((s) => s.selectKey);
  const moveKey = useAnimationStore((s) => s.moveKey);
  const nudgeSelectedKeys = useAnimationStore((s) => s.nudgeSelectedKeys);
  const clearSelection = useAnimationStore((s) => s.clearSelection);
  const setTrackMuted = useAnimationStore((s) => s.setTrackMuted);
  const setTrackLocked = useAnimationStore((s) => s.setTrackLocked);
  const toggleTrackSolo = useAnimationStore((s) => s.toggleTrackSolo);
  const soloTrackIds = useAnimationStore((s) => s.soloTrackIds);
  const markers = useAnimationStore((s) => s.markers);
  const moveMarker = useAnimationStore((s) => s.moveMarker);
  const removeMarker = useAnimationStore((s) => s.removeMarker);

  const [draggingKey, setDraggingKey] = useState<{ trackId: string; keyId: string }|null>(null);
  const [draggingMarker, setDraggingMarker] = useState<string|null>(null);
  const [draggingGroup, setDraggingGroup] = useState<{ trackIds: string[]; startX: number; startT: number; lastDt: number }|null>(null);

  const objects = useSceneStore((s) => s.objects);
  const listRef = useRef<HTMLDivElement>(null);
  const curvesRef = useRef<HTMLDivElement>(null);
  const [expandedObjects, setExpandedObjects] = useState<Record<string, boolean>>({});
  const [expandedTransforms, setExpandedTransforms] = useState<Record<string, boolean>>({}); // key: `${objId}:transform:${cat}`

  const onSyncScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (target === listRef.current && curvesRef.current) {
      curvesRef.current.scrollTop = target.scrollTop;
    } else if (target === curvesRef.current && listRef.current) {
      listRef.current.scrollTop = target.scrollTop;
    }
  };

  const hasClip = !!activeClipId && !!clip;
  const clipStart = clip?.start ?? 0;
  const clipEnd = clip?.end ?? Math.max(clipStart + 5, clipStart + 1);
  const clampPan = (p: number) => {
    // Limit left scroll to ~100px before clip start (frame zero origin)
    const maxLeftSeconds = 100 / Math.max(zoom, 1);
    const minPan = -maxLeftSeconds;
    // Right pan can be generous; no hard limit here
    return Math.max(minPan, p);
  };

  // Build hierarchical rows
  type Row = ListRow;
  const rows: Row[] = useMemo(() => {
    if (!clip) return [];
    const byObject: Record<string, { name: string; trackIds: string[] }> = {};
    for (const tid of clip.trackIds) {
      const tr = tracks[tid]; if (!tr) continue;
      const objId = tr.targetId;
      (byObject[objId] ||= { name: objects[objId]?.name || objId, trackIds: [] }).trackIds.push(tid);
    }
    const out: Row[] = [];
    Object.entries(byObject).forEach(([objId, info]) => {
      const objectRow: Row = { kind: 'object', id: objId, label: info.name, depth: 0, childTrackIds: info.trackIds } as any;
      out.push(objectRow);
      if (!expandedObjects[objId]) return;
      const cats: Record<'position'|'rotation'|'scale', string[]> = { position: [], rotation: [], scale: [] } as any;
      info.trackIds.forEach((tid) => {
        const tr = tracks[tid]; if (!tr) return;
        const [cat] = tr.property.split('.') as [keyof typeof cats | string];
        if (cat === 'position' || cat === 'rotation' || cat === 'scale') {
          cats[cat].push(tid);
        }
      });
      (['position','rotation','scale'] as const).forEach((cat) => {
        const tids = cats[cat];
        if (!tids.length) return;
        const catId = `${objId}:transform:${cat}`;
        out.push({ kind: 'category', id: catId, objectId: objId, category: cat, label: cat[0].toUpperCase()+cat.slice(1), depth: 1, childTrackIds: tids } as any);
        if (!expandedTransforms[catId]) return;
        const byAxis: Record<'x'|'y'|'z', string|undefined> = { x: undefined, y: undefined, z: undefined } as any;
        tids.forEach((tid) => {
          const tr = tracks[tid]; if (!tr) return;
          const parts = tr.property.split('.');
          const axis = parts[1] as 'x'|'y'|'z'|undefined;
          if (axis && byAxis[axis] === undefined) byAxis[axis] = tid;
        });
        (['x','y','z'] as const).forEach((axis) => {
          const tid = byAxis[axis];
          if (!tid) return;
          out.push({ kind: 'track', id: tid, objectId: objId, property: `${cat}.${axis}`, axis, label: axis.toUpperCase(), depth: 2 } as any);
        });
      });
    });
    return out;
  }, [clip, tracks, objects, expandedObjects, expandedTransforms]);
  const rowHeight = 40;

  const unionKeyTimes = (trackIds: string[]) => {
    const set = new Set<number>();
    trackIds.forEach((tid) => {
      const tr = tracks[tid]; if (!tr) return;
      tr.channel.keys.forEach((k: any) => set.add(k.t));
    });
    return Array.from(set.values()).sort((a,b)=>a-b);
  };
  const allKeyTimes = useMemo(() => {
    if (!clip) return [] as number[];
    return unionKeyTimes(clip.trackIds);
  }, [clip, tracks]);

  const posToTimeFromCurves = (clientX: number): number => {
    const rect = (curvesRef.current as HTMLDivElement | null)?.getBoundingClientRect();
    if (!rect) return playhead;
    const x = clientX - rect.left;
    const t = (x / Math.max(zoom, 1)) + clipStart + pan;
    return Math.max(clipStart, Math.min(t, clipEnd));
  };

  // Group drag handlers: dragging object or category rows moves all their child keys in time
  const onMouseDownGroup = (trackIds: string[], e: React.MouseEvent<HTMLDivElement>) => {
    if (!trackIds?.length) return;
    // Only start drag on main button, and ignore if clicking on a key (bubbling prevented there)
    if (e.button !== 0) return;
  setDraggingGroup({ trackIds, startX: e.clientX, startT: playhead, lastDt: 0 });
    // Select involved tracks for visual feedback
    if (!(e.shiftKey || e.metaKey || e.ctrlKey)) clearSelection();
    trackIds.forEach((tid) => selectTrack(tid, true));
  };
  const onMouseMoveGroup = (trackIds: string[], clientX: number) => {
    if (!draggingGroup) return;
    // compute delta time based on mouse motion
  const total = (clientX - draggingGroup.startX) / Math.max(zoom, 1);
  if (!isFinite(total)) return;
  const delta = total - draggingGroup.lastDt;
  if (Math.abs(delta) < 1e-6) return;
  useAnimationStore.getState().nudgeKeysForTracks(trackIds, delta, false);
  setDraggingGroup({ ...draggingGroup, lastDt: draggingGroup.lastDt + delta });
  };
  const onMouseUpGroup: React.MouseEventHandler<HTMLDivElement> = () => {
    if (!draggingGroup) return;
    setDraggingGroup(null);
  };

  return (
    <div className="absolute left-0 right-0 bottom-0 z-20" style={{ pointerEvents: 'none' }}>
      <div className="mx-2 rounded-md border border-white/10 bg-black/70 backdrop-blur pointer-events-auto overflow-hidden">
        <div className="grid" style={{ gridTemplateColumns: '260px 1fr' }}>
          <div className="border-r bg-black border-white/10 flex items-center px-2 text-xs opacity-70" style={{ height: RULER_HEIGHT }}>
            Tracks
          </div>
          <Ruler
            height={RULER_HEIGHT}
            hasClip={hasClip}
            clipStart={clipStart}
            clipEnd={clipEnd}
            fps={fps}
            zoom={zoom}
            pan={pan}
            playhead={playhead}
            onSeek={seekSeconds}
            onWheelZoom={(factor, anchorX) => {
              const oldZoom = Math.max(zoom, 1);
              const newZoom = Math.round(Math.max(10, Math.min(1000, oldZoom * factor)));
              if (anchorX !== undefined) {
                // keep time under anchorX stable: t = x/zoom + clipStart + pan
                // pan' = t - (x/newZoom) - clipStart
                const t = (anchorX / oldZoom) + clipStart + pan;
                const newPan = t - (anchorX / newZoom) - clipStart;
                setPan(newPan);
              }
              setZoom(newZoom);
            }}
            onWheelPan={(delta) => setPan(clampPan(pan + delta))}
            keyTimes={allKeyTimes}
            markers={markers}
            onBeginDragMarker={(id) => setDraggingMarker(id)}
            onDragMarker={(id, t) => moveMarker(id, t)}
            onDoubleClickMarker={(id) => removeMarker(id)}
            draggingMarkerId={draggingMarker}
          />
        </div>

        <div className="h-64 border-t border-white/10 grid" style={{ gridTemplateColumns: '260px 1fr' }} onMouseUp={onMouseUpGroup}>
          <TrackList
            rows={rows}
            objects={objects}
            tracks={tracks}
            rowHeight={rowHeight}
            expandedObjects={expandedObjects}
            setExpandedObjects={setExpandedObjects}
            expandedTransforms={expandedTransforms}
            setExpandedTransforms={setExpandedTransforms}
            selection={selection}
            soloTrackIds={soloTrackIds}
            selectTrack={selectTrack}
            toggleTrackSolo={toggleTrackSolo}
            setTrackMuted={setTrackMuted}
            setTrackLocked={setTrackLocked}
            onScrollSync={onSyncScroll}
            listRef={listRef}
          />
          

          <TrackLanes
            rows={rows}
            rowHeight={rowHeight}
            clipStart={clipStart}
            clipEnd={clipEnd}
            pan={pan}
            zoom={zoom}
            tracks={tracks}
            selection={selection as any}
            playhead={playhead}
            curvesRef={curvesRef}
            onScrollSync={onSyncScroll}
            unionKeyTimes={unionKeyTimes}
            onMouseDownKey={(tid, keyId, e) => { e.stopPropagation(); setDraggingKey({ trackId: tid, keyId }); selectKey(tid, keyId, e.shiftKey || e.metaKey || e.ctrlKey); }}
            onMouseMoveKey={(tid, keyId, clientX) => { if (draggingKey && draggingKey.keyId === keyId && draggingKey.trackId === tid) moveKey(tid, keyId, posToTimeFromCurves(clientX)); }}
            onMouseDownGroup={onMouseDownGroup}
            onMouseMoveGroup={onMouseMoveGroup}
            onSetPan={(p) => setPan(clampPan(p))}
          />
        </div>
      </div>
    </div>
  );
};

export default Timeline;

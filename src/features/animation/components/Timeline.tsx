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
  const setTrackMuted = useAnimationStore((s) => s.setTrackMuted);
  const setTrackLocked = useAnimationStore((s) => s.setTrackLocked);
  const toggleTrackSolo = useAnimationStore((s) => s.toggleTrackSolo);
  const soloTrackIds = useAnimationStore((s) => s.soloTrackIds);
  const markers = useAnimationStore((s) => s.markers);
  const moveMarker = useAnimationStore((s) => s.moveMarker);
  const removeMarker = useAnimationStore((s) => s.removeMarker);

  const [draggingKey, setDraggingKey] = useState<{ trackId: string; keyId: string }|null>(null);
  const [draggingMarker, setDraggingMarker] = useState<string|null>(null);

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

  const unionKeyTimes = (trackIds: string[]) => {
    const set = new Set<number>();
    trackIds.forEach((tid) => {
      const tr = tracks[tid]; if (!tr) return;
      tr.channel.keys.forEach((k: any) => set.add(k.t));
    });
    return Array.from(set.values()).sort((a,b)=>a-b);
  };

  const posToTimeFromCurves = (clientX: number): number => {
    const rect = (curvesRef.current as HTMLDivElement | null)?.getBoundingClientRect();
    if (!rect) return playhead;
    const x = clientX - rect.left;
    const t = (x / Math.max(zoom, 1)) + clipStart + pan;
    return Math.max(clipStart, Math.min(t, clipEnd));
  };

  return (
    <div className="absolute left-0 right-0 bottom-0 z-20" style={{ pointerEvents: 'none' }}>
      <div className="mx-2 rounded-md border border-white/10 bg-black/70 backdrop-blur pointer-events-auto overflow-hidden">
        <div className="grid" style={{ gridTemplateColumns: '260px 1fr' }}>
          <div className="border-r border-white/10 flex items-center px-2 text-xs opacity-70" style={{ height: RULER_HEIGHT }}>
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
            onWheelZoom={(factor) => setZoom(Math.round(zoom * factor))}
            onWheelPan={(delta) => setPan(pan + delta)}
            markers={markers}
            onBeginDragMarker={(id) => setDraggingMarker(id)}
            onDragMarker={(id, t) => moveMarker(id, t)}
            onDoubleClickMarker={(id) => removeMarker(id)}
            draggingMarkerId={draggingMarker}
          />
        </div>

        <div className="h-64 border-t border-white/10 grid" style={{ gridTemplateColumns: '260px 1fr' }}>
          <TrackList
            rows={rows}
            objects={objects}
            tracks={tracks}
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
            clipStart={clipStart}
            clipEnd={clipEnd}
            pan={pan}
            zoom={zoom}
            tracks={tracks}
            selection={selection as any}
            curvesRef={curvesRef}
            onScrollSync={onSyncScroll}
            unionKeyTimes={unionKeyTimes}
            onMouseDownKey={(tid, keyId, e) => { e.stopPropagation(); setDraggingKey({ trackId: tid, keyId }); selectKey(tid, keyId, e.shiftKey || e.metaKey || e.ctrlKey); }}
            onMouseMoveKey={(tid, keyId, clientX) => { if (draggingKey && draggingKey.keyId === keyId && draggingKey.trackId === tid) moveKey(tid, keyId, posToTimeFromCurves(clientX)); }}
          />
        </div>
      </div>
    </div>
  );
};

export default Timeline;

"use client";

import React from 'react';
import { ChevronDown, ChevronRight, Lock, Star, VolumeX } from 'lucide-react';

export type ObjectRow = { kind: 'object'; id: string; label: string; depth: 0; childTrackIds: string[] };
export type CategoryRow = { kind: 'category'; id: string; objectId: string; category: string; label: string; depth: 1; childTrackIds: string[] };
export type TrackRow = { kind: 'track'; id: string; objectId: string; property: string; axis?: 'x'|'y'|'z'; label: string; depth: 2 };
export type Row = ObjectRow | CategoryRow | TrackRow;

export type TrackListProps = {
  rows: Row[];
  objects: Record<string, { name?: string }>;
  tracks: Record<string, any>;
  rowHeight?: number;
  expandedObjects: Record<string, boolean>;
  setExpandedObjects: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  expandedTransforms: Record<string, boolean>;
  setExpandedTransforms: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  selection: { trackIds: string[] };
  soloTrackIds: Set<string>;
  selectTrack: (trackId: string, additive: boolean) => void;
  toggleTrackSolo: (trackId: string) => void;
  setTrackMuted: (trackId: string, muted: boolean) => void;
  setTrackLocked: (trackId: string, locked: boolean) => void;
  onScrollSync: React.UIEventHandler<HTMLDivElement>;
  listRef: React.RefObject<HTMLDivElement | null>;
};

export const TrackList: React.FC<TrackListProps> = (props) => {
  const {
    rows,
    objects,
    tracks,
  rowHeight = 40,
    expandedObjects,
    setExpandedObjects,
    expandedTransforms,
    setExpandedTransforms,
    selection,
    soloTrackIds,
    selectTrack,
    toggleTrackSolo,
    setTrackMuted,
    setTrackLocked,
    onScrollSync,
    listRef,
  } = props;

  return (
    <div className="border-r border-white/10 overflow-auto" ref={listRef} onScroll={onScrollSync}>
      {rows.map((row) => {
        if (row.kind === 'object') {
          const expanded = !!expandedObjects[row.id];
          return (
            <div key={`obj:${row.id}`} className="flex items-center gap-2 px-2 text-xs cursor-pointer bg-black/30 border-b border-white/5"
              style={{ height: rowHeight }}
              onClick={() => setExpandedObjects((m) => ({ ...m, [row.id]: !expanded }))}
              title={row.label}
            >
              {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              <div className="font-medium truncate flex-1">{row.label}</div>
            </div>
          );
        } else if (row.kind === 'category') {
          const expanded = !!expandedTransforms[row.id];
          return (
            <div key={`cat:${row.id}`} className="flex items-center gap-2 px-2 text-[11px] cursor-pointer pl-6 bg-black/20 border-b border-white/5"
              style={{ height: rowHeight }}
              onClick={() => setExpandedTransforms((m) => ({ ...m, [row.id]: !expanded }))}
              title={`${objects[row.objectId]?.name || row.objectId} ${row.label}`}
            >
              {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              <div className="truncate flex-1">{row.label}</div>
            </div>
          );
        } else {
          const tid = row.id; const tr = tracks[tid]; if (!tr) return null;
          const selected = selection.trackIds.includes(tid);
          const solo = soloTrackIds.has(tid);
          return (
            <div key={`trk:${tid}`} className={`flex items-center gap-2 px-2 text-xs cursor-pointer pl-10 border-b border-white/5 ${selected ? 'bg-white/10' : ''}`}
              style={{ height: rowHeight }}
              onClick={(e) => selectTrack(tid, e.shiftKey || e.metaKey || e.ctrlKey)}
              title={`${objects[row.objectId]?.name || row.objectId}.${tr.property}`}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              <div className="flex-1 truncate">{row.label}</div>
              <button className={`p-1 rounded ${solo ? 'bg-yellow-500/30' : 'bg-white/10'}`} title="Solo: Play only this track (and other soloed)" onClick={(e) => { e.stopPropagation(); toggleTrackSolo(tid); }}>
                <Star className="h-3.5 w-3.5" />
              </button>
              <button className={`p-1 rounded ${tr.muted ? 'bg-red-500/30' : 'bg-white/10'}`} title="Mute: Disable this track during playback" onClick={(e) => { e.stopPropagation(); setTrackMuted(tid, !tr.muted); }}>
                <VolumeX className="h-3.5 w-3.5" />
              </button>
              <button className={`p-1 rounded ${tr.locked ? 'bg-gray-500/30' : 'bg-white/10'}`} title="Lock: Prevent editing keys on this track" onClick={(e) => { e.stopPropagation(); setTrackLocked(tid, !tr.locked); }}>
                <Lock className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        }
      })}
    </div>
  );
};

export default TrackList;

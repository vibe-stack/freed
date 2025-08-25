"use client";

import React from 'react';
import { useAnimationStore, secondsToTimecode } from '@/stores/animation-store';
import { ChevronsLeft, SkipBack, Play, Pause, Square, SkipForward, ChevronsRight, PanelBottom, CornerDownLeft, CornerDownRight } from 'lucide-react';
import { DragInput } from '@/components/drag-input';

const IconButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { title: string }>
  = ({ title, children, ...props }) => (
  <button
    {...props}
    title={title}
    className={`inline-flex items-center justify-center h-8 w-8 rounded-md border border-white/10 bg-white/5 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500 ${props.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
  >
    {children}
  </button>
);

export const BottomBar: React.FC = () => {
  const playing = useAnimationStore((s) => s.playing);
  const play = useAnimationStore((s) => s.play);
  const pause = useAnimationStore((s) => s.pause);
  const stop = useAnimationStore((s) => s.stop);
  const togglePlay = useAnimationStore((s) => s.togglePlay);
  const fps = useAnimationStore((s) => s.fps);
  const setFps = useAnimationStore((s) => s.setFps);
  const toggleLoop = useAnimationStore((s) => s.toggleLoop);
  const activeClipId = useAnimationStore((s) => s.activeClipId);
  const clip = useAnimationStore((s) => s.activeClipId ? s.clips[s.activeClipId] : null);
  const playhead = useAnimationStore((s) => s.playhead);
  const toggleTimelinePanel = useAnimationStore((s) => s.toggleTimelinePanel);
  const timelineOpen = useAnimationStore((s) => s.timelinePanelOpen);
  const autoKey = useAnimationStore((s) => s.autoKey);
  const setAutoKey = useAnimationStore((s) => s.setAutoKey);
  const seekSeconds = useAnimationStore((s) => s.seekSeconds);
  const prevKey = useAnimationStore((s) => s.prevKey);
  const nextKey = useAnimationStore((s) => s.nextKey);
  const setClipRange = useAnimationStore((s) => s.setClipRange);

  const hasClip = !!activeClipId;
  const loop = clip?.loop ?? false;

  const onTogglePlay = () => (playing ? pause() : play());

  return (
    <div aria-label="Animation bottom bar" className="w-full border-t border-white/10 bg-black/80 supports-[backdrop-filter]:bg-black/60">
      <div className="mx-2 my-1">
        <div className="flex items-center gap-1 px-2 py-1 text-xs select-none">
          {/* Transport */}
          <div className="flex items-center gap-1">
            <IconButton title="Seek to In (Home)" onClick={() => clip && seekSeconds(clip.start)} disabled={!hasClip}>
              <ChevronsLeft className="h-4 w-4" />
            </IconButton>
            <IconButton title="Prev Key (J)" onClick={prevKey} disabled={!hasClip}>
              <SkipBack className="h-4 w-4" />
            </IconButton>
            <IconButton title={playing ? 'Pause (Space)' : 'Play (Space)'} onClick={onTogglePlay} disabled={!hasClip}>
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </IconButton>
            <IconButton title="Stop (Shift+Space)" onClick={stop} disabled={!hasClip}>
              <Square className="h-4 w-4" />
            </IconButton>
            <IconButton title="Next Key (N)" onClick={nextKey} disabled={!hasClip}>
              <SkipForward className="h-4 w-4" />
            </IconButton>
            <IconButton title="Seek to Out (End)" onClick={() => clip && seekSeconds(clip.end)} disabled={!hasClip}>
              <ChevronsRight className="h-4 w-4" />
            </IconButton>
          </div>

          {/* Loop */}
          <div className="flex items-center gap-1 ml-1">
            <label className="flex items-center gap-1">
              <input type="checkbox" className="accent-blue-500" checked={loop} onChange={toggleLoop} disabled={!hasClip} />
              <span className="opacity-80">Loop</span>
            </label>
          </div>

          {/* Auto-key */}
          <div className="flex items-center gap-1 ml-1">
            <label className="flex items-center gap-1">
              <input type="checkbox" className="accent-blue-500" checked={autoKey} onChange={(e) => setAutoKey(e.target.checked)} />
              <span className="opacity-80">Auto-key</span>
            </label>
          </div>

          {/* FPS */}
          <div className="flex items-center gap-1 ml-2">
            <span className="opacity-70">FPS</span>
            <select
              className="bg-black/40 border border-white/10 rounded px-2 py-1 focus:outline-none"
              value={fps}
              onChange={(e) => setFps(parseInt(e.target.value))}
            >
              {[12, 24, 25, 30, 48, 50, 60].map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>

          {/* Timecode and range (Draggable inputs) */}
          <div className="flex items-center gap-2 ml-2 tabular-nums">
            <div title="Current time" className="flex items-center gap-1">
              <span className="opacity-70">TC</span>
              <span className="font-mono">{secondsToTimecode(playhead, fps)}</span>
            </div>
            {hasClip && (
              <div className="flex items-center gap-2 min-w-[260px]">
                <DragInput
                  label="In"
                  value={clip!.start}
                  step={1 / fps}
                  precision={3}
                  min={0}
                  onChange={(v) => setClipRange(Math.min(Math.max(0, v), clip!.end - 1 / fps), clip!.end)}
                />
                <DragInput
                  label="Out"
                  value={clip!.end}
                  step={1 / fps}
                  precision={3}
                  min={clip!.start + 1 / fps}
                  onChange={(v) => setClipRange(clip!.start, Math.max(v, clip!.start + 1 / fps))}
                />
              </div>
            )}
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Clip range quick set and timeline toggle */}
          {hasClip && (
            <div className="flex items-center gap-1 mr-1">
              <IconButton title="Set In from playhead" onClick={() => clip && setClipRange(playhead, clip.end)}>
                <CornerDownLeft className="h-4 w-4" />
              </IconButton>
              <IconButton title="Set Out from playhead" onClick={() => clip && setClipRange(clip.start, playhead)}>
                <CornerDownRight className="h-4 w-4" />
              </IconButton>
            </div>
          )}
          <IconButton
            title={timelineOpen ? 'Close Timeline (T)' : 'Open Timeline (T)'}
            onClick={toggleTimelinePanel}
          >
            <PanelBottom className="h-4 w-4" />
          </IconButton>
        </div>
      </div>
    </div>
  );
};

export default BottomBar;

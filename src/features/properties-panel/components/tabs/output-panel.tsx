'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSceneStore } from '@/stores/scene-store';
import { useAnimationStore } from '@/stores/animation-store';
import { useViewportStore } from '@/stores/viewport-store';
import { useSelectionStore } from '@/stores/selection-store';
import { useShaderTimeStore } from '@/stores/shader-time-store';
import { DragInput } from '@/components/drag-input';
import Switch from '@/components/switch';
import { downloadBlob } from '@/utils/three-export';

// Mediabunny APIs
import type { VideoCodec, Quality } from 'mediabunny';
import {
  Output,
  BufferTarget,
  StreamTarget,
  Mp4OutputFormat,
  WebMOutputFormat,
  MovOutputFormat,
  MkvOutputFormat,
  CanvasSource,
  QUALITY_LOW,
  QUALITY_MEDIUM,
  QUALITY_HIGH,
  getEncodableVideoCodecs,
} from 'mediabunny';

type Container = 'mp4' | 'mov' | 'webm' | 'mkv';
type QualityPreset = 'low' | 'medium' | 'high';
type TargetMode = 'memory' | 'file';

const containerSupportedCodecs: Record<Container, VideoCodec[]> = {
  mp4: ['avc', 'hevc', 'av1'],
  mov: ['avc', 'hevc', 'av1'],
  webm: ['vp9', 'av1', 'vp8'],
  mkv: ['av1', 'vp9', 'vp8', 'hevc', 'avc'],
};

const qualityToLib = (q: QualityPreset): Quality => (
  q === 'low' ? QUALITY_LOW : q === 'high' ? QUALITY_HIGH : QUALITY_MEDIUM
);

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="text-[11px] uppercase tracking-wide text-gray-400 mb-1">{children}</div>
);

const Card: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = '', children, ...rest }) => (
  <div className={`bg-white/5 border border-white/10 rounded p-1.5 ${className}`} {...rest}>{children}</div>
);

export const OutputPanel: React.FC = () => {
  const scene = useSceneStore();

  // Basics
  const [container, setContainer] = useState<Container>('mp4');
  const [codec, setCodec] = useState<VideoCodec>('avc');
  const [fps, setFps] = useState<number>(() => useAnimationStore.getState().fps || 30);
  const [quality, setQuality] = useState<QualityPreset>('high');
  const [cameraObjectId, setCameraObjectId] = useState<string | 'default'>('default');
  const [keyframeInterval, setKeyframeInterval] = useState<number>(5);
  const [rotation, setRotation] = useState<0 | 90 | 180 | 270>(0);

  // Targets
  const [targetMode, setTargetMode] = useState<TargetMode>('memory');
  const [chunked, setChunked] = useState<boolean>(false);
  const [chunkSizeMiB, setChunkSizeMiB] = useState<number>(16);

  // Format-specific options
  const [mp4FastStart, setMp4FastStart] = useState<false | 'in-memory' | 'fragmented'>('in-memory');
  const [mp4MinFragSec, setMp4MinFragSec] = useState<number>(1);
  const [mkvAppendOnly, setMkvAppendOnly] = useState<boolean>(false);
  const [mkvMinClusterSec, setMkvMinClusterSec] = useState<number>(1);

  // Busy/progress
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const cancelRef = useRef<{ cancel?: () => void } | null>(null);

  // Compute list of scene camera objects
  const cameraObjects = useMemo(() => {
    return Object.values(scene.objects).filter((o) => o.type === 'camera');
  }, [scene.objects]);

  // Compute encodable codecs and pick default per container
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const supported = await getEncodableVideoCodecs();
        const filtered = supported.filter((c) => containerSupportedCodecs[container].includes(c as any)) as VideoCodec[];
        if (mounted && filtered.length) setCodec(filtered[0]);
      } catch {
        // ignore
      }
    })();
    return () => { mounted = false; };
  }, [container]);

  // Helper: find main canvas to capture (choose the last canvas on page)
  const getCanvas = (): HTMLCanvasElement | null => {
    const canvases = Array.from(document.querySelectorAll('canvas')) as HTMLCanvasElement[];
    if (!canvases.length) return null;
    return canvases[canvases.length - 1] || canvases[0];
  };

  // Format instance based on selection
  const createFormat = () => {
    if (container === 'mp4') return new Mp4OutputFormat({ fastStart: mp4FastStart, minimumFragmentDuration: mp4FastStart === 'fragmented' ? mp4MinFragSec : undefined });
    if (container === 'mov') return new MovOutputFormat({ fastStart: mp4FastStart, minimumFragmentDuration: mp4FastStart === 'fragmented' ? mp4MinFragSec : undefined });
    if (container === 'webm') return new WebMOutputFormat({ appendOnly: mkvAppendOnly, minimumClusterDuration: mkvMinClusterSec });
    return new MkvOutputFormat({ appendOnly: mkvAppendOnly, minimumClusterDuration: mkvMinClusterSec });
  };

  // Export flow
  const startExport = async () => {
    if (busy) return;
    const canvas = getCanvas();
    if (!canvas) return;

    // Determine timeline
    const s = useAnimationStore.getState();
    const active = s.activeClipId ? s.clips[s.activeClipId] : null;
    const start = active ? active.start : 0;
    const end = active ? active.end : Math.max(0, 5);
    const duration = Math.max(0, end - start);
    const FPS = Math.max(1, Math.min(240, Math.round(fps || s.fps || 30)));
    const totalFrames = Math.max(1, Math.round(Math.max(duration, 1 / FPS) * FPS));

    // Snapshot previous UI/viewport states to restore later
    const prev = {
      shading: useViewportStore.getState().shadingMode,
      grid: useViewportStore.getState().showGrid,
      axes: useViewportStore.getState().showAxes,
      autoOrbit: useViewportStore.getState().autoOrbitIntervalSec ?? 0,
      activeCamera: useViewportStore.getState().activeCameraObjectId ?? null,
      viewMode: useSelectionStore.getState().selection.viewMode as 'object' | 'edit',
      meshId: useSelectionStore.getState().selection.meshId as string | null,
      playing: useAnimationStore.getState().playing,
    } as const;

    // Optionally ask for a file handle up-front
    let writable: FileSystemWritableFileStream | null = null;
    if (targetMode === 'file') {
      try {
        const fmt = createFormat();
        const ext = (fmt.fileExtension || '').replace(/^\./, '');
        // Fallbacks if APIs are unavailable
        if (!('showSaveFilePicker' in window)) throw new Error('File System API not available');
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: `render_${new Date().toISOString().replace(/[:.]/g, '-')}.${ext || container}`,
          types: [{
            description: 'Video file',
            accept: { [fmt.mimeType || 'video/*']: [`.${ext || container}`] },
          }],
        });
        writable = await handle.createWritable();
      } catch (e) {
        // If user cancels or unsupported, fall back to memory
        writable = null;
        setTargetMode('memory');
      }
    }

    // Apply recording-friendly settings
    try {
      setBusy(true);
      setProgress({ current: 0, total: totalFrames });
      // Guard runtime sampler from updating while we drive frames
      (useAnimationStore as any).setState((st: any) => { st._exportGuard = true; });
      // Enforce object mode
      try { useSelectionStore.getState().setViewMode('object'); } catch {}
      // Hide helpers and set material mode
      useViewportStore.getState().setShadingMode('material');
      if (useViewportStore.getState().showGrid) useViewportStore.getState().toggleGrid();
      if (useViewportStore.getState().showAxes) useViewportStore.getState().toggleAxes();
      useViewportStore.getState().setAutoOrbitInterval(0);
      // Activate selected camera or default
      useViewportStore.getState().setActiveCamera(cameraObjectId === 'default' ? null : cameraObjectId);
      // Pause playback to avoid runtime sampler fighting us
      if (useAnimationStore.getState().playing) useAnimationStore.getState().pause();

      // Set up Mediabunny
      const target = writable
        ? new StreamTarget(writable as any, { chunked, chunkSize: Math.max(1, Math.floor(chunkSizeMiB)) * 2 ** 20 })
        : new BufferTarget();
      const fmt = createFormat();
      const output = new Output({
        format: fmt,
        target,
      });
      const source = new CanvasSource(canvas, {
        codec: codec,
        bitrate: qualityToLib(quality),
        keyFrameInterval: keyframeInterval,
        sizeChangeBehavior: 'contain',
      });
      const trackMeta: any = { frameRate: FPS };
      // Only set rotation metadata if supported by the container format
      if ((fmt as any).supportsVideoRotationMetadata) trackMeta.rotation = rotation;
      output.addVideoTrack(source, trackMeta);

      // Allow cancel from UI
      let canceled = false;
      cancelRef.current = { cancel: () => { canceled = true; } };

      await output.start();
      // Allow a frame for the renderer to reflect camera/view toggles before first capture
      await new Promise<void>((res) => requestAnimationFrame(() => res()));

      // Drive timeline deterministically and capture each frame
      const applyAt = useAnimationStore.getState().applySampleAt;
      const setAnimTime = useShaderTimeStore.getState().setAnimTime;
      const progressStep = Math.max(1, Math.floor(totalFrames / 100));
      for (let i = 0; i < totalFrames; i++) {
        if (canceled) break;
        const t = start + i / FPS;
        // Apply transforms and shader time
        applyAt(t);
        setAnimTime(t);
        // Wait one RAF for R3F/Three to render the new state
        await new Promise<void>((res) => requestAnimationFrame(() => res()));
        // Submit frame
        await source.add(i / FPS, 1 / FPS);
        if (i % progressStep === 0 || i === totalFrames - 1) setProgress({ current: i + 1, total: totalFrames });
      }

      if (!canceled) {
        await output.finalize();
        // If memory target, download
        if (!writable) {
          const mime = await output.getMimeType();
          const buf = (target as BufferTarget).buffer;
          if (buf) {
            const blob = new Blob([buf], { type: mime });
            const ts = new Date().toISOString().replace(/[:.]/g, '-');
            const name = `render_${ts}.${container}`;
            downloadBlob(blob, name);
          }
        }
      } else {
        await output.cancel();
      }
    } catch (e) {
      console.error('Video export failed:', e);
    } finally {
      // Restore states
      useViewportStore.getState().setShadingMode(prev.shading);
      if (useViewportStore.getState().showGrid !== prev.grid) useViewportStore.getState().toggleGrid();
      if (useViewportStore.getState().showAxes !== prev.axes) useViewportStore.getState().toggleAxes();
      useViewportStore.getState().setAutoOrbitInterval(prev.autoOrbit as any);
      useViewportStore.getState().setActiveCamera(prev.activeCamera);
      if (prev.viewMode === 'edit' && prev.meshId) {
        try { useSelectionStore.getState().enterEditMode(prev.meshId); } catch {}
      }
      if (prev.playing) useAnimationStore.getState().play();
      // Clear guard
      (useAnimationStore as any).setState((st: any) => { st._exportGuard = false; });
      setBusy(false);
      setProgress(null);
      cancelRef.current = null;
    }
  };

  const codecOptions = useMemo(() => {
    const base = containerSupportedCodecs[container];
    return base as VideoCodec[];
  }, [container]);

  return (
    <div className="p-2 space-y-3 text-gray-200 text-[12px]">
      <div>
        <SectionTitle>Camera</SectionTitle>
        <Card>
          <div className="flex flex-wrap gap-1.5">
            <button
              className={`rounded border px-2 py-1 text-[11px] ${cameraObjectId === 'default' ? 'border-white/30 bg-white/15 text-white' : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10'}`}
              onClick={() => setCameraObjectId('default')}
              disabled={busy}
            >Default View</button>
            {cameraObjects.map((o) => (
              <button key={o.id}
                className={`rounded border px-2 py-1 text-[11px] ${cameraObjectId === o.id ? 'border-white/30 bg-white/15 text-white' : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10'}`}
                onClick={() => setCameraObjectId(o.id)}
                disabled={busy}
              >{o.name}</button>
            ))}
          </div>
        </Card>
      </div>

      <div>
        <SectionTitle>Timeline</SectionTitle>
        <Card className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="w-28 text-[11px] text-gray-400">FPS</div>
            <DragInput compact value={fps} precision={0} step={1} onChange={(v) => setFps(Math.max(1, Math.min(240, Math.round(v))))} />
          </div>
          <div className="flex items-center gap-2">
            <div className="w-28 text-[11px] text-gray-400">Keyframe interval (s)</div>
            <DragInput compact value={keyframeInterval} precision={0} step={1} onChange={(v) => setKeyframeInterval(Math.max(1, Math.round(v)))} />
          </div>
        </Card>
      </div>

      <div>
        <SectionTitle>Output</SectionTitle>
        <Card className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-28 text-[11px] text-gray-400">Container</div>
            <div className="flex flex-wrap gap-1.5">
              {(['mp4','mov','webm','mkv'] as Container[]).map((c) => (
                <button key={c}
                  className={`rounded border px-2 py-1 text-[11px] ${container === c ? 'border-white/30 bg-white/15 text-white' : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10'}`}
                  onClick={() => setContainer(c)}
                  disabled={busy}
                >{c.toUpperCase()}</button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-28 text-[11px] text-gray-400">Codec</div>
            <div className="flex flex-wrap gap-1.5">
              {codecOptions.map((c) => (
                <button key={c}
                  className={`rounded border px-2 py-1 text-[11px] ${codec === c ? 'border-white/30 bg-white/15 text-white' : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10'}`}
                  onClick={() => setCodec(c)}
                  disabled={busy}
                >{c.toUpperCase()}</button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-28 text-[11px] text-gray-400">Quality</div>
            <div className="flex flex-wrap gap-1.5">
              {(['low','medium','high'] as QualityPreset[]).map((q) => (
                <button key={q}
                  className={`rounded border px-2 py-1 text-[11px] ${quality === q ? 'border-white/30 bg-white/15 text-white' : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10'}`}
                  onClick={() => setQuality(q)}
                  disabled={busy}
                >{q.toUpperCase()}</button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-28 text-[11px] text-gray-400">Rotation</div>
            <select
              className="flex-1 bg-transparent text-xs border border-white/10 rounded p-1"
              value={rotation}
              onChange={(e) => setRotation(parseInt(e.target.value, 10) as 0 | 90 | 180 | 270)}
              disabled={busy}
            >
              {[0,90,180,270].map((r) => <option key={r} value={r}>{r}°</option>)}
            </select>
          </div>
        </Card>
      </div>

      <div>
        <SectionTitle>Format options</SectionTitle>
        <Card className="space-y-2">
          {(container === 'mp4' || container === 'mov') && (
            <>
              <div className="flex items-center gap-2">
                <div className="w-28 text-[11px] text-gray-400">Fast Start</div>
                <select
                  className="flex-1 bg-transparent text-xs border border-white/10 rounded p-1"
                  value={mp4FastStart as any}
                  onChange={(e) => setMp4FastStart((e.target.value === 'false' ? false : e.target.value) as any)}
                  disabled={busy}
                >
                  <option value="false">Off</option>
                  <option value="in-memory">In-memory</option>
                  <option value="fragmented">Fragmented</option>
                </select>
              </div>
              {mp4FastStart === 'fragmented' && (
                <div className="flex items-center gap-2">
                  <div className="w-28 text-[11px] text-gray-400">Min fragment (s)</div>
                  <DragInput compact value={mp4MinFragSec} precision={0} step={1} onChange={(v) => setMp4MinFragSec(Math.max(1, Math.round(v)))} />
                </div>
              )}
            </>
          )}

          {(container === 'webm' || container === 'mkv') && (
            <>
              <div className="flex items-center gap-2">
                <div className="w-28 text-[11px] text-gray-400">Append-only</div>
                <Switch checked={mkvAppendOnly} onCheckedChange={(v) => setMkvAppendOnly(!!v)} />
              </div>
              <div className="flex items-center gap-2">
                <div className="w-28 text-[11px] text-gray-400">Min cluster (s)</div>
                <DragInput compact value={mkvMinClusterSec} precision={0} step={1} onChange={(v) => setMkvMinClusterSec(Math.max(1, Math.round(v)))} />
              </div>
            </>
          )}
        </Card>
      </div>

      <div>
        <SectionTitle>Target</SectionTitle>
        <Card className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-28 text-[11px] text-gray-400">Write to</div>
            <div className="flex gap-1.5">
              <button
                className={`rounded border px-2 py-1 text-[11px] ${targetMode === 'memory' ? 'border-white/30 bg-white/15 text-white' : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10'}`}
                onClick={() => setTargetMode('memory')}
                disabled={busy}
              >Download (memory)</button>
              <button
                className={`rounded border px-2 py-1 text-[11px] ${targetMode === 'file' ? 'border-white/30 bg-white/15 text-white' : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10'}`}
                onClick={() => setTargetMode('file')}
                disabled={busy}
              >Save to disk</button>
            </div>
          </div>
          {targetMode === 'file' && (
            <>
              <div className="flex items-center gap-2">
                <div className="w-28 text-[11px] text-gray-400">Chunked mode</div>
                <Switch checked={chunked} onCheckedChange={(v) => setChunked(!!v)} />
              </div>
              <div className="flex items-center gap-2">
                <div className="w-28 text-[11px] text-gray-400">Chunk size (MiB)</div>
                <DragInput compact value={chunkSizeMiB} precision={0} step={1} onChange={(v) => setChunkSizeMiB(Math.max(1, Math.round(v)))} />
              </div>
            </>
          )}
        </Card>
      </div>

      <div className="pt-1">
        {!busy ? (
          <button
            className={`inline-flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/15 px-3 py-1.5 text-[12px] ${!busy ? 'text-emerald-200 hover:bg-emerald-500/25 hover:text-white' : 'opacity-60 text-emerald-200'}`}
            onClick={startExport}
            disabled={busy}
          >Export</button>
        ) : (
          <div className="flex items-center gap-3">
            <div className="h-1.5 flex-1 rounded bg-white/10 overflow-hidden">
              <div className="h-full bg-emerald-500/60" style={{ width: progress ? `${Math.round((progress.current / progress.total) * 100)}%` : '0%' }} />
            </div>
            <button
              className="rounded-md border border-white/20 bg-white/10 px-3 py-1.5 text-[12px] text-gray-200 hover:bg-white/15"
              onClick={() => cancelRef.current?.cancel?.()}
            >Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default OutputPanel;

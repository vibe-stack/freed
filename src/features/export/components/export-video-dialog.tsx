'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog } from '@base-ui-components/react/dialog';
import { useViewportStore } from '@/stores/viewport-store';
import { useSceneStore } from '@/stores/scene-store';
import { useAnimationStore } from '@/stores/animation-store';
import { useSelectionStore } from '@/stores/selection-store';
import { useShaderTimeStore } from '@/stores/shader-time-store';
import { downloadBlob } from '@/utils/three-export';

// Mediabunny APIs
import type { VideoCodec, Quality } from 'mediabunny';
import {
  Output,
  BufferTarget,
  Mp4OutputFormat,
  WebMOutputFormat,
  CanvasSource,
  QUALITY_LOW,
  QUALITY_MEDIUM,
  QUALITY_HIGH,
  getEncodableVideoCodecs,
} from 'mediabunny';

type Container = 'mp4' | 'webm';
type QualityPreset = 'low' | 'medium' | 'high';

export type ExportVideoDialogProps = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

const qualityToLib = (q: QualityPreset): Quality => (
  q === 'low' ? QUALITY_LOW : q === 'high' ? QUALITY_HIGH : QUALITY_MEDIUM
);

const containerSupportedCodecs: Record<Container, VideoCodec[]> = {
  mp4: ['avc', 'hevc', 'av1'],
  webm: ['vp9', 'av1', 'vp8'],
};

const ExportVideoDialog: React.FC<ExportVideoDialogProps> = ({ open, onOpenChange }) => {
  const scene = useSceneStore();

  const [container, setContainer] = useState<Container>('mp4');
  const [codec, setCodec] = useState<VideoCodec>('avc');
  const [fps, setFps] = useState<number>(() => useAnimationStore.getState().fps || 30);
  const [quality, setQuality] = useState<QualityPreset>('high');
  const [cameraObjectId, setCameraObjectId] = useState<string | 'default'>('default');
  const [keyframeInterval, setKeyframeInterval] = useState<number>(5);
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
        // fallback stays
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
  // Ensure at least 1 frame to avoid a stuck UI
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
      const target = new BufferTarget();
      const output = new Output({
        format: container === 'mp4' ? new Mp4OutputFormat() : new WebMOutputFormat(),
        target,
      });
      const source = new CanvasSource(canvas, {
        codec: codec,
        bitrate: qualityToLib(quality),
        keyFrameInterval: keyframeInterval,
        sizeChangeBehavior: 'contain',
      });
      output.addVideoTrack(source, { frameRate: FPS });

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
        const mime = await output.getMimeType();
        const buf = target.buffer;
        if (buf) {
          const blob = new Blob([buf], { type: mime });
          const ts = new Date().toISOString().replace(/[:.]/g, '-');
          const name = `render_${ts}.${container}`;
          downloadBlob(blob, name);
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
      onOpenChange(false);
    }
  };

  const canStart = !busy;
  const codecOptions = useMemo(() => {
    // UI-only list for display; actual encodables fetched async
    const base = containerSupportedCodecs[container];
    return base as VideoCodec[];
  }, [container]);

  return (
    <Dialog.Root modal={false} open={open} onOpenChange={(v) => { if (!busy) onOpenChange(v); }}>
      <Dialog.Portal>
        <Dialog.Popup className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[820px] max-w-[96vw] rounded-xl border border-white/10 bg-[#0b0e13] p-4 shadow-2xl text-sm text-gray-200">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <Dialog.Title className="text-base font-semibold text-white">Export to Video</Dialog.Title>
              <Dialog.Description className="mt-1 text-gray-400">
                Render the active timeline once to a video file.
              </Dialog.Description>
            </div>
            <Dialog.Close disabled={busy} className="rounded p-1 text-gray-400 hover:text-white hover:bg-white/10">✕</Dialog.Close>
          </div>

          <div className="mt-4 grid grid-cols-12 gap-4">
            <div className="col-span-7 space-y-3">
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <div className="text-[12px] font-semibold text-gray-300">Camera</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    className={`rounded border px-2 py-1.5 text-[12px] ${cameraObjectId === 'default' ? 'border-white/30 bg-white/15 text-white' : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10'}`}
                    onClick={() => setCameraObjectId('default')}
                    disabled={busy}
                  >
                    Default View
                  </button>
                  {cameraObjects.map((o) => (
                    <button key={o.id}
                      className={`rounded border px-2 py-1.5 text-[12px] ${cameraObjectId === o.id ? 'border-white/30 bg-white/15 text-white' : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10'}`}
                      onClick={() => setCameraObjectId(o.id)}
                      disabled={busy}
                    >{o.name}</button>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <div className="text-[12px] font-semibold text-gray-300">Timeline</div>
                <div className="mt-2 text-[12px] text-gray-300">
                  FPS
                  <input type="number" min={1} max={240} value={fps}
                    className="ml-2 w-20 rounded border border-white/10 bg-transparent px-2 py-1 outline-none"
                    onChange={(e) => setFps(parseInt(e.target.value || '30', 10))}
                    disabled={busy}
                  />
                  <span className="ml-3">Keyframe interval (sec)</span>
                  <input type="number" min={1} max={30} value={keyframeInterval}
                    className="ml-2 w-20 rounded border border-white/10 bg-transparent px-2 py-1 outline-none"
                    onChange={(e) => setKeyframeInterval(parseInt(e.target.value || '5', 10))}
                    disabled={busy}
                  />
                </div>
                <div className="mt-2 text-[12px] text-gray-400">The full active clip will be rendered once.</div>
              </div>
            </div>

            <div className="col-span-5 space-y-3">
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <div className="text-[12px] font-semibold text-gray-300">Output</div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    className={`rounded border px-2 py-1.5 text-[12px] ${container === 'mp4' ? 'border-white/30 bg-white/15 text-white' : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10'}`}
                    onClick={() => setContainer('mp4')}
                    disabled={busy}
                  >MP4</button>
                  <button
                    className={`rounded border px-2 py-1.5 text-[12px] ${container === 'webm' ? 'border-white/30 bg-white/15 text-white' : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10'}`}
                    onClick={() => setContainer('webm')}
                    disabled={busy}
                  >WebM</button>
                </div>

                <div className="mt-3 text-[12px] text-gray-300">Codec</div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {codecOptions.map((c) => (
                    <button key={c}
                      className={`rounded border px-2 py-1.5 text-[12px] ${codec === c ? 'border-white/30 bg-white/15 text-white' : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10'}`}
                      onClick={() => setCodec(c)}
                      disabled={busy}
                    >{c.toUpperCase()}</button>
                  ))}
                </div>

                <div className="mt-3 text-[12px] text-gray-300">Quality</div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {(['low', 'medium', 'high'] as QualityPreset[]).map((q) => (
                    <button key={q}
                      className={`rounded border px-2 py-1.5 text-[12px] ${quality === q ? 'border-white/30 bg-white/15 text-white' : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10'}`}
                      onClick={() => setQuality(q)}
                      disabled={busy}
                    >{q.toUpperCase()}</button>
                  ))}
                </div>
              </div>

              <div className="mt-4">
                {!busy ? (
                  <button
                    className={`inline-flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/15 px-3 py-2 text-[12px] ${canStart ? 'text-emerald-200 hover:bg-emerald-500/25 hover:text-white' : 'opacity-60 text-emerald-200'}`}
                    onClick={startExport}
                    disabled={!canStart}
                  >
                    Export
                  </button>
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
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default ExportVideoDialog;

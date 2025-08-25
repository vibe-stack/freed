import { secondsToTimecode } from '@/stores/animation-store';

export type Tick = {
  x: number;
  t: number;
  label?: string;
  major: boolean;
};

export type VisibleRange = {
  start: number;
  end: number;
};

export function computeVisibleRange(clipStart: number, clipEnd: number, pan: number, zoom: number, pxWidth: number): VisibleRange {
  // The leftmost visible time for x=0 follows the same convention as xToTime in the original file
  // t = (x / zoom) + clipStart + pan
  // For x=0 => t0 = clipStart + pan
  const start = Math.max(clipStart, clipStart + pan);
  const end = Math.min(clipEnd, start + Math.max(pxWidth, 0) / Math.max(zoom, 1));
  return { start, end };
}

export function timeToX(t: number, clipStart: number, pan: number, zoom: number): number {
  return (t - (clipStart + pan)) * zoom;
}

export function xToTime(x: number, clipStart: number, pan: number, zoom: number): number {
  return (x / zoom) + clipStart + pan;
}

// Generate ticks within the visible range. Major ticks at 1s multiples by default; add minors based on fps.
export function makeTicks(range: VisibleRange, fps: number, clipStart: number, pan: number, zoom: number): Tick[] {
  const out: Tick[] = [];
  const { start, end } = range;
  if (!isFinite(start) || !isFinite(end) || end <= start) return out;

  // Choose minor step as a fraction of a second based on fps; fall back to 0.5s if fps small.
  const minorFrames = Math.max(1, Math.round(fps / 4)); // quarter-second granularity
  const minorStep = minorFrames / fps;
  const majorStep = 1; // 1s

  // Start from the nearest minor tick <= start
  const firstMinor = Math.floor(start / minorStep) * minorStep;
  for (let t = firstMinor; t <= end + 1e-6; t += minorStep) {
    const isMajor = Math.abs((t / majorStep) - Math.round(t / majorStep)) < 1e-6;
    // Clamp to clip bounds is handled by caller if needed
    const x = timeToX(t, clipStart, pan, zoom);
    const label = isMajor ? secondsToTimecode(t, fps) : undefined;
    out.push({ x, t, label, major: isMajor });
  }
  return out;
}

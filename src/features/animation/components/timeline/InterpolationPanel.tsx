"use client";

import React, { useMemo, useRef } from 'react';
import { useAnimationStore, Key as AnimKey } from '@/stores/animation-store';
import { DragInput } from '@/components/drag-input';

const sampleHermite = (k0: AnimKey, k1: AnimKey, t: number) => {
  const dt = Math.max(1e-6, k1.t - k0.t);
  const u = (t - k0.t) / dt;
  const m0 = (k0.tanOut !== undefined) ? k0.tanOut : (k1.v - k0.v) / dt;
  const m1 = (k1.tanIn !== undefined) ? k1.tanIn : (k1.v - k0.v) / dt;
  const h00 = (2 * u ** 3) - (3 * u ** 2) + 1;
  const h10 = (u ** 3) - (2 * u ** 2) + u;
  const h01 = (-2 * u ** 3) + (3 * u ** 2);
  const h11 = (u ** 3) - (u ** 2);
  return h00 * k0.v + h10 * dt * m0 + h01 * k1.v + h11 * dt * m1;
};

export const InterpolationPanel: React.FC = () => {
  const clip = useAnimationStore((s) => s.activeClipId ? s.clips[s.activeClipId] : null);
  const tracks = useAnimationStore((s) => s.tracks);
  const selection = useAnimationStore((s) => s.selection);
  const setInterpolation = useAnimationStore((s) => s.setInterpolation);
  const setKeyTangentIn = useAnimationStore((s) => s.setKeyTangentIn);
  const setKeyTangentOut = useAnimationStore((s) => s.setKeyTangentOut);
  const applyEasingPreset = useAnimationStore((s) => s.applyEasingPreset);
  const moveKey = useAnimationStore((s) => s.moveKey);
  const setKeyValue = useAnimationStore((s) => s.setKeyValue);
  const insertKey = useAnimationStore((s) => s.insertKey);
  const selectKey = useAnimationStore((s) => s.selectKey);

  const firstSel = useMemo(() => {
    const entries = Object.entries(selection.keys || {});
    if (!entries.length) return null;
    const [tid, set] = entries[0] as [string, Set<string>];
    const kid = set && Array.from(set)[0];
    const tr = tracks[tid];
    const key = kid ? tr?.channel.keys.find((k) => k.id === kid) : undefined;
    return (kid && tr && key) ? { tid, tr, key } : null;
  }, [selection.keys, tracks]);

  const tid = firstSel?.tid;
  const tr = firstSel?.tr;
  const key = firstSel?.key;
  const keys = tr?.channel.keys ?? [];
  const kIndex = key ? keys.findIndex((k) => k.id === key.id) : -1;
  const prev = kIndex > 0 ? keys[kIndex - 1] : undefined;
  const next = kIndex >= 0 && kIndex < keys.length - 1 ? keys[kIndex + 1] : undefined;

  const t0 = key?.t ?? (clip?.start ?? 0);
  const t1 = (key && next) ? next.t : (clip?.end ?? ((key?.t ?? 0) + 1));
  // Value range based on the selected segment for better sensitivity
  const segVals: number[] = [];
  if (key) segVals.push(key.v);
  if (next) segVals.push(next.v);
  if (key && next) {
    const dt = Math.max(1e-6, next.t - key.t);
    const m0 = key.tanOut ?? (next.v - key.v) / dt;
    const m1 = next.tanIn ?? (next.v - key.v) / dt;
    segVals.push(key.v + m0 * dt * 0.25, next.v - m1 * dt * 0.25);
  }
  const vMin = segVals.length ? Math.min(...segVals) : 0;
  const vMax = segVals.length ? Math.max(...segVals) : 1;
  const vpad = (vMax - vMin) * 0.15 + 1e-3;
  const Y0 = vMin - vpad;
  const Y1 = vMax + vpad;

  const W = 220 - 8; // panel width minus padding
  const H = 160;
  const timeToX = useMemo(() => (t: number) => ((t - t0) / Math.max(1e-6, (t1 - t0))) * W, [W, t0, t1, W]);
  const valueToY = useMemo(() => (v: number) => (1 - (v - Y0) / Math.max(1e-6, (Y1 - Y0))) * H, [Y0, Y1, H]);
  const xToTime = useMemo(() => (x: number) => t0 + (x / Math.max(1e-6, W)) * (t1 - t0), [W, t0, t1, W]);
  const yToValue = useMemo(() => (y: number) => Y0 + (1 - (y / Math.max(1e-6, H))) * (Y1 - Y0), [Y0, Y1, H]);

  const pathD = useMemo(() => {
    if (!key || !next) return '';
    const k0 = key; const k1 = next;
    const steps = 64;
    let d = `M ${timeToX(k0.t)} ${valueToY(k0.v)}`;
    for (let s = 1; s <= steps; s++) {
      const t = k0.t + (k1.t - k0.t) * (s / steps);
      let v: number;
      if (k0.segEase) {
        const u = s / steps;
        const strength = Math.max(0, Math.min(3, k0.segEase.strength ?? 1));
        const easeOutBounce = (x: number) => {
          const n1 = 7.5625; const d1 = 2.75;
          if (x < 1 / d1) return n1 * x * x;
          if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75;
          if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375;
          return n1 * (x -= 2.625 / d1) * x + 0.984375;
        };
        const easeInBounce = (x: number) => 1 - easeOutBounce(1 - x);
        const easeInOutBounce = (x: number) => x < 0.5 ? (1 - easeOutBounce(1 - 2 * x)) / 2 : (1 + easeOutBounce(2 * x - 1)) / 2;
        const easeOutElastic = (x: number) => {
          const c4 = (2 * Math.PI) / (0.3 + 0.2 * (1 - strength));
          return x === 0 ? 0 : x === 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x - 0.075) * c4) + 1;
        };
        const easeInElastic = (x: number) => (x === 0 ? 0 : x === 1 ? 1 : -Math.pow(2, 10 * x - 10) * Math.sin((x - 0.075) * (2 * Math.PI) / (0.3 + 0.2 * (1 - strength))));
        const easeInOutElastic = (x: number) => {
          if (x === 0 || x === 1) return x;
          const c5 = (2 * Math.PI) / (0.45 + 0.2 * (1 - strength));
          return u < 0.5
            ? -(Math.pow(2, 20 * u - 10) * Math.sin((20 * u - 11.125) * c5)) / 2
            : (Math.pow(2, -20 * u + 10) * Math.sin((20 * u - 11.125) * c5)) / 2 + 1;
        };
        const applyEase = (kind: 'bounce'|'elastic', mode: 'in'|'out'|'inOut', x: number) => {
          if (kind === 'bounce') return mode === 'in' ? easeInBounce(x) : mode === 'inOut' ? easeInOutBounce(x) : easeOutBounce(x);
          return mode === 'in' ? easeInElastic(x) : mode === 'inOut' ? easeInOutElastic(x) : easeOutElastic(x);
        };
        const uu = applyEase(k0.segEase.type, k0.segEase.mode, u);
        v = k0.v + (k1.v - k0.v) * uu;
      } else if (k0.interp === 'step') {
        v = k0.v;
      } else if (k0.interp === 'bezier' || k1.interp === 'bezier') {
        v = sampleHermite(k0, k1, t);
      } else {
        v = k0.v + (k1.v - k0.v) * (s / steps);
      }
      d += ` L ${timeToX(t)} ${valueToY(v)}`;
    }
    return d;
  }, [key, next, timeToX, valueToY]);

  // drag key
  const dragging = useRef<null | { id: string; startX: number; startY: number; startT: number; startV: number }>(null);
  const beginDragKey = (k: AnimKey, e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX; const startY = e.clientY;
    dragging.current = { id: k.id, startX, startY, startT: k.t, startV: k.v };
    const move = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const dx = ev.clientX - dragging.current.startX;
      const dy = ev.clientY - dragging.current.startY;
  let t = dragging.current.startT + (dx / Math.max(1e-6, W)) * (t1 - t0);
  const v = dragging.current.startV + (-(dy) / Math.max(1e-6, H)) * (Y1 - Y0);
      // clamp between neighbors
      const idx = keys.findIndex((kk) => kk.id === k.id);
      const left = idx > 0 ? keys[idx - 1].t + 1e-4 : t0;
      const right = idx < keys.length - 1 ? keys[idx + 1].t - 1e-4 : t1;
      t = Math.max(left, Math.min(right, t));
      if (tid) {
        moveKey(tid, k.id, t);
        setKeyValue(tid, k.id, v);
      }
    };
    const up = () => {
      dragging.current = null;
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  // drag tangent handle
  const handleDrag = (which: 'in'|'out', e: React.MouseEvent) => {
    e.preventDefault();
    if (!key) return;
    const baseX = timeToX(key.t); const baseY = valueToY(key.v);
    const neighbor = which === 'out' ? next : prev;
    if (!neighbor) return;
    const dt = Math.abs(neighbor.t - key.t);
    const refDx = (dt * 0.25) / Math.max(1e-6, (t1 - t0)) * W; // screen px
    const startTan = which === 'out' ? (key.tanOut ?? (neighbor.v - key.v) / Math.max(1e-6, dt)) : (key.tanIn ?? (neighbor.v - key.v) / Math.max(1e-6, dt));
    const startHy = baseY - (startTan * (refDx / Math.max(1e-6, W)) * (t1 - t0)) / Math.max(1e-6, (Y1 - Y0)) * H;
    const move = (ev: MouseEvent) => {
      const curX = ev.clientX; const curY = ev.clientY;
      const dx = (curX - (baseX + (which === 'out' ? refDx : -refDx)));
      const dy = (curY - startHy);
      const dTime = (dx / Math.max(1e-6, W)) * (t1 - t0);
      const dValue = -(dy / Math.max(1e-6, H)) * (Y1 - Y0);
      const newDxTime = (which === 'out' ? dt * 0.25 : -dt * 0.25) + dTime;
      const newDyVal = (startTan * (dt * 0.25)) + dValue;
      const slope = newDyVal / Math.max(1e-6, newDxTime);
  if (!tid || !key) return;
  if (which === 'out') setKeyTangentOut(tid, key.id, slope);
  else setKeyTangentIn(tid, key.id, slope);
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  const addPoint = (e: React.MouseEvent) => {
    if (e.defaultPrevented) return;
    const svg = e.currentTarget as SVGSVGElement;
    const rect = svg.getBoundingClientRect();
    const x = e.clientX - rect.left; const y = e.clientY - rect.top;
  if (!tid) return;
  const t = xToTime(x);
  const v = yToValue(y);
  const id = insertKey(tid, t, v, 'bezier');
  selectKey(tid, id, false);
  };

  const slopePrev = (key && prev) ? (key.v - prev.v) / Math.max(1e-6, (key.t - prev.t)) : 0;
  const slopeNext = (key && next) ? (next.v - key.v) / Math.max(1e-6, (next.t - key.t)) : 0;

  const applyPreset = (preset: 'linear'|'easeIn'|'easeOut'|'easeInOut') => {
    if (!tid || !key) return;
    if (preset === 'linear') {
      setInterpolation(tid, key.id, 'linear');
      setKeyTangentIn(tid, key.id, undefined);
      setKeyTangentOut(tid, key.id, undefined);
      return;
    }
    setInterpolation(tid, key.id, 'bezier');
    if (preset === 'easeIn') {
      setKeyTangentIn(tid, key.id, 0);
      setKeyTangentOut(tid, key.id, slopeNext * 2);
      if (prev) useAnimationStore.getState().setKeyTangentOut(tid, prev.id, slopePrev * 0.5);
    } else if (preset === 'easeOut') {
      if (next) useAnimationStore.getState().setKeyTangentIn(tid, next.id, slopeNext * 0.5);
      setKeyTangentOut(tid, key.id, 0);
      setKeyTangentIn(tid, key.id, slopePrev * 2);
    } else if (preset === 'easeInOut') {
      setKeyTangentIn(tid, key.id, 0);
      setKeyTangentOut(tid, key.id, 0);
      if (prev) useAnimationStore.getState().setKeyTangentOut(tid, prev.id, slopePrev * 0.5);
      if (next) useAnimationStore.getState().setKeyTangentIn(tid, next.id, slopeNext * 0.5);
    }
  };

  return (
    <div className="text-xs space-y-2">
      <div className="flex items-center gap-2">
        <span className="opacity-70">Mode</span>
        <select
          className="bg-black/40 border border-white/10 rounded px-2 py-1 outline-none"
          value={key?.interp ?? 'linear'}
          onChange={(e) => { if (tid && key) setInterpolation(tid, key.id, e.target.value as any); }}
        >
          <option value="step">Constant</option>
          <option value="linear">Linear</option>
          <option value="bezier">Bezier</option>
        </select>
      </div>
      {!clip && <div className="opacity-60">Create a clip to edit interpolation.</div>}
      {clip && !key && <div className="opacity-60">Select a keyframe to edit interpolation.</div>}
      {clip && key && (
        <>
          {key?.interp === 'bezier' && (
            <div className="grid grid-cols-2 gap-2">
              <label className="flex items-center gap-1">
                <span className="opacity-70">In</span>
                <DragInput value={key?.tanIn ?? slopePrev} onChange={(v: number) => tid && key && setKeyTangentIn(tid, key.id, v)} step={0.1} min={-100} max={100} />
              </label>
              <label className="flex items-center gap-1">
                <span className="opacity-70">Out</span>
                <DragInput value={key?.tanOut ?? slopeNext} onChange={(v: number) => tid && key && setKeyTangentOut(tid, key.id, v)} step={0.1} min={-100} max={100} />
              </label>
            </div>
          )}
          <div className="flex items-center gap-1 flex-wrap">
            <span className="opacity-70 mr-1">Presets:</span>
            <button className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 border border-white/10" onClick={() => applyPreset('linear')}>Linear</button>
            <button className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 border border-white/10" onClick={() => applyPreset('easeIn')}>Ease In</button>
            <button className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 border border-white/10" onClick={() => applyPreset('easeOut')}>Ease Out</button>
            <button className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 border border-white/10" onClick={() => applyPreset('easeInOut')}>Ease In-Out</button>
            <button className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 border border-white/10" onClick={() => key && tid && applyEasingPreset([{ trackId: tid, keyId: key.id }], 'bounce', 1)}>Bounce</button>
            <button className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 border border-white/10" onClick={() => key && tid && applyEasingPreset([{ trackId: tid, keyId: key.id }], 'elastic', 1)}>Elastic</button>
            {key?.segEase && (
              <button className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 border border-white/10" onClick={() => tid && key && setInterpolation(tid, key.id, key.interp)}>
                Clear Easing
              </button>
            )}
          </div>
          <svg width={W} height={H} className="border border-white/10 rounded bg-black/40 cursor-crosshair" onDoubleClick={addPoint}
            style={{ display: 'block' }}>
            {/* grid */}
            <rect x={0} y={0} width={W} height={H} fill="transparent" />
            {/* curve */}
            <path d={pathD} stroke="#8b5cf6" strokeWidth={1.5} fill="none" />
            {/* keys and tangents */}
            {key && (
              (() => {
                const k = key; const x = timeToX(k.t); const y = valueToY(k.v);
                const elems: React.ReactNode[] = [];
                if (prev) {
                  const dt = k.t - prev.t;
                  const hx = timeToX(k.t - dt * 0.25);
                  const hy = valueToY(k.v - (k.tanIn ?? (k.v - prev.v) / Math.max(1e-6, dt)) * (dt * 0.25));
                  elems.push(<line key={`lin-${k.id}`} x1={x} y1={y} x2={hx} y2={hy} stroke="#aaa" strokeDasharray="2 2" />);
                  elems.push(<circle key={`hin-${k.id}`} cx={hx} cy={hy} r={3} fill="#aaa" className="cursor-pointer" onMouseDown={(e) => handleDrag('in', e)} />);
                }
                if (next) {
                  const dt = next.t - k.t;
                  const hx = timeToX(k.t + dt * 0.25);
                  const hy = valueToY(k.v + (k.tanOut ?? (next.v - k.v) / Math.max(1e-6, dt)) * (dt * 0.25));
                  elems.push(<line key={`lout-${k.id}`} x1={x} y1={y} x2={hx} y2={hy} stroke="#aaa" strokeDasharray="2 2" />);
                  elems.push(<circle key={`hout-${k.id}`} cx={hx} cy={hy} r={3} fill="#aaa" className="cursor-pointer" onMouseDown={(e) => handleDrag('out', e)} />);
                }
                elems.push(<circle key={`k-${k.id}`} cx={x} cy={y} r={4} fill={'#facc15'} stroke="#000" className="cursor-move" onMouseDown={(e) => beginDragKey(k, e)} />);
                if (next) {
                  const nx = timeToX(next.t); const ny = valueToY(next.v);
                  elems.push(<circle key={`kn-${next.id}`} cx={nx} cy={ny} r={3} fill={'#fff'} stroke="#000" className="cursor-default" />);
                }
                return <g key={k.id}>{elems}</g>;
              })()
            )}
          </svg>
        </>
      )}
    </div>
  );
};

export default InterpolationPanel;

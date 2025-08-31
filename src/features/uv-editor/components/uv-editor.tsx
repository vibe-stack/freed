"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useUVEditorStore } from '@/stores/uv-editor-store';
import { useSelectionStore } from '@/stores/selection-store';
import { useGeometryStore } from '@/stores/geometry-store';
import { useSceneStore } from '@/stores/scene-store';
import { fitUVs01, planarProject, sphereProject, cubeProject, scaleOffsetUVs, unwrapMeshBySeams } from '@/utils/uv-mapping';
import { UVStage } from './uv-stage';

type Props = { open: boolean; onOpenChange: (v: boolean) => void };

const UVEditor: React.FC<Props> = ({ open, onOpenChange }) => {
  const selection = useSelectionStore((s) => s.selection);
  const geometry = useGeometryStore();
  const scene = useSceneStore();
  const uvSel = useUVEditorStore();
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(256); // pixels per UV unit
  // Transform state (Blender-like: G/R/S with axis constraints and confirm/cancel)
  type TransformMode = 'translate' | 'rotate' | 'scale';
  type AxisMode = 'xy' | 'x' | 'y';
  const [xform, setXform] = useState<null | {
    mode: TransformMode;
    startMouse: { x: number; y: number }; // in canvas px
    startUV: { x: number; y: number }; // uv at mouse start
    origin: { x: number; y: number }; // pivot (median)
    uv0: Map<string, { x: number; y: number }>; // original selection uv
    axis: AxisMode;
  }>(null);
  const [marquee, setMarquee] = useState<null | { start: { x: number; y: number }; current: { x: number; y: number }; additive: boolean }>(null);
  const areaRef = useRef<HTMLDivElement | null>(null);
  const lastMousePx = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [hasFocus, setHasFocus] = useState(false);
  const [updateTrigger, setUpdateTrigger] = useState(0);
  // Floating panel position/size with persistence
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    if (typeof window === 'undefined') return { x: 24, y: 80 };
    try { const raw = localStorage.getItem('uvEditorPos'); if (raw) return JSON.parse(raw); } catch {}
    return { x: 24, y: 80 };
  });
  const [size, setSize] = useState<{ w: number; h: number }>(() => {
    if (typeof window === 'undefined') return { w: 560, h: 520 };
    try { const raw = localStorage.getItem('uvEditorSize'); if (raw) return JSON.parse(raw); } catch {}
    return { w: 560, h: 520 };
  });
  useEffect(() => { try { localStorage.setItem('uvEditorPos', JSON.stringify(pos)); } catch {} }, [pos]);
  useEffect(() => { try { localStorage.setItem('uvEditorSize', JSON.stringify(size)); } catch {} }, [size]);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const dragPanelRef = useRef<{ ox: number; oy: number; sx: number; sy: number; dragging: boolean }>({ ox: 0, oy: 0, sx: 0, sy: 0, dragging: false });
  const resizeRef = useRef<{ ox: number; oy: number; sw: number; sh: number; resizing: boolean }>({ ox: 0, oy: 0, sw: 0, sh: 0, resizing: false });

  const mesh = useMemo(() => {
    // Prefer explicit edit-mode mesh, else currently selected object with a mesh, else last selected mesh in geometry store
    let meshId: string | undefined;
    if (selection.viewMode === 'edit' && selection.meshId) {
      meshId = selection.meshId || undefined;
    } else {
      const objId = selection.objectIds[0] || scene.selectedObjectId || null;
      const obj = objId ? scene.objects[objId] : undefined;
      meshId = (obj?.meshId as string | undefined) || geometry.selectedMeshId || undefined;
    }
    return meshId ? geometry.meshes.get(meshId) : undefined;
  }, [selection.viewMode, selection.meshId, selection.objectIds, scene.selectedObjectId, scene.objects, geometry.meshes, geometry.selectedMeshId, updateTrigger]);

  // Keep UV selection in sync with mesh changes and global edit selection
  const lastMeshIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const currentId = mesh?.id;
    if (currentId !== lastMeshIdRef.current) {
      // Clear UV selection when switching meshes
      uvSel.clearSelection();
      lastMeshIdRef.current = currentId;
    }
  }, [mesh?.id]);

  // Mirror global edit vertex selection into UV editor when applicable
  useEffect(() => {
    if (selection.viewMode === 'edit' && selection.meshId && mesh && selection.meshId === mesh.id) {
      if (selection.vertexIds) {
        uvSel.setSelection(selection.vertexIds);
      }
    }
  }, [selection.viewMode, selection.meshId, selection.vertexIds, mesh?.id]);

  // r3f handles rendering; keep refs for interaction math that still uses screenToUV

  // Wheel zoom on the r3f canvas element (CSS pixels space)
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const cx = (e.clientX - rect.left);
      const cy = (e.clientY - rect.top);
      const uBefore = (cx - (el.clientWidth / 2 + pan.x)) / zoom;
      const vBefore = - (cy - (el.clientHeight / 2 + pan.y)) / zoom;
      const delta = Math.sign(e.deltaY);
      setZoom((z) => {
        const newZ = Math.max(32, Math.min(4096, delta > 0 ? z * 0.9 : z * 1.1));
        const uAfterPx = uBefore * newZ;
        const vAfterPx = vBefore * newZ;
        const centerX = el.clientWidth / 2;
        const centerY = el.clientHeight / 2;
        setPan({ x: cx - (centerX + uAfterPx), y: cy - (centerY - vAfterPx) });
        return newZ;
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel as any);
  }, [pan.x, pan.y, zoom]);

  const screenToUV = (el: HTMLElement, clientX: number, clientY: number) => {
    const rect = el.getBoundingClientRect();
    const w = el.clientWidth; const h = el.clientHeight;
    const cx = (clientX - rect.left); const cy = (clientY - rect.top);
    const u = (cx - (w / 2 + pan.x)) / zoom;
    const v = - (cy - (h / 2 + pan.y)) / zoom;
    return { x: u, y: v };
  };

  // React onWheel removed; we use a native non-passive listener above

  const onPointerDown: React.PointerEventHandler<HTMLElement> = (e) => {
    if (!canvasRef.current || !mesh) return;
    // Focus the interaction area to receive keyboard shortcuts
    panelRef.current?.focus();
    // Do not start marquee or selection changes if currently transforming; LMB will confirm on release
    if (xform) return;
    const uv = screenToUV(canvasRef.current, e.clientX, e.clientY);
    // hit test nearest vertex
    let closest: { id: string; dist: number; uv0: {x:number;y:number} } | null = null;
    for (const v of mesh.vertices) {
      const d = Math.hypot(v.uv.x - uv.x, v.uv.y - uv.y);
      if (!closest || d < closest.dist) closest = { id: v.id, dist: d, uv0: {x: v.uv.x, y: v.uv.y} };
    }
    // Left button: pick/drag or start marquee. Right handled in move.
    if (e.button === 0) {
      // Click selects (with shift for additive). Movement with LMB is marquee only (no immediate drag-move).
      if (closest && closest.dist < 8/zoom) {
        if (e.shiftKey) {
          uvSel.toggleSelection(closest.id);
          // Also propagate to global selection if in edit mode
          if (selection.viewMode === 'edit' && mesh) {
            useSelectionStore.getState().toggleVertexSelection(mesh.id, closest.id);
          }
        } else if (!uvSel.selection.has(closest.id)) {
          uvSel.setSelection([closest.id]);
          if (selection.viewMode === 'edit' && mesh) {
            useSelectionStore.getState().selectVertices(mesh.id, [closest.id], false);
          }
        }
        // Do not start a move here; G/R/S will handle transforms.
      } else {
        // Start marquee selection (local CSS px)
        const rect = canvasRef.current.getBoundingClientRect();
        const lx = e.clientX - rect.left;
        const ly = e.clientY - rect.top;
        setMarquee({ start: { x: lx, y: ly }, current: { x: lx, y: ly }, additive: !!e.shiftKey });
      }
    }
  };

  const onPointerMove: React.PointerEventHandler<HTMLElement> = (e) => {
    if (!canvasRef.current) return;
    // Track last mouse position for transform start reference
    // Store local position in px relative to area
    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      lastMousePx.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }
    // If in a transform, update it instead of panning
    if (xform && mesh) {
      const uvNow = screenToUV(canvasRef.current, e.clientX, e.clientY);
      const du = uvNow.x - xform.startUV.x; const dv = uvNow.y - xform.startUV.y;
      useGeometryStore.getState().updateMesh(mesh.id, (m) => {
        if (xform.mode === 'translate') {
          const ax = xform.axis === 'y' ? 0 : 1; const ay = xform.axis === 'x' ? 0 : 1;
          for (const v of m.vertices) {
            const o = xform.uv0.get(v.id);
            if (o) v.uv = { x: o.x + du * ax, y: o.y - dv * ay };
          }
        } else if (xform.mode === 'rotate') {
          // Angle from origin based on mouse movement relative to origin
          const a0 = Math.atan2(xform.startUV.y - xform.origin.y, xform.startUV.x - xform.origin.x);
          const a1 = Math.atan2(uvNow.y - xform.origin.y, uvNow.x - xform.origin.x);
          const da = a1 - a0;
          const cos = Math.cos(da), sin = Math.sin(da);
          for (const v of m.vertices) {
            const o = xform.uv0.get(v.id);
            if (!o) continue;
            const px = o.x - xform.origin.x; const py = o.y - xform.origin.y;
            // Axis constraint: rotate but then project on axis by keeping the constrained axis from original radius
            let rx = px * cos - py * sin;
            let ry = px * sin + py * cos;
            if (xform.axis === 'x') ry = py; else if (xform.axis === 'y') rx = px;
            v.uv = { x: xform.origin.x + rx, y: xform.origin.y + ry };
          }
        } else if (xform.mode === 'scale') {
          // Scale factor based on mouse distance ratio from origin
          const d0 = Math.hypot(xform.startUV.x - xform.origin.x, xform.startUV.y - xform.origin.y) || 1e-6;
          const d1 = Math.hypot(uvNow.x - xform.origin.x, uvNow.y - xform.origin.y);
          const s = d1 / d0;
          const sx = xform.axis === 'y' ? 1 : s;
          const sy = xform.axis === 'x' ? 1 : s;
          for (const v of m.vertices) {
            const o = xform.uv0.get(v.id);
            if (!o) continue;
            const px = o.x - xform.origin.x; const py = o.y - xform.origin.y;
            v.uv = { x: xform.origin.x + px * sx, y: xform.origin.y + py * sy };
          }
        }
      });
      setUpdateTrigger(t => t + 1);
      return;
    }
    if (e.buttons === 2) { // right-drag pan (invert Y so dragging down pans view down) when not transforming
      setPan((p) => ({ x: p.x + e.movementX, y: p.y - e.movementY }));
      return;
    }
    if (marquee && e.buttons === 1) {
      if (canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        setMarquee((m) => (m ? { ...m, current: { x: e.clientX - rect.left, y: e.clientY - rect.top } } : m));
      }
      return;
    }
  };

  const onPointerUp: React.PointerEventHandler<HTMLElement> = (e) => {
    // Confirm transform on LMB up
    if (xform && e.button === 0) setXform(null);
    if (marquee && canvasRef.current && mesh) {
      const { start, current, additive } = marquee;
      // Convert local px back to client for screenToUV (CSS px)
      const rect = canvasRef.current.getBoundingClientRect();
      const a = screenToUV(canvasRef.current, start.x + rect.left, start.y + rect.top);
      const b = screenToUV(canvasRef.current, current.x + rect.left, current.y + rect.top);
      const minU = Math.min(a.x, b.x), maxU = Math.max(a.x, b.x);
      const minV = Math.min(a.y, b.y), maxV = Math.max(a.y, b.y);
      
      const picked: string[] = [];
      for (const v of mesh.vertices) {
        const inside = v.uv.x + 1e-6 >= minU && v.uv.x - 1e-6 <= maxU && v.uv.y + 1e-6 >= minV && v.uv.y - 1e-6 <= maxV;
        if (inside) {
          picked.push(v.id);
        }
      }
      
      if (additive) {
        const set = new Set(uvSel.selection); picked.forEach((id) => set.add(id)); uvSel.setSelection(Array.from(set));
        if (selection.viewMode === 'edit' && mesh) {
          useSelectionStore.getState().selectVertices(mesh.id, picked, true);
        }
      } else {
        // If marquee is essentially a click, fallback to nearest vertex pick for correctness
        const isClick = Math.abs(current.x - start.x) < 2 && Math.abs(current.y - start.y) < 2;
        if (isClick) {
          // Find nearest vertex to the click position
          const uvClick = a; // a corresponds to start
          let closest: { id: string; d: number } | null = null;
          for (const v of mesh.vertices) {
            const d = Math.hypot(v.uv.x - uvClick.x, v.uv.y - uvClick.y);
            if (!closest || d < closest.d) closest = { id: v.id, d };
          }
          if (closest) {
            uvSel.setSelection([closest.id]);
            if (selection.viewMode === 'edit') useSelectionStore.getState().selectVertices(mesh.id, [closest.id], false);
          } else {
            uvSel.setSelection([]);
            if (selection.viewMode === 'edit') useSelectionStore.getState().selectVertices(mesh.id, [], false);
          }
        } else {
          uvSel.setSelection(picked);
          if (selection.viewMode === 'edit' && mesh) {
            useSelectionStore.getState().selectVertices(mesh.id, picked, false);
          }
        }
      }
    }
    setMarquee(null);
  };
  const onContextMenu: React.MouseEventHandler<HTMLElement> = (e) => {
    e.preventDefault();
    // Right-click cancels current transform
    if (xform && mesh) {
      useGeometryStore.getState().updateMesh(mesh.id, (m) => {
        for (const v of m.vertices) {
          const o = xform.uv0.get(v.id);
          if (o) v.uv = { x: o.x, y: o.y };
        }
      });
      setXform(null);
    }
  };

  // Keyboard controls for G/R/S, axis constraints, confirm/cancel
  const onKeyDown: React.KeyboardEventHandler = (e) => {
    if (!mesh || !canvasRef.current) return;
    // Always stop propagation inside UV editor to avoid global handlers
    e.stopPropagation();
    // Start transform modes
    if (!xform && (e.key.toLowerCase() === 'g' || e.key.toLowerCase() === 'r' || e.key.toLowerCase() === 's')) {
      const mode: TransformMode = e.key.toLowerCase() === 'g' ? 'translate' : e.key.toLowerCase() === 'r' ? 'rotate' : 'scale';
      // Use most up-to-date selection from global store when in edit mode, else local UV selection
      const effectiveSel: Set<string> = (selection.viewMode === 'edit' && selection.meshId === mesh.id)
        ? new Set(selection.vertexIds)
        : uvSel.selection;
      if (!effectiveSel.size) {
        return; // nothing to transform
      }
      // Use last mouse position over the area; else center
  const rect = canvasRef.current.getBoundingClientRect();
  const localX = lastMousePx.current.x || rect.width / 2;
  const localY = lastMousePx.current.y || rect.height / 2;
  const mx = rect.left + localX;
  const my = rect.top + localY;
  const startUV = screenToUV(canvasRef.current, mx, my);
      // Origin: median of selected UVs
  let sx = 0, sy = 0, n = 0;
  for (const v of mesh.vertices) { if (effectiveSel.has(v.id)) { sx += v.uv.x; sy += v.uv.y; n++; } }
      const origin = { x: n ? sx / n : 0, y: n ? sy / n : 0 };
      const uv0 = new Map<string, { x: number; y: number }>();
  for (const v of mesh.vertices) { if (effectiveSel.has(v.id)) uv0.set(v.id, { x: v.uv.x, y: v.uv.y }); }
      
      const init = { mode, startMouse: { x: mx, y: my }, startUV, origin, uv0, axis: 'xy' } as const;
      setXform(init as any);
      e.preventDefault();
      return;
    }
    if (xform) {
      if (e.key === 'Escape') {
        // cancel
        useGeometryStore.getState().updateMesh(mesh.id, (m) => {
          for (const v of m.vertices) {
            const o = xform.uv0.get(v.id);
            if (o) v.uv = { x: o.x, y: o.y };
          }
        });
        setXform(null);
        e.preventDefault();
        return;
      }
      if (e.key === 'Enter') {
        // confirm
        setXform(null);
        e.preventDefault();
        return;
      }
      // Axis constraints
      if (e.key.toLowerCase() === 'x') { setXform((xf) => (xf ? { ...xf, axis: xf.axis === 'x' ? 'xy' : 'x' } : xf)); e.preventDefault(); return; }
      if (e.key.toLowerCase() === 'y') { setXform((xf) => (xf ? { ...xf, axis: xf.axis === 'y' ? 'xy' : 'y' } : xf)); e.preventDefault(); return; }
    }
  };

  const onKeyUp: React.KeyboardEventHandler = (e) => {
    // Stop propagation on keyup as well to block global handlers
    e.stopPropagation();
  };

  // Block global shortcuts when UV editor is open
  useEffect(() => {
    if (!open) return;
    const guard = (ev: KeyboardEvent) => {
      const k = ev.key.toLowerCase();
      if (k === 'g' || k === 'r' || k === 's' || k === 'x' || k === 'y' || k === 'escape' || k === 'enter') {
        // Only intercept if our panel has focus to avoid stealing global shortcuts
        if (hasFocus) {
          ev.preventDefault();
          onKeyDown(ev as any);
          ev.stopPropagation();
        }
      }
    };
    window.addEventListener('keydown', guard, true);
    return () => window.removeEventListener('keydown', guard, true);
  }, [open, hasFocus]);

  const applyFit = () => {
    if (!mesh) return;
    useGeometryStore.getState().updateMesh(mesh.id, (m) => fitUVs01(m, uvSel.selection));
  };
  const applySphere = () => { if (!mesh) return; useGeometryStore.getState().updateMesh(mesh.id, (m) => sphereProject(m, uvSel.selection)); };
  const applyPlanar = (axis: 'x'|'y'|'z') => { if (!mesh) return; useGeometryStore.getState().updateMesh(mesh.id, (m) => planarProject(m, axis, uvSel.selection)); };
  const applyCube = () => { if (!mesh) return; useGeometryStore.getState().updateMesh(mesh.id, (m) => cubeProject(m, uvSel.selection)); };
  const tile2x = () => { if (!mesh) return; useGeometryStore.getState().updateMesh(mesh.id, (m) => scaleOffsetUVs(m, {x:2,y:2}, {x:0,y:0}, uvSel.selection)); };
  const unwrap = () => { if (!mesh) return; useGeometryStore.getState().updateMesh(mesh.id, (m) => unwrapMeshBySeams(m)); };

  if (!open) return null;

  // Panel drag handlers
  const onHeaderMouseDown: React.MouseEventHandler<HTMLDivElement> = (e) => {
    const header = e.currentTarget;
    const rect = header.getBoundingClientRect();
    const withinHeader = e.clientY >= rect.top && e.clientY <= rect.bottom;
    if (!withinHeader) return;
    dragPanelRef.current = { ox: e.clientX, oy: e.clientY, sx: pos.x, sy: pos.y, dragging: true };
    const onMove = (ev: MouseEvent) => {
      if (!dragPanelRef.current.dragging) return;
      const dx = ev.clientX - dragPanelRef.current.ox;
      const dy = ev.clientY - dragPanelRef.current.oy;
      setPos({ x: dragPanelRef.current.sx + dx, y: dragPanelRef.current.sy + dy });
    };
    const onUp = () => {
      dragPanelRef.current.dragging = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const onResizeMouseDown: React.MouseEventHandler<HTMLDivElement> = (e) => {
    resizeRef.current = { ox: e.clientX, oy: e.clientY, sw: size.w, sh: size.h, resizing: true };
    const onMove = (ev: MouseEvent) => {
      if (!resizeRef.current.resizing) return;
      const dw = ev.clientX - resizeRef.current.ox;
      const dh = ev.clientY - resizeRef.current.oy;
      setSize((s) => ({ w: Math.max(360, resizeRef.current.sw + dw), h: Math.max(260, resizeRef.current.sh + dh) }));
    };
    const onUp = () => {
      resizeRef.current.resizing = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
  <div className="absolute inset-0 z-30 pointer-events-none">
      <div
        ref={panelRef}
    className="absolute bg-black/60 backdrop-blur-md border border-white/10 rounded-md shadow-xl pointer-events-auto flex flex-col select-none"
        style={{ left: pos.x, top: pos.y, width: size.w, height: size.h }}
        tabIndex={0}
    onKeyDown={onKeyDown}
    onKeyUp={onKeyUp}
        onFocus={() => setHasFocus(true)}
        onBlur={() => setHasFocus(false)}
      >
    <div className="px-3 py-2 border-b border-white/10 text-[11px] uppercase tracking-wide text-gray-400 flex items-center justify-between cursor-move" onMouseDown={onHeaderMouseDown}>
          <span>UV Editor</span>
          <div className="flex gap-2">
            <button className="px-2 py-1 rounded border border-white/10 hover:bg-white/10" onClick={() => onOpenChange(false)}>Close</button>
          </div>
        </div>
        <div className="relative flex-1 overflow-hidden">
          <div
      className="absolute inset-0 bg-black/40 touch-none outline-none focus:outline-none focus-visible:outline-none"
            ref={(el) => { (canvasRef as any).current = el as any; areaRef.current = el as any; }}
            onPointerDown={(e) => {
              // Focus the area when clicked to ensure keyboard events are captured
              panelRef.current?.focus();
              onPointerDown(e);
            }}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onContextMenu={onContextMenu}
            role="application"
            style={{ outline: 'none' }}
          >
            <UVStage mesh={mesh} selected={uvSel.selection} pan={pan} zoom={zoom} style={{ width: '100%', height: '100%' }} />
            {xform && (
              <div className="absolute left-2 top-2 text-[12px] text-gray-300 bg-black/40 px-2 py-1 rounded border border-white/10">
                {xform.mode === 'translate' ? 'Move' : xform.mode === 'rotate' ? 'Rotate' : 'Scale'} {xform.axis !== 'xy' ? `(${xform.axis.toUpperCase()} constrained)` : ''} — LMB: confirm • RMB/Esc: cancel • X/Y: constrain axis
              </div>
            )}
          </div>
          {!mesh && (
            <div className="absolute inset-0 flex items-center justify-center text-center text-[12px] text-gray-400">
              <div className="px-6 py-4 bg-black/30 rounded-md border border-white/10">
                <div className="font-semibold mb-1 text-gray-300">No active mesh for UV editing</div>
                <div>Enter Edit Mode on a mesh or select a mesh object to see its UVs.</div>
              </div>
            </div>
          )}
          {marquee && (
            (() => {
              const x1 = marquee.start.x; const y1 = marquee.start.y;
              const x2 = marquee.current.x; const y2 = marquee.current.y;
              const left = Math.min(x1, x2), top = Math.min(y1, y2);
              const w = Math.abs(x2 - x1), h = Math.abs(y2 - y1);
              return (
                <div
          className="absolute border border-gray-400/80 bg-gray-400/10 pointer-events-none"
                  style={{ left, top, width: w, height: h }}
                />
              );
            })()
          )}
          {/* Resize handle */}
          <div
            className="absolute right-0 bottom-0 w-4 h-4 cursor-se-resize opacity-70"
            onMouseDown={onResizeMouseDown}
            style={{ background: 'linear-gradient(135deg, transparent 0 50%, rgba(255,255,255,0.2) 50% 100%)' }}
          />
        </div>
        <div className="px-3 py-2 border-t border-white/10 text-[12px] flex items-center gap-2 flex-wrap">
          <button className="px-2 py-1 rounded border border-white/10 hover:bg-white/10" onClick={applyFit}>Fit 0-1</button>
          <button className="px-2 py-1 rounded border border-white/10 hover:bg-white/10" onClick={applyCube}>Cube</button>
          <button className="px-2 py-1 rounded border border-white/10 hover:bg-white/10" onClick={() => applyPlanar('x')}>Planar X</button>
          <button className="px-2 py-1 rounded border border-white/10 hover:bg-white/10" onClick={() => applyPlanar('y')}>Planar Y</button>
          <button className="px-2 py-1 rounded border border-white/10 hover:bg-white/10" onClick={() => applyPlanar('z')}>Planar Z</button>
          <button className="px-2 py-1 rounded border border-white/10 hover:bg-white/10" onClick={applySphere}>Sphere</button>
          <button className="px-2 py-1 rounded border border-white/10 hover:bg-white/10" onClick={tile2x}>Tile 2x</button>
          <button className="px-2 py-1 rounded border border-green-400/20 hover:bg-green-400/10" onClick={unwrap}>Unwrap (Seams)</button>
      <span className="text-gray-400 ml-auto">G: Move • R: Rotate • S: Scale • X/Y: axis • LMB: confirm • RMB/Esc: cancel • LMB drag: marquee • RMB drag: pan • Wheel: zoom</span>
        </div>
      </div>
    </div>
  );
};

export default UVEditor;

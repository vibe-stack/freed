import { useState, useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { useSelectionStore } from '@/stores/selection-store';
import { useToolStore } from '@/stores/tool-store';
import { useGeometryStore } from '@/stores/geometry-store';
import { Vector3, Matrix4, Quaternion, Euler } from 'three';

export const useMarqueeSelection = (objTransform: any) => {
  const { gl, camera, size } = useThree();
  const [marquee, setMarquee] = useState<null | { start: { x: number; y: number }; current: { x: number; y: number }; additive: boolean }>(null);

  useEffect(() => {
    const el = gl?.domElement as HTMLCanvasElement | undefined;
    if (!el) return;
    
    let currentMarquee: typeof marquee = null;
    
    const onDown = (e: PointerEvent) => {
      // Only in edit mode, only LMB, require Alt+Shift, and no active tool/sculpt
      if (useSelectionStore.getState().selection.viewMode !== 'edit') return;
      if ((e.buttons & 1) !== 1 || e.button !== 0) return;
      if (!e.altKey || !e.shiftKey) return;
      if (useToolStore.getState().isActive || useToolStore.getState().sculptStrokeActive) return;
      
      // Prevent camera controls
      e.preventDefault();
      e.stopPropagation();
      
      const r = el.getBoundingClientRect();
      const lx = e.clientX - r.left;
      const ly = e.clientY - r.top;
      
      useToolStore.getState().setMarqueeActive(true);
      currentMarquee = { start: { x: lx, y: ly }, current: { x: lx, y: ly }, additive: false };
      setMarquee(currentMarquee);
      
      // Use local refs to avoid closure issues
      window.addEventListener('pointermove', onMove, { capture: true });
      window.addEventListener('pointerup', onUp, { capture: true });
    };
    
    const onMove = (e: PointerEvent) => {
      if (!currentMarquee) return;
      e.preventDefault();
      e.stopPropagation();
      
      const r = el.getBoundingClientRect();
      currentMarquee = { ...currentMarquee, current: { x: e.clientX - r.left, y: e.clientY - r.top } };
      setMarquee(currentMarquee);
    };
    
    const onUp = (e: PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Clean up listeners immediately
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerup', onUp, true);
      
      if (!currentMarquee) { 
        useToolStore.getState().setMarqueeActive(false); 
        return; 
      }
      
      try {
        const sx = currentMarquee.start.x, sy = currentMarquee.start.y;
        const cx = currentMarquee.current.x, cy = currentMarquee.current.y;
        const minX = Math.min(sx, cx), maxX = Math.max(sx, cx);
        const minY = Math.min(sy, cy), maxY = Math.max(sy, cy);
        
        // Ignore tiny drags (treat like click-through)
        if (Math.abs(maxX - minX) < 2 && Math.abs(maxY - minY) < 2) return;
        
        const sel = useSelectionStore.getState().selection;
        if (!sel.meshId) return;
        
        const geo = useGeometryStore.getState();
        const m = geo.meshes.get(sel.meshId);
        if (!m) return;
        
        // Build object world matrix from objTransform
        const pos = new Vector3(objTransform.position.x, objTransform.position.y, objTransform.position.z);
        const scl = new Vector3(objTransform.scale.x, objTransform.scale.y, objTransform.scale.z);
        const quat = new Quaternion().setFromEuler(new Euler(objTransform.rotation.x, objTransform.rotation.y, objTransform.rotation.z));
        const objMat = new Matrix4().compose(pos, quat, scl);
        
        const toScreen = (p: { x: number; y: number; z: number }) => {
          const wp = new Vector3(p.x, p.y, p.z).applyMatrix4(objMat);
          const sp = wp.project(camera as any);
          // Convert NDC to canvas-local px
          const sx = (sp.x * 0.5 + 0.5) * size.width;
          const sy = (-sp.y * 0.5 + 0.5) * size.height;
          return { x: sx, y: sy, z: sp.z };
        };
        
        const inside = (x: number, y: number) => x >= minX && x <= maxX && y >= minY && y <= maxY;
        
        if (sel.selectionMode === 'vertex') {
          const picked: string[] = [];
          for (const v of m.vertices) {
            const sp = toScreen(v.position);
            if (inside(sp.x, sp.y)) picked.push(v.id);
          }
          // For marquee selection, don't use additive - just select the picked vertices
          // This matches typical marquee behavior where you drag to select a group
          useSelectionStore.getState().selectVertices(m.id, picked);
        } else if (sel.selectionMode === 'edge') {
          const vmap = new Map(m.vertices.map(v => [v.id, v] as const));
          const picked: string[] = [];
          for (const e of m.edges) {
            const v0 = vmap.get(e.vertexIds[0]);
            const v1 = vmap.get(e.vertexIds[1]);
            if (!v0 || !v1) continue;
            const a = toScreen(v0.position); const b = toScreen(v1.position);
            if (inside(a.x, a.y) && inside(b.x, b.y)) picked.push(e.id);
          }
          useSelectionStore.getState().selectEdges(m.id, picked);
        } else if (sel.selectionMode === 'face') {
          const vmap = new Map(m.vertices.map(v => [v.id, v] as const));
          const picked: string[] = [];
          for (const f of m.faces) {
            let allIn = true;
            for (const vid of f.vertexIds) {
              const v = vmap.get(vid); if (!v) { allIn = false; break; }
              const sp = toScreen(v.position);
              if (!inside(sp.x, sp.y)) { allIn = false; break; }
            }
            if (allIn) picked.push(f.id);
          }
          useSelectionStore.getState().selectFaces(m.id, picked);
        }
      } finally {
        currentMarquee = null;
        setMarquee(null);
        useToolStore.getState().setMarqueeActive(false);
      }
    };
    
    el.addEventListener('pointerdown', onDown, { passive: false, capture: true });
    
    return () => {
      el.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerup', onUp, true);
      // Ensure marquee is cleaned up on unmount
      currentMarquee = null;
      setMarquee(null);
      useToolStore.getState().setMarqueeActive(false);
    };
  }, [gl, objTransform.position.x, objTransform.position.y, objTransform.position.z, objTransform.rotation.x, objTransform.rotation.y, objTransform.rotation.z, objTransform.scale.x, objTransform.scale.y, objTransform.scale.z, size.width, size.height, camera]);

  return marquee;
};

"use client";

import { useEffect, useRef } from 'react';

export function useShaderEditorHotkeys(
  enabled: boolean,
  containerRef: React.RefObject<HTMLDivElement | null>,
  handlers: { copy(): void; cut(): void; paste(): void; del(): void }
) {
  const pointerInsideRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    const root = containerRef.current;
    if (!root) return;
    const onEnter = () => { pointerInsideRef.current = true; };
    const onLeave = () => { pointerInsideRef.current = false; };
    root.addEventListener('pointerenter', onEnter);
    root.addEventListener('pointerleave', onLeave);

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const inside = !!(target && root.contains(target)) || pointerInsideRef.current;
      if (!inside) return;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || (target as any).contentEditable === 'true')) return;

      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const isMeta = e.metaKey || e.ctrlKey;

      if (isMeta && k === 'c') { e.preventDefault(); e.stopPropagation(); handlers.copy(); return; }
      if (isMeta && k === 'x') { e.preventDefault(); e.stopPropagation(); handlers.cut(); return; }
      if (isMeta && k === 'v') { e.preventDefault(); e.stopPropagation(); handlers.paste(); return; }
      if (k === 'Backspace' || k === 'Delete') { e.preventDefault(); e.stopPropagation(); handlers.del(); return; }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      root.removeEventListener('pointerenter', onEnter);
      root.removeEventListener('pointerleave', onLeave);
    };
  }, [enabled, containerRef, handlers]);
}

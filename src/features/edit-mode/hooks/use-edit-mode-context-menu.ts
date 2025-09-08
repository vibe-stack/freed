import { useState, useEffect } from 'react';
import { useSelectionStore } from '@/stores/selection-store';

export const useEditModeContextMenu = (gl: any) => {
  const [cmOpen, setCmOpen] = useState(false);
  const [cmPos, setCmPos] = useState<{ x: number; y: number } | null>(null);
  const [cmFlipX, setCmFlipX] = useState(false);
  const [cmFlipY, setCmFlipY] = useState(false);

  useEffect(() => {
    const el = gl?.domElement as HTMLElement | undefined;
    if (!el) return;
    const onCM = (e: MouseEvent) => {
      // Only in edit mode
      if (useSelectionStore.getState().selection.viewMode !== 'edit') return;
      // Allow RMB drag in tools: open only on contextmenu event (no drag)
      e.preventDefault();
      e.stopPropagation();
      const x = e.clientX, y = e.clientY;
      setCmPos({ x, y });
      const vw = window.innerWidth, vh = window.innerHeight;
      setCmFlipX(vw - x < 240);
      setCmFlipY(vh - y < 200);
      setCmOpen(true);
    };
    el.addEventListener('contextmenu', onCM, { passive: false });
    return () => el.removeEventListener('contextmenu', onCM as any);
  }, [gl]);

  return { cmOpen, setCmOpen, cmPos, cmFlipX, cmFlipY };
};

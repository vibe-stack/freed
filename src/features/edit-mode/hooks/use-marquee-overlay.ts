import { useEffect } from 'react';

export const useMarqueeOverlay = (marquee: any, gl: any) => {
  useEffect(() => {
    if (!marquee) return;
    
    const el = gl?.domElement as HTMLCanvasElement | undefined;
    if (!el) return;
    
    // Create overlay div
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.border = '1px solid rgba(255,255,255,0.8)';
    overlay.style.background = 'rgba(255,255,255,0.1)';
    overlay.style.pointerEvents = 'none';
    overlay.style.zIndex = '10000';
    
    // Position relative to canvas
    const rect = el.getBoundingClientRect();
    const left = Math.min(marquee.start.x, marquee.current.x) + rect.left;
    const top = Math.min(marquee.start.y, marquee.current.y) + rect.top;
    const width = Math.abs(marquee.current.x - marquee.start.x);
    const height = Math.abs(marquee.current.y - marquee.start.y);
    
    overlay.style.left = `${left}px`;
    overlay.style.top = `${top}px`;
    overlay.style.width = `${width}px`;
    overlay.style.height = `${height}px`;
    
    document.body.appendChild(overlay);
    
    return () => {
      document.body.removeChild(overlay);
    };
  }, [marquee, gl]);
};

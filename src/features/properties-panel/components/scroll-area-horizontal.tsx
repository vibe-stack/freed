"use client";

import React, { PropsWithChildren, useRef, useEffect } from 'react';

export const ScrollAreaHorizontal: React.FC<PropsWithChildren> = ({ children }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const wheelHandler = (e: WheelEvent) => {
      if (e.deltaY !== 0 && (e.shiftKey || el.scrollWidth > el.clientWidth)) {
        el.scrollLeft += e.deltaY;
        e.preventDefault();
      }
    };
    el.addEventListener('wheel', wheelHandler, { passive: false });
    return () => el.removeEventListener('wheel', wheelHandler as any);
  }, []);

  return (
    <div ref={ref} className="overflow-x-auto">
      {children}
    </div>
  );
};

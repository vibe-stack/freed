"use client";

import React, { PropsWithChildren, useRef, useEffect } from 'react';

export const ScrollAreaHorizontal: React.FC<PropsWithChildren> = ({ children }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const wheelHandler: EventListener = (e) => {
      const we = e as WheelEvent;
      if (we.deltaY !== 0 && (we.shiftKey || el.scrollWidth > el.clientWidth)) {
        el.scrollLeft += we.deltaY;
        we.preventDefault();
      }
    };
    el.addEventListener('wheel', wheelHandler, { passive: false });
    return () => el.removeEventListener('wheel', wheelHandler);
  }, []);

  return (
    <div ref={ref} className="overflow-x-auto">
      {children}
    </div>
  );
};

import * as React from 'react';

export const Pill = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className = '', children, ...rest }, ref) => (
  <div
    ref={ref}
    className={`pointer-events-auto bg-black/40 backdrop-blur-md border border-white/10 rounded-xl shadow-lg shadow-black/30 ${className}`}
    {...rest}
  >
    {children}
  </div>
));
Pill.displayName = 'Pill';
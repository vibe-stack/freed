"use client";

import React from 'react';

type SwitchProps = {
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  label?: string;
};

export const Switch: React.FC<SwitchProps> = ({ checked, onCheckedChange, disabled = false, className = '', label }) => {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => !disabled && onCheckedChange?.(!checked)}
      className={
        `relative inline-flex h-4 w-7 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-150 ` +
        (disabled ? 'opacity-50 cursor-not-allowed ' : '') +
        (checked ? 'bg-emerald-500 ' : 'bg-white/20 ') +
        className
      }
    >
      <span
        className={
          `inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform duration-150 ` +
          (checked ? 'translate-x-3.5' : 'translate-x-0.5')
        }
      />
    </button>
  );
};

export default Switch;

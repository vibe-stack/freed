'use client';

import React, { useState, useRef, useEffect } from 'react';

interface ShortcutHelpProps {
  className?: string;
}

export const ShortcutHelp: React.FC<ShortcutHelpProps> = ({ className }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const shortcuts = [
    { key: 'Tab', description: 'Toggle between Object/Edit mode' },
    { key: '1', description: 'Vertex selection mode (Edit Mode)' },
    { key: '2', description: 'Edge selection mode (Edit Mode)' },
    { key: '3', description: 'Face selection mode (Edit Mode)' },
  { key: 'Alt + Shift + Drag', description: 'Marquee select (Edit Mode); edges/faces must be fully inside' },
    { key: 'Alt + A', description: 'Clear selection' },
    { key: 'Esc', description: 'Clear selection' },
  ];

  return (
    <div className={className} ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-2 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
        title="Show keyboard shortcuts"
      >
        ⌨️ Shortcuts
      </button>
      
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg border dark:border-gray-600 z-50 min-w-[280px]">
          <h3 className="text-sm font-semibold mb-3 text-gray-900 dark:text-white">
            Keyboard Shortcuts
          </h3>
          <div className="space-y-2">
            {shortcuts.map(({ key, description }, index) => (
              <div key={index} className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">{description}</span>
                <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono">
                  {key}
                </kbd>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t dark:border-gray-700 text-xs text-gray-500">
            Blender-compatible shortcuts
          </div>
        </div>
      )}
    </div>
  );
};

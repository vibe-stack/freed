"use client";
import { StoreProvider } from '@/stores';
import { ShortcutProvider } from '@/components/shortcut-provider';
import EditorLayout from '@/features/layout/components/editor-layout';


export default function Home() {
  return (
    <StoreProvider>
      <ShortcutProvider>
        <EditorLayout />
      </ShortcutProvider>
    </StoreProvider>
  );
}

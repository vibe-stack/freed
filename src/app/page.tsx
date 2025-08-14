import { StoreProvider } from '../stores';
import { ShortcutProvider } from '@/components/ShortcutProvider';
import EditorLayout from '@/components/EditorLayout';

export default function Home() {
  return (
    <StoreProvider>
      <ShortcutProvider>
        <EditorLayout />
      </ShortcutProvider>
    </StoreProvider>
  );
}

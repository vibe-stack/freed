import { StoreProvider } from '../stores';
import { GeometryDebugPanel } from '../components/GeometryDebugPanel';
import { ShortcutProvider } from '../components/ShortcutProvider';

export default function Home() {
  return (
    <StoreProvider>
      <ShortcutProvider>
        <div className="min-h-screen p-8 bg-gray-50 dark:bg-gray-900">
          <div className="max-w-6xl mx-auto">
            <header className="text-center mb-8">
              <h1 className="text-4xl font-bold mb-4 text-gray-900 dark:text-white">
                Freed - 3D Web Editor
              </h1>
              <p className="text-lg text-gray-600 dark:text-gray-300">
                React-first 3D editor with reactive geometry system
              </p>
            </header>
            
            <main>
              <GeometryDebugPanel />
            </main>
            
            <footer className="mt-12 text-center text-sm text-gray-500">
              <p>Phase 1: Reactive Foundation - Core stores and data structures implemented</p>
              <p className="mt-2 text-xs">
                Shortcuts: Tab-Object/Edit Mode | 1-Vertex, 2-Edge, 3-Face (Edit Mode) | Alt+A or Esc-Clear Selection
              </p>
            </footer>
          </div>
        </div>
      </ShortcutProvider>
    </StoreProvider>
  );
}

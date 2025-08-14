# Freed - 3D Web Editor

A React-first 3D editor with reactive geometry system, built with Next.js and modern web technologies.

## 🚀 Features

### Core Functionality
- **Reactive Geometry System**: Built on Zustand stores with reactive data structures
- **Dual View Modes**: Object Mode and Edit Mode for different interaction paradigms
- **Component Selection**: Vertex, Edge, and Face selection in Edit Mode
- **Scene Hierarchy**: Nested objects with parent-child relationships
- **Real-time Updates**: All changes are immediately reflected across the UI

### T3D File Format Support
- **Custom Format**: Proprietary `.t3d` format for saving/loading scenes
- **Full Data Preservation**: Complete scene state including meshes, materials, hierarchy, and viewport
- **Browser-based**: Entirely client-side export/import using ZIP compression
- **Version Control**: Built-in version compatibility system
- **ID Stability**: Preserves all object IDs across export/import cycles

### Current Implementation
- Multiple mesh creation and management
- Material system with PBR properties
- Transform operations (position, rotation, scale)
- Selection state management
- Viewport camera controls
- Debug panels and test suites

## 🛠️ Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **State Management**: Zustand with Immer middleware
- **3D Math**: Custom geometry utilities
- **File Handling**: JSZip for T3D format
- **Styling**: Tailwind CSS
- **Development**: Turbopack for fast builds

## 📁 Project Structure

```
src/
├── app/                    # Next.js app directory
├── components/             # React components
│   ├── GeometryDebugPanel.tsx
│   ├── T3DToolbar.tsx     # Export/Import controls
│   ├── T3DTestSuite.tsx   # Testing utilities
│   └── DemoContentCreator.tsx
├── stores/                 # Zustand stores
│   ├── geometryStore.ts   # Meshes and materials
│   ├── sceneStore.ts      # Scene hierarchy
│   ├── selectionStore.ts  # Selection state
│   └── viewportStore.ts   # Camera and viewport
├── types/                  # TypeScript definitions
│   ├── geometry.ts        # Core 3D types
│   └── t3d.ts            # T3D format types
└── utils/                  # Utilities
    ├── geometry.ts        # Math and geometry helpers
    ├── t3dExporter.ts     # T3D export functionality
    └── t3dImporter.ts     # T3D import functionality
```

## 🎮 Usage

### Getting Started

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Run development server**:
   ```bash
   npm run dev
   ```

3. **Open in browser**: Navigate to `http://localhost:3000`

### Basic Workflow

1. **Create Demo Content**: Click "Create Demo Scene" to populate the scene
2. **Switch Modes**: Use Tab key to toggle between Object and Edit modes
3. **Select Elements**: Click objects/vertices/edges/faces based on current mode
4. **Export Scene**: Click "Export as .t3d" to save your work
5. **Import Scene**: Click "Import .t3d" to load a saved scene

### Keyboard Shortcuts

- **Tab**: Toggle between Object Mode and Edit Mode
- **1**: Switch to Vertex selection (Edit Mode)
- **2**: Switch to Edge selection (Edit Mode)  
- **3**: Switch to Face selection (Edit Mode)
- **Alt+A** or **Esc**: Clear all selections

## 📄 T3D File Format

The T3D format is a ZIP archive containing:

- `scene.json`: Complete scene data in JSON format
- `assets/`: Folder for textures and other assets (future)

### Key Features:
- **Versioned**: Semantic versioning for compatibility
- **Complete**: Preserves all scene data including IDs
- **Compressed**: ZIP compression for smaller files
- **Extensible**: Designed for future enhancements

See [T3D_FORMAT.md](./T3D_FORMAT.md) for detailed specification.

## 🧪 Testing

The project includes comprehensive testing tools:

- **T3D Test Suite**: Automated round-trip testing for export/import
- **Filter Tests**: Verify selective export functionality
- **Demo Content**: Sample scenes for testing

Run tests through the web interface or use the programmatic test suite.

## 🏗️ Development

### Architecture

The application follows a reactive architecture pattern:

1. **Stores**: Centralized state management with Zustand
2. **Components**: React components that subscribe to store changes
3. **Utilities**: Pure functions for calculations and data transformations
4. **Types**: Comprehensive TypeScript definitions

### Adding Features

1. **Define Types**: Add TypeScript definitions in `src/types/`
2. **Update Stores**: Extend Zustand stores with new state and actions
3. **Create Components**: Build React components that consume store data
4. **Add Utilities**: Implement pure functions for complex operations

### Code Style

- **Functional Components**: Use React function components with hooks
- **Immutable Updates**: All state changes use Immer for immutability
- **TypeScript**: Strict typing for all code
- **Modular**: Clear separation of concerns

## 🚧 Current Status

**Phase 1: Reactive Foundation** ✅
- Core stores and data structures implemented
- Basic geometry creation and manipulation
- Selection system with dual modes
- Scene hierarchy management

**Phase 2: File System** ✅
- T3D format design and implementation
- Export/import functionality
- Data integrity testing
- Browser-based file operations

**Phase 3: 3D Rendering** (Coming Soon)
- Three.js integration
- Real-time 3D viewport
- Material rendering
- Interactive 3D manipulators

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📝 License

This project is in active development. License to be determined.

## 🔮 Roadmap

- [ ] 3D viewport with Three.js
- [ ] Interactive transformers and gizmos  
- [ ] Advanced material system
- [ ] Animation timeline
- [ ] Plugin system
- [ ] Multi-user collaboration
- [ ] Cloud storage integration

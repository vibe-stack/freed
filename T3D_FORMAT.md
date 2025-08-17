# T3D File Format Specification

## Overview

The T3D (Three-D) file format is a custom 3D scene format designed for the Gestalt 3D Editor. It stores complete 3D scenes including meshes, materials, scene hierarchy, and viewport state in a structured, version-controlled format.

## Format Structure

A T3D file is a ZIP archive containing:
- `scene.json` - Main scene data (required)
- `assets/` - Folder for textures and other assets (optional)

### File Extension
- `.t3d` - T3D scene file

## Scene.json Structure

```json
{
  "metadata": {
    "version": { "major": 1, "minor": 0, "patch": 0 },
    "created": "2025-08-14T10:30:00.000Z",
    "modified": "2025-08-14T10:30:00.000Z",
    "author": "User Name",
    "description": "Optional scene description",
    "application": "Gestalt 3D Editor",
    "applicationVersion": "0.1.0"
  },
  "meshes": [...],
  "materials": [...],
  "objects": [...],
  "rootObjects": ["object-id-1", "object-id-2"],
  "viewport": {...},
  "selectedObjectId": "object-id-1"
}
```

## Data Structures

### Mesh
```json
{
  "id": "mesh-uuid",
  "name": "Cube",
  "vertices": [
    {
      "id": "vertex-uuid",
      "position": { "x": 0, "y": 0, "z": 0 },
      "normal": { "x": 0, "y": 1, "z": 0 },
      "uv": { "x": 0, "y": 0 },
      "selected": false
    }
  ],
  "edges": [
    {
      "id": "edge-uuid",
      "vertexIds": ["vertex-uuid-1", "vertex-uuid-2"],
      "faceIds": ["face-uuid-1", "face-uuid-2"],
      "selected": false
    }
  ],
  "faces": [
    {
      "id": "face-uuid",
      "vertexIds": ["vertex-uuid-1", "vertex-uuid-2", "vertex-uuid-3"],
      "normal": { "x": 0, "y": 1, "z": 0 },
      "materialId": "material-uuid",
      "selected": false
    }
  ],
  "transform": {
    "position": { "x": 0, "y": 0, "z": 0 },
    "rotation": { "x": 0, "y": 0, "z": 0 },
    "scale": { "x": 1, "y": 1, "z": 1 }
  },
  "visible": true,
  "locked": false
}
```

### Material
```json
{
  "id": "material-uuid",
  "name": "Material Name",
  "color": { "x": 1, "y": 1, "z": 1 },
  "roughness": 0.5,
  "metalness": 0.0,
  "emissive": { "x": 0, "y": 0, "z": 0 }
}
```

### Scene Object
```json
{
  "id": "object-uuid",
  "name": "Cube Object",
  "type": "mesh",
  "parentId": null,
  "children": ["child-object-uuid"],
  "transform": {
    "position": { "x": 0, "y": 0, "z": 0 },
    "rotation": { "x": 0, "y": 0, "z": 0 },
    "scale": { "x": 1, "y": 1, "z": 1 }
  },
  "visible": true,
  "locked": false,
  "meshId": "mesh-uuid"
}
```

### Viewport
```json
{
  "camera": {
    "position": { "x": 5, "y": 5, "z": 5 },
    "target": { "x": 0, "y": 0, "z": 0 },
    "up": { "x": 0, "y": 1, "z": 0 },
    "fov": 50,
    "near": 0.1,
    "far": 1000
  },
  "shadingMode": "solid",
  "showGrid": true,
  "showAxes": true,
  "gridSize": 10,
  "backgroundColor": { "x": 0.2, "y": 0.2, "z": 0.2 }
}
```

## Version Compatibility

The T3D format uses semantic versioning:
- **Major version**: Breaking changes in file format
- **Minor version**: Backward-compatible additions
- **Patch version**: Bug fixes and clarifications

### Current Version: 1.0.0

## ID Stability

All objects maintain stable UUIDs:
- Meshes, materials, objects, vertices, edges, and faces all have unique IDs
- IDs are preserved across export/import operations
- This ensures references between objects remain intact

## Browser Implementation

The T3D system runs entirely in the browser using:
- **JSZip** for ZIP file creation/reading
- **File API** for file download/upload
- **JSON** for data serialization

## Usage

### Export
```typescript
import { exportAndDownload } from './utils/t3dExporter';

// Export entire scene
await exportAndDownload(workspaceData, 'my-scene.t3d');

// Export with filters
await exportAndDownload(workspaceData, 'selected.t3d', {
  includeMeshes: ['mesh-1', 'mesh-2'],
  includeViewport: false
});
```

### Import
```typescript
import { openImportDialog } from './utils/t3dImporter';

openImportDialog(
  (data) => {
    // Handle successful import
    console.log('Loaded:', data.meshes.length, 'meshes');
  },
  (error) => {
    // Handle error
    console.error('Import failed:', error);
  }
);
```

## Future Extensions

- **Assets folder**: Support for texture files, HDRI environments
- **Animation data**: Keyframes, animation clips
- **Lighting**: Light objects, shadow settings
- **Compression**: Advanced compression for large scenes
- **Streaming**: Partial scene loading for large files

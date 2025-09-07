import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { nanoid } from 'nanoid';
import { Text3D } from '@/types/geometry';
import { useGeometryStore } from './geometry-store';
import { createMeshFromGeometry, createVertex, createFace, vec3, vec2 } from '@/utils/geometry';
import { useSceneStore } from './scene-store';

// Convert Three.js TextGeometry to our internal mesh format
// TODO: Implement proper Three.js TextGeometry integration with font loading
async function buildTextGeometry(text: string, fontFamily: string, size: number, depth: number, bevel: boolean, bevelSize: number, bevelSegments: number, align: 'left'|'center'|'right', lineHeight: number) {
  try {
    // For now, we'll use a default font - in production you'd want to load actual font files
    // Three.js fonts are JSON files converted from TTF/OTF fonts using typeface.js
    
    // Create a simple fallback geometry using basic shapes
    // This is a placeholder until proper font loading is implemented
    const lines = text.split(/\n/);
    const vertices: any[] = [];
    const faces: any[] = [];

    const addQuad = (baseId: number, vIdx: number[]) => {
      const [a,b,c,d] = vIdx.map(i => vertices[i].id);
      faces.push(createFace([a,b,c,d], [vec2(0,0), vec2(1,0), vec2(1,1), vec2(0,1)]));
    };

    let cursorY = 0;
    const charWidth = size * 0.6; // approximate character width
    const depthZ = depth;

    lines.forEach((line) => {
      const lineWidth = line.length * charWidth;
      let offsetX = 0;
      if (align === 'center') offsetX = -lineWidth/2;
      else if (align === 'right') offsetX = -lineWidth;
      let cursorX = offsetX;
      
      for (let ci=0; ci<line.length; ci++) {
        const ch = line[ci];
        if (ch === ' ') {
          cursorX += charWidth;
          continue;
        }
        
        const w = charWidth;
        const h = size;
        const x0 = cursorX;
        const x1 = cursorX + w;
        const y0 = -cursorY;
        const y1 = -cursorY - h;
        
        // Create extruded character geometry (simple box per character)
        // front face (z=0)
        const v0 = createVertex(vec3(x0,y1,0), vec3(0,0,1), vec2(0,0));
        const v1 = createVertex(vec3(x1,y1,0), vec3(0,0,1), vec2(1,0));
        const v2 = createVertex(vec3(x1,y0,0), vec3(0,0,1), vec2(1,1));
        const v3 = createVertex(vec3(x0,y0,0), vec3(0,0,1), vec2(0,1));
        // back face (z=-depth)
        const v4 = createVertex(vec3(x0,y1,-depthZ), vec3(0,0,-1), vec2(0,0));
        const v5 = createVertex(vec3(x1,y1,-depthZ), vec3(0,0,-1), vec2(1,0));
        const v6 = createVertex(vec3(x1,y0,-depthZ), vec3(0,0,-1), vec2(1,1));
        const v7 = createVertex(vec3(x0,y0,-depthZ), vec3(0,0,-1), vec2(0,1));
        
        const base = vertices.length;
        vertices.push(v0,v1,v2,v3,v4,v5,v6,v7);
        
        // faces: front, back, sides (as quads)
        addQuad(base, [base+0,base+1,base+2,base+3]); // front
        addQuad(base, [base+7,base+6,base+5,base+4]); // back (reverse order)
        addQuad(base, [base+0,base+3,base+7,base+4]); // left
        addQuad(base, [base+1,base+5,base+6,base+2]); // right
        addQuad(base, [base+3,base+2,base+6,base+7]); // top
        addQuad(base, [base+0,base+4,base+5,base+1]); // bottom
        
        cursorX += w;
      }
      cursorY += size * lineHeight;
    });

    return { vertices, faces };
  } catch (error) {
    console.warn('Text geometry generation failed, using fallback:', error);
    // Return a simple fallback
    const vertices = [
      createVertex(vec3(-0.5, -0.25, 0), vec3(0,0,1), vec2(0,0)),
      createVertex(vec3(0.5, -0.25, 0), vec3(0,0,1), vec2(1,0)),
      createVertex(vec3(0.5, 0.25, 0), vec3(0,0,1), vec2(1,1)),
      createVertex(vec3(-0.5, 0.25, 0), vec3(0,0,1), vec2(0,1)),
    ];
    const faces = [createFace([vertices[0].id, vertices[1].id, vertices[2].id, vertices[3].id], [vec2(0,0), vec2(1,0), vec2(1,1), vec2(0,1)])];
    return { vertices, faces };
  }
}

interface TextState {
  texts: Record<string, Text3D>;
}

interface TextActions {
  createText: (params?: Partial<Omit<Text3D, 'id' | 'meshId' | 'rasterized'>>) => { textId: string; objectId: string };
  updateText: (textId: string, updater: (t: Text3D) => void) => void;
  rasterizeText: (textId: string) => void; // converts owning object to mesh type
  removeText: (textId: string) => void;
}

type TextStore = TextState & TextActions;

export const useTextStore = create<TextStore>()(immer((set) => ({
  texts: {},
  createText: (params = {}) => {
    const geom = useGeometryStore.getState();
    const scene = useSceneStore.getState();
    const id = nanoid();
    const defaults: Omit<Text3D, 'id' | 'meshId' | 'rasterized'> = {
      text: 'Text',
      fontFamily: 'Inter',
      size: 0.5,
      depth: 0.1,
      bevelEnabled: false,
      bevelSize: 0.02,
      bevelSegments: 2,
      curveSegments: 4,
      align: 'left',
      lineHeight: 1.2,
    } as any;
    const partial = { ...defaults, ...params } as any;
    
    // Create mesh asynchronously
    buildTextGeometry(partial.text, partial.fontFamily, partial.size, partial.depth, partial.bevelEnabled, partial.bevelSize, partial.bevelSegments, partial.align, partial.lineHeight)
      .then(({ vertices, faces }) => {
        const mesh = createMeshFromGeometry('Text', vertices, faces, { shading: 'flat' });
        geom.addMesh(mesh);
        
        // Update the text resource with the mesh ID
        set((state) => {
          if (state.texts[id]) {
            state.texts[id].meshId = mesh.id;
          }
        });
        
        // Update the scene object with the mesh ID
        const obj = Object.values(scene.objects).find(o => (o as any).textId === id);
        if (obj) {
          scene.updateObject(obj.id, (o: any) => { o.meshId = mesh.id; });
        }
      });
    
    const textRes: Text3D = { id, meshId: '', rasterized: false, ...partial };
    set((state) => { state.texts[id] = textRes; });
    
    // Create scene object referencing text
    const object = {
      id: nanoid(),
      name: partial.text.substring(0, 16) || 'Text',
      type: 'text',
      parentId: null,
      children: [],
      transform: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
      visible: true,
      locked: false,
      render: true,
      textId: id,
      meshId: '', // Will be updated once geometry is built
    } as any;
    scene.addObject(object);
    scene.selectObject(object.id);
    return { textId: id, objectId: object.id };
  },
  updateText: (textId, updater) => {
    set((state) => {
      const t = state.texts[textId];
      if (!t || t.rasterized) return;
      updater(t);
      
      // Rebuild geometry asynchronously
      buildTextGeometry(t.text, t.fontFamily, t.size, t.depth, t.bevelEnabled, t.bevelSize, t.bevelSegments, t.align, t.lineHeight)
        .then(({ vertices, faces }) => {
          const geom = useGeometryStore.getState();
          const oldMeshId = t.meshId;
          if (oldMeshId) {
            geom.replaceGeometry(oldMeshId, vertices, faces);
            const mesh = geom.meshes.get(oldMeshId);
            if (mesh) {
              mesh.name = t.text.substring(0, 16) || 'Text';
            }
          }
        });
      
      // Update scene object name
      const scene = useSceneStore.getState();
      const obj = Object.values(scene.objects).find(o => (o as any).textId === textId);
      if (obj) scene.updateObject(obj.id, (o: any) => { o.name = t.text.substring(0, 16) || 'Text'; });
    });
  },
  rasterizeText: (textId) => {
    const scene = useSceneStore.getState();
    set((state) => {
      const t = state.texts[textId];
      if (!t || t.rasterized) return;
      
      // Convert owning object to mesh type
      const obj = Object.values(scene.objects).find(o => (o as any).textId === textId);
      if (obj) {
        scene.updateObject(obj.id, (o: any) => { o.type = 'mesh'; delete o.textId; });
      }
      t.rasterized = true;
    });
  },
  removeText: (textId) => {
    set((state) => { delete state.texts[textId]; });
  },
})));

export const useTextResource = (textId: string) => useTextStore((s) => s.texts[textId]);
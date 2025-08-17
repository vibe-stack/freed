import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { subscribeWithSelector } from 'zustand/middleware';
import { useMemo } from 'react';
import { SceneObject, Transform, Light, LightType, CameraResource, CameraType } from '../types/geometry';
import { vec3 } from '../utils/geometry';
import { nanoid } from 'nanoid';

interface SceneState {
  objects: Record<string, SceneObject>;
  rootObjects: string[]; // Objects with parentId === null
  selectedObjectId: string | null;
  lights: Record<string, Light>;
  cameras: Record<string, CameraResource>;
}

interface SceneActions {
  addObject: (object: SceneObject) => void;
  removeObject: (objectId: string) => void;
  updateObject: (objectId: string, updater: (object: SceneObject) => void) => void;
  selectObject: (objectId: string | null) => void;
  setParent: (childId: string, parentId: string | null) => void;
  moveObject: (objectId: string, newParentId: string | null, index?: number) => void;
  reset: () => void;
  
  // Transform operations
  setTransform: (objectId: string, transform: Partial<Transform>) => void;
  translateObject: (objectId: string, delta: [number, number, number]) => void;
  rotateObject: (objectId: string, delta: [number, number, number]) => void;
  scaleObject: (objectId: string, delta: [number, number, number]) => void;
  
  // Visibility and locking
  setVisible: (objectId: string, visible: boolean) => void;
  setLocked: (objectId: string, locked: boolean) => void;
  setRender: (objectId: string, render: boolean) => void;
  setVisibleRecursive: (objectId: string, visible: boolean) => void;
  setLockedRecursive: (objectId: string, locked: boolean) => void;
  setRenderRecursive: (objectId: string, render: boolean) => void;
  
  // Utility functions
  createMeshObject: (name: string, meshId: string) => string;
  createGroupObject: (name: string) => string;
  createLightObject: (name: string, type: LightType) => string;
  createCameraObject: (name: string, type: CameraType) => string;
  groupObjects: (objectIds: string[], name?: string) => string | null;
  ungroupObject: (groupId: string) => void;
  getObject: (objectId: string) => SceneObject | null;
  getChildren: (parentId: string | null) => SceneObject[];
  getHierarchy: () => SceneObject[];
  getSelectedObject: () => SceneObject | null;
  getDescendants: (objectId: string) => string[];
}

type SceneStore = SceneState & SceneActions;

export const useSceneStore = create<SceneStore>()(
  subscribeWithSelector(
    immer((set, get) => ({
      // Initial state
      objects: {},
      rootObjects: [],
      selectedObjectId: null,
  lights: {},
  cameras: {},
      
      // Actions
      addObject: (object: SceneObject) => {
        set((state) => {
          state.objects[object.id] = object;
          
          if (object.parentId === null) {
            state.rootObjects.push(object.id);
          } else {
            const parent = state.objects[object.parentId];
            if (parent) {
              parent.children.push(object.id);
            }
          }
        });
      },
      
      removeObject: (objectId: string) => {
        set((state) => {
          const object = state.objects[objectId];
          if (!object) return;
          
          // Remove from parent's children or root objects
          if (object.parentId === null) {
            const index = state.rootObjects.indexOf(objectId);
            if (index >= 0) {
              state.rootObjects.splice(index, 1);
            }
          } else {
            const parent = state.objects[object.parentId];
            if (parent) {
              const index = parent.children.indexOf(objectId);
              if (index >= 0) {
                parent.children.splice(index, 1);
              }
            }
          }
          
          // Recursively remove children
          const removeRecursive = (id: string) => {
            const obj = state.objects[id];
            if (obj) {
              // Clean up component references
              if (obj.lightId) delete state.lights[obj.lightId];
              if (obj.cameraId) delete state.cameras[obj.cameraId];
              obj.children.forEach((childId: string) => removeRecursive(childId));
              delete state.objects[id];
            }
          };
          
          removeRecursive(objectId);
          
          // Clear selection if this object was selected
          if (state.selectedObjectId === objectId) {
            state.selectedObjectId = null;
          }
        });
      },
      
      updateObject: (objectId: string, updater: (object: SceneObject) => void) => {
        set((state) => {
          const object = state.objects[objectId];
          if (object) {
            updater(object);
          }
        });
      },
      
      selectObject: (objectId: string | null) => {
        set((state) => {
          state.selectedObjectId = objectId;
        });
      },
      
      setParent: (childId: string, parentId: string | null) => {
        set((state) => {
          const child = state.objects[childId];
          if (!child) return;
          
          // Remove from old parent
          if (child.parentId === null) {
            const index = state.rootObjects.indexOf(childId);
            if (index >= 0) {
              state.rootObjects.splice(index, 1);
            }
          } else {
            const oldParent = state.objects[child.parentId];
            if (oldParent) {
              const index = oldParent.children.indexOf(childId);
              if (index >= 0) {
                oldParent.children.splice(index, 1);
              }
            }
          }
          
          // Add to new parent
          child.parentId = parentId;
          if (parentId === null) {
            state.rootObjects.push(childId);
          } else {
            const newParent = state.objects[parentId];
            if (newParent) {
              newParent.children.push(childId);
            }
          }
        });
      },
      
      moveObject: (objectId: string, newParentId: string | null, index?: number) => {
        // First set the parent
        get().setParent(objectId, newParentId);
        
        // Then move to specific index if provided
        if (index !== undefined) {
          set((state) => {
            if (newParentId === null) {
              const currentIndex = state.rootObjects.indexOf(objectId);
              if (currentIndex >= 0) {
                state.rootObjects.splice(currentIndex, 1);
                state.rootObjects.splice(Math.min(index, state.rootObjects.length), 0, objectId);
              }
            } else {
              const parent = state.objects[newParentId];
              if (parent) {
                const currentIndex = parent.children.indexOf(objectId);
                if (currentIndex >= 0) {
                  parent.children.splice(currentIndex, 1);
                  parent.children.splice(Math.min(index, parent.children.length), 0, objectId);
                }
              }
            }
          });
        }
      },
      
      // Transform operations
      setTransform: (objectId: string, transform: Partial<Transform>) => {
        set((state) => {
          const object = state.objects[objectId];
          if (object) {
            Object.assign(object.transform, transform);
          }
        });
      },
      
      translateObject: (objectId: string, delta: [number, number, number]) => {
        set((state) => {
          const object = state.objects[objectId];
          if (object) {
            object.transform.position.x += delta[0];
            object.transform.position.y += delta[1];
            object.transform.position.z += delta[2];
          }
        });
      },
      
      rotateObject: (objectId: string, delta: [number, number, number]) => {
        set((state) => {
          const object = state.objects[objectId];
          if (object) {
            object.transform.rotation.x += delta[0];
            object.transform.rotation.y += delta[1];
            object.transform.rotation.z += delta[2];
          }
        });
      },
      
      scaleObject: (objectId: string, delta: [number, number, number]) => {
        set((state) => {
          const object = state.objects[objectId];
          if (object) {
            object.transform.scale.x *= delta[0];
            object.transform.scale.y *= delta[1];
            object.transform.scale.z *= delta[2];
          }
        });
      },
      
      // Visibility and locking
      setVisible: (objectId: string, visible: boolean) => {
        set((state) => {
          const object = state.objects[objectId];
          if (object) {
            object.visible = visible;
          }
        });
      },
      
      setLocked: (objectId: string, locked: boolean) => {
        set((state) => {
          const object = state.objects[objectId];
          if (object) {
            object.locked = locked;
          }
        });
      },
      setRender: (objectId: string, render: boolean) => {
        set((state) => {
          const object = state.objects[objectId];
          if (object) {
            object.render = render;
          }
        });
      },
      setVisibleRecursive: (objectId: string, visible: boolean) => {
        set((state) => {
          const update = (id: string) => {
            const obj = state.objects[id];
            if (!obj) return;
            obj.visible = visible;
            obj.children.forEach(update);
          };
          update(objectId);
        });
      },
      setLockedRecursive: (objectId: string, locked: boolean) => {
        set((state) => {
          const update = (id: string) => {
            const obj = state.objects[id];
            if (!obj) return;
            obj.locked = locked;
            obj.children.forEach(update);
          };
          update(objectId);
        });
      },
      setRenderRecursive: (objectId: string, render: boolean) => {
        set((state) => {
          const update = (id: string) => {
            const obj = state.objects[id];
            if (!obj) return;
            obj.render = render;
            obj.children.forEach(update);
          };
          update(objectId);
        });
      },
      
      // Utility functions
      createMeshObject: (name: string, meshId: string) => {
        const object: SceneObject = {
          id: nanoid(),
          name,
          type: 'mesh',
          parentId: null,
          children: [],
          transform: {
            position: vec3(0, 0, 0),
            rotation: vec3(0, 0, 0),
            scale: vec3(1, 1, 1),
          },
          visible: true,
          locked: false,
          render: true,
          meshId,
        };
        
        get().addObject(object);
        return object.id;
      },
      createGroupObject: (name: string) => {
        const object: SceneObject = {
          id: nanoid(),
          name,
          type: 'group',
          parentId: null,
          children: [],
          transform: {
            position: vec3(0, 0, 0),
            rotation: vec3(0, 0, 0),
            scale: vec3(1, 1, 1),
          },
          visible: true,
          locked: false,
          render: true,
        };
        get().addObject(object);
        return object.id;
      },
      createLightObject: (name: string, type: LightType) => {
        const id = nanoid();
        const light: Light = {
          id,
          type,
          color: vec3(1, 1, 1),
          intensity: 1,
          ...(type === 'spot' ? { angle: Math.PI / 6, penumbra: 0.2, distance: 0, decay: 2 } : {}),
          ...(type === 'rectarea' ? { width: 1, height: 1 } : {}),
          ...(type === 'point' ? { distance: 0, decay: 2 } : {}),
        };
        set((state) => { state.lights[id] = light; });
        const object: SceneObject = {
          id: nanoid(),
          name,
          type: 'light',
          parentId: null,
          children: [],
          transform: {
            position: vec3(0, 2, 2),
            rotation: vec3(0, 0, 0),
            scale: vec3(1, 1, 1),
          },
          visible: true,
          locked: false,
          render: true,
          lightId: id,
        };
        get().addObject(object);
        return object.id;
      },
      createCameraObject: (name: string, type: CameraType) => {
        const id = nanoid();
        const cam: CameraResource = {
          id,
          type,
          ...(type === 'perspective' ? { fov: 50 } : { left: -1, right: 1, top: 1, bottom: -1 }),
          near: 0.1,
          far: 1000,
        };
        set((state) => { state.cameras[id] = cam; });
        const object: SceneObject = {
          id: nanoid(),
          name,
          type: 'camera',
          parentId: null,
          children: [],
          transform: {
            position: vec3(0, 2.5, 5),
            rotation: vec3(0, 0, 0),
            scale: vec3(1, 1, 1),
          },
          visible: true,
          locked: false,
          render: true,
          cameraId: id,
        };
        get().addObject(object);
        return object.id;
      },
      groupObjects: (objectIds: string[], name: string = 'Group') => {
        const state = get();
        if (objectIds.length === 0) return null;
        // Filter to only IDs that exist
        const ids = objectIds.filter((id) => !!state.objects[id]);
        if (ids.length === 0) return null;
        // Prevent grouping with hierarchical conflicts: keep only top-most selections
        const isDescendantOf = (a: string, b: string): boolean => {
          let cur = state.objects[a]?.parentId;
          while (cur) { if (cur === b) return true; cur = state.objects[cur]?.parentId || null; }
          return false;
        };
        const topLevel = ids.filter((id) => !ids.some((other) => other !== id && isDescendantOf(id, other)));
        // Determine common parent
        const parents = new Set(topLevel.map((id) => state.objects[id]?.parentId ?? null));
        const commonParent = parents.size === 1 ? topLevel.length > 0 ? (state.objects[topLevel[0]]?.parentId ?? null) : null : null;
        // Create group under common parent
        const groupId = get().createGroupObject(name);
        // Place group under common parent
        get().setParent(groupId, commonParent);
        // Move selected under group, preserving their order in their original parent where possible
        topLevel.forEach((cid) => get().setParent(cid, groupId));
        return groupId;
      },
      ungroupObject: (groupId: string) => {
        const state = get();
        const group = state.objects[groupId];
        if (!group || group.type !== 'group') return;
        const parentId = group.parentId;
        const children = [...group.children];
        // Move children to group's parent
        children.forEach((cid) => get().setParent(cid, parentId));
        // Remove the group
        get().removeObject(groupId);
      },
      
      getObject: (objectId: string) => {
        return get().objects[objectId] || null;
      },
      
      getChildren: (parentId: string | null) => {
        const state = get();
        const childIds = parentId === null ? state.rootObjects : state.objects[parentId]?.children || [];
        return childIds.map(id => state.objects[id]).filter(Boolean) as SceneObject[];
      },
      
      getHierarchy: () => {
        const state = get();
        const result: SceneObject[] = [];
        
        const addWithChildren = (objectId: string, depth: number = 0) => {
          const object = state.objects[objectId];
          if (object) {
            result.push({ ...object });
            object.children.forEach(childId => addWithChildren(childId, depth + 1));
          }
        };
        
        state.rootObjects.forEach(id => addWithChildren(id));
        return result;
      },
      
      getSelectedObject: () => {
        const state = get();
        return state.selectedObjectId ? state.objects[state.selectedObjectId] || null : null;
      },
      getDescendants: (objectId: string) => {
        const state = get();
        const result: string[] = [];
        const add = (id: string) => {
          const obj = state.objects[id];
          if (!obj) return;
          obj.children.forEach((cid) => {
            result.push(cid);
            add(cid);
          });
        };
        add(objectId);
        return result;
      },
      reset: () => {
        set((state) => {
          state.objects = {};
          state.rootObjects = [];
          state.selectedObjectId = null;
          state.lights = {};
          state.cameras = {};
        });
      },
    }))
  )
);

// Selector hooks for optimized re-renders
export const useSceneObjects = () => {
  const objects = useSceneStore((state) => state.objects);
  return useMemo(() => Object.values(objects), [objects]);
};

export const useRootObjects = () => {
  const rootObjects = useSceneStore((state) => state.rootObjects);
  const objects = useSceneStore((state) => state.objects);
  return useMemo(() => {
    return rootObjects.map(id => objects[id]).filter(Boolean) as SceneObject[];
  }, [rootObjects, objects]);
};

export const useSelectedObject = () => {
  const selectedObjectId = useSceneStore((state) => state.selectedObjectId);
  const objects = useSceneStore((state) => state.objects);
  return useMemo(() => 
    selectedObjectId ? objects[selectedObjectId] || null : null,
    [selectedObjectId, objects]
  );
};

export const useSelectedObjectId = () => useSceneStore((state) => state.selectedObjectId);

export const useLight = (lightId: string) => useSceneStore((s) => s.lights[lightId]);
export const useCameraResource = (cameraId: string) => useSceneStore((s) => s.cameras[cameraId]);

export const useSceneHierarchy = () => {
  const rootObjects = useSceneStore((state) => state.rootObjects);
  const objects = useSceneStore((state) => state.objects);
  return useMemo(() => {
    const result: SceneObject[] = [];
    
    const addWithChildren = (objectId: string) => {
      const object = objects[objectId];
      if (object) {
        result.push({ ...object });
        object.children.forEach(childId => addWithChildren(childId));
      }
    };
    
    rootObjects.forEach(id => addWithChildren(id));
    return result;
  }, [rootObjects, objects]);
};

import { useMemo } from 'react';
import { applyModifiersToMesh } from '@/utils/modifiers';

type UseDisplayMeshParams = {
  mesh?: any;
  modifiers: any[];
  viewMode: string;
  editMeshId?: string | null;
  objMeshId?: string | null;
};

export default function useDisplayMesh({ mesh, modifiers, viewMode, editMeshId, objMeshId }: UseDisplayMeshParams) {
  return useMemo(() => {
    if (!mesh) return undefined;
    const editingThis = viewMode === 'edit' && objMeshId && objMeshId === editMeshId;
    if (editingThis) return mesh;
    const activeMods = modifiers.filter((m) => m.enabled);
    if (activeMods.length === 0) return mesh;
    try {
      return applyModifiersToMesh(mesh, activeMods);
    } catch {
      return mesh;
    }
  }, [mesh, modifiers, viewMode, editMeshId, objMeshId]);
}

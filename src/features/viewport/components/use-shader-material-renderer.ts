import { useMemo } from 'react';
import { MeshStandardMaterial, Color, DoubleSide, Material } from 'three/webgpu';
import { useMaterialNodes } from '@/features/materials/hooks/use-material-nodes';
// Terrain maps are applied in TerrainView; this hook only builds the base material.

type MeshRes = any;

type Params = {
  displayMesh?: MeshRes | null;
  shading: string;
  isSelected: boolean;
  materials: Map<string, any> | undefined;
};

export function useShaderMaterialRenderer({ displayMesh, shading, isSelected, materials }: Params): Material {
  // Get node material (hook must be called at top-level)
  const nodeMaterial = useMaterialNodes(shading === 'material' ? displayMesh?.materialId : undefined) as unknown as Material | undefined;
  // no terrain coupling here

  // Build a standard material or prefer a node material when available.
  const mat = useMemo<Material>(() => {
    // Default material params
    let color = new Color(0.8, 0.8, 0.85);
    let roughness = 0.8;
    let metalness = 0.05;
    let emissive = new Color(0, 0, 0);
    let emissiveIntensity = 1;

    if (shading === 'material' && displayMesh?.materialId) {
      const matRes = materials?.get(displayMesh.materialId);
      if (matRes) {
        color = new Color(matRes.color.x, matRes.color.y, matRes.color.z);
        roughness = matRes.roughness;
        metalness = matRes.metalness;
        emissive = new Color(matRes.emissive.x, matRes.emissive.y, matRes.emissive.z);
        emissiveIntensity = matRes.emissiveIntensity ?? 1;
      }
    }

    if (isSelected && shading !== 'material') {
      color = new Color('#ff9900');
    }

    const std = new MeshStandardMaterial({
      color,
      roughness,
      metalness,
      emissive,
      emissiveIntensity,
      wireframe: shading === 'wireframe',
      side: DoubleSide,
      flatShading: (displayMesh?.shading ?? 'flat') === 'flat',
      shadowSide: 1,
    });

    if (nodeMaterial) {
      try {
        (nodeMaterial as any).wireframe = shading === 'wireframe';
        (nodeMaterial as any).flatShading = (displayMesh?.shading ?? 'flat') === 'flat';
        (nodeMaterial as any).side = DoubleSide;
        (nodeMaterial as any).emissiveIntensity = emissiveIntensity;
      } catch {
        // ignore if node material doesn't accept these
      }
    }

    return (nodeMaterial ?? std) as Material;
  }, [displayMesh, shading, isSelected, materials, nodeMaterial]);

  return mat;
}

export default useShaderMaterialRenderer;

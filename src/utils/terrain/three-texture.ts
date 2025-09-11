import * as THREE from 'three/webgpu';

export function createNormalDataTexture(data: Float32Array, width: number, height: number): THREE.DataTexture {
  const tex = new (THREE as any).DataTexture(data, width, height, (THREE as any).RGBAFormat, (THREE as any).FloatType);
  // Normal maps are linear data
  (tex as any).colorSpace = (THREE as any).LinearSRGBColorSpace ?? (THREE as any).LinearSRGBColorSpace;
  (tex as any).flipY = false;
  (tex as any).needsUpdate = true;
  // Avoid mipmapping artifacts on height-derived normals
  (tex as any).generateMipmaps = true;
  (tex as any).minFilter = (THREE as any).LinearMipmapLinearFilter ?? (THREE as any).LinearFilter;
  (tex as any).magFilter = (THREE as any).LinearFilter;
  return tex as THREE.DataTexture;
}

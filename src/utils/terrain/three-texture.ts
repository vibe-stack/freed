import * as THREE from 'three/webgpu';

export function createNormalDataTexture(data: Float32Array, width: number, height: number): THREE.DataTexture {
  // Pack [-1,1] normals into [0,1] RGB
  const packed = new Float32Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const nx = data[i * 4 + 0];
    const ny = data[i * 4 + 1];
    const nz = data[i * 4 + 2];
    packed[i * 4 + 0] = nx * 0.5 + 0.5;
    packed[i * 4 + 1] = ny * 0.5 + 0.5;
    packed[i * 4 + 2] = nz * 0.5 + 0.5;
    packed[i * 4 + 3] = 1.0;
  }
  const tex = new (THREE as any).DataTexture(packed, width, height, (THREE as any).RGBAFormat, (THREE as any).FloatType);
  // Normal maps are linear data
  (tex as any).colorSpace = (THREE as any).LinearSRGBColorSpace ?? (THREE as any).NoColorSpace;
  (tex as any).flipY = false;
  (tex as any).needsUpdate = true;
  // Avoid mipmapping artifacts on height-derived normals
  (tex as any).generateMipmaps = false;
  (tex as any).minFilter = (THREE as any).LinearFilter;
  (tex as any).magFilter = (THREE as any).LinearFilter;
  return tex as THREE.DataTexture;
}

export function createHeightDataTexture(data: Float32Array, width: number, height: number): THREE.DataTexture {
  // Pack height into R channel; keep RGBA for alignment
  const rgba = new Float32Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const h = data[i];
    rgba[i * 4 + 0] = h;
    rgba[i * 4 + 1] = h;
    rgba[i * 4 + 2] = h;
    rgba[i * 4 + 3] = 1;
  }
  const tex = new (THREE as any).DataTexture(rgba, width, height, (THREE as any).RGBAFormat, (THREE as any).FloatType);
  (tex as any).colorSpace = (THREE as any).LinearSRGBColorSpace ?? (THREE as any).NoColorSpace;
  (tex as any).flipY = false;
  (tex as any).needsUpdate = true;
  (tex as any).generateMipmaps = false;
  (tex as any).minFilter = (THREE as any).LinearFilter;
  (tex as any).magFilter = (THREE as any).LinearFilter;
  return tex as THREE.DataTexture;
}

// Minimal shims so TypeScript doesn't complain about WebGPU-related dynamic properties we access on three's WebGPURenderer
// These are intentionally loose (any) – the runtime objects are provided by three / browser WebGPU.
// REMOVE once upstream typings expose these.

declare module 'three/webgpu' {
  interface WebGPURenderer {
    device?: GPUDevice; // three r165+ might expose internal device
    adapter?: GPUAdapter;
  }
}

// Global WebGPU types are provided by lib.dom.d.ts – this file only helps with optional three renderer fields.
export {};

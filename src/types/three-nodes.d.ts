declare module 'three/nodes' {
  export const MeshStandardNodeMaterial: any;
  export const float: (...args: any[]) => any;
  export const vec3: (...args: any[]) => any;
  export const uv: (...args: any[]) => any;
  export const normalWorld: any;
  export const add: (...args: any[]) => any;
  export const mul: (...args: any[]) => any;
  export const mix: (...args: any[]) => any;
}

// Minimal declarations for TSL bloom and pass
// declare module 'three/tsl' {
//   export const pass: (...args: any[]) => any;
// }

declare module 'three/addons/tsl/display/BloomNode.js' {
  export const bloom: (...args: any[]) => any;
}

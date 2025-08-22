// Shader node graph types for TSL-based materials

export type SocketType = 'float' | 'vec2' | 'vec3' | 'vec4';

export type ShaderNodeType =
  | 'input' // scene/builtins provider (uv, normal)
  | 'output' // material outputs (color, roughness, metalness, emissive, emissiveIntensity)
  | 'const-float'
  | 'const-color' // vec3
  | 'uv' // vec2
  | 'normal' // vec3 (world)
  | 'add'
  | 'mul'
  | 'mix';

export interface ShaderNodeBase {
  id: string;
  type: ShaderNodeType;
  position: { x: number; y: number };
  hidden: boolean;
}

export interface ConstFloatNode extends ShaderNodeBase {
  type: 'const-float';
  data: { value: number };
}

export interface ConstColorNode extends ShaderNodeBase {
  type: 'const-color';
  data: { r: number; g: number; b: number };
}

export interface MixNode extends ShaderNodeBase {
  type: 'mix';
}

export interface BinaryMathNode extends ShaderNodeBase {
  type: 'add' | 'mul';
}

export interface InputNode extends ShaderNodeBase {
  type: 'input';
}

export interface OutputNode extends ShaderNodeBase {
  type: 'output';
}

export type ShaderNode =
  | ConstFloatNode
  | ConstColorNode
  | MixNode
  | BinaryMathNode
  | InputNode
  | OutputNode
  | ShaderNodeBase; // uv, normal minimal base

export interface ShaderEdge {
  id: string;
  source: string; // node id
  sourceHandle: string; // output socket key
  target: string; // node id
  targetHandle: string; // input socket key
}

export interface ShaderGraph {
  materialId: string;
  nodes: ShaderNode[];
  edges: ShaderEdge[];
}

// Socket catalogs for each node type
export const NodeInputs: Record<ShaderNodeType, Record<string, SocketType>> = {
  'input': {},
  'output': {
    color: 'vec3',
    roughness: 'float',
    metalness: 'float',
    emissive: 'vec3',
    emissiveIntensity: 'float',
  },
  'const-float': {},
  'const-color': {},
  'uv': {},
  'normal': {},
  'add': { a: 'float', b: 'float' },
  'mul': { a: 'float', b: 'float' },
  'mix': { a: 'float', b: 'float', t: 'float' },
};

export const NodeOutputs: Record<ShaderNodeType, Record<string, SocketType>> = {
  'input': { uv: 'vec2', normal: 'vec3' },
  'output': {},
  'const-float': { out: 'float' },
  'const-color': { out: 'vec3' },
  'uv': { out: 'vec2' },
  'normal': { out: 'vec3' },
  'add': { out: 'float' },
  'mul': { out: 'float' },
  'mix': { out: 'float' },
};

export function isCompatible(outT: SocketType, inT: SocketType) {
  if (outT === inT) return true;
  // allow float -> vec3 splat for quick color controls
  if (outT === 'float' && inT === 'vec3') return true;
  return false;
}

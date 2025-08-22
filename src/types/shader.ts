// Shader node graph types for TSL-based materials

export type SocketType = 'float' | 'vec2' | 'vec3' | 'vec4' | 'bool' | 'mat3' | 'mat4';

export type ShaderNodeType =
  | 'input' // scene/builtins provider (uv, normal)
  | 'output' // material outputs (color, roughness, metalness, emissive, emissiveIntensity)
  | 'const-float'
  | 'const-color' // vec3
  | 'uv' // vec2
  | 'normal' // vec3 (world)
  | 'add'
  | 'sub'
  | 'mul'
  | 'div'
  | 'assign'
  | 'mod'
  | 'equal'
  | 'notEqual'
  | 'lessThan'
  | 'greaterThan'
  | 'lessThanEqual'
  | 'greaterThanEqual'
  | 'and'
  | 'or'
  | 'not'
  | 'xor'
  | 'bitAnd'
  | 'bitNot'
  | 'bitOr'
  | 'bitXor'
  | 'shiftLeft'
  | 'shiftRight'
  | 'mix'
  // Oscillators
  | 'oscSine'
  | 'oscSquare'
  | 'oscTriangle'
  | 'oscSawtooth'
  // Model builtins
  | 'modelDirection'
  | 'modelViewMatrix'
  | 'modelNormalMatrix'
  | 'modelWorldMatrix'
  | 'modelPosition'
  | 'modelScale'
  | 'modelViewPosition'
  | 'modelWorldMatrixInverse'
  | 'highpModelViewMatrix'
  | 'highpModelNormalViewMatrix';

export interface ShaderNodeBase {
  id: string;
  type: ShaderNodeType;
  position: { x: number; y: number };
  hidden: boolean;
  data: Record<string, any>;
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
  type: 'add' | 'sub' | 'mul' | 'div' | 'mod';
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
  'sub': { a: 'float', b: 'float' },
  'mul': { a: 'float', b: 'float' },
  'div': { a: 'float', b: 'float' },
  'assign': { a: 'float', b: 'float' },
  'mod': { a: 'float', b: 'float' },
  'equal': { a: 'float', b: 'float' },
  'notEqual': { a: 'float', b: 'float' },
  'lessThan': { a: 'float', b: 'float' },
  'greaterThan': { a: 'float', b: 'float' },
  'lessThanEqual': { a: 'float', b: 'float' },
  'greaterThanEqual': { a: 'float', b: 'float' },
  'and': { a: 'bool', b: 'bool' },
  'or': { a: 'bool', b: 'bool' },
  'not': { a: 'bool' },
  'xor': { a: 'bool', b: 'bool' },
  'bitAnd': { a: 'float', b: 'float' },
  'bitNot': { a: 'float' },
  'bitOr': { a: 'float', b: 'float' },
  'bitXor': { a: 'float', b: 'float' },
  'shiftLeft': { a: 'float', b: 'float' },
  'shiftRight': { a: 'float', b: 'float' },
  'mix': { a: 'float', b: 'float', t: 'float' },
  // oscillators have no inputs (use global timer)
  'oscSine': {},
  'oscSquare': {},
  'oscTriangle': {},
  'oscSawtooth': {},
  // model providers have no inputs
  'modelDirection': {},
  'modelViewMatrix': {},
  'modelNormalMatrix': {},
  'modelWorldMatrix': {},
  'modelPosition': {},
  'modelScale': {},
  'modelViewPosition': {},
  'modelWorldMatrixInverse': {},
  'highpModelViewMatrix': {},
  'highpModelNormalViewMatrix': {},
};

export const NodeOutputs: Record<ShaderNodeType, Record<string, SocketType>> = {
  'input': { uv: 'vec2', normal: 'vec3' },
  'output': {},
  'const-float': { out: 'float' },
  'const-color': { out: 'vec3' },
  'uv': { out: 'vec2' },
  'normal': { out: 'vec3' },
  'add': { out: 'float' },
  'sub': { out: 'float' },
  'mul': { out: 'float' },
  'div': { out: 'float' },
  'assign': { out: 'float' },
  'mod': { out: 'float' },
  'equal': { out: 'bool' },
  'notEqual': { out: 'bool' },
  'lessThan': { out: 'bool' },
  'greaterThan': { out: 'bool' },
  'lessThanEqual': { out: 'bool' },
  'greaterThanEqual': { out: 'bool' },
  'and': { out: 'bool' },
  'or': { out: 'bool' },
  'not': { out: 'bool' },
  'xor': { out: 'bool' },
  'bitAnd': { out: 'float' },
  'bitNot': { out: 'float' },
  'bitOr': { out: 'float' },
  'bitXor': { out: 'float' },
  'shiftLeft': { out: 'float' },
  'shiftRight': { out: 'float' },
  'mix': { out: 'float' },
  // oscillators
  'oscSine': { out: 'float' },
  'oscSquare': { out: 'float' },
  'oscTriangle': { out: 'float' },
  'oscSawtooth': { out: 'float' },
  // model
  'modelDirection': { out: 'vec3' },
  'modelViewMatrix': { out: 'mat4' },
  'modelNormalMatrix': { out: 'mat3' },
  'modelWorldMatrix': { out: 'mat4' },
  'modelPosition': { out: 'vec3' },
  'modelScale': { out: 'vec3' },
  'modelViewPosition': { out: 'vec3' },
  'modelWorldMatrixInverse': { out: 'mat4' },
  'highpModelViewMatrix': { out: 'mat4' },
  'highpModelNormalViewMatrix': { out: 'mat3' },
};

export function isCompatible(outT: SocketType, inT: SocketType) {
  if (outT === inT) return true;
  // allow float -> vec3 splat for quick color controls
  if (outT === 'float' && inT === 'vec3') return true;
  return false;
}

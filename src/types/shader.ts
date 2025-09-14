// Shader node graph types for TSL-based materials

export type SocketType = 'float' | 'vec2' | 'vec3' | 'vec4' | 'bool' | 'mat3' | 'mat4' | 'texture';

export type ShaderNodeType =
  | 'input' // scene/builtins provider (uv, normal)
  | 'output' // legacy standard output (back-compat)
  | 'output-standard' // standard PBR output
  | 'output-physical' // physical PBR output
  | 'output-phong' // phong output
  | 'output-toon' // toon output
  | 'const-float'
  | 'const-color' // vec3
  | 'texture' // texture sampler from uploaded file (outputs vec4)
  | 'normalMap' // builds a perturbed normal from a normal texture
  | 'uv' // vec2 (primary)
  | 'uv2' // vec2 (secondary)
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
  // Common math
  | 'abs' | 'floor' | 'ceil' | 'clamp' | 'saturate' | 'min' | 'max' | 'step' | 'smoothstep' | 'pow' | 'exp' | 'log' | 'sqrt' | 'sign' | 'fract' | 'length' | 'normalize' | 'dot' | 'cross' | 'distance'
  // Trig
  | 'sin' | 'cos' | 'tan' | 'asin' | 'acos' | 'atan'
  // Vectors and swizzles
  | 'vec2' | 'vec3' | 'vec4' | 'swizzle' | 'combine'
  | 'unpack'
  | 'uvScale' | 'uvTransform'
  // Oscillators
  | 'oscSine'
  | 'oscSquare'
  | 'oscTriangle'
  | 'oscSawtooth'
  // Attributes / camera / world
  | 'positionAttr' | 'normalAttr' | 'uvAttr' | 'viewPosition' | 'worldPosition' | 'cameraPosition'
  // Time
  | 'time' | 'timeSine' | 'timeCos' | 'animTime' | 'animFrame'
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
  | 'highpModelNormalViewMatrix'
  // Conditionals (ternary)
  | 'select'
  // Camera
  | 'cameraNear' | 'cameraFar' | 'cameraProjectionMatrix' | 'cameraProjectionMatrixInverse' | 'cameraViewMatrix' | 'cameraWorldMatrix' | 'cameraNormalMatrix'
  // Screen and Viewport
  | 'screenUV' | 'screenCoordinate' | 'screenSize'
  | 'viewportUV' | 'viewport' | 'viewportCoordinate' | 'viewportSize'
  // UV utils (no textures)
  | 'matcapUV' | 'rotateUV' | 'spherizeUV' | 'spritesheetUV' | 'equirectUV'
  // Interpolation
  | 'remap' | 'remapClamp'
  // Random
  | 'hash'
  // Rotate
  | 'rotate'
  // Blend Modes
  | 'blendBurn' | 'blendDodge' | 'blendOverlay' | 'blendScreen' | 'blendColor'
  // Packing
  | 'directionToColor' | 'colorToDirection'
  // Extra math/optics
  | 'reflect' | 'refract' | 'round' | 'trunc' | 'inverseSqrt' | 'degrees' | 'radians' | 'exp2' | 'log2' | 'lengthSq' | 'oneMinus' | 'pow2' | 'pow3' | 'pow4'
  // Debug/visualization helpers
  | 'debugHeight' | 'debugWorldY' | 'debugLocalY'
  // Direct vertex attribute access
  | 'vertexPosition' | 'vertexY'
  // Axis testing
  | 'testAllAxes';

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
  'output-standard': {
    color: 'vec3',
    roughness: 'float',
    metalness: 'float',
    emissive: 'vec3',
    emissiveIntensity: 'float',
  // NodeMaterial base inputs
  opacity: 'float',
  alphaTest: 'float',
  normal: 'vec3',
  position: 'vec3',
  depth: 'float',
  env: 'vec3',
  ao: 'float',
  },
  'output-physical': {
    color: 'vec3',
    roughness: 'float',
    metalness: 'float',
    emissive: 'vec3',
    emissiveIntensity: 'float',
  // NodeMaterial base inputs
  opacity: 'float',
  alphaTest: 'float',
  normal: 'vec3',
  position: 'vec3',
  depth: 'float',
  env: 'vec3',
  ao: 'float',
  // Physical-specific
  clearcoat: 'float',
  clearcoatRoughness: 'float',
  clearcoatNormal: 'vec3',
  sheen: 'vec3',
  iridescence: 'float',
  iridescenceIOR: 'float',
  iridescenceThickness: 'float',
  specularIntensity: 'float',
  specularColor: 'vec3',
  ior: 'float',
  transmission: 'float',
  thickness: 'float',
  attenuationDistance: 'float',
  attenuationColor: 'vec3',
  dispersion: 'float',
  anisotropy: 'vec2',
  },
  'output-phong': {
    color: 'vec3',
    emissive: 'vec3',
    emissiveIntensity: 'float',
    // NodeMaterial base inputs
    opacity: 'float',
    alphaTest: 'float',
    normal: 'vec3',
    position: 'vec3',
    depth: 'float',
    env: 'vec3',
    ao: 'float',
    // Phong specific
    shininess: 'float',
    specular: 'vec3',
  },
  'output-toon': {
    color: 'vec3',
    emissive: 'vec3',
    emissiveIntensity: 'float',
    // NodeMaterial base inputs
    opacity: 'float',
    alphaTest: 'float',
    normal: 'vec3',
    position: 'vec3',
    depth: 'float',
    env: 'vec3',
    ao: 'float',
  },
  'const-float': {},
  'const-color': {},
  'texture': { uv: 'vec2' },
  'uv': {},
  'uv2': {},
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
  // Mix is typed as vec4 to allow generic mixing of floats/vec2/vec3 via compatibility rules;
  // output is declared as vec4 (downcasts allowed when connecting to vec3 inputs like color)
  'mix': { a: 'vec4', b: 'vec4', t: 'float' },
  // common math
  'abs': { x: 'float' },
  'floor': { x: 'float' },
  'ceil': { x: 'float' },
  'clamp': { x: 'float', min: 'float', max: 'float' },
  'saturate': { x: 'float' },
  'min': { a: 'float', b: 'float' },
  'max': { a: 'float', b: 'float' },
  'step': { edge: 'float', x: 'float' },
  'smoothstep': { a: 'float', b: 'float', x: 'float' },
  'pow': { a: 'float', b: 'float' },
  'exp': { x: 'float' },
  'log': { x: 'float' },
  'sqrt': { x: 'float' },
  'sign': { x: 'float' },
  'fract': { x: 'float' },
  'length': { x: 'vec3' },
  'normalize': { x: 'vec3' },
  'dot': { a: 'vec3', b: 'vec3' },
  'cross': { a: 'vec3', b: 'vec3' },
  'distance': { a: 'vec3', b: 'vec3' },
  // trig
  'sin': { x: 'float' },
  'cos': { x: 'float' },
  'tan': { x: 'float' },
  'asin': { x: 'float' },
  'acos': { x: 'float' },
  'atan': { x: 'float' },
  // vectors
  'vec2': { x: 'float', y: 'float' },
  'vec3': { x: 'float', y: 'float', z: 'float' },
  'vec4': { x: 'float', y: 'float', z: 'float', w: 'float' },
  // Swizzle can accept any vector; compatibility logic allows vec2/vec3/vec4
  'swizzle': { in: 'vec4' },
  'combine': { x: 'float', y: 'float', z: 'float', w: 'float' },
  'unpack': { value: 'vec4' },
  // UV transforms
  'uvScale': { uv: 'vec2', scale: 'vec2' },
  'uvTransform': { uv: 'vec2', offset: 'vec2', rotation: 'float', scale: 'vec2', center: 'vec2' },
  // Normal map helper: expects a sampled normal texture (vec4) on 'in'
  'normalMap': { in: 'vec4', uv: 'vec2', scale: 'float' },
  // oscillators have no inputs (use global timer)
  'oscSine': {},
  'oscSquare': {},
  'oscTriangle': {},
  'oscSawtooth': {},
  // attributes
  'positionAttr': {},
  'normalAttr': {},
  'uvAttr': {},
  'viewPosition': {},
  'worldPosition': {},
  'cameraPosition': {},
  // time
  'time': {},
  'timeSine': {},
  'timeCos': {},
  'animTime': {},
  'animFrame': {},
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
  // conditional
  // Select (ternary) generalized to vec4 so it can switch colors as well as scalars;
  // smaller numeric inputs (float/vec2/vec3) are accepted by compatibility rules
  'select': { cond: 'bool', a: 'vec4', b: 'vec4' },
  // camera
  'cameraNear': {},
  'cameraFar': {},
  'cameraProjectionMatrix': {},
  'cameraProjectionMatrixInverse': {},
  'cameraViewMatrix': {},
  'cameraWorldMatrix': {},
  'cameraNormalMatrix': {},
  // screen
  'screenUV': {},
  'screenCoordinate': {},
  'screenSize': {},
  // viewport
  'viewportUV': {},
  'viewport': {},
  'viewportCoordinate': {},
  'viewportSize': {},
  // uv utils
  'matcapUV': {},
  'rotateUV': { uv: 'vec2', rotation: 'float' },
  'spherizeUV': { uv: 'vec2', strength: 'float' },
  'spritesheetUV': { count: 'float', uv: 'vec2', frame: 'float' },
  'equirectUV': { direction: 'vec3' },
  // interpolation
  'remap': { x: 'float', inLow: 'float', inHigh: 'float', outLow: 'float', outHigh: 'float' },
  'remapClamp': { x: 'float', inLow: 'float', inHigh: 'float', outLow: 'float', outHigh: 'float' },
  // random
  'hash': { seed: 'float' },
  // rotate
  'rotate': { position: 'vec3', rotation: 'vec3' },
  // blend
  'blendBurn': { a: 'vec3', b: 'vec3' },
  'blendDodge': { a: 'vec3', b: 'vec3' },
  'blendOverlay': { a: 'vec3', b: 'vec3' },
  'blendScreen': { a: 'vec3', b: 'vec3' },
  'blendColor': { a: 'vec3', b: 'vec3' },
  // packing
  'directionToColor': { value: 'vec3' },
  'colorToDirection': { value: 'vec3' },
  // extra math/optics
  'reflect': { I: 'vec3', N: 'vec3' },
  'refract': { I: 'vec3', N: 'vec3', eta: 'float' },
  'round': { x: 'float' },
  'trunc': { x: 'float' },
  'inverseSqrt': { x: 'float' },
  'degrees': { x: 'float' },
  'radians': { x: 'float' },
  'exp2': { x: 'float' },
  'log2': { x: 'float' },
  'lengthSq': { x: 'vec3' },
  'oneMinus': { x: 'float' },
  'pow2': { x: 'float' },
  'pow3': { x: 'float' },
  'pow4': { x: 'float' },
  // debug helpers - no inputs needed, they read built-in positions
  'debugHeight': {},
  'debugWorldY': {},
  'debugLocalY': {},
  // direct vertex attribute access
  'vertexPosition': {},
  'vertexY': {},
  // axis testing
  'testAllAxes': {},
};

export const NodeOutputs: Record<ShaderNodeType, Record<string, SocketType>> = {
  'input': { uv: 'vec2', uv2: 'vec2', normal: 'vec3' },
  'output': {},
  'output-standard': {},
  'output-physical': {},
  'output-phong': {},
  'output-toon': {},
  'const-float': { out: 'float' },
  'const-color': { out: 'vec3' },
  'texture': { out: 'vec4' },
  'normalMap': { out: 'vec3' },
  'uv': { out: 'vec2' },
  'uv2': { out: 'vec2' },
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
  // Declared as vec4 so it can be wired into color (vec3) or other vector inputs;
  // scalar uses still work by implicit upcast on inputs and downcast on outputs
  'mix': { out: 'vec4' },
  // common math
  'abs': { out: 'float' },
  'floor': { out: 'float' },
  'ceil': { out: 'float' },
  'clamp': { out: 'float' },
  'saturate': { out: 'float' },
  'min': { out: 'float' },
  'max': { out: 'float' },
  'step': { out: 'float' },
  'smoothstep': { out: 'float' },
  'pow': { out: 'float' },
  'exp': { out: 'float' },
  'log': { out: 'float' },
  'sqrt': { out: 'float' },
  'sign': { out: 'float' },
  'fract': { out: 'float' },
  'length': { out: 'float' },
  'normalize': { out: 'vec3' },
  'dot': { out: 'float' },
  'cross': { out: 'vec3' },
  'distance': { out: 'float' },
  // trig
  'sin': { out: 'float' },
  'cos': { out: 'float' },
  'tan': { out: 'float' },
  'asin': { out: 'float' },
  'acos': { out: 'float' },
  'atan': { out: 'float' },
  // vectors
  'vec2': { out: 'vec2' },
  'vec3': { out: 'vec3' },
  'vec4': { out: 'vec4' },
  'swizzle': { out: 'float' },
  'combine': { out: 'vec4' },
  'unpack': { x: 'float', y: 'float', z: 'float', w: 'float' },
  // UV transforms
  'uvScale': { out: 'vec2' },
  'uvTransform': { out: 'vec2' },
  // oscillators
  'oscSine': { out: 'float' },
  'oscSquare': { out: 'float' },
  'oscTriangle': { out: 'float' },
  'oscSawtooth': { out: 'float' },
  // attributes
  'positionAttr': { out: 'vec3' },
  'normalAttr': { out: 'vec3' },
  'uvAttr': { out: 'vec2' },
  'viewPosition': { out: 'vec3' },
  'worldPosition': { out: 'vec3' },
  'cameraPosition': { out: 'vec3' },
  // time
  'time': { out: 'float' },
  'timeSine': { out: 'float' },
  'timeCos': { out: 'float' },
  'animTime': { out: 'float' },
  'animFrame': { out: 'float' },
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
  // conditional
  // Matches the generalized input typing
  'select': { out: 'vec4' },
  // camera
  'cameraNear': { out: 'float' },
  'cameraFar': { out: 'float' },
  'cameraProjectionMatrix': { out: 'mat4' },
  'cameraProjectionMatrixInverse': { out: 'mat4' },
  'cameraViewMatrix': { out: 'mat4' },
  'cameraWorldMatrix': { out: 'mat4' },
  'cameraNormalMatrix': { out: 'mat3' },
  // screen
  'screenUV': { out: 'vec2' },
  'screenCoordinate': { out: 'vec2' },
  'screenSize': { out: 'vec2' },
  // viewport
  'viewportUV': { out: 'vec2' },
  'viewport': { out: 'vec4' },
  'viewportCoordinate': { out: 'vec2' },
  'viewportSize': { out: 'vec2' },
  // uv utils
  'matcapUV': { out: 'vec2' },
  'rotateUV': { out: 'vec2' },
  'spherizeUV': { out: 'vec2' },
  'spritesheetUV': { out: 'vec2' },
  'equirectUV': { out: 'vec2' },
  // interpolation
  'remap': { out: 'float' },
  'remapClamp': { out: 'float' },
  // random
  'hash': { out: 'float' },
  // rotate
  'rotate': { out: 'vec3' },
  // blend
  'blendBurn': { out: 'vec3' },
  'blendDodge': { out: 'vec3' },
  'blendOverlay': { out: 'vec3' },
  'blendScreen': { out: 'vec3' },
  'blendColor': { out: 'vec3' },
  // packing
  'directionToColor': { out: 'vec3' },
  'colorToDirection': { out: 'vec3' },
  // extra math/optics
  'reflect': { out: 'vec3' },
  'refract': { out: 'vec3' },
  'round': { out: 'float' },
  'trunc': { out: 'float' },
  'inverseSqrt': { out: 'float' },
  'degrees': { out: 'float' },
  'radians': { out: 'float' },
  'exp2': { out: 'float' },
  'log2': { out: 'float' },
  'lengthSq': { out: 'float' },
  'oneMinus': { out: 'float' },
  'pow2': { out: 'float' },
  'pow3': { out: 'float' },
  'pow4': { out: 'float' },
  // debug helpers - output height/Y coordinates as colors for visualization
  'debugHeight': { out: 'vec3' },
  'debugWorldY': { out: 'float' },
  'debugLocalY': { out: 'float' },
  // direct vertex attribute access
  'vertexPosition': { out: 'vec3' },
  'vertexY': { out: 'float' },
  // axis testing - outputs RGB where R=X, G=Y, B=Z
  'testAllAxes': { out: 'vec3' },
};

function isNumericVector(t: SocketType) {
  return t === 'float' || t === 'vec2' || t === 'vec3' || t === 'vec4';
}

export function isCompatible(outT: SocketType, inT: SocketType) {
  if (outT === inT) return true;
  // Special handling for texture sockets: only texture -> texture
  if ((outT === 'texture') !== (inT === 'texture')) return false;
  // Allow vector size coercion in common cases:
  // - smaller vectors into vec4-typed inputs (we'll fill missing comps)
  if (inT === 'vec4' && (outT === 'vec2' || outT === 'vec3')) return true;
  // - vec4 outputs into vec3 inputs (common for texture RGBA -> RGB color)
  if (inT === 'vec3' && outT === 'vec4') return true;
  // Generic numeric compatibility: allow scalar-vector ops and vice versa
  if (isNumericVector(outT) && isNumericVector(inT)) {
    if (outT === 'float' || inT === 'float') return true; // scalar with any vector size
    // Both vectors: allow equal size or safe downcast (out >= in)
    const dims: Record<SocketType, number> = { float: 1, vec2: 2, vec3: 3, vec4: 4, bool: 0, mat3: 9, mat4: 16, texture: 0 };
    return dims[outT] >= dims[inT] && dims[inT] > 0;
  }
  return false;
}

import type { ShaderGraph, ShaderNode, ShaderEdge } from '@/types/shader';
import { MeshStandardNodeMaterial, MeshPhysicalNodeMaterial, MeshPhongNodeMaterial, MeshToonNodeMaterial } from 'three/webgpu';
import { DoubleSide, BackSide } from 'three/webgpu';
import * as TSL from 'three/tsl';
// Shader TSL builder and resolvers registry

export type TSLBuildResult = {
  createStandardNodeMaterial: () => import('three').Material;
  createPhysicalNodeMaterial: () => import('three').Material;
  createPhongNodeMaterial: () => import('three').Material;
  createToonNodeMaterial: () => import('three').Material;
  createAuto: () => import('three').Material; // pick based on output node present in graph
};

type BuildContext = {
  findInput: (nodeId: string, handle: string) => { from: ShaderNode; fromHandle: string } | null;
};

type NodeResolver = (
  node: ShaderNode,
  outHandle: string,
  ctx: BuildContext,
  build: (n: ShaderNode, h: string) => any
) => any;

// Category resolvers
import { constResolvers } from './nodes/const-nodes';
import { builtinResolvers } from './nodes/builtin-nodes';
import { mathResolvers } from './nodes/math-nodes';
import { oscResolvers } from './nodes/osc-nodes';
import { commonResolvers } from './nodes/common-nodes';
import { trigResolvers } from './nodes/trig-nodes';
import { vectorResolvers } from './nodes/vector-nodes';
import { attrResolvers } from './nodes/attr-nodes';
import { timeResolvers } from './nodes/time-nodes';
import { conditionalResolvers } from './nodes/conditional-nodes';
import { cameraResolvers } from './nodes/camera-nodes';
import { screenResolvers } from './nodes/screen-nodes';
import { uvUtilResolvers } from './nodes/uvutil-nodes';
import { interpResolvers } from './nodes/interp-nodes';
import { randomResolvers } from './nodes/random-nodes';
import { rotateResolvers } from './nodes/rotate-nodes';
import { blendResolvers } from './nodes/blend-nodes';
import { packResolvers } from './nodes/pack-nodes';
import { textureResolvers } from './nodes/texture-nodes';
import { uvTransformResolvers } from './nodes/uv-transform-nodes';
import { normalMapResolvers } from './nodes/normalmap-nodes';
import { debugResolvers } from './nodes/debug-nodes';

const resolvers: Record<string, NodeResolver> = {
  ...constResolvers,
  ...builtinResolvers,
  ...mathResolvers,
  ...oscResolvers,
  ...commonResolvers,
  ...trigResolvers,
  ...vectorResolvers,
  ...attrResolvers,
  ...timeResolvers,
  ...conditionalResolvers,
  ...cameraResolvers,
  ...screenResolvers,
  ...uvUtilResolvers,
  ...interpResolvers,
  ...randomResolvers,
  ...rotateResolvers,
  ...blendResolvers,
  ...packResolvers,
  ...textureResolvers,
  ...uvTransformResolvers,
  ...normalMapResolvers,
  ...debugResolvers,
};

function resolveNode(
  node: ShaderNode,
  outHandle: string,
  ctx: BuildContext,
  build: (n: ShaderNode, h: string) => any
): any {
  const r: NodeResolver | undefined = resolvers[node.type as string];
  if (r) return r(node, outHandle, ctx, build);
  return null;
}

export function buildTSLMaterialFactory(graph: ShaderGraph): TSLBuildResult {
  const nodes: Record<string, ShaderNode> = Object.fromEntries(graph.nodes.map((n) => [n.id, n]));
  const edgesByTarget: Record<string, ShaderEdge[]> = {};
  for (const e of graph.edges) {
    const k = `${e.target}:${e.targetHandle}`;
    (edgesByTarget[k] ||= []).push(e);
  }

  const ctx: BuildContext = {
    findInput: (nodeId, handle) => {
      const es = edgesByTarget[`${nodeId}:${handle}`];
      if (!es || es.length === 0) return null;
      const e = es[0];
      const from = nodes[e.source];
      if (!from) return null;
      return { from, fromHandle: e.sourceHandle };
    },
  };

  const buildNodeExpr = (node: ShaderNode, outHandle: string): any => resolveNode(node, outHandle, ctx, buildNodeExpr);

  function createStandardNodeMaterial(): import('three').Material {
    const out = graph.nodes.find((n) => n.type === 'output' || n.type === 'output-standard');
    if (!out) return new MeshStandardNodeMaterial();

    const resolveIn = (key: string) => {
      const pair = ctx.findInput(out.id, key);
      return pair ? buildNodeExpr(pair.from, pair.fromHandle) : null;
    };

  const color = resolveIn('color') ?? TSL.vec3(0.8, 0.8, 0.85);
    const roughness = resolveIn('roughness') ?? TSL.float(0.8);
    const metalness = resolveIn('metalness') ?? TSL.float(0.05);
  const emissive = resolveIn('emissive') ?? TSL.vec3(0, 0, 0);
    const emissiveIntensity = resolveIn('emissiveIntensity') ?? TSL.float(1);

  const mat = new MeshStandardNodeMaterial();
  // Base NodeMaterial properties
  const opacity = resolveIn('opacity');
  const alphaTest = resolveIn('alphaTest');
  const normalNode = resolveIn('normal');
  const positionNode = resolveIn('position');
  const depthNode = resolveIn('depth');
  const envNode = resolveIn('env');
  const aoNode = resolveIn('ao');

  const toVec3 = (v: any) => (v && (v as any).getMember ? (v as any).getMember('xyz') : v);
  (mat as any).colorNode = toVec3(color);
  (mat as any).roughnessNode = roughness;
  (mat as any).metalnessNode = metalness;
  (mat as any).emissiveNode = toVec3(emissive);
  (mat as any).emissiveIntensity = emissiveIntensity;
  if (opacity) (mat as any).opacityNode = opacity;
  if (alphaTest) (mat as any).alphaTestNode = alphaTest;
  if (normalNode) (mat as any).normalNode = normalNode;
  if (positionNode) (mat as any).positionNode = positionNode;
  if (depthNode) (mat as any).depthNode = depthNode;
  if (envNode) (mat as any).envNode = envNode;
  if (aoNode) (mat as any).aoNode = aoNode;
  // Always render both sides for editor consistency
  (mat as any).side = DoubleSide;
  (mat as any).shadowSide = BackSide;
  const built = mat as import('three').Material;
  return built;
  }

  function createPhysicalNodeMaterial(): import('three').Material {
    const out = graph.nodes.find((n) => n.type === 'output-physical');
    if (!out) return new MeshPhysicalNodeMaterial();

    const resolveIn = (key: string) => {
      const pair = ctx.findInput(out.id, key);
      return pair ? buildNodeExpr(pair.from, pair.fromHandle) : null;
    };

  const color = resolveIn('color') ?? TSL.vec3(0.8, 0.8, 0.85);
    const roughness = resolveIn('roughness') ?? TSL.float(0.8);
    const metalness = resolveIn('metalness') ?? TSL.float(0.05);
  const emissive = resolveIn('emissive') ?? TSL.vec3(0, 0, 0);
    const emissiveIntensity = resolveIn('emissiveIntensity') ?? TSL.float(1);
    // TODO: wire up physical-only channels when nodes exist: clearcoat, sheen, transmission, etc.

  const mat = new MeshPhysicalNodeMaterial();
  // Base NodeMaterial properties
  const opacity = resolveIn('opacity');
  const alphaTest = resolveIn('alphaTest');
  const normalNode = resolveIn('normal');
  const positionNode = resolveIn('position');
  const depthNode = resolveIn('depth');
  const envNode = resolveIn('env');
  const aoNode = resolveIn('ao');

  // Physical-specific
  const clearcoat = resolveIn('clearcoat');
  const clearcoatRoughness = resolveIn('clearcoatRoughness');
  const clearcoatNormal = resolveIn('clearcoatNormal');
  const sheen = resolveIn('sheen');
  const iridescence = resolveIn('iridescence');
  const iridescenceIOR = resolveIn('iridescenceIOR');
  const iridescenceThickness = resolveIn('iridescenceThickness');
  const specularIntensity = resolveIn('specularIntensity');
  const specularColor = resolveIn('specularColor');
  const ior = resolveIn('ior');
  const transmission = resolveIn('transmission');
  const thickness = resolveIn('thickness');
  const attenuationDistance = resolveIn('attenuationDistance');
  const attenuationColor = resolveIn('attenuationColor');
  const dispersion = resolveIn('dispersion');
  const anisotropy = resolveIn('anisotropy');

  const toVec3 = (v: any) => (v && (v as any).getMember ? (v as any).getMember('xyz') : v);
  (mat as any).colorNode = toVec3(color);
  (mat as any).roughnessNode = roughness;
  (mat as any).metalnessNode = metalness;
  (mat as any).emissiveNode = toVec3(emissive);
  (mat as any).emissiveIntensity = emissiveIntensity;
  if (opacity) (mat as any).opacityNode = opacity;
  if (alphaTest) (mat as any).alphaTestNode = alphaTest;
  if (normalNode) (mat as any).normalNode = normalNode;
  if (positionNode) (mat as any).positionNode = positionNode;
  if (depthNode) (mat as any).depthNode = depthNode;
  if (envNode) (mat as any).envNode = envNode;
  if (aoNode) (mat as any).aoNode = aoNode;
  if (clearcoat) (mat as any).clearcoatNode = clearcoat;
  if (clearcoatRoughness) (mat as any).clearcoatRoughnessNode = clearcoatRoughness;
  if (clearcoatNormal) (mat as any).clearcoatNormalNode = clearcoatNormal;
  if (sheen) (mat as any).sheenNode = sheen;
  if (iridescence) (mat as any).iridescenceNode = iridescence;
  if (iridescenceIOR) (mat as any).iridescenceIORNode = iridescenceIOR;
  if (iridescenceThickness) (mat as any).iridescenceThicknessNode = iridescenceThickness;
  if (specularIntensity) (mat as any).specularIntensityNode = specularIntensity;
  if (specularColor) (mat as any).specularColorNode = specularColor;
  if (ior) (mat as any).iorNode = ior;
  if (transmission) (mat as any).transmissionNode = transmission;
  if (thickness) (mat as any).thicknessNode = thickness;
  if (attenuationDistance) (mat as any).attenuationDistanceNode = attenuationDistance;
  if (attenuationColor) (mat as any).attenuationColorNode = attenuationColor;
  if (dispersion) (mat as any).dispersionNode = dispersion;
  if (anisotropy) (mat as any).anisotropyNode = anisotropy;
  // Always render both sides for editor consistency
  (mat as any).side = DoubleSide;
  (mat as any).shadowSide = BackSide;
  const built = mat as import('three').Material;
  return built;
  }

  function createPhongNodeMaterial(): import('three').Material {
    const out = graph.nodes.find((n) => n.type === 'output-phong');
    if (!out) return new MeshPhongNodeMaterial();

    const resolveIn = (key: string) => {
      const pair = ctx.findInput(out.id, key);
      return pair ? buildNodeExpr(pair.from, pair.fromHandle) : null;
    };

  const color = resolveIn('color') ?? TSL.vec3(0.8, 0.8, 0.85);
  const emissive = resolveIn('emissive') ?? TSL.vec3(0, 0, 0);
    const emissiveIntensity = resolveIn('emissiveIntensity') ?? TSL.float(1);
    const shininess = resolveIn('shininess') ?? TSL.float(30);
    const specular = resolveIn('specular') ?? TSL.vec3(0.2, 0.2, 0.2);

    // Base NodeMaterial
    const opacity = resolveIn('opacity');
    const alphaTest = resolveIn('alphaTest');
    const normalNode = resolveIn('normal');
    const positionNode = resolveIn('position');
    const depthNode = resolveIn('depth');
    const envNode = resolveIn('env');
    const aoNode = resolveIn('ao');

  const mat = new MeshPhongNodeMaterial();
    const toVec3 = (v: any) => (v && (v as any).getMember ? (v as any).getMember('xyz') : v);
    (mat as any).colorNode = toVec3(color);
    (mat as any).emissiveNode = toVec3(emissive);
    (mat as any).emissiveIntensity = emissiveIntensity;
    (mat as any).shininessNode = shininess;
    (mat as any).specularNode = specular;
    if (opacity) (mat as any).opacityNode = opacity;
    if (alphaTest) (mat as any).alphaTestNode = alphaTest;
    if (normalNode) (mat as any).normalNode = normalNode;
    if (positionNode) (mat as any).positionNode = positionNode;
    if (depthNode) (mat as any).depthNode = depthNode;
    if (envNode) (mat as any).envNode = envNode;
    if (aoNode) (mat as any).aoNode = aoNode;
  // Always render both sides for editor consistency
  (mat as any).side = DoubleSide;
  (mat as any).shadowSide = BackSide;
  const built = mat as import('three').Material;
  return built;
  }

  function createToonNodeMaterial(): import('three').Material {
    const out = graph.nodes.find((n) => n.type === 'output-toon');
    if (!out) return new MeshToonNodeMaterial();

    const resolveIn = (key: string) => {
      const pair = ctx.findInput(out.id, key);
      return pair ? buildNodeExpr(pair.from, pair.fromHandle) : null;
    };

    const color = resolveIn('color') ?? TSL.vec3(0.8, 0.8, 0.85);
    const emissive = resolveIn('emissive') ?? TSL.vec3(0, 0, 0);
    const emissiveIntensity = resolveIn('emissiveIntensity') ?? TSL.float(1);

    // Base NodeMaterial
    const opacity = resolveIn('opacity');
    const alphaTest = resolveIn('alphaTest');
    const normalNode = resolveIn('normal');
    const positionNode = resolveIn('position');
    const depthNode = resolveIn('depth');
    const envNode = resolveIn('env');
    const aoNode = resolveIn('ao');

  const mat = new MeshToonNodeMaterial();
    (mat as any).colorNode = color;
    (mat as any).emissiveNode = emissive;
    (mat as any).emissiveIntensity = emissiveIntensity;
    if (opacity) (mat as any).opacityNode = opacity;
    if (alphaTest) (mat as any).alphaTestNode = alphaTest;
    if (normalNode) (mat as any).normalNode = normalNode;
    if (positionNode) (mat as any).positionNode = positionNode;
    if (depthNode) (mat as any).depthNode = depthNode;
    if (envNode) (mat as any).envNode = envNode;
    if (aoNode) (mat as any).aoNode = aoNode;
  // Always render both sides for editor consistency
  (mat as any).side = DoubleSide;
  (mat as any).shadowSide = BackSide;
  const built = mat as import('three').Material;
  return built;
  }

  function createAuto(): import('three').Material {
    if (graph.nodes.some((n) => n.type === 'output-physical')) return createPhysicalNodeMaterial();
    if (graph.nodes.some((n) => n.type === 'output-phong')) return createPhongNodeMaterial();
    if (graph.nodes.some((n) => n.type === 'output-toon')) return createToonNodeMaterial();
    // fallback to standard (supports legacy 'output' too)
    return createStandardNodeMaterial();
  }

  return { createStandardNodeMaterial, createPhysicalNodeMaterial, createPhongNodeMaterial, createToonNodeMaterial, createAuto };
}

import type { ShaderGraph, ShaderNode, ShaderEdge, ShaderNodeType, SocketType } from '@/types/shader';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import {
  float as nFloat,
  vec3 as nVec3,
  uv as nUv,
  normalWorld as nNormalWorld,
  add as nAdd,
  mul as nMul,
  mix as nMix,
} from 'three/tsl';

// Minimal TSL material factory from a node graph.
// We return a function that can construct a MeshStandardNodeMaterial using three's TSL at render time.

export type TSLBuildResult = {
  createStandardNodeMaterial: () => import('three').Material;
};

type BuildContext = {
  findInput: (nodeId: string, handle: string) => { from: ShaderNode; fromHandle: string } | null;
  getOutputType: (node: ShaderNode, handle: string) => SocketType | null;
};

/** Build a runnable constructor that creates a Three.js StandardNodeMaterial using TSL for a shader graph */
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
    getOutputType: (_node, _handle) => null,
  };

  function buildNodeExpr(node: ShaderNode, outHandle: string): any {
    const fromInput = (inputKey: string) => ctx.findInput(node.id, inputKey);
    const resolve = (pair: { from: ShaderNode; fromHandle: string } | null) => {
      if (!pair) return null;
      return buildNodeExpr(pair.from, pair.fromHandle);
    };

    switch (node.type as ShaderNodeType) {
      case 'const-float': {
        const v = (node as any).data?.value ?? 0;
  return nFloat(v);
      }
      case 'const-color': {
        const { r = 1, g = 1, b = 1 } = (node as any).data ?? {};
  return nVec3(r, g, b);
      }
      case 'input': {
  if (outHandle === 'uv') return nUv();
  if (outHandle === 'normal') return nNormalWorld;
        return null;
      }
      case 'add': {
        const a = resolve(fromInput('a'));
        const b = resolve(fromInput('b'));
  return nAdd(a, b);
      }
      case 'mul': {
        const a = resolve(fromInput('a'));
        const b = resolve(fromInput('b'));
  return nMul(a, b);
      }
      case 'mix': {
        const a = resolve(fromInput('a'));
        const b = resolve(fromInput('b'));
        const t = resolve(fromInput('t'));
  return nMix(a, b, t);
      }
      case 'output': {
        return null;
      }
      case 'uv':
  return nUv();
      case 'normal':
  return nNormalWorld;
      default:
        return null;
    }
  }

  function createStandardNodeMaterial(): import('three').Material {
    const out = graph.nodes.find((n) => n.type === 'output');
    if (!out) {
      return new MeshStandardNodeMaterial();
    }

    const resolveIn = (key: string) => {
      const pair = ctx.findInput(out.id, key);
      return pair ? buildNodeExpr(pair.from, pair.fromHandle) : null;
    };

  const color = resolveIn('color') ?? nVec3(0.8, 0.8, 0.85);
  const roughness = resolveIn('roughness') ?? nFloat(0.8);
  const metalness = resolveIn('metalness') ?? nFloat(0.05);
  const emissive = resolveIn('emissive') ?? nVec3(0, 0, 0);
  const emissiveIntensity = resolveIn('emissiveIntensity') ?? nFloat(1);

  const mat = new MeshStandardNodeMaterial();
  (mat as any).colorNode = color;
  (mat as any).roughnessNode = roughness;
  (mat as any).metalnessNode = metalness;
  (mat as any).emissiveNode = emissive;
  (mat as any).emissiveIntensityNode = emissiveIntensity;
  return mat as import('three').Material;
  }

  return { createStandardNodeMaterial };
}

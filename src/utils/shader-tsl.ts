import type { ShaderGraph, ShaderNode, ShaderEdge, ShaderNodeType, SocketType, ConstFloatNode, ConstColorNode } from '@/types/shader';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import * as TSL from 'three/tsl';

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

        const op2 = (name: keyof typeof TSL, a: any, b: any) => {
            const fn: any = (TSL)[name];
            if (typeof fn === 'function') return fn(a, b);
            return a; // graceful fallback
        };
        const op1 = (name: keyof typeof TSL, a: any) => {
            const fn: any = (TSL)[name];
            if (typeof fn === 'function') return fn(a);
            return a; // graceful fallback
        };

        switch (node.type as ShaderNodeType) {
            case 'const-float': {
                const v = ((node as ConstFloatNode).data)?.value ?? 0;
                return TSL.float(v);
            }
            case 'const-color': {
                const { r = 1, g = 1, b = 1 } = (node as ConstColorNode).data ?? {};
                return TSL.vec3(r, g, b);
            }
            case 'input': {
                if (outHandle === 'uv') return TSL.uv();
                if (outHandle === 'normal') return (TSL).normalWorld;
                return null;
            }
            case 'add': {
                const a = resolve(fromInput('a'));
                const b = resolve(fromInput('b'));
                return TSL.add(a, b);
            }
            case 'sub': {
                const a = resolve(fromInput('a'));
                const b = resolve(fromInput('b'));
                return op2('sub', a, b);
            }
            case 'mul': {
                const a = resolve(fromInput('a'));
                const b = resolve(fromInput('b'));
                return TSL.mul(a, b);
            }
            case 'div': {
                const a = resolve(fromInput('a'));
                const b = resolve(fromInput('b'));
                return op2('div', a, b);
            }
            case 'assign': {
                // In shader graphs, assignment is not meaningful; treat as pass-through of b if present, else a
                const a = resolve(fromInput('a'));
                const b = resolve(fromInput('b'));
                return b ?? a;
            }
            case 'mod': {
                const a = resolve(fromInput('a'));
                const b = resolve(fromInput('b'));
                return op2('mod', a, b);
            }
            case 'equal': {
                const a = resolve(fromInput('a'));
                const b = resolve(fromInput('b'));
                return op2('equal', a, b);
            }
            case 'notEqual': {
                const a = resolve(fromInput('a'));
                const b = resolve(fromInput('b'));
                return op2('notEqual', a, b);
            }
            case 'lessThan': {
                const a = resolve(fromInput('a'));
                const b = resolve(fromInput('b'));
                return op2('lessThan', a, b);
            }
            case 'greaterThan': {
                const a = resolve(fromInput('a'));
                const b = resolve(fromInput('b'));
                return op2('greaterThan', a, b);
            }
            case 'lessThanEqual': {
                const a = resolve(fromInput('a'));
                const b = resolve(fromInput('b'));
                return op2('lessThanEqual', a, b);
            }
            case 'greaterThanEqual': {
                const a = resolve(fromInput('a'));
                const b = resolve(fromInput('b'));
                return op2('greaterThanEqual', a, b);
            }
            case 'and': {
                const a = resolve(fromInput('a'));
                const b = resolve(fromInput('b'));
                return op2('and', a, b);
            }
            case 'or': {
                const a = resolve(fromInput('a'));
                const b = resolve(fromInput('b'));
                return op2('or', a, b);
            }
            case 'not': {
                const a = resolve(fromInput('a'));
                return op1('not', a);
            }
            case 'xor': {
                const a = resolve(fromInput('a'));
                const b = resolve(fromInput('b'));
                return op2('xor', a, b);
            }
            case 'bitAnd': {
                const a = resolve(fromInput('a'));
                const b = resolve(fromInput('b'));
                return op2('bitAnd', a, b);
            }
            case 'bitNot': {
                const a = resolve(fromInput('a'));
                return op1('bitNot', a);
            }
            case 'bitOr': {
                const a = resolve(fromInput('a'));
                const b = resolve(fromInput('b'));
                return op2('bitOr', a, b);
            }
            case 'bitXor': {
                const a = resolve(fromInput('a'));
                const b = resolve(fromInput('b'));
                return op2('bitXor', a, b);
            }
            case 'shiftLeft': {
                const a = resolve(fromInput('a'));
                const b = resolve(fromInput('b'));
                return op2('shiftLeft', a, b);
            }
            case 'shiftRight': {
                const a = resolve(fromInput('a'));
                const b = resolve(fromInput('b'));
                return op2('shiftRight', a, b);
            }
            // Oscillators using global timer
            case 'oscSine': {

                return (TSL).oscSine();
            }
            case 'oscSquare': {

                return (TSL).oscSquare();
            }
            case 'oscTriangle': {
                return (TSL).oscTriangle();
            }
            case 'oscSawtooth': {
                return (TSL).oscSawtooth();
            }
            // Model builtins
            case 'modelDirection': return (TSL).modelDirection ?? TSL.vec3(0, 0, 1);
            case 'modelViewMatrix': return (TSL).modelViewMatrix ?? null;
            case 'modelNormalMatrix': return (TSL).modelNormalMatrix ?? null;
            case 'modelWorldMatrix': return (TSL).modelWorldMatrix ?? null;
            case 'modelPosition': return (TSL).modelPosition ?? TSL.vec3(0, 0, 0);
            case 'modelScale': return (TSL).modelScale ?? TSL.vec3(1, 1, 1);
            case 'modelViewPosition': return (TSL).modelViewPosition ?? TSL.vec3(0, 0, 0);
            case 'modelWorldMatrixInverse': return (TSL).modelWorldMatrixInverse ?? null;
            case 'highpModelViewMatrix': return (TSL).highPrecisionModelViewMatrix ?? (TSL).modelViewMatrix ?? null;
            case 'highpModelNormalViewMatrix': return (TSL).highpModelNormalViewMatrix ?? (TSL).modelNormalMatrix ?? null;
            case 'mix': {
                const a = resolve(fromInput('a'));
                const b = resolve(fromInput('b'));
                const t = resolve(fromInput('t'));
                return TSL.mix(a, b, t);
            }
            case 'output': {
                return null;
            }
            case 'uv':
                return TSL.uv();
            case 'normal':
                return (TSL).normalWorld;
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

        const color = resolveIn('color') ?? TSL.vec3(0.8, 0.8, 0.85);
        const roughness = resolveIn('roughness') ?? TSL.float(0.8);
        const metalness = resolveIn('metalness') ?? TSL.float(0.05);
        const emissive = resolveIn('emissive') ?? TSL.vec3(0, 0, 0);
        const emissiveIntensity = resolveIn('emissiveIntensity') ?? TSL.float(1);

        const mat = new MeshStandardNodeMaterial();
        (mat).colorNode = color;
        (mat).roughnessNode = roughness;
        (mat).metalnessNode = metalness;
        (mat).emissiveNode = emissive;
        (mat).emissiveIntensity = emissiveIntensity;
        return mat as import('three').Material;
    }

    return { createStandardNodeMaterial };
}

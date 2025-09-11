import { streamObject } from 'ai';
import { xai } from "@ai-sdk/xai"
import { z } from 'zod';

// Allow streaming responses up to 30 seconds (Vercel Edge limit hint)
export const maxDuration = 30;

// OpenAI structured output currently rejects tuple item arrays like [ {type:number}, ... ] at root of items.
// Use object-based vectors instead of tuples to stay within supported JSON Schema subset.
const vector3 = z.object({ x: z.number(), y: z.number(), z: z.number() });
// Allow color either as {r,g,b} 0-255 integers or as a #RRGGBB hex string.
const colorSchema = z.union([
    z.object({ r: z.number().int().min(0).max(255), g: z.number().int().min(0).max(255), b: z.number().int().min(0).max(255) }),
    z.string().regex(/^#?[0-9a-fA-F]{6}$/),
    vector3, // fallback if model uses x,y,z 0-1 floats
]);
const meshSchema = z.object({
    mesh: z.object({
        name: z.string().optional(),
        vertices: z.array(vector3).default([]),
        faces: z.array(z.array(z.number()).min(3).max(4)).default([]),
        material: z.object({
            color: colorSchema.optional(),
            roughness: z.number().min(0).max(1).optional(),
            metalness: z.number().min(0).max(1).optional(),
            emissive: colorSchema.optional(),
            emissiveIntensity: z.number().min(0).max(1).optional(),
            opacity: z.number().min(0).max(1).optional(),
            transparent: z.boolean().optional(),
        }).optional(),
    })
});

interface PostBody {
    prompt?: string;
    model?: 'gpt-5' | 'gpt-5-mini' | 'gpt-5-nano';
    // optional: 'low' | 'medium' | 'high' detail preference. Defaults to 'medium'.
    detail?: 'low' | 'medium' | 'high';
    // optional: max desired vertex count. We'll clamp to a safe server-side cap.
    maxVertices?: number;
    // optional freeform style hints (e.g. "architectural", "organic", "mechanical").
    style?: string;
}

export async function POST(req: Request) {
    const body: PostBody = await req.json().catch(() => ({}));
    const userPrompt = (body.prompt || '').slice(0, 800); // guard length
    // const model = openai(body.model || 'gpt-5-mini');
    const model = xai("grok-4-0709")

    // Instruction prompt guiding the model to emit ONLY the structured object.
    // Note: by default prefer moderate detail; allow higher detail when requested by client.
    const systemInstructions = `
You are a 3D mesh generator specializing in high-fidelity, realistic models. Output ONLY a JSON object that matches the schema.

Rules:
- Provide a concise, descriptive mesh.name (e.g., "Ancient Oak Tree with Bark Texture Details", "Ergonomic Modern Office Chair").
- Aim for detail: incorporate intricate features like surface variations, asymmetries for organic shapes, or precise engineering for man-made objects.
- Use realistic proportions, scales, and architectures based on real-world references.
- Optimize topology for quality: favor quads for smooth surfaces to support subdivision and texturing; use triangles only where necessary; ensure manifold, watertight meshes without self-intersections or holes.
- Target a higher vertex count (e.g., 100-1000+ vertices depending on complexity) for smoother curves, finer details, and better subdivision potential.
- Use 0-based indices in faces.
- Center the mesh at the origin (0,0,0) and normalize scale to fit within a unit bounding box unless the request specifies otherwise.
- Ensure symmetry where logically appropriate (e.g., for vehicles or furniture).
- Do not include extra narration, metadata, or prose—only the JSON object that matches the schema.

User's request: ${userPrompt}
`;

    const { partialObjectStream, } = streamObject({
        model: model,
        schema: meshSchema,
        prompt: systemInstructions,
        temperature: 0.2
    });

    // Stream each partial object state as NDJSON so the client can incrementally update.
    const stream = new ReadableStream({
        async start(controller) {
            const encoder = new TextEncoder();
            try {
                for await (const partial of partialObjectStream) {
                    controller.enqueue(encoder.encode(JSON.stringify(partial) + '\n'));
                }
            } catch (err: any) {
                controller.enqueue(encoder.encode(JSON.stringify({ error: err?.message || 'stream_error' }) + '\n'));
            } finally {
                controller.close();
            }
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'application/x-ndjson; charset=utf-8',
            'Cache-Control': 'no-cache',
        }
    });
}
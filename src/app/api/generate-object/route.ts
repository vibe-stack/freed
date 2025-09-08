import { generateObject } from 'ai';
import { z } from 'zod';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
    const { object } = await generateObject({
        model: 'openai/gpt-5-mini',
        schema: z.object({
            recipe: z.object({
                name: z.string(),
                ingredients: z.array(z.object({ name: z.string(), amount: z.string() })),
                steps: z.array(z.string()),
            }),
        }),
        prompt: 'Generate a lasagna recipe.',
    });

    return result.toUIMessageStreamResponse();
}
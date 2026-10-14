import { z } from 'zod';
import { askJSON, errorResponse } from '@/lib/ai/server';
import { readBody } from '@/lib/ai/request';
import { ResumeOut } from '@/lib/ai/schemas';
import { RESUME_SYSTEM, resumeMessage } from '@/lib/ai/prompts';

const In = z.object({ text: z.string().min(20).max(60_000) });

export async function POST(req: Request) {
  try {
    const { text } = await readBody(req, In);
    const out = await askJSON({
      schema: ResumeOut,
      system: RESUME_SYSTEM,
      messages: [{ role: 'user', content: resumeMessage(text) }],
      effort: 'medium',
    });
    return Response.json(out);
  } catch (e) {
    return errorResponse(e);
  }
}

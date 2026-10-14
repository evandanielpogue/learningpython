import { z } from 'zod';
import { askJSON, errorResponse } from '@/lib/ai/server';
import { readBody } from '@/lib/ai/request';
import { QuestionsOut } from '@/lib/ai/schemas';
import { INTERVIEW_SYSTEM, interviewContext } from '@/lib/ai/prompts';

const s = (n: number) => z.string().max(n);
const In = z.object({
  role: s(200),
  company: s(200),
  location: s(200).optional(),
  match: z.array(z.object({ strength: s(20), text: s(600), evidence: z.array(s(600)).max(6), answer: s(2000).optional() })).max(30),
  proof: z.array(z.object({ metric: s(60), text: s(600), story: s(4000).optional() })).max(20),
  people: z.array(z.object({ name: s(200), label: s(200), touches: z.number().int().min(0).max(100), replied: z.boolean(), activity: z.array(s(800)).max(6) })).max(20),
  research: z.array(z.object({ title: s(300), detail: s(2000) })).max(30),
});

export async function POST(req: Request) {
  try {
    const brief = await readBody(req, In);
    const out = await askJSON({
      schema: QuestionsOut,
      system: INTERVIEW_SYSTEM,
      messages: [{ role: 'user', content: interviewContext(brief) }],
      effort: 'medium',
    });
    return Response.json({ ...out, source: 'claude' });
  } catch (e) {
    return errorResponse(e);
  }
}

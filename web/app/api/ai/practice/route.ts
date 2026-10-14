import { z } from 'zod';
import { FAST_MODEL, askJSON, errorResponse } from '@/lib/ai/server';
import { readBody } from '@/lib/ai/request';
import { PracticeOut } from '@/lib/ai/schemas';

const In = z.object({
  company: z.string().max(200),
  role: z.string().max(200),
  question: z.string().min(3).max(600),
  answer: z.string().min(1).max(6000),
  proof: z.array(z.string().max(600)).max(20),
});

const SYSTEM = [
  'You coach someone through a practice interview answer for a specific sales role.',
  'Judge the answer the way the hiring manager will: did it answer the question, is there a',
  'number, is it their own doing ("I", not "we"), does it end on a result.',
  'Feedback is two to four plain sentences with contractions, warm and direct, no "great answer".',
  'The stronger version keeps their facts and voice. Never invent a number, a name or an outcome.',
].join('\n');

export async function POST(req: Request) {
  try {
    const b = await readBody(req, In);
    const out = await askJSON({
      schema: PracticeOut,
      model: FAST_MODEL,
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content:
            `Role: ${b.role} at ${b.company}\nTheir proof:\n- ${b.proof.join('\n- ') || '(none)'}\n\n` +
            `Question: ${b.question}\n\nTheir answer:\n${b.answer}`,
        },
      ],
      effort: 'low',
      maxTokens: 4000,
    });
    return Response.json(out);
  } catch (e) {
    return errorResponse(e);
  }
}

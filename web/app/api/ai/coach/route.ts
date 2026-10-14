import { z } from 'zod';
import { askJSON, errorResponse } from '@/lib/ai/server';
import { readBody } from '@/lib/ai/request';
import { CoachOut } from '@/lib/ai/schemas';
import { PREP_SYSTEM, prepHead } from '@/lib/ai/prompts';

const In = z.object({
  company: z.string().max(200),
  role: z.string().max(200),
  item: z.object({ kind: z.enum(['story', 'gap']), label: z.string().max(600) }),
  history: z.array(z.object({ role: z.enum(['coach', 'user']), text: z.string().max(4000) })).max(40),
});

/* The coach talks like a person: short, warm, contractions, one question at
   a time. Its replies arrive as one to three chat bubbles. */
const VOICE =
  '\n\nWrite like a friendly sales manager over coffee: contractions, plain words, no jargon, no "great answer". ' +
  'Put what you say in bubbles: usually one, two when you react to something they said before asking the next thing.';

export async function POST(req: Request) {
  try {
    const b = await readBody(req, In);
    const messages = [
      { role: 'user' as const, content: prepHead({ company: b.company, role: b.role }, b.item) },
      ...b.history.map((t) => ({ role: t.role === 'coach' ? ('assistant' as const) : ('user' as const), content: t.text })),
    ];
    /* the conversation must end on their turn */
    if (messages[messages.length - 1].role !== 'user') messages.push({ role: 'user', content: 'Go on.' });
    const out = await askJSON({ schema: CoachOut, system: PREP_SYSTEM + VOICE, messages, effort: 'low', maxTokens: 4000 });
    return Response.json(out);
  } catch (e) {
    return errorResponse(e);
  }
}

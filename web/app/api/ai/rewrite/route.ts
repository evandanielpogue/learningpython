import { z } from 'zod';
import { FAST_MODEL, askJSON, errorResponse } from '@/lib/ai/server';
import { readBody } from '@/lib/ai/request';
import { RewriteOut } from '@/lib/ai/schemas';
import { REWRITE_SYSTEM } from '@/lib/ai/prompts';

const In = z.object({
  ask: z.string().min(1).max(500),
  subject: z.string().max(300).default(''),
  draft: z.string().min(1).max(8000),
  channel: z.string().max(20),
  to: z.string().max(200),
  stories: z.array(z.string().max(2000)).max(10).default([]),
});

export async function POST(req: Request) {
  try {
    const b = await readBody(req, In);
    const out = await askJSON({
      schema: RewriteOut,
      model: FAST_MODEL,
      system: REWRITE_SYSTEM + '\nKeep every [bracketed placeholder] that is still in the draft.',
      messages: [
        {
          role: 'user',
          content:
            `Channel: ${b.channel}. To: ${b.to}.\n` +
            (b.stories.length ? `Stories they have told, for facts only:\n- ${b.stories.join('\n- ')}\n\n` : '') +
            (b.subject ? `Subject: ${b.subject}\n` : '') +
            `Draft:\n<draft>\n${b.draft}\n</draft>\n\nWhat they want: ${b.ask}`,
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

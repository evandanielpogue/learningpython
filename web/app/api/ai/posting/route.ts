import { z } from 'zod';
import { AIError, MODEL, aiEnabled, anthropic, errorResponse, toAIError } from '@/lib/ai/server';
import { readBody } from '@/lib/ai/request';
import { POSTING_EMPTY, POSTING_HTTPS_ONLY, POSTING_LINKEDIN_REFUSAL, POSTING_NOT_A_POSTING, POSTING_SYSTEM, postingMessage } from '@/lib/ai/prompts';
import { noFetch, fetchable } from '@/lib/engine/sources';

const In = z.object({ url: z.string().url().max(2000) });

/* A browser cannot read another site's page, so the model's own web fetch
   reads the posting. Sites that forbid automated access are blocked here
   and at the tool. */
export async function POST(req: Request) {
  try {
    if (!aiEnabled()) throw new AIError('No model is configured.', 503);
    const { url } = await readBody(req, In);
    if (!/^https:\/\//i.test(url)) throw new AIError(POSTING_HTTPS_ONLY, 400);
    if (!fetchable(url)) throw new AIError(POSTING_LINKEDIN_REFUSAL, 400);

    const messages: Parameters<ReturnType<typeof anthropic>['messages']['create']>[0]['messages'] = [
      { role: 'user', content: postingMessage(url) },
    ];
    const tools = [{ type: 'web_fetch_20260209' as const, name: 'web_fetch' as const, max_uses: 2, max_content_tokens: 20000, blocked_domains: noFetch }];
    let text = '';
    /* a long fetch can pause the turn; resume it a couple of times at most */
    for (let i = 0; i < 3; i++) {
      const res = await anthropic().messages.create({ model: MODEL, max_tokens: 16000, system: POSTING_SYSTEM, messages, tools, output_config: { effort: 'low' } });
      if (res.stop_reason === 'refusal') throw new AIError('The model declined that page.', 422);
      text = res.content.map((b) => (b.type === 'text' ? b.text : '')).join('').trim();
      if (res.stop_reason !== 'pause_turn') break;
      messages.push({ role: 'assistant', content: res.content });
    }
    if (!text) throw new AIError(POSTING_EMPTY, 422);
    if (text.includes(POSTING_NOT_A_POSTING)) throw new AIError('That page did not have a job posting on it.', 422);
    return Response.json({ text });
  } catch (e) {
    return errorResponse(toAIError(e));
  }
}

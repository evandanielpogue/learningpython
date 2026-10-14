import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type { z } from 'zod';

/* Every model call goes through here, on the server. The key comes from the
   environment and never reaches the browser. */

export const MODEL = 'claude-opus-5-5';
/* short rewrites and quick turns, where speed matters more than depth */
export const FAST_MODEL = 'claude-sonnet-5-5';

export function aiEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let client: Anthropic | null = null;
function anthropic(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}

export class AIError extends Error {
  constructor(
    message: string,
    readonly status = 502,
  ) {
    super(message);
  }
}

type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

interface Ask<S extends z.ZodType> {
  schema: S;
  system: string;
  messages: Anthropic.Beta.Messages.BetaMessageParam[];
  model?: string;
  effort?: Effort;
  maxTokens?: number;
}

/* Structured output, validated against a Zod schema. Server-side fallbacks
   are on: if a safety classifier declines, the API re-runs the request on a
   suitable model instead of failing the user's step. */
export async function askJSON<S extends z.ZodType>({ schema, system, messages, model = MODEL, effort = 'medium', maxTokens = 16000 }: Ask<S>): Promise<z.infer<S>> {
  if (!aiEnabled()) throw new AIError('No model is configured.', 503);
  try {
    const res = await anthropic().beta.messages.parse({
      model,
      max_tokens: maxTokens,
      system,
      messages,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort, format: betaZodOutputFormat(schema) },
    });
    if (res.stop_reason === 'refusal') throw new AIError('The model declined that one.', 422);
    if (res.stop_reason === 'max_tokens') throw new AIError('The answer ran too long. Try a shorter input.', 422);
    if (res.parsed_output == null) throw new AIError('The model did not return the shape we asked for.');
    return res.parsed_output as z.infer<S>;
  } catch (e) {
    throw toAIError(e);
  }
}

export function toAIError(e: unknown): AIError {
  if (e instanceof AIError) return e;
  if (e instanceof Anthropic.AuthenticationError) return new AIError('The API key was rejected.', 503);
  if (e instanceof Anthropic.RateLimitError) return new AIError('Rate limited. Wait a moment and try again.', 429);
  if (e instanceof Anthropic.BadRequestError) return new AIError(e.message, 400);
  if (e instanceof Anthropic.APIError) return new AIError(`The model service failed (${e.status ?? 'network'}).`, 502);
  return new AIError(e instanceof Error ? e.message : 'Something went wrong.', 500);
}

export function errorResponse(e: unknown): Response {
  const err = toAIError(e);
  return Response.json({ error: err.message }, { status: err.status });
}

export { anthropic };

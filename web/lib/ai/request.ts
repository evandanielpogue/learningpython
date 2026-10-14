import 'server-only';
import { z } from 'zod';
import { AIError } from './server';

/* Every route reads its body through here: JSON only, size-capped, shape
   checked. A bad request never reaches the model. */
const MAX_BYTES = 200_000;

export async function readBody<S extends z.ZodType>(req: Request, schema: S): Promise<z.infer<S>> {
  const raw = await req.text();
  if (raw.length > MAX_BYTES) throw new AIError('That is too much text to send at once.', 413);
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new AIError('The request was not JSON.', 400);
  }
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new AIError('The request was missing something.', 400);
  return parsed.data;
}

export const ProofIn = z.object({
  id: z.string().max(80),
  text: z.string().max(600),
  metric: z.string().max(60).default(''),
  where: z.string().max(200).default(''),
});

export const RoleIn = z.object({
  title: z.string().max(200),
  company: z.string().max(200),
  span: z.string().max(80),
  bullets: z.array(z.string().max(600)).max(30),
});

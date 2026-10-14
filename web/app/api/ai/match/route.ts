import { z } from 'zod';
import { askJSON, errorResponse } from '@/lib/ai/server';
import { ProofIn, RoleIn, readBody } from '@/lib/ai/request';
import { MatchOut } from '@/lib/ai/schemas';
import { MATCH_SYSTEM, matchMessage } from '@/lib/ai/prompts';

const In = z.object({
  listing: z.string().min(20).max(40_000),
  proof: z.array(ProofIn).max(40),
  roles: z.array(RoleIn).max(20),
  requirements: z.array(z.string().max(600)).max(30).default([]),
});

export async function POST(req: Request) {
  try {
    const b = await readBody(req, In);
    const out = await askJSON({
      schema: MatchOut,
      system: MATCH_SYSTEM + '\n\nCopy each requirement whole. Refer to proof only by the ids given.',
      messages: [{ role: 'user', content: matchMessage(b.listing, b.proof, b.roles, b.requirements) }],
      effort: 'medium',
    });
    /* never trust an id the model made up */
    const ids = new Set(b.proof.map((p) => p.id));
    out.requirements = out.requirements.map((r) => ({ ...r, proofIds: r.proofIds.filter((id) => ids.has(id)) }));
    return Response.json(out);
  } catch (e) {
    return errorResponse(e);
  }
}

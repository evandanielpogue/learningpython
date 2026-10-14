/* ==========================================================================
   What the listing asks for against what you have.

   The model does this properly. Without one, tags are matched against the
   requirement text, which is blunt but honest about being blunt.
   ========================================================================== */
import type { MatchScore, Proof, Requirement } from '../types';
import { uid } from './ids';

export interface RankedProof {
  proof: Proof;
  score: number;
  hits: string[];
}

/** Score every proof point against the listing, best first. */
export function rankProof(proof: Proof[], listingText: string): RankedProof[] {
  const hay = String(listingText || '').toLowerCase();
  return proof
    .map((p) => {
      const hits = (p.tags || []).filter((t) => hay.indexOf(t) > -1);
      return { proof: p, score: hits.length, hits };
    })
    .sort((a, b) => b.score - a.score);
}

const STOP =
  /^(the|and|for|with|you|your|our|that|this|from|into|able|have|has|will|who|are|was|were|they|them|their|a|an|of|to|in|on|at|as|by|or|it|is|be|do|not|all|any|can|how|what|when|more|most|than|then|through|across|using|used|use|help|helps|work|works|working|new|next|every|each|per|up|out|off|over|under|about|also|its)$/;

function words(t: string): string[] {
  return String(t)
    .toLowerCase()
    .replace(/[^a-z0-9+ ]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.test(w));
}

/** Match each requirement line against the proof list. `listingText` is
    accepted for parity with the model-backed matcher and is not needed by
    the local one. */
export function matchLocally(requirementTexts: string[], listingText: string, proof: Proof[]): Requirement[] {
  void listingText;
  return (requirementTexts || []).map((r) => {
    const hay = String(r).toLowerCase();
    const rw = words(r);
    const hits = proof
      .map((w) => {
        const tagHits = (w.tags || []).filter((t) => hay.indexOf(t) > -1).length;
        const ww = words(w.text + ' ' + w.short);
        const shared = rw.filter((x) => ww.indexOf(x) > -1).length;
        return { id: w.id, n: tagHits * 2 + shared };
      })
      .filter((x) => x.n)
      .sort((a, b) => b.n - a.n);
    return {
      id: uid('req'),
      text: r,
      priority: /\b(\d\+? years|must|required|minimum)\b/i.test(r) ? 'must' : 'nice',
      proofIds: hits.slice(0, 2).map((x) => x.id),
      strength: hits.length && hits[0].n >= 3 ? 'strong' : hits.length ? 'partial' : 'none',
      note: '',
    } satisfies Requirement;
  });
}

export function matchScore(requirements: Requirement[] | null | undefined): MatchScore {
  const m = requirements || [];
  return {
    total: m.length,
    covered: m.filter((r) => r.strength !== 'none').length,
    gaps: m.filter((r) => r.strength === 'none'),
  };
}

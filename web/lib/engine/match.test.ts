import { describe, expect, it } from 'vitest';
import { matchLocally, matchScore, rankProof } from './match';
import { parseListing } from './listing';
import { ACME_LISTING, exampleProfile } from './seed';

const profile = exampleProfile(new Date('2026-06-01'));

describe('rankProof', () => {
  it('scores tags found in the listing, best first', () => {
    const ranked = rankProof(profile.proof, ACME_LISTING);
    expect(ranked).toHaveLength(profile.proof.length);
    expect(ranked[0].score).toBeGreaterThanOrEqual(ranked[1].score);
    expect(ranked.slice(0, 3).map((r) => r.proof.id)).toEqual(['w1', 'w2', 'w3']);
    expect(ranked[0].hits.length).toBe(ranked[0].score);
  });
  it('does not mutate the input order', () => {
    const before = profile.proof.map((p) => p.id);
    rankProof(profile.proof, ACME_LISTING);
    expect(profile.proof.map((p) => p.id)).toEqual(before);
  });
  it('scores nothing for an empty listing', () => {
    expect(rankProof(profile.proof, '').every((r) => r.score === 0)).toBe(true);
  });
});

describe('matchLocally and matchScore on the Acme example', () => {
  const reqs = matchLocally(parseListing(ACME_LISTING).requirements, ACME_LISTING, profile.proof);
  const score = matchScore(reqs);

  it('makes one requirement per line', () => {
    expect(reqs).toHaveLength(8);
    expect(new Set(reqs.map((r) => r.id)).size).toBe(8);
  });

  it('covers five of eight', () => {
    expect(score).toMatchObject({ covered: 5, total: 8 });
  });

  it('names the three gaps', () => {
    expect(score.gaps.map((g) => g.text)).toEqual([
      'Work RevOps buyers through a multi threaded evaluation',
      'Ramp fast and help the next hires ramp faster',
      'A track record of quota attainment you can talk through',
    ]);
    expect(score.gaps.every((g) => g.strength === 'none' && g.proofIds.length === 0)).toBe(true);
  });

  it('is strong where the tags line up and points at the proof', () => {
    const pricing = reqs.find((r) => /pricing or packaging/.test(r.text))!;
    expect(pricing.strength).toBe('strong');
    expect(pricing.proofIds).toEqual(['w1']);
  });

  it('calls a years line a must', () => {
    expect(reqs.find((r) => /5\+ years/.test(r.text))!.priority).toBe('must');
  });

  it('copes with no proof at all', () => {
    const none = matchLocally(['Run full cycle from first call to close'], '', []);
    expect(none[0].strength).toBe('none');
  });

  it('matchScore tolerates null', () => {
    expect(matchScore(null)).toEqual({ total: 0, covered: 0, gaps: [] });
  });
});

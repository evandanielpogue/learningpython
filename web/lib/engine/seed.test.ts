import { describe, expect, it } from 'vitest';
import { ACME_LISTING, exampleOpportunity, exampleProfile } from './seed';
import { buildAgenda } from './agenda';
import { matchScore } from './match';

describe('exampleProfile', () => {
  const p = exampleProfile(new Date('2026-06-01'));
  it('is Evan, read by the parser, with stable ids', () => {
    expect(p).toMatchObject({ name: 'Evan Pogue', imported: true, photo: null, years: 8 });
    expect(p.roles.map((r) => r.id)).toEqual(['r1', 'r2', 'r3']);
    expect(p.proof.map((w) => w.id)).toEqual(['w1', 'w2', 'w3', 'w4', 'w5', 'w6']);
  });
});

describe('exampleOpportunity', () => {
  const profile = exampleProfile(new Date('2026-06-01'));
  const o = exampleOpportunity(profile, 1_800_000_000_000);

  it('is Acme, flagged as the example, at the tailor step', () => {
    expect(o).toMatchObject({
      company: 'Acme', role: 'Mid-Market Account Executive', req: '4821', example: true,
      done: ['upload'], open: 'tailor', outcome: 'open', booked: false, listing: ACME_LISTING,
    });
  });
  it('leads with proof that exists on the profile', () => {
    expect(o.proofIds).toHaveLength(3);
    for (const id of o.proofIds) expect(profile.proof.some((p) => p.id === id)).toBe(true);
  });
  it('has its contacts, suggestions, research and touches', () => {
    expect(o.contacts).toHaveLength(5);
    expect(o.suggested).toHaveLength(2);
    expect(o.research).toHaveLength(5);
    expect(o.touches).toHaveLength(10);
    expect(o.touches.every((t) => !t.contactId || o.contacts.some((c) => c.id === t.contactId))).toBe(true);
    expect(o.touches.map((t) => t.status).filter((s) => s !== 'queued')).toEqual(['sent', 'replied', 'sent', 'due']);
  });
  it('matches the listing against the profile', () => {
    expect(matchScore(o.requirements)).toMatchObject({ covered: 5, total: 8 });
    expect(buildAgenda(o, profile.proof)).toHaveLength(6);
  });
  it('is three days old', () => {
    expect(o.updatedAt - o.createdAt).toBe(3 * 86400000);
    expect(o.timeline[0].kind).toBe('created');
  });
  it('shares no state between calls', () => {
    const a = exampleOpportunity(profile, 1);
    a.contacts[0].name = 'Changed';
    expect(exampleOpportunity(profile, 1).contacts[0].name).toBe('Dana Koh');
  });
});

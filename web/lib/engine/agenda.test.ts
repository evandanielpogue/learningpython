import { describe, expect, it } from 'vitest';
import { answerAgenda, buildAgenda, skipAgenda, stories } from './agenda';
import { exampleOpportunity, exampleProfile } from './seed';

const profile = exampleProfile(new Date('2026-06-01'));
const base = exampleOpportunity(profile, 1_800_000_000_000);

describe('buildAgenda', () => {
  const items = buildAgenda(base, profile.proof);

  it('has a story per proof point led with, then up to four gaps', () => {
    expect(items.map((i) => i.kind)).toEqual(['story', 'story', 'story', 'gap', 'gap', 'gap']);
    expect(items.filter((i) => i.kind === 'story').map((i) => i.ref)).toEqual(base.proofIds);
    expect(items[0].ask).toBe('What actually happened behind this');
    expect(items[3].ask).toBe('Nothing on your résumé answers this');
    expect(items.every((i) => !i.done && i.text === '')).toBe(true);
  });

  it('points gaps at requirement ids', () => {
    const ids = base.requirements.filter((r) => r.strength === 'none').map((r) => r.id);
    expect(items.filter((i) => i.kind === 'gap').map((i) => i.ref)).toEqual(ids);
  });

  it('keeps an agenda that already exists', () => {
    const withAgenda = { ...base, agenda: items };
    expect(buildAgenda(withAgenda, profile.proof)).toBe(items);
  });
});

describe('answerAgenda / skipAgenda / stories', () => {
  const agenda = buildAgenda(base, profile.proof);
  const opp = { ...base, agenda };

  it('records an answer without touching the input', () => {
    const next = answerAgenda(opp, agenda[0].id, 'I rewrote discovery.');
    expect(next.agenda[0]).toMatchObject({ text: 'I rewrote discovery.', done: true });
    expect(opp.agenda[0].done).toBe(false);
    expect(next).not.toBe(opp);
    expect(stories(next).map((s) => s.text)).toEqual(['I rewrote discovery.']);
  });

  it('un-does an item when the answer is emptied', () => {
    const answered = answerAgenda(opp, agenda[0].id, 'Something');
    const cleared = answerAgenda(answered, agenda[0].id, '   ');
    expect(cleared.agenda[0].done).toBe(false);
    expect(stories(cleared)).toEqual([]);
  });

  it('records a skip', () => {
    const next = skipAgenda(opp, agenda[1].id);
    expect(next.agenda[1].skipped).toBe(true);
    expect(opp.agenda[1].skipped).toBeUndefined();
  });

  it('ignores an id it does not know', () => {
    expect(answerAgenda(opp, 'nope', 'x')).toBe(opp);
    expect(skipAgenda(opp, 'nope')).toBe(opp);
  });

  it('stories tolerates null', () => {
    expect(stories(null)).toEqual([]);
  });
});

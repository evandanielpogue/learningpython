import { describe, expect, it } from 'vitest';
import { EXAMPLE_RESUME, fromModel, parseResume } from './resume';

describe('parseResume on the example résumé', () => {
  const now = new Date('2026-06-01');
  const p = parseResume(EXAMPLE_RESUME, 'Evan_Pogue.pdf', now);

  it('reads the contact block', () => {
    expect(p.name).toBe('Evan Pogue');
    expect(p.email).toBe('evan@example.com');
    expect(p.phone).toBe('312 555 0148');
    expect(p.location).toBe('Chicago, IL');
  });

  it('reads three roles with their bullets', () => {
    expect(p.roles).toHaveLength(3);
    expect(p.roles.map((r) => r.bullets.length)).toEqual([3, 3, 2]);
    expect(p.roles[0].title).toBe('Senior AE, Mid-Market');
    expect(p.roles[0].company).toBe('Brightline, Chicago');
    expect(p.roles[0].span).toBe('2023 to now');
    expect(p.roles[2].title).toBe('SDR, then AE');
  });

  it('works out years from the earliest start', () => {
    expect(p.years).toBe(8);
  });

  it('pulls a proof point from every bullet with a number in it', () => {
    expect(p.proof).toHaveLength(6);
    expect(p.proof.map((w) => w.metric)).toEqual(['$1.2M', '30\u219270', '40%', '41%', 'Top 3', '$340k']);
  });

  it('labels each number with the clause it sits in, number taken out', () => {
    expect(p.proof[1].short).toBe('rebuilt discovery when cycles went');
    expect(p.proof[2].short).toBe('held the team together through attrition');
    expect(p.proof[3].short).toBe('grew territory ARR year over year');
  });

  it('tags proof for matching', () => {
    const pricing = p.proof.find((w) => w.text.includes('pricing'))!;
    expect(pricing.tags).toContain('pricing');
    expect(pricing.where).toBe('Brightline, Chicago, 2023 to now');
  });

  it('reads the tools line and recognises tools in the text', () => {
    expect(p.stack).toEqual(expect.arrayContaining(['Salesforce', 'HubSpot', 'Gong', 'MEDDPICC']));
    expect(new Set(p.stack.map((t) => t.toLowerCase())).size).toBe(p.stack.length);
  });

  it('reads the voice off the bullets', () => {
    expect(p.voice.traits).toEqual(['Short lines', 'Numbers first', 'One ask']);
  });

  it('has nothing missing', () => {
    expect(p.missing).toEqual([]);
  });

  it('names what it could not find rather than inventing it', () => {
    const empty = parseResume('just some words');
    expect(empty.roles).toEqual([]);
    expect(empty.missing).toEqual(expect.arrayContaining(['email', 'roles', 'proof']));
  });
});

describe('fromModel', () => {
  it('normalises a model result and adds ids', () => {
    const p = fromModel({
      name: 'Ada Lovelace', years: '7',
      roles: [{ title: 'Engineer', company: 'Analytical', span: '2020 to now', bullets: ['Built it', ''] }, { title: '', company: '' }],
      proof: [
        { text: 'Cut cycle 30%', metric: '30%', short: 'cycle time', where: 'Analytical', tags: ['Cycle'] },
        { text: 'no metric', metric: '' },
      ],
      tools: ['Python', ''],
      voice: ['Short lines'],
    });
    expect(p.name).toBe('Ada Lovelace');
    expect(p.years).toBe(7);
    expect(p.roles).toHaveLength(1);
    expect(p.roles[0].bullets).toEqual(['Built it']);
    expect(p.roles[0].id).toMatch(/^r_/);
    expect(p.proof).toHaveLength(1);
    expect(p.proof[0].tags).toEqual(['cycle']);
    expect(p.stack).toEqual(['Python']);
    expect(p.missing).toEqual(expect.arrayContaining(['email']));
  });

  it('still accepts the prototype name `wins`', () => {
    const p = fromModel({ wins: [{ text: 'Grew ARR 41%', metric: '41%' }] });
    expect(p.proof).toHaveLength(1);
  });

  it('clamps years', () => {
    expect(fromModel({ years: 400 }).years).toBe(60);
    expect(fromModel({ years: 'lots' }).years).toBe(0);
  });
});

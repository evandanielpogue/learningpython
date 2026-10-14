import { ACME_LISTING } from './seed';
import { describe, expect, it } from 'vitest';
import { fullRequirement, parseListing } from './listing';
import { LISTINGS } from './listing.fixtures';

describe('parseListing: postings people actually paste', () => {
  for (const f of LISTINGS) {
    it('reads a ' + f.name.toLowerCase() + ' posting', () => {
      const p = parseListing(f.text);
      const bad: string[] = [];
      for (const [k, want] of Object.entries(f.want)) {
        const got = (p as unknown as Record<string, string>)[k] || '';
        const ok = want instanceof RegExp ? want.test(got) : got === want;
        if (!ok) bad.push(k + ' = "' + got + '"');
      }
      if (!p.requirements.length) bad.push('nothing asked for came out');
      expect(bad).toEqual([]);
    });
  }

  it('reads the HubSpot LinkedIn-style posting field by field', () => {
    const p = parseListing(LISTINGS[0].text);
    expect(p.company).toBe('HubSpot');
    expect(p.role).toBe('Enterprise Account Executive');
    expect(p.location).toMatch(/Cambridge, MA/);
    expect(p.requirements).toContain('5+ years of closing experience in SaaS');
    expect(p.facts).toContain('Enterprise segment');
  });

  it('leaves a field blank rather than inventing one', () => {
    const p = parseListing('Some notes I pasted by mistake.\nNothing useful in here at all.');
    expect(p.company).toBe('');
  });

  it('never returns a requirement as the job title', () => {
    for (const f of LISTINGS) {
      expect(parseListing(f.text).role).not.toMatch(/^[-–—•*]\s|^\d+[.)]\s|^\d+\+? years/i);
    }
  });

  it('returns the empty shape for empty input', () => {
    expect(parseListing('')).toEqual({ role: '', company: '', location: '', req: '', requirements: [], facts: [] });
  });

  it('reads a requisition number and caps requirements at eight', () => {
    const many = ['Account Executive', 'Acme', 'Req 4821', ...Array.from({ length: 12 }, (_, i) => '- requirement number ' + i + ' of many')];
    const p = parseListing(many.join('\n'));
    expect(p.req).toBe('4821');
    expect(p.requirements).toHaveLength(8);
  });

  it('falls back to requirement-sounding sentences when there are no bullets', () => {
    const p = parseListing('Account Executive\nAcme\nYou must have 5 years of experience selling software. We like cats.');
    expect(p.requirements.some((r) => /5 years/.test(r))).toBe(true);
  });

  it('flags pricing changes (alternation fix)', () => {
    expect(parseListing('Account Executive\nAcme\n- sold through a repackaging effort\n').facts).not.toContain('Pricing change in play');
    expect(parseListing('Account Executive\nAcme\n- sold through a pricing change\n').facts).toContain('Pricing change in play');
  });
});

describe('fullRequirement', () => {
  const listing = 'Role\n- Run full cycle from first call to close against a $1.1M annual number\n- Other';
  it('recovers a clipped requirement from the listing', () => {
    expect(fullRequirement(listing, 'Run full cycle from first call to…')).toBe(
      'Run full cycle from first call to close against a $1.1M annual number',
    );
  });
  it('leaves a whole requirement alone', () => {
    expect(fullRequirement(listing, 'Anything')).toBe('Anything');
  });
  it('returns the text when the listing cannot help', () => {
    expect(fullRequirement('', 'Clipped…')).toBe('Clipped…');
    expect(fullRequirement(listing, 'Not in there…')).toBe('Not in there…');
  });
});

describe('a city with how they work', () => {
  it('keeps the city in "Chicago, hybrid"', () => {
    expect(parseListing(ACME_LISTING).location).toBe('Chicago, hybrid');
    expect(parseListing('Account Executive\nLoom · Austin, remote\n\n- 3+ years selling SaaS').location).toBe('Austin, remote');
  });
});

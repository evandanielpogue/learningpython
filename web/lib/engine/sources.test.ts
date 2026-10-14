import { describe, expect, it } from 'vitest';
import { all, fetchable, get, groups, linkFor, noFetch, parse, parseQuestions, parseReviews } from './sources';

describe('catalogue', () => {
  it('has eleven sources in four groups', () => {
    expect(all()).toHaveLength(11);
    expect(groups().map((g) => g.name)).toEqual(['Interviews', 'Inside', 'Customers', 'The company']);
  });
  it('builds search links from the company and role', () => {
    expect(linkFor('gd-int', 'Acme Co', 'AE')).toBe(
      'https://www.glassdoor.com/Search/results.htm?keyword=Acme%20Co%20AE%20interview',
    );
    expect(linkFor('indeed', 'Acme Co')).toBe('https://www.indeed.com/cmp/Acme-Co/reviews');
    expect(linkFor('nope', 'Acme')).toBe('');
    expect(get('g2')?.paste).toBe('customers');
  });
});

describe('fetchable', () => {
  it('refuses sites that need a login or forbid collection', () => {
    expect(noFetch).toContain('linkedin.com');
    expect(fetchable('https://www.linkedin.com/jobs/view/1')).toBe(false);
    expect(fetchable('https://www.glassdoor.com/Interview/x')).toBe(false);
    expect(fetchable('https://boards.greenhouse.io/acme/jobs/1')).toBe(true);
  });
});

describe('parse', () => {
  it('keeps questions and drops the rest', () => {
    const out = parseQuestions('1. Tell me about a time you lost a deal\n- Salary was fine\n* How do you forecast?\n\nshort', 'Reddit');
    expect(out.map((o) => o.title)).toEqual(['Tell me about a time you lost a deal', 'How do you forecast?']);
    expect(out[0]).toMatchObject({ kind: 'Interview question', source: 'Reddit' });
  });
  it('sorts reviews into gripes and voices', () => {
    const out = parseReviews('The reporting is slow and clunky\nLoved the onboarding team a lot');
    expect(out.map((o) => o.kind)).toEqual(['Customer gripe', 'Customer voice']);
  });
  it('routes by mode', () => {
    expect(parse('questions', 'Why do you want this job?')[0].kind).toBe('Interview question');
    expect(parse('customers', 'It is expensive for what it does')[0].kind).toBe('Customer gripe');
    expect(parse('notes', 'Something I noticed on the site')[0]).toMatchObject({ kind: 'Note', source: 'pasted' });
  });
});

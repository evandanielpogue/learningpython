import { describe, expect, it } from 'vitest';
import { colourFor, lookupLinkedIn, readProfile, suggestFor } from './people';
import { exampleOpportunity, exampleProfile } from './seed';

const opp = exampleOpportunity(exampleProfile(new Date('2026-06-01')), 1_800_000_000_000);

describe('suggestFor', () => {
  const s = suggestFor('Acme Robotics', 'Mid-Market Account Executive');
  it('suggests three seats, all placeholders', () => {
    expect(s.map((x) => x.persona)).toEqual(['Hiring manager', 'Recruiter', 'Shared tie']);
    expect(s.every((x) => x.placeholder)).toBe(true);
    expect(new Set(s.map((x) => x.id)).size).toBe(3);
  });
  it('names the segment and guesses the domain', () => {
    expect(s[0].name).toBe('Director, Mid-Market');
    expect(s[0].email).toBe('first.last@acmerobotics.com');
    expect(s[1].email).toBe('talent@acmerobotics.com');
    expect(s[2].guessedEmail).toBe(false);
  });
  it('falls back to Sales, and picks Enterprise', () => {
    expect(suggestFor('X', 'Analyst')[0].name).toBe('Director, Sales');
    expect(suggestFor('X', 'Enterprise AE')[0].name).toBe('Director, Enterprise');
  });
});

describe('colourFor', () => {
  it('maps a persona to a colour key', () => {
    expect(colourFor('Peer')).toBe('peer');
    expect(colourFor('Hiring manager')).toBe('manager');
    expect(colourFor('Skip level')).toBe('exec');
    expect(colourFor('Shared tie')).toBe('tie');
    expect(colourFor('Recruiter')).toBe('recruiter');
    expect(colourFor('Other')).toBe('other');
    expect(colourFor('Mystery')).toBe('other');
  });
});

describe('readProfile on pasted LinkedIn profiles', () => {
  it('reads a profile copied from the top of the page', () => {
    const p = readProfile(
      [
        'Jordan Rivera',
        '· 2nd',
        'Director of Sales at Acme',
        'Chicago, Illinois, United States',
        'Contact info',
        '500+ connections',
        'https://www.linkedin.com/in/Jordan-Rivera-3a9b21/',
      ].join('\n'),
    )!;
    expect(p.name).toBe('Jordan Rivera');
    expect(p.title).toBe('Director of Sales at Acme');
    expect(p.company).toBe('Acme');
    expect(p.persona).toBe('Hiring manager');
    expect(p.where).toBe('Chicago, Illinois, United States'.length < 40 ? 'Chicago, Illinois, United States' : '');
    expect(p.linkedin).toBe('in/jordan-rivera-3a9b21');
  });

  it('reads a recruiter with a pronoun line and a short place', () => {
    const p = readProfile(
      [
        'Priya Shah (She/Her)',
        'Message',
        'Senior Technical Recruiter @ Acme Robotics',
        'Austin, TX',
        'linkedin.com/in/priyashah',
      ].join('\n'),
    )!;
    expect(p.name).toBe('Priya Shah');
    expect(p.title).toBe('Senior Technical Recruiter @ Acme Robotics');
    expect(p.company).toBe('Acme Robotics');
    expect(p.persona).toBe('Recruiter');
    expect(p.where).toBe('Austin, TX');
    expect(p.linkedin).toBe('in/priyashah');
  });

  it('reads a VP as a skip level and a plain title as a peer', () => {
    expect(readProfile('Diane Walsh\nVP Sales at Acme\n')!.persona).toBe('Skip level');
    expect(readProfile('Dana Koh\nMid-Market AE at Acme\n')!.persona).toBe('Peer');
  });

  it('gives up when there is no name', () => {
    expect(readProfile('')).toBeNull();
    expect(readProfile('connect\nmessage\n12 followers')).toBeNull();
  });
});

describe('lookupLinkedIn', () => {
  const known = [...opp.contacts, ...opp.suggested];

  it('asks for something first', () => {
    expect(lookupLinkedIn('  ', opp.contacts, known)).toEqual({ ok: false, reason: 'Paste their LinkedIn URL first.' });
  });

  it('resolves a profile we already know about', () => {
    const r = lookupLinkedIn('https://www.linkedin.com/in/inesokafor/', opp.contacts, known);
    expect(r).toMatchObject({ ok: true, exact: true, person: { name: 'Ines Okafor', linkedin: 'in/inesokafor' } });
  });

  it('turns an unknown URL into a name', () => {
    const r = lookupLinkedIn('linkedin.com/in/dana-whitfield-8a2b91', opp.contacts, known);
    expect(r).toMatchObject({ ok: true, exact: false, person: { name: 'Dana Whitfield', persona: 'Other' } });
  });

  it('refuses rubbish and duplicates', () => {
    expect(lookupLinkedIn('not a url', opp.contacts, known)).toMatchObject({ ok: false, reason: expect.stringMatching(/does not look like/) });
    expect(lookupLinkedIn('linkedin.com/in/marcusreed', opp.contacts, known)).toEqual({
      ok: false, reason: 'Marcus Reed is already on your list.',
    });
  });

  it('reads a pasted profile and refuses one already on the list', () => {
    const paste = 'Jordan Rivera\nRevOps Manager at Acme\nChicago, IL\n';
    const r = lookupLinkedIn(paste, opp.contacts, known);
    expect(r).toMatchObject({ ok: true, exact: false, pasted: true, person: { name: 'Jordan Rivera', persona: 'Hiring manager' } });
    expect(lookupLinkedIn('Dana Koh\nMid-Market AE at Acme\n', opp.contacts, known)).toEqual({
      ok: false, reason: 'Dana Koh is already on your list.',
    });
    expect(lookupLinkedIn('hello\nthere', opp.contacts, known)).toMatchObject({ ok: false });
  });
});

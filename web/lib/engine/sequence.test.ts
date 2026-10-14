import { describe, expect, it } from 'vitest';
import {
  PLAN, bodyFor, buildSequence, counts, fill, logReply, refreshDue, templatesFor, unresolved,
} from './sequence';
import { TEMPLATES } from './templates';
import { EXAMPLE_ANGLES, exampleOpportunity, exampleProfile } from './seed';
import type { Touch } from '../types';

const NOW = 1_800_000_000_000;
const DAY = 86400000;
const profile = exampleProfile(new Date('2026-06-01'));
const opp = exampleOpportunity(profile, NOW);
const marcus = opp.contacts.find((c) => c.id === 'p3')!;
const angle = EXAMPLE_ANGLES[0].take;

describe('fill', () => {
  it('fills the placeholders', () => {
    const out = fill('{first} at {company}, re {role}. {name} / {title} / {me} / {slug}', opp, marcus, profile, profile.proof);
    expect(out).toBe(
      'Marcus at Acme, re Mid-Market Account Executive. Marcus Reed / Director, Mid-Market / Evan Pogue / evan-acme',
    );
  });

  it('says "there" with no contact', () => {
    expect(fill('{first}, hi', opp, null, profile, profile.proof)).toBe('there, hi');
  });

  it('capitalises {win} at a paragraph start and lowercases it mid-sentence', () => {
    const text = profile.proof[0].text;
    const lowered = text.charAt(0).toLowerCase() + text.slice(1);
    const out = fill('{first}, I applied. Context: {win}.\n\n{win}. Then more.\n  {win} again', opp, marcus, profile, profile.proof);
    expect(out).toContain('Context: ' + lowered + '.');
    expect(out).toContain('\n\n' + text + '. Then more.');
    expect(out).toContain('\n  ' + text + ' again');
  });

  it('puts the angle in lowercased after a comma, and drops the line when there is none', () => {
    const withAngle = fill('{first}, {angle}\n\nBody', opp, marcus, profile, profile.proof, angle);
    expect(withAngle).toBe('Marcus, ' + angle.charAt(0).toLowerCase() + angle.slice(1) + '\n\nBody');
    expect(fill('{first}, {angle}\n\nBody', opp, marcus, profile, profile.proof)).toBe('Marcus,\n\nBody');
    expect(fill('Intro\n{angle}\nBody', opp, marcus, profile, profile.proof)).toBe('Intro\nBody');
  });

  it('drops a {win} line when there is no proof', () => {
    const none = { ...opp, proofIds: [] };
    expect(fill('Hi\n{win}.\nBye', none, marcus, profile, profile.proof)).toBe('Hi\nBye');
  });

  it('does not mutate its inputs', () => {
    const before = JSON.stringify(opp);
    fill('{win}', opp, marcus, profile, profile.proof);
    expect(JSON.stringify(opp)).toBe(before);
  });
});

describe('unresolved', () => {
  it('finds bracket placeholders', () => {
    expect(unresolved('Marcus,\n\n[One sentence on what that took.] [The number.]\n\nWorth fifteen minutes?')).toEqual([
      '[One sentence on what that took.]',
      '[The number.]',
    ]);
  });
  it('finds nothing in a finished message', () => {
    expect(unresolved('Marcus,\n\nThe cycle went from 70 days to 41.')).toEqual([]);
    expect(unresolved('')).toEqual([]);
    expect(unresolved('[ab]')).toEqual([]);
  });
});

describe('buildSequence', () => {
  const touches = buildSequence(opp, TEMPLATES, profile, profile.proof, angle);

  it('builds the plan against whoever is on the list', () => {
    expect(touches.map((t) => t.day)).toEqual(PLAN.map((p) => p.day));
    expect(touches.every((t) => t.status === 'queued')).toBe(true);
    expect(touches[0]).toMatchObject({ channel: 'ATS', contactId: null, templateId: null, body: '' });
  });

  it('matches a template and a contact per row', () => {
    const hm = touches.find((t) => t.templateId === 'tpl_hm')!;
    expect(hm.contactId).toBe('p3');
    expect(hm.subject).toBe('applied for the Mid-Market Account Executive');
    expect(hm.body.startsWith('Marcus, seat pricing moved your SMB floor')).toBe(true);
    expect(unresolved(hm.body)).toHaveLength(1);
    const brk = touches[touches.length - 1];
    expect(brk).toMatchObject({ templateId: 'tpl_break', contactId: 'p3', subject: 'closing the loop' });
  });

  it('leaves out anything with nobody to send it to', () => {
    const lonely = { ...opp, contacts: opp.contacts.filter((c) => c.persona === 'Peer') };
    const t = buildSequence(lonely, TEMPLATES, profile, profile.proof);
    expect(t.every((x) => x.contactId === null || x.contactId === 'p1')).toBe(true);
    expect(t.length).toBeLessThan(PLAN.length);
  });

  it('keeps the person-less ATS row even with no contacts', () => {
    const t = buildSequence({ ...opp, contacts: [] }, TEMPLATES, profile, profile.proof);
    expect(t.map((x) => x.channel)).toEqual(['ATS', 'Email']);
    expect(t[1].contactId).toBeNull();
  });
});

describe('bodyFor', () => {
  it('keeps a body that is already written', () => {
    const t = opp.touches[0];
    expect(bodyFor(t, opp, TEMPLATES, profile, profile.proof)).toBe(t.body);
  });
  it('resolves a template the touch only points at', () => {
    const t = opp.touches.find((x) => x.id === 's3')!;
    const body = bodyFor(t, opp, TEMPLATES, profile, profile.proof);
    expect(body.startsWith('Priya, I applied for the Mid-Market Account Executive on Tuesday.')).toBe(true);
    expect(body).not.toMatch(/\{/);
  });
  it('is empty with no template', () => {
    expect(bodyFor({ ...opp.touches[2], templateId: null }, opp, TEMPLATES, profile, profile.proof)).toBe('');
  });
});

describe('logReply', () => {
  const t = (id: string, contactId: string | null, day: number, status: Touch['status']): Touch => ({
    id, contactId, day, status, templateId: null, channel: 'Email', note: '', subject: '', body: '',
  });
  const touches = [
    t('a', 'p1', 0, 'sent'), t('b', 'p1', 4, 'queued'), t('c', 'p1', 8, 'due'),
    t('d', 'p2', 3, 'queued'), t('e', 'p1', 9, 'sent'),
  ];

  it("marks the reply and drops that contact's later touches", () => {
    const { touches: next, dropped } = logReply(touches, 'a');
    expect(dropped).toBe(2);
    expect(next.map((x) => x.status)).toEqual(['replied', 'skipped', 'skipped', 'queued', 'sent']);
  });

  it('does not mutate the input', () => {
    logReply(touches, 'a');
    expect(touches[0].status).toBe('sent');
    expect(touches[1].status).toBe('queued');
  });

  it('ignores an unknown touch', () => {
    const r = logReply(touches, 'zzz');
    expect(r.dropped).toBe(0);
    expect(r.touches).toBe(touches);
  });

  it('works on the example: Dana replying drops her referral ask', () => {
    const { touches: next, dropped } = logReply(opp.touches, 's2');
    expect(dropped).toBe(1);
    expect(next.find((x) => x.id === 's6')!.status).toBe('skipped');
    expect(counts(next)).toEqual({ sent: 3, replies: 1 });
  });
});

describe('refreshDue', () => {
  it('makes queued touches due once their day has come', () => {
    const queued = { ...opp, touches: opp.touches.map((x) => (x.status === 'due' ? { ...x, status: 'queued' as const } : x)) };
    const out = refreshDue(queued, NOW);
    expect(out.touches.filter((x) => x.status === 'queued' && x.day <= 3)).toEqual([]);
    expect(out.touches.find((x) => x.id === 's4')!.status).toBe('due');
    expect(out.touches.find((x) => x.id === 's5')!.status).toBe('queued');
    expect(queued.touches.find((x) => x.id === 's4')!.status).toBe('queued');
  });
  it('catches up twenty days in', () => {
    const old = { ...opp, createdAt: NOW - 20 * DAY };
    const out = refreshDue(old, NOW);
    expect(out.touches.filter((x) => x.status === 'queued')).toEqual([]);
  });
  it('returns the same object when nothing changed', () => {
    expect(refreshDue(opp, NOW)).toBe(opp);
  });
});

describe('templatesFor', () => {
  it('puts persona matches first, then channel matches, without mutating', () => {
    const before = TEMPLATES.map((t) => t.id);
    const out = templatesFor(TEMPLATES, 'Recruiter', 'Email');
    expect(out[0].id).toBe('tpl_rec');
    expect(out[1].persona).toBe('Recruiter');
    expect(TEMPLATES.map((t) => t.id)).toEqual(before);
    expect(out).toHaveLength(TEMPLATES.length);
  });
});

import { describe, expect, it } from 'vitest';
import {
  asQuestion, bankable, clip, isFiller, join, missing, mirror, opening, pick, pickUnused, probe, questions,
  readReq, readWin, shape, summary, turn, worthKeeping,
  type CoachMessage,
} from './coach';
import { buildAgenda } from './agenda';
import { exampleOpportunity, exampleProfile } from './seed';

const profile = exampleProfile(new Date('2026-06-01'));
const opp = exampleOpportunity(profile, 1_800_000_000_000);
const agenda = buildAgenda(opp, profile.proof);
const storyItem = agenda[0];
const gapItem = agenda.find((a) => a.kind === 'gap')!;
const ctx = { proof: profile.proof.find((p) => p.id === storyItem.ref)! };

const FULL =
  'I rewrote the discovery script myself and the reps pushed back at first, ' +
  'but the cycle went from 70 days down to 41 by Q3 and the book closed at $1.2M.';

/** play the coach's bubbles into the history the way the app does */
function reply(history: CoachMessage[], user?: string): { history: CoachMessage[]; r: ReturnType<typeof turn> } {
  const h = user === undefined ? history : [...history, { role: 'user' as const, content: user }];
  const r = turn(storyItem, h, ctx);
  const next = [...h];
  r.bubbles.forEach((b) => next.push({ role: 'assistant', content: b, stage: r.stage, want: r.want, story: r.story }));
  return { history: next, r };
}

describe('reading numbers and requirements', () => {
  it('sorts metrics by kind', () => {
    expect(readWin({ metric: '$1.2M', text: '' }).kind).toBe('money');
    expect(readWin({ metric: '30→70', text: '' })).toMatchObject({ kind: 'shift', from: '30', to: '70', worse: true });
    expect(readWin({ metric: '70→30', text: '' }).worse).toBe(false);
    expect(readWin({ metric: '40%', text: 'held the team through attrition' }).kind).toBe('loss');
    expect(readWin({ metric: '112%', text: 'quota' }).kind).toBe('over');
    expect(readWin({ metric: '41%', text: 'growth' }).kind).toBe('pct');
    expect(readWin({ metric: '3x', text: '' }).kind).toBe('multiple');
    expect(readWin({ metric: 'Top 3', text: '' }).kind).toBe('count');
    expect(readWin({ metric: '', text: '' }).kind).toBe('none');
  });
  it('sorts listing lines into categories', () => {
    expect(readReq('MEDDPICC or similar, used properly')).toMatchObject({ cat: 'method', term: 'MEDDPICC' });
    expect(readReq({ text: 'Experience with Salesforce' }).cat).toBe('tool');
    expect(readReq('Be kind').cat).toBe('other');
  });
  it('turns listing lines into questions in the right grammar', () => {
    expect(shape('5+ years of SaaS sales')).toBe('years');
    expect(shape('Work RevOps buyers')).toBe('action');
    expect(asQuestion('Work RevOps buyers through an evaluation.')).toBe(
      'Walk me through how you work RevOps buyers through an evaluation.',
    );
    expect(asQuestion('Experience with quota attainment')).toBe('Tell me about quota attainment.');
    expect(asQuestion('5+ years of SaaS sales')).toMatch(/^You have 5-odd years/);
  });
  it('clips at a word, closes quotes, and joins without stacking punctuation', () => {
    expect(clip('one two three four five six', 14)).toBe('one two three…');
    expect(clip('said "hello there my friend', 20)).not.toMatch(/"/);
    expect(join('He said so…', 'Why?')).toBe('He said so. Why?');
    expect(join('Done.', 'Next?')).toBe('Done. Next?');
    expect(join('He said "no."', 'Why?')).toBe('He said "no." Why?');
  });
  it('picks stably and avoids what was used', () => {
    const list = ['a', 'b', 'c'];
    expect(pick(list, 'k')).toBe(pick(list, 'k'));
    expect(pickUnused(list, 'k', ['a', 'b'])).toBe('c');
    expect(pickUnused(list, 'k', list)).toBeNull();
    expect(pick([], 'k')).toBeNull();
  });
});

describe('opening', () => {
  it('names the actual number on a story', () => {
    const o = opening(storyItem, ctx)!;
    expect(o).toContain('$1.2M');
  });
  it('is stable for the same item and different between items', () => {
    expect(opening(storyItem, ctx)).toBe(opening(storyItem, ctx));
    const seen = agenda
      .filter((a) => a.kind === 'story')
      .map((a) => opening(a, { proof: profile.proof.find((p) => p.id === a.ref)! }));
    expect(new Set(seen).size).toBe(seen.length);
  });
  it('asks about the term on a gap', () => {
    const o = opening({ id: 'g', kind: 'gap', label: 'MEDDPICC or similar, used properly' })!;
    expect(o).toContain('MEDDPICC');
  });
  it('accepts the prototype name `win` in the context', () => {
    expect(opening(storyItem, { win: ctx.proof })).toBe(opening(storyItem, ctx));
  });
  it('is null with no item', () => {
    expect(opening(null)).toBeNull();
  });
  it('opens a turn with no answers', () => {
    const t = turn(storyItem, [], ctx);
    expect(t).toMatchObject({ stage: 'open', complete: false, story: '' });
    expect(t.bubbles).toEqual([opening(storyItem, ctx)]);
    expect(opening(gapItem)).toBeTruthy();
  });
});

describe('turn: probing', () => {
  const open: CoachMessage[] = [{ role: 'assistant', content: 'x', stage: 'open' }];

  it('probes for a number when everything else is there', () => {
    const answer =
      'I rebuilt the whole motion over a couple of quarters and it was a slog, the reps pushed back ' +
      'hard at first but eventually I got everyone onto the new way of working and it ended up sticking';
    const r = turn(storyItem, [...open, { role: 'user', content: answer }], ctx);
    expect(r.stage).toBe('dig');
    expect(r.want).toBe('number');
    expect(r.complete).toBe(false);
    expect(r.bubbles[r.bubbles.length - 1].toLowerCase()).toMatch(/number|figure|roughly|how long/);
  });

  it('probes "we" versus "I" when only we is said', () => {
    const answer =
      'We rebuilt the discovery script together and the whole team pushed back a bit but we got there in the end';
    expect(missing([answer])).toBe('we');
    const r = turn(storyItem, [...open, { role: 'user', content: answer }], ctx);
    expect(r.want).toBe('we');
    expect(r.bubbles[r.bubbles.length - 1]).toMatch(/you|yours|part/i);
  });

  it('asks for more when the answer is thin', () => {
    const r = turn(storyItem, [...open, { role: 'user', content: 'I ran the pod.' }], ctx);
    expect(r.want).toBe('thin');
    expect(r.stage).not.toBe('confirm');
  });

  it('answers "I do not know" with a smaller question, not the same one', () => {
    const first = reply([], 'i dont know');
    expect(first.r.stage).toBe('dig');
    expect(first.r.bubbles[0]).toBeTruthy();
    expect(first.r.bubbles[0]).not.toBe(opening(storyItem, ctx));
  });

  it('rephrases when they do not follow', () => {
    const r = turn(storyItem, [...open, { role: 'user', content: 'what do you mean' }], ctx);
    expect(r.stage).toBe('dig');
    expect(r.bubbles).toHaveLength(1);
  });

  it('never asks the same thing twice and stops interrogating', () => {
    let h: CoachMessage[] = [];
    const said: string[] = [];
    for (let i = 0; i < 8; i++) {
      const r = turn(storyItem, h, ctx);
      r.bubbles.forEach((b) => {
        said.push(b);
        h.push({ role: 'assistant', content: b, stage: r.stage, want: r.want, story: r.story });
      });
      h = [...h, { role: 'user', content: 'it was fine i guess and things went okay overall' }];
    }
    expect(said.filter((x, i) => said.indexOf(x) !== i)).toEqual([]);
    expect(said.length).toBeLessThanOrEqual(9);
  });

  it('mirrors a figure back before the next question', () => {
    expect(mirror('it took about 30 days in the end', 'k')).toMatch(/30 days/);
    expect(mirror('nothing quotable here', 'k')).toBeNull();
    expect(probe('number', 'k')).toBeTruthy();
  });
});

describe('turn: completion and summary', () => {
  it('goes straight to the read-back on a complete first answer', () => {
    const r = turn(storyItem, [{ role: 'assistant', content: 'x', stage: 'open' }, { role: 'user', content: FULL }], ctx);
    expect(r.stage).toBe('confirm');
    expect(r.complete).toBe(false);
    expect(r.story).toContain('70 days');
    expect(r.bubbles[0]).toMatch(/\?$/);
    expect(r.bubbles[0]).toContain(r.story);
  });

  it('banks the read-back on yes', () => {
    const a = reply([], FULL);
    expect(a.r.stage).toBe('confirm');
    const b = reply(a.history, 'yes');
    expect(b.r).toMatchObject({ stage: 'done', complete: true });
    expect(b.r.story).toBe(a.r.story);
    expect(b.r.story).not.toMatch(/\byes\b/i);
  });

  it('keeps their rewrite when they send a longer one', () => {
    const a = reply([], FULL);
    const rewrite = 'Actually I rewrote the discovery script and sat on thirty calls, cycle dropped from 70 days to 41, book closed at $1.2M.';
    const b = reply(a.history, rewrite);
    expect(b.r).toMatchObject({ stage: 'done', complete: true, story: rewrite });
  });

  it('goes back to digging on no', () => {
    const a = reply([], FULL);
    const b = reply(a.history, 'no');
    expect(b.r).toMatchObject({ stage: 'dig', complete: false });
  });

  it('will not read filler back as a story', () => {
    const filler = 'it was fine i guess and things went okay overall';
    const s = summary([filler, filler, filler]);
    expect((s.match(/it was fine/g) || []).length).toBeLessThanOrEqual(1);
    expect(worthKeeping(s)).toBe(false);
    expect(worthKeeping('I cut the cycle from 70 days to 41 across 14 accounts in Q3.')).toBe(true);
    expect(worthKeeping('')).toBe(false);
  });

  it('summary keeps the strongest sentences and drops filler answers', () => {
    expect(summary(['yes', 'ok', ''])).toBe('');
    expect(summary(['yes', FULL])).toContain('$1.2M');
  });

  it('bankable prefers the read-back, otherwise their words without filler', () => {
    const a = reply([], FULL);
    expect(bankable(a.history)).toBe(a.r.story);
    expect(bankable([
      { role: 'user', content: 'I ran the SMB pod for two quarters during the reorg and we hit plan.' },
      { role: 'assistant', content: 'Anything you would change?', stage: 'dig' },
      { role: 'user', content: 'yes' },
    ])).toBe('I ran the SMB pod for two quarters during the reorg and we hit plan.');
    expect(bankable(undefined)).toBe('');
  });

  it('accepts the app\'s stored turn shape (role coach, text)', () => {
    const r = turn(storyItem, [{ role: 'coach', text: 'x', stage: 'open' }, { role: 'user', text: FULL }], ctx);
    expect(r.stage).toBe('confirm');
  });
});

describe('isFiller', () => {
  it('is true for bare yes, no and shrugs', () => {
    for (const t of ['', 'yes', 'Yeah.', 'ok thanks', 'no', 'not sure', "I don't know", 'Sounds right!']) {
      expect(isFiller(t)).toBe(true);
    }
  });
  it('is false for anything with content', () => {
    expect(isFiller('yes, and then we cut the cycle in half')).toBe(false);
    expect(isFiller(FULL)).toBe(false);
  });
});

describe('questions', () => {
  const q = questions(opp, profile.proof);

  it('builds likely questions from gaps, must-haves, numbers and people', () => {
    expect(q.source).toBe('local');
    expect(q.likely.length).toBeGreaterThan(0);
    expect(q.likely.length).toBeLessThanOrEqual(10);
    const kinds = q.likely.map((x) => x.kind);
    expect(kinds).toEqual(expect.arrayContaining(['gap', 'strength', 'win', 'person']));
    expect(q.likely.find((x) => x.kind === 'win')!.question).toBe('You mention $1.2M. How did you get there?');
    expect(q.likely.find((x) => x.question.includes('40%'))!.question).toBe('You mention 40%. What was your part in that?');
  });

  it('turns listing lines into spoken questions', () => {
    const gap = q.likely.find((x) => x.kind === 'gap')!;
    expect(gap.question).toBe('Walk me through how you work RevOps buyers through a multi threaded evaluation.');
    expect(gap.gap).toMatch(/Story/);
    expect(q.likely.some((x) => /work revops buyers through an? /i.test(x.question) && /experience with work/i.test(x.question))).toBe(false);
  });

  it('asks back about the method, the quota and what was found', () => {
    expect(q.toAsk.map((x) => x.question)).toEqual(
      expect.arrayContaining(['How strictly is MEDDPICC actually run here?']),
    );
    expect(q.toAsk.length).toBeLessThanOrEqual(6);
    expect(q.toAsk.some((x) => x.question.startsWith('On Marcus Reed on the reprice'))).toBe(true);
  });

  it('warns about unanswered gaps', () => {
    expect(q.watch[0]).toMatch(/^3 requirements have nothing behind them/);
    expect(q.watch.length).toBeLessThanOrEqual(5);
  });

  it('puts a reported interview question first and a customer gripe in toAsk', () => {
    const withResearch = {
      ...opp,
      research: [
        { id: 'a', date: '', kind: 'Interview question', title: 'Tell me about a deal you lost', detail: '', source: 'Reddit', use: '' },
        { id: 'b', date: '', kind: 'Customer gripe', title: 'Reporting is slow.', detail: '', source: 'G2', use: '' },
        { id: 'c', date: '', kind: 'Customer gripe', title: 'Support is missing at night.', detail: '', source: 'G2', use: '' },
      ],
    };
    const r = questions(withResearch, profile.proof);
    expect(r.likely[0]).toMatchObject({ kind: 'reported', question: 'Tell me about a deal you lost' });
    expect(r.likely[0].why).toContain('on Reddit');
    expect(r.toAsk[0].question).toMatch(/^Customers keep saying /);
    expect(r.watch.some((w) => /2 customer complaints/.test(w))).toBe(true);
  });

  it('has no unbalanced quotes or stacked punctuation', () => {
    for (const x of q.likely) {
      expect((x.question.match(/"/g) || []).length % 2).toBe(0);
      expect(x.question).not.toMatch(/\.\s*\.|…\.|"\./);
    }
  });

  it('copes with an empty opportunity', () => {
    expect(questions({ requirements: [], research: [], contacts: [] })).toEqual({
      likely: [], toAsk: [], watch: [], source: 'local',
    });
  });
});

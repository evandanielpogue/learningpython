/* ==========================================================================
   The Acme example: a worked opportunity for anyone who wants to see the
   app running before handing over their own history. Its profile is the
   example résumé, read by the real parser; its contacts, research and
   touches are fixed so the example is the same every time.
   ========================================================================== */
import type { Contact, Finding, Opportunity, Profile, Suggestion, TimelineEvent, Touch } from '../types';
import { parseListing } from './listing';
import { matchLocally, rankProof } from './match';
import { EXAMPLE_RESUME, parseResume } from './resume';

export const ACME_LISTING =
  'Mid-Market Account Executive\nAcme · Chicago, hybrid · Req 4821\n\nAcme is hiring six mid-market AEs as we build the segment out properly. You will own a territory of 80 to 150k ACV accounts selling to RevOps and sales leaders, with 60 to 90 day cycles.\n\nWhat you will do\n- Run full cycle from first call to close against a $1.1M annual number\n- Work RevOps buyers through a multi threaded evaluation\n- Help us rebuild the discovery script now that seat based pricing has changed the deal math\n- Ramp fast and help the next hires ramp faster\n\nWhat we are looking for\n- 5+ years of SaaS sales, at least two in mid-market\n- Experience selling through a pricing or packaging change\n- A track record of quota attainment you can talk through\n- MEDDPICC or similar, used properly';

/** The angles the example's messages open with. The engine takes one as the
    `angle` argument to `fill` and `buildSequence`. */
export const EXAMPLE_ANGLES: { id: string; title: string; sub: string; on: boolean; take: string }[] = [
  {
    id: 'a1', title: 'Seat pricing moved the SMB floor to five seats', sub: 'Reps turn into qualifiers overnight', on: true,
    take: 'Seat pricing moved your SMB floor to five seats. Reps stop selling and start qualifying, and anyone who cannot run a two call close gets found out fast.',
  },
  {
    id: 'a2', title: 'Six AE reqs open at the same time', sub: 'Ramp is the constraint, not headcount', on: false,
    take: 'Six AE reqs open at once means ramp is the constraint, not headcount. The team that gets people productive in 45 days instead of 90 makes the number.',
  },
  {
    id: 'a3', title: 'Series B, 340 people, repriced in Q2', sub: 'Forecasting breaks after a reprice', on: false,
    take: 'You repriced in Q2 at 340 people. Every forecast built on the old motion is guesswork now, and that lands on the front line first.',
  },
];

const EXAMPLE_CONTACTS: Contact[] = [
  {
    id: 'p1', name: 'Dana Koh', title: 'Mid-Market AE', persona: 'Peer',
    tenure: '2 yrs at Acme', prev: 'Before: Outreach', mutuals: 3,
    email: 'dana.koh@acme.com', linkedin: 'in/danakoh',
    ask: 'What the team is actually like', notes: '',
    activity: [
      { when: '4 days ago', kind: 'LinkedIn post', text: 'Posted about closing her first deal under the new five seat minimum. "Took three calls instead of one. Still counting it."', use: 'Saw your post about the first five seat deal taking three calls instead of one.' },
      { when: '3 weeks ago', kind: 'Comment', text: 'Commented on a thread about discovery scripts: "ours is being rewritten right now and it is overdue".', use: 'Saw you mention the discovery rewrite being overdue.' },
    ],
  },
  {
    id: 'p2', name: 'Priya Shah', title: 'Talent Partner', persona: 'Recruiter',
    tenure: '10 months at Acme', prev: 'Before: Greenhouse', mutuals: 1,
    email: 'priya.shah@acme.com', linkedin: 'in/priyashah',
    ask: 'Whether the req is actually moving', notes: '',
    activity: [
      { when: '2 days ago', kind: 'Job post', text: 'Posted all six AE reqs in one update. "Building out mid-market properly this time."', use: 'Saw you posted all six AE reqs at once.' },
      { when: '1 week ago', kind: 'LinkedIn post', text: 'Shared that Acme cut time to first interview from 18 days to 6.', use: 'Saw you got time to first interview down from 18 days to 6.' },
    ],
  },
  {
    id: 'p3', name: 'Marcus Reed', title: 'Director, Mid-Market', persona: 'Hiring manager',
    tenure: '3 yrs at Acme', prev: 'Before: Zendesk, Okta', mutuals: 2,
    email: 'marcus.reed@acme.com', linkedin: 'in/marcusreed',
    ask: 'Fifteen minutes', notes: 'Ran the SMB team before mid-market. Owns the number.',
    activity: [
      { when: 'Yesterday', kind: 'LinkedIn post', text: 'Wrote about the reprice: "half my team had to relearn how to open a call. That is on me, not them."', use: 'Read what you wrote about half the team relearning how to open a call.' },
      { when: '2 weeks ago', kind: 'Podcast', text: 'On the Revenue Room podcast, said mid-market cycles went from 34 days to 61 after the pricing change.', use: 'Heard you on Revenue Room say cycles went 34 to 61 days after the change.' },
      { when: '1 month ago', kind: 'Comment', text: 'Argued in a comment thread that ramp, not headcount, is what breaks a mid-market plan.', use: 'Saw your point that ramp breaks a mid-market plan before headcount does.' },
    ],
  },
  {
    id: 'p4', name: 'Diane Walsh', title: 'VP Sales', persona: 'Skip level',
    tenure: '18 months at Acme', prev: 'Before: Braze, Segment', mutuals: 0,
    email: 'diane.walsh@acme.com', linkedin: 'in/dianewalsh',
    ask: 'A point of view worth passing down', notes: '',
    activity: [
      { when: '6 days ago', kind: 'LinkedIn post', text: 'Posted the Q2 numbers and wrote "mid-market carries next year. No way around it."', use: 'Saw you write that mid-market carries next year with no way around it.' },
    ],
  },
  {
    id: 'p5', name: 'Sam Lowe', title: 'Left Acme in 2024, now at Brightline', persona: 'Shared tie',
    tenure: '2 yrs at Acme', prev: 'Overlapped with you at Brightline', mutuals: 7,
    email: 'sam.lowe@brightline.io', linkedin: 'in/samlowe',
    ask: 'An introduction to Marcus', notes: 'Worked under Dev on the same floor as you.',
    activity: [
      { when: '2 months ago', kind: 'LinkedIn post', text: 'Wrote a long post on why he left Acme and what he would have fixed first.', use: 'Read your post about what you would have fixed first at Acme.' },
    ],
  },
];

/** people we found but have not added yet */
const EXAMPLE_SUGGESTED: Suggestion[] = [
  {
    id: 'g1', name: 'Ines Okafor', title: 'Senior Manager, Mid-Market', persona: 'Hiring manager',
    found: 'Runs the second mid-market pod', why: 'The listing says six reqs. Two managers are hiring, not one.',
    email: 'ines.okafor@acme.com', linkedin: 'in/inesokafor', mutuals: 0, tenure: '1 yr at Acme', prev: 'Before: Klaviyo',
    ask: 'Fifteen minutes', placeholder: false, guessedEmail: false,
  },
  {
    id: 'g2', name: 'Tom Brantley', title: 'RevOps Lead', persona: 'Other',
    found: 'Named in the listing as a partner to the role', why: 'He owns the discovery script the listing wants rebuilt.',
    email: 'tom.brantley@acme.com', linkedin: 'in/tombrantley', mutuals: 1, tenure: '4 yrs at Acme', prev: '',
    ask: 'What actually breaks in discovery today', placeholder: false, guessedEmail: false,
  },
];

const EXAMPLE_RESEARCH: Finding[] = [
  {
    id: 'res1', date: 'Yesterday', kind: 'Leadership', title: 'Marcus Reed on the reprice',
    detail: 'Wrote publicly that half his team had to relearn how to open a call after the pricing change, and took the blame for it himself.',
    source: 'LinkedIn', use: 'Read what Marcus wrote about half the team relearning how to open a call.',
  },
  {
    id: 'res2', date: '6 days ago', kind: 'Earnings', title: 'Mid-market named the growth engine',
    detail: 'Diane Walsh posted Q2 numbers with the line that mid-market carries next year. Net new logos came in under plan.',
    source: 'LinkedIn', use: 'Saw the Q2 post naming mid-market as the segment that carries next year.',
  },
  {
    id: 'res3', date: '2 weeks ago', kind: 'Product', title: 'Seat based pricing, five seat SMB floor',
    detail: 'The spring reprice moved the SMB tier to a five seat minimum. Deal math changed mid quarter and reps went from one call closes to two.',
    source: 'Pricing page', use: 'The five seat floor turns a one call close into a two call close.',
  },
  {
    id: 'res4', date: '3 weeks ago', kind: 'Hiring', title: 'Six AE reqs opened at once',
    detail: 'Priya Shah posted all six in a single update. At that volume ramp time, not headcount, is the constraint on the plan.',
    source: 'Careers page', use: 'Six AE reqs at once means ramp is the constraint, not headcount.',
  },
  {
    id: 'res5', date: '2 months ago', kind: 'Funding', title: 'Series B, roughly 340 people',
    detail: 'Raised in the same year as the reprice. Every forecast built on the old motion became guesswork, and that lands on the front line first.',
    source: 'Press release', use: 'A Series B and a reprice in the same year lands hardest on the front line.',
  },
];

/** the example's fourteen days: one applied, one answered, one sent, one due */
const EXAMPLE_TOUCHES: Touch[] = [
  { id: 's1', day: 0, contactId: null, templateId: null, channel: 'ATS', note: 'Apply. You still have to exist in the system.', status: 'sent', subject: '', body: 'Applied through the careers page so there is a record of it.' },
  { id: 's2', day: 0, contactId: 'p1', templateId: 'tpl_peer', channel: 'LinkedIn', note: 'Ask about the team, nothing else', status: 'replied', subject: '', body: '' },
  { id: 's3', day: 2, contactId: 'p2', templateId: 'tpl_rec', channel: 'Email', note: 'Name the req, ask one question', status: 'sent', subject: 'Mid-Market AE, applied Tuesday', body: '' },
  { id: 's4', day: 3, contactId: 'p3', templateId: 'tpl_hm', channel: 'Email', note: 'Your angle, then the page', status: 'due', subject: 'your SMB motion and the new pricing page', body: '' },
  { id: 's5', day: 5, contactId: 'p5', templateId: 'tpl_tie', channel: 'LinkedIn', note: 'Ask for the intro, write it for him', status: 'queued', subject: '', body: '' },
  { id: 's6', day: 7, contactId: 'p1', templateId: 'tpl_ref', channel: 'Reply', note: 'Now you can ask for the referral', status: 'queued', subject: '', body: '' },
  { id: 's7', day: 8, contactId: 'p3', templateId: 'tpl_hm2', channel: 'Email', note: 'Bring something new or do not write', status: 'queued', subject: 'three places discovery stalls', body: '' },
  { id: 's8', day: 10, contactId: 'p4', templateId: 'tpl_exec', channel: 'Email', note: 'Eighty words, business first', status: 'queued', subject: 'mid-market ramp', body: '' },
  { id: 's9', day: 12, contactId: 'p2', templateId: 'tpl_call', channel: 'Call', note: 'Pick up the phone', status: 'queued', subject: '', body: '' },
  { id: 's10', day: 14, contactId: null, templateId: 'tpl_break', channel: 'Email', note: 'Say you are stopping, leave the door open', status: 'queued', subject: 'closing the loop', body: '' },
];

const DAY_MS = 86400000;

function clone<T>(o: T): T {
  return JSON.parse(JSON.stringify(o)) as T;
}

/** The example résumé, read by the real parser, with stable ids (`r1`, `w1`)
    so the example opportunity can point at them. */
export function exampleProfile(now: Date = new Date()): Profile {
  const parsed = parseResume(EXAMPLE_RESUME, 'Evan_Pogue.pdf', now);
  return {
    name: parsed.name,
    email: parsed.email,
    phone: parsed.phone,
    location: parsed.location,
    years: parsed.years,
    photo: null,
    imported: true,
    source: 'Evan_Pogue.pdf',
    voice: parsed.voice,
    roles: parsed.roles.map((r, i) => ({ ...r, id: 'r' + (i + 1) })),
    proof: parsed.proof.map((p, i) => ({ ...p, id: 'w' + (i + 1) })),
    stack: parsed.stack,
  };
}

/** The Acme opportunity: three days in, one reply, one touch due. */
export function exampleOpportunity(profile: Profile, now: number = Date.now()): Opportunity {
  const createdAt = now - 3 * DAY_MS;
  const parsed = parseListing(ACME_LISTING);
  const touches = clone(EXAMPLE_TOUCHES);
  const at = (day: number) => createdAt + day * DAY_MS;
  const timeline: TimelineEvent[] = [
    { at: createdAt, kind: 'created', text: 'Added Acme' },
    { at: at(0), kind: 'sent', text: 'Applied through the careers page' },
    { at: at(0), kind: 'sent', text: 'Messaged Dana Koh on LinkedIn' },
    { at: at(1), kind: 'reply', text: 'Dana Koh replied' },
    { at: at(2), kind: 'sent', text: 'Emailed Priya Shah' },
  ];
  return {
    id: 'opp_acme',
    company: 'Acme',
    role: 'Mid-Market Account Executive',
    location: 'Chicago, hybrid',
    req: '4821',
    postingUrl: 'https://boards.example.com/acme/jobs/4821',
    listing: ACME_LISTING,
    facts: ['Series B', '340 people', 'Repriced in Q2', '6 AE reqs open'],
    requirements: matchLocally(parsed.requirements, ACME_LISTING, profile.proof),
    proofIds: rankProof(profile.proof, ACME_LISTING).slice(0, 3).map((r) => r.proof.id),
    agenda: [],
    chats: {},
    contacts: clone(EXAMPLE_CONTACTS),
    suggested: clone(EXAMPLE_SUGGESTED),
    touches,
    research: clone(EXAMPLE_RESEARCH),
    questions: null,
    practice: [],
    booked: false,
    outcome: 'open',
    done: ['upload'],
    open: 'tailor',
    timeline,
    example: true,
    createdAt,
    updatedAt: now,
  };
}

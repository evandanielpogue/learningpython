/* ==========================================================================
   store.js — application state
   Stands in for the backend. Everything persists to localStorage so a reload
   behaves like a real session. Wrapped in try/catch because private windows
   and blocked site data both throw on access.

   The unit of work is an opportunity: one company, one role, one listing.
   Wins, contacts, research, the sequence and the page all hang off it, so
   two opportunities never share a story.
   ========================================================================== */
(function (window) {
  'use strict';

  var KEY = 'frontdoor.v4';

  var PERSONAS = [
    { key: 'Peer',           colour: '--p-peer' },
    { key: 'Recruiter',      colour: '--p-recruiter' },
    { key: 'Hiring manager', colour: '--p-manager' },
    { key: 'Skip level',     colour: '--p-exec' },
    { key: 'Shared tie',     colour: '--p-tie' },
    { key: 'Other',          colour: '--line-3' }
  ];
  var CHANNELS = ['Email', 'LinkedIn', 'Call', 'Reply', 'ATS', 'Text'];
  var STAGES = ['First touch', 'Follow up', 'Escalation', 'Referral ask', 'Breakup'];

  function uid(p) { return (p || 'x') + '_' + Math.random().toString(36).slice(2, 8); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function slugify(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  }

  /* ---- profile --------------------------------------------------------- */
  var SEED_PROFILE = {
    name: 'Evan Pogue',
    email: 'evan@example.com',
    phone: '312 555 0148',
    location: 'Chicago, IL',
    years: 8,
    photo: null,
    imported: false,
    source: null,
    voice: { traits: ['Direct', 'Numbers first', 'One ask'] },
    roles: [
      { id: 'r1', title: 'Senior AE, Mid-Market', company: 'Brightline, Chicago', span: '2023 to now', on: true,
        bullets: [
          'Carried $1.2M and finished at 112% through a seat pricing change',
          'Rebuilt discovery when cycles went from 30 days to 70',
          'Held the team together through 40% attrition and still made the year'
        ] },
      { id: 'r2', title: 'Account Executive', company: 'Northwind, Chicago', span: '2021 to 2023', on: true,
        bullets: [
          'Grew territory ARR 41% year over year',
          'Got four new AEs to quota in two quarters',
          'Top 3 of 38 reps, two years running'
        ] },
      { id: 'r3', title: 'SDR, then AE', company: 'Cobalt, remote', span: '2018 to 2021', on: true,
        bullets: [
          'Closed the biggest deal the company had done at $340k',
          'Built the outbound motion from nothing'
        ] }
    ],
    /* tags are what a listing gets matched against */
    wins: [
      { id: 'w1', text: 'Finished at 112% through a pricing change', where: 'Brightline, FY25', metric: '112%', short: 'through a pricing change',
        tags: ['pricing', 'quota', 'attainment', 'change', 'seat', 'packaging', 'reprice'] },
      { id: 'w2', text: 'Carried a $1.2M quota and hit it', where: 'Brightline, FY25', metric: '$1.2M', short: 'quota carried and hit',
        tags: ['quota', 'mid-market', 'enterprise', 'acv', 'closing', 'number'] },
      { id: 'w3', text: 'Rebuilt discovery when cycles went 30 to 70 days', where: 'Brightline, Q2', metric: '30→70', short: 'day cycles, rebuilt discovery',
        tags: ['discovery', 'cycle', 'process', 'meddpicc', 'qualification', 'sales process', 'complex'] },
      { id: 'w4', text: 'Grew territory ARR 41% year over year', where: 'Northwind, FY23', metric: '41%', short: 'territory ARR growth',
        tags: ['territory', 'growth', 'arr', 'expansion', 'pipeline', 'new logo'] },
      { id: 'w5', text: 'Ramped four new AEs to quota in two quarters', where: 'Northwind, FY23', metric: '4 AEs', short: 'ramped to quota in two quarters',
        tags: ['ramp', 'coaching', 'onboarding', 'mentor', 'team', 'lead', 'manager', 'hiring'] },
      { id: 'w6', text: 'Top 3 of 38 reps, two years running', where: 'Northwind', metric: 'Top 3', short: 'of 38 reps, two years running',
        tags: ['performance', 'ranking', 'consistent', 'top', 'president'] },
      { id: 'w7', text: 'Closed the biggest deal the company had done', where: 'Cobalt, FY21', metric: '$340k', short: 'largest deal in company history',
        tags: ['enterprise', 'large', 'strategic', 'acv', 'negotiation', 'outbound'] }
    ],
    stack: ['Salesforce', 'HubSpot', 'Outreach', 'Gong', 'Clay', 'Sales Navigator', 'MEDDPICC'],
    reference: { quote: 'Evan rebuilt our discovery script in the middle of a pricing change and we still made the year. He is who you want in the room when the motion breaks.', who: 'Dev Nair', role: 'VP Sales at Brightline', initials: 'DN' }
  };

  /* ---- message templates ----------------------------------------------- */
  var TEMPLATES = [
    { id: 'tpl_peer', name: 'Ask a peer what it is really like', persona: 'Peer', stage: 'First touch', channel: 'LinkedIn', stock: true,
      body: "{first}, I applied for the {role} and figured I would go to the source rather than the portal.\n\nCurious what changed day to day when {company} moved upmarket. Longer cycles, or just more people in the room?\n\nEither way, appreciate you reading this." },
    { id: 'tpl_rec', name: 'Check the req is actually moving', persona: 'Recruiter', stage: 'First touch', channel: 'Email', stock: true,
      body: "{first}, I applied for the {role} on Tuesday. Quick context: {win}.\n\nIs the team still interviewing for this one, or is it further along than the posting suggests?" },
    { id: 'tpl_hm', name: 'Open with what you noticed', persona: 'Hiring manager', stage: 'First touch', channel: 'Email', stock: true,
      body: "{first}, {angle}\n\nI ran that exact change at Brightline last year. We lost 40% of the team, rebuilt the discovery script, and still finished at 112%.\n\nI applied for the {role}. The 30-60-90 is here:\nfrontdoor.app/p/{slug}\n\nWorth fifteen minutes, or should I stay in the queue?" },
    { id: 'tpl_hm2', name: 'Follow up with something new', persona: 'Hiring manager', stage: 'Follow up', channel: 'Email', stock: true,
      body: "{first}, spent an hour in your trial and wrote up the three places a mid-market buyer stalls in discovery. Added it to the same page:\nfrontdoor.app/p/{slug}\n\nThe second one is the interesting one. Integrations come up before security, which is backwards at your ACV.\n\nStill happy to trade fifteen minutes if useful." },
    { id: 'tpl_exec', name: 'Go one level up', persona: 'Skip level', stage: 'Escalation', channel: 'Email', stock: true,
      body: "{first}, your mid-market segment is the one that has to carry next year's number, and new rep ramp is usually where that plan breaks.\n\n{win}.\n\nApplied for the {role}. Plan is here: frontdoor.app/p/{slug}\n\nWorth passing down, or should I sit tight?" },
    { id: 'tpl_tie', name: 'Ask for the intro and write it for them', persona: 'Shared tie', stage: 'Referral ask', channel: 'LinkedIn', stock: true,
      body: "{first}, we overlapped at Brightline in 2022.\n\nI am going after the {role} at {company} and saw you spent two years there. If you are still in touch with the team, would you be up for forwarding me along? Totally fine if that bridge is not one you want to cross.\n\nSomething you could paste:\n\"{me} ran our SMB to mid-market transition at Brightline and finished at 112% through it. He has applied for the {role}.\"" },
    { id: 'tpl_ref', name: 'Ask a peer to refer you', persona: 'Peer', stage: 'Referral ask', channel: 'Reply', stock: true,
      body: "{first}, that detail about cycles was the most useful thing anyone has told me about this role. I rebuilt my 30-60-90 around it.\n\nIf it feels right after one conversation, would you be open to dropping me in the referral portal? No pressure at all." },
    { id: 'tpl_call', name: 'Phone script for the recruiter', persona: 'Recruiter', stage: 'Follow up', channel: 'Call', stock: true,
      body: "Hi {first}, it is {me}. I applied for the {role} a couple of weeks back. Is now a bad time?\n\n[pause, actually wait]\n\nQuick one. I wanted to check whether that req is still moving or whether it is on hold. I would rather know than keep guessing." },
    { id: 'tpl_break', name: 'Close the loop and leave the door open', persona: 'Other', stage: 'Breakup', channel: 'Email', stock: true,
      body: "{first}, closing the loop on this one so I am not cluttering your inbox.\n\nUnrelated to the role, the integrations-before-security thing is worth handing to whoever owns your discovery script. Cheap fix.\n\nIf the seat opens up again I would still want the conversation. Good luck with the quarter." }
  ];

  /* ---- the Acme example -------------------------------------------------- */
  var ACME_LISTING = "Mid-Market Account Executive\nAcme · Chicago, hybrid · Req 4821\n\nAcme is hiring six mid-market AEs as we build the segment out properly. You will own a territory of 80 to 150k ACV accounts selling to RevOps and sales leaders, with 60 to 90 day cycles.\n\nWhat you will do\n- Run full cycle from first call to close against a $1.1M annual number\n- Work RevOps buyers through a multi threaded evaluation\n- Help us rebuild the discovery script now that seat based pricing has changed the deal math\n- Ramp fast and help the next hires ramp faster\n\nWhat we are looking for\n- 5+ years of SaaS sales, at least two in mid-market\n- Experience selling through a pricing or packaging change\n- A track record of quota attainment you can talk through\n- MEDDPICC or similar, used properly";

  var CONTACTS = [
    { id: 'p1', name: 'Dana Koh', title: 'Mid-Market AE', persona: 'Peer', colour: '--p-peer',
      tenure: '2 yrs at Acme', prev: 'Before: Outreach', mutuals: 3,
      email: 'dana.koh@acme.com', linkedin: 'in/danakoh',
      ask: 'What the team is actually like', notes: '',
      activity: [
        { when: '4 days ago', kind: 'LinkedIn post', text: 'Posted about closing her first deal under the new five seat minimum. "Took three calls instead of one. Still counting it."', use: 'Saw your post about the first five seat deal taking three calls instead of one.' },
        { when: '3 weeks ago', kind: 'Comment', text: 'Commented on a thread about discovery scripts: "ours is being rewritten right now and it is overdue".', use: 'Saw you mention the discovery rewrite being overdue.' }
      ] },
    { id: 'p2', name: 'Priya Shah', title: 'Talent Partner', persona: 'Recruiter', colour: '--p-recruiter',
      tenure: '10 months at Acme', prev: 'Before: Greenhouse', mutuals: 1,
      email: 'priya.shah@acme.com', linkedin: 'in/priyashah',
      ask: 'Whether the req is actually moving', notes: '',
      activity: [
        { when: '2 days ago', kind: 'Job post', text: 'Posted all six AE reqs in one update. "Building out mid-market properly this time."', use: 'Saw you posted all six AE reqs at once.' },
        { when: '1 week ago', kind: 'LinkedIn post', text: 'Shared that Acme cut time to first interview from 18 days to 6.', use: 'Saw you got time to first interview down from 18 days to 6.' }
      ] },
    { id: 'p3', name: 'Marcus Reed', title: 'Director, Mid-Market', persona: 'Hiring manager', colour: '--p-manager',
      tenure: '3 yrs at Acme', prev: 'Before: Zendesk, Okta', mutuals: 2,
      email: 'marcus.reed@acme.com', linkedin: 'in/marcusreed',
      ask: 'Fifteen minutes', notes: 'Ran the SMB team before mid-market. Owns the number.',
      activity: [
        { when: 'Yesterday', kind: 'LinkedIn post', text: 'Wrote about the reprice: "half my team had to relearn how to open a call. That is on me, not them."', use: 'Read what you wrote about half the team relearning how to open a call.' },
        { when: '2 weeks ago', kind: 'Podcast', text: 'On the Revenue Room podcast, said mid-market cycles went from 34 days to 61 after the pricing change.', use: 'Heard you on Revenue Room say cycles went 34 to 61 days after the change.' },
        { when: '1 month ago', kind: 'Comment', text: 'Argued in a comment thread that ramp, not headcount, is what breaks a mid-market plan.', use: 'Saw your point that ramp breaks a mid-market plan before headcount does.' }
      ] },
    { id: 'p4', name: 'Diane Walsh', title: 'VP Sales', persona: 'Skip level', colour: '--p-exec',
      tenure: '18 months at Acme', prev: 'Before: Braze, Segment', mutuals: 0,
      email: 'diane.walsh@acme.com', linkedin: 'in/dianewalsh',
      ask: 'A point of view worth passing down', notes: '',
      activity: [
        { when: '6 days ago', kind: 'LinkedIn post', text: 'Posted the Q2 numbers and wrote "mid-market carries next year. No way around it."', use: 'Saw you write that mid-market carries next year with no way around it.' }
      ] },
    { id: 'p5', name: 'Sam Lowe', title: 'Left Acme in 2024, now at Brightline', persona: 'Shared tie', colour: '--p-tie',
      tenure: '2 yrs at Acme', prev: 'Overlapped with you at Brightline', mutuals: 7,
      email: 'sam.lowe@brightline.io', linkedin: 'in/samlowe',
      ask: 'An introduction to Marcus', notes: 'Worked under Dev on the same floor as you.',
      activity: [
        { when: '2 months ago', kind: 'LinkedIn post', text: 'Wrote a long post on why he left Acme and what he would have fixed first.', use: 'Read your post about what you would have fixed first at Acme.' }
      ] }
  ];

  /* people we found but have not added yet */
  var SUGGESTED = [
    { id: 'g1', name: 'Ines Okafor', title: 'Senior Manager, Mid-Market', persona: 'Hiring manager',
      found: 'Runs the second mid-market pod', why: 'The listing says six reqs. Two managers are hiring, not one.',
      email: 'ines.okafor@acme.com', linkedin: 'in/inesokafor', mutuals: 0, tenure: '1 yr at Acme', prev: 'Before: Klaviyo',
      ask: 'Fifteen minutes' },
    { id: 'g2', name: 'Tom Brantley', title: 'RevOps Lead', persona: 'Other',
      found: 'Named in the listing as a partner to the role', why: 'He owns the discovery script the listing wants rebuilt.',
      email: 'tom.brantley@acme.com', linkedin: 'in/tombrantley', mutuals: 1, tenure: '4 yrs at Acme', prev: '',
      ask: 'What actually breaks in discovery today' }
  ];

  var RESEARCH = [
    { date: 'Yesterday', kind: 'Leadership', title: 'Marcus Reed on the reprice',
      detail: 'Wrote publicly that half his team had to relearn how to open a call after the pricing change, and took the blame for it himself.',
      source: 'LinkedIn', use: 'Read what Marcus wrote about half the team relearning how to open a call.' },
    { date: '6 days ago', kind: 'Earnings', title: 'Mid-market named the growth engine',
      detail: 'Diane Walsh posted Q2 numbers with the line that mid-market carries next year. Net new logos came in under plan.',
      source: 'LinkedIn', use: 'Saw the Q2 post naming mid-market as the segment that carries next year.' },
    { date: '2 weeks ago', kind: 'Product', title: 'Seat based pricing, five seat SMB floor',
      detail: 'The spring reprice moved the SMB tier to a five seat minimum. Deal math changed mid quarter and reps went from one call closes to two.',
      source: 'Pricing page', use: 'The five seat floor turns a one call close into a two call close.' },
    { date: '3 weeks ago', kind: 'Hiring', title: 'Six AE reqs opened at once',
      detail: 'Priya Shah posted all six in a single update. At that volume ramp time, not headcount, is the constraint on the plan.',
      source: 'Careers page', use: 'Six AE reqs at once means ramp is the constraint, not headcount.' },
    { date: '2 months ago', kind: 'Funding', title: 'Series B, roughly 340 people',
      detail: 'Raised in the same year as the reprice. Every forecast built on the old motion became guesswork, and that lands on the front line first.',
      source: 'Press release', use: 'A Series B and a reprice in the same year lands hardest on the front line.' }
  ];

  var ANGLES = [
    { id: 'a1', title: 'Seat pricing moved the SMB floor to five seats', sub: 'Reps turn into qualifiers overnight', on: true,
      take: 'Seat pricing moved your SMB floor to five seats. Reps stop selling and start qualifying, and anyone who cannot run a two call close gets found out fast.' },
    { id: 'a2', title: 'Six AE reqs open at the same time', sub: 'Ramp is the constraint, not headcount', on: false,
      take: 'Six AE reqs open at once means ramp is the constraint, not headcount. The team that gets people productive in 45 days instead of 90 makes the number.' },
    { id: 'a3', title: 'Series B, 340 people, repriced in Q2', sub: 'Forecasting breaks after a reprice', on: false,
      take: 'You repriced in Q2 at 340 people. Every forecast built on the old motion is guesswork now, and that lands on the front line first.' }
  ];

  var STEPS = [
    { id: 's1',  day: 0,  contact: null, template: null,        channel: 'ATS',      note: 'Apply. You still have to exist in the system.', status: 'sent',
      subject: '', body: 'Applied through the careers page so there is a record of it.' },
    { id: 's2',  day: 0,  contact: 'p1', template: 'tpl_peer',  channel: 'LinkedIn', note: 'Ask about the team, nothing else', status: 'replied', subject: '', body: '' },
    { id: 's3',  day: 2,  contact: 'p2', template: 'tpl_rec',   channel: 'Email',    note: 'Name the req, ask one question', status: 'sent',
      subject: 'Mid-Market AE, applied Tuesday', body: '' },
    { id: 's4',  day: 3,  contact: 'p3', template: 'tpl_hm',    channel: 'Email',    note: 'Your angle, then the page', status: 'due',
      subject: 'your SMB motion and the new pricing page', body: '' },
    { id: 's5',  day: 5,  contact: 'p5', template: 'tpl_tie',   channel: 'LinkedIn', note: 'Ask for the intro, write it for him', status: 'queued', subject: '', body: '' },
    { id: 's6',  day: 7,  contact: 'p1', template: 'tpl_ref',   channel: 'Reply',    note: 'Now you can ask for the referral', status: 'queued', subject: '', body: '' },
    { id: 's7',  day: 8,  contact: 'p3', template: 'tpl_hm2',   channel: 'Email',    note: 'Bring something new or do not write', status: 'queued',
      subject: 'three places discovery stalls', body: '' },
    { id: 's8',  day: 10, contact: 'p4', template: 'tpl_exec',  channel: 'Email',    note: 'Eighty words, business first', status: 'queued',
      subject: 'mid-market ramp', body: '' },
    { id: 's9',  day: 12, contact: 'p2', template: 'tpl_call',  channel: 'Call',     note: 'Pick up the phone', status: 'queued', subject: '', body: '' },
    { id: 's10', day: 14, contact: null, template: 'tpl_break', channel: 'Email',    note: 'Say you are stopping, leave the door open', status: 'queued',
      subject: 'closing the loop', body: '' }
  ];

  var SECTIONS = [
    { key: 'hero',  label: 'Header',            on: true },
    { key: 'why',   label: 'Why this company',  on: true },
    { key: 'proof', label: 'The numbers',       on: true },
    { key: 'story', label: 'The story',         on: true },
    { key: 'plan',  label: 'First 90 days',     on: true },
    { key: 'exp',   label: 'Where I have been', on: true },
    { key: 'said',  label: 'Reference',         on: true },
    { key: 'stack', label: 'Tools',             on: true },
    { key: 'video', label: 'Video',             on: false }
  ];

  function taskSet() {
    return [
      { id: 't1', text: 'Paste the job listing',   sub: 'We read it for you',                     on: false },
      { id: 't2', text: 'Confirm what you lead with', sub: 'Three wins, matched to the listing',  on: false },
      { id: 't3', text: 'Add your contacts',       sub: 'Start with the three we found',          on: false },
      { id: 't4', text: 'Read the research',       sub: 'What they said, recently, in public',    on: false },
      { id: 't5', text: 'Build the sequence',      sub: 'Ten touches over two weeks',             on: false },
      { id: 't6', text: 'Send the first message',  sub: 'Start with the peer',                    on: false }
    ];
  }

  function seedCampaign() {
    return {
      id: 'c_acme',
      company: 'Acme', role: 'Mid-Market Account Executive',
      location: 'Chicago, hybrid', req: '4821', slug: 'evan-acme',
      listing: ACME_LISTING,
      status: 'running', day: 3, createdAt: Date.now() - 3 * 864e5,
      facts: ['Series B', '340 people', 'Repriced in Q2', '6 AE reqs open'],
      requirements: ['5+ yrs SaaS', '$80 to 150k ACV', 'RevOps buyers', '60 to 90 day cycles', 'Sold through a reprice'],
      winIds: ['w1', 'w3', 'w2'],
      story: 'Brightline repriced to seat based in the middle of my best year. Forty per cent of the team left inside two quarters. I rewrote discovery around the new deal math, took cycles from 30 days to 70 without losing the number, and finished at 112%.',
      pageTemplate: 'case',
      angles: clone(ANGLES),
      contacts: clone(CONTACTS),
      suggested: clone(SUGGESTED),
      steps: clone(STEPS),
      research: clone(RESEARCH),
      sections: clone(SECTIONS),
      tasks: taskSet(),
      activeStep: 's4',
      activeContact: 'p1',
      pendingInsert: null,
      sent: 3, replies: 1,
      views: 4, lastView: '2 hours ago'
    };
  }

  function defaults() {
    return {
      user: null,
      profile: clone(SEED_PROFILE),
      templates: clone(TEMPLATES),
      campaigns: [],
      lastCampaign: null
    };
  }

  var state = defaults();
  var subs = [];

  function read() {
    try { var raw = window.localStorage.getItem(KEY); return raw ? JSON.parse(raw) : null; }
    catch (e) { return null; }
  }
  function write() {
    try { window.localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }
  function emit() { subs.forEach(function (fn) { try { fn(state); } catch (e) {} }); }

  var Store = {
    state: state,
    PERSONAS: PERSONAS,
    CHANNELS: CHANNELS,
    STAGES: STAGES,
    SAMPLE_LISTING: ACME_LISTING,
    uid: uid,
    slugify: slugify,

    init: function () {
      var saved = read();
      if (saved) {
        Object.keys(defaults()).forEach(function (k) {
          if (saved[k] !== undefined) state[k] = saved[k];
        });
      }
      return state;
    },
    subscribe: function (fn) { subs.push(fn); return function () { subs = subs.filter(function (f) { return f !== fn; }); }; },
    save: function () { write(); emit(); },

    /* auth */
    signIn: function (email) {
      var nm = state.profile.name;
      state.user = { email: email || state.profile.email, name: nm, initials: Store.initials(nm) };
      Store.save();
      return state.user;
    },
    signOut: function () { state.user = null; Store.save(); },
    isAuthed: function () { return !!state.user; },
    initials: function (n) {
      return String(n || '?').trim().split(/\s+/).map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase();
    },

    /* ---- opportunities -------------------------------------------------- */
    campaigns: function () { return state.campaigns; },
    campaign: function (id) { return state.campaigns.filter(function (c) { return c.id === id; })[0] || null; },
    touch: function (id) { state.lastCampaign = id; Store.save(); },

    createSeedCampaign: function () {
      if (Store.campaign('c_acme')) return Store.campaign('c_acme');
      var c = seedCampaign();
      state.profile.imported = true;
      state.profile.source = state.profile.source || 'Evan_Pogue.pdf';
      c.tasks[0].on = true;
      c.tasks[1].on = true;
      c.tasks[2].on = true;
      state.campaigns.unshift(c);
      state.lastCampaign = c.id;
      Store.save();
      return c;
    },

    /* Read a pasted listing. Crude on purpose: it is a stand in for the
       parse that would happen server side, and it has to fail gracefully
       on whatever someone actually pastes. */
    parseListing: function (text) {
      var raw = String(text || '').trim();
      var lines = raw.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
      var out = { role: '', company: '', location: '', req: '', requirements: [], facts: [] };
      if (!lines.length) return out;

      /* only split on a separator with space around it, so a hyphenated
         title like "Mid-Market Account Executive" survives intact */
      out.role = lines[0].replace(/\s+[-–|·]\s+.*$/, '').slice(0, 70);

      /* line two is usually "Company · Place · Req 123", or the company sits
         after an "at" somewhere in the first paragraph */
      var meta = (lines[1] || '').split(/\s*[·|]\s*/);
      if (meta.length > 1) {
        out.company = meta[0].slice(0, 40);
        out.location = (meta[1] || '').slice(0, 40);
      }
      if (!out.company) {
        var at = raw.match(/\bat\s+([A-Z][A-Za-z0-9&.\- ]{1,28})\b/);
        if (at) out.company = at[1].trim();
      }
      if (!out.company) out.company = 'The company';
      var req = raw.match(/\breq(?:uisition)?\.?\s*#?\s*([A-Za-z0-9-]{2,12})/i);
      if (req) out.req = req[1];
      if (!out.location) {
        var loc = raw.match(/\b(remote|hybrid|on ?site|[A-Z][a-z]+,\s?[A-Z]{2})\b/);
        if (loc) out.location = loc[1];
      }

      lines.forEach(function (l) {
        if (/^[-–•*]\s+/.test(l)) {
          var b = l.replace(/^[-–•*]\s+/, '').replace(/\.$/, '');
          if (b.length > 4 && out.requirements.length < 8) out.requirements.push(b.slice(0, 80));
        }
      });

      [[/\byears?\b/i, 'Years of experience called out'],
       [/\bquota\b/i, 'Carries a number'],
       [/\bmid[- ]market\b/i, 'Mid-market segment'],
       [/\benterprise\b/i, 'Enterprise segment'],
       [/\bpricing|packaging|reprice\b/i, 'Pricing change in play'],
       [/\bramp\b/i, 'Ramp is on their mind'],
       [/\bremote\b/i, 'Remote friendly']
      ].forEach(function (p) { if (p[0].test(raw) && out.facts.length < 5) out.facts.push(p[1]); });

      return out;
    },

    /* Score every win against the listing and hand back the best three. */
    rankWins: function (text) {
      var hay = String(text || '').toLowerCase();
      return state.profile.wins.map(function (w) {
        var hits = (w.tags || []).filter(function (t) { return hay.indexOf(t) > -1; });
        return { win: w, score: hits.length, hits: hits };
      }).sort(function (a, b) { return b.score - a.score; });
    },

    createCampaign: function (data) {
      var parsed = data.parsed || Store.parseListing(data.listing);
      var ranked = Store.rankWins(data.listing);
      var id = uid('c');
      var c = {
        id: id,
        company: data.company || parsed.company,
        role: data.role || parsed.role,
        location: parsed.location || '',
        req: parsed.req || '',
        slug: slugify((state.profile.name.split(' ')[0] || 'me') + '-' + (data.company || parsed.company)),
        listing: data.listing || '',
        status: 'running', day: 0, createdAt: Date.now(),
        facts: parsed.facts || [],
        requirements: parsed.requirements || [],
        winIds: (data.winIds || ranked.slice(0, 3).map(function (r) { return r.win.id; })),
        story: data.story || '',
        pageTemplate: 'case',
        angles: [],
        contacts: [],
        suggested: Store.suggestFor(data.company || parsed.company, parsed.role),
        steps: [],
        research: [],
        sections: clone(SECTIONS),
        tasks: taskSet(),
        activeStep: null, activeContact: null, pendingInsert: null,
        sent: 0, replies: 0, views: 0, lastView: 'never'
      };
      c.tasks[0].on = true;
      c.tasks[1].on = true;
      state.campaigns.unshift(c);
      state.lastCampaign = id;
      Store.save();
      return c;
    },
    removeCampaign: function (id) {
      state.campaigns = state.campaigns.filter(function (c) { return c.id !== id; });
      if (state.lastCampaign === id) state.lastCampaign = state.campaigns[0] ? state.campaigns[0].id : null;
      Store.save();
    },
    updateCampaign: function (id, patch) {
      var c = Store.campaign(id); if (!c) return;
      Object.keys(patch).forEach(function (k) { c[k] = patch[k]; });
      Store.save();
    },
    /* the three names worth finding on any listing */
    suggestFor: function (company, role) {
      var dom = slugify(company).replace(/-/g, '') + '.com';
      var seg = /mid[- ]market/i.test(role || '') ? 'Mid-Market' : /enterprise/i.test(role || '') ? 'Enterprise' : 'Sales';
      return [
        { id: uid('g'), name: 'Director, ' + seg, title: 'Likely hiring manager at ' + company, persona: 'Hiring manager',
          found: 'Named on the team page', why: 'Owns the number this role carries. The one person who can skip the queue.',
          email: 'first.last@' + dom, linkedin: '', mutuals: 0, tenure: '', prev: '', ask: 'Fifteen minutes' },
        { id: uid('g'), name: 'Talent Partner', title: 'Recruiter on this req at ' + company, persona: 'Recruiter',
          found: 'Posted the req', why: 'Knows whether the req is moving or already has a finalist.',
          email: 'talent@' + dom, linkedin: '', mutuals: 0, tenure: '', prev: '', ask: 'Whether the req is moving' },
        { id: uid('g'), name: 'Someone you already know', title: 'Worked with you, now near ' + company, persona: 'Shared tie',
          found: 'Overlap in your history', why: 'A warm forward beats a cold email every time. Ask them to paste two lines.',
          email: '', linkedin: '', mutuals: 0, tenure: '', prev: '', ask: 'An introduction' }
      ];
    },

    /* ---- wins on an opportunity ------------------------------------------ */
    campaignWins: function (c) {
      return (c.winIds || []).map(function (id) {
        return state.profile.wins.filter(function (w) { return w.id === id; })[0];
      }).filter(Boolean);
    },
    toggleCampaignWin: function (cid, wid) {
      var c = Store.campaign(cid); if (!c) return;
      var have = c.winIds.indexOf(wid);
      if (have > -1) c.winIds.splice(have, 1);
      else if (c.winIds.length < 3) c.winIds.push(wid);
      Store.save();
    },

    /* ---- contacts -------------------------------------------------------- */
    colourFor: function (persona) {
      var p = PERSONAS.filter(function (x) { return x.key === persona; })[0];
      return p ? p.colour : '--line-3';
    },
    addContact: function (cid, data) {
      var c = Store.campaign(cid); if (!c) return null;
      var person = {
        id: uid('p'), name: data.name || 'Someone at ' + c.company,
        title: data.title || '', persona: data.persona || 'Other',
        colour: Store.colourFor(data.persona || 'Other'),
        tenure: data.tenure || '', prev: data.prev || '', mutuals: data.mutuals || 0,
        email: data.email || '', linkedin: data.linkedin || '',
        ask: data.ask || '', notes: '', activity: data.activity || []
      };
      c.contacts.push(person);
      Store.save();
      return person;
    },
    acceptSuggestion: function (cid, sid) {
      var c = Store.campaign(cid); if (!c) return null;
      var s = (c.suggested || []).filter(function (x) { return x.id === sid; })[0];
      if (!s) return null;
      c.suggested = c.suggested.filter(function (x) { return x.id !== sid; });
      return Store.addContact(cid, s);
    },
    dismissSuggestion: function (cid, sid) {
      var c = Store.campaign(cid); if (!c) return;
      c.suggested = (c.suggested || []).filter(function (x) { return x.id !== sid; });
      Store.save();
    },
    updateContact: function (cid, pid, patch) {
      var c = Store.campaign(cid); if (!c) return;
      var p = c.contacts.filter(function (x) { return x.id === pid; })[0]; if (!p) return;
      Object.keys(patch).forEach(function (k) { p[k] = patch[k]; });
      if (patch.persona) p.colour = Store.colourFor(patch.persona);
      Store.save();
    },
    removeContact: function (cid, pid) {
      var c = Store.campaign(cid); if (!c) return;
      c.contacts = c.contacts.filter(function (x) { return x.id !== pid; });
      if (c.activeContact === pid) c.activeContact = c.contacts[0] ? c.contacts[0].id : null;
      c.steps.forEach(function (s) { if (s.contact === pid) s.contact = null; });
      Store.save();
    },
    moveContact: function (cid, pid, dir) {
      var c = Store.campaign(cid); if (!c) return;
      var i = c.contacts.map(function (x) { return x.id; }).indexOf(pid);
      var j = i + dir;
      if (i < 0 || j < 0 || j >= c.contacts.length) return;
      var tmp = c.contacts[i]; c.contacts[i] = c.contacts[j]; c.contacts[j] = tmp;
      Store.save();
    },

    /* ---- steps ------------------------------------------------------------ */
    addStep: function (cid) {
      var c = Store.campaign(cid); if (!c) return null;
      var last = c.steps.length ? c.steps[c.steps.length - 1].day : 0;
      var s = { id: uid('s'), day: last + 2, contact: c.contacts[0] ? c.contacts[0].id : null,
                template: null, channel: 'Email', note: 'New step', status: 'queued',
                subject: '', body: '' };
      c.steps.push(s);
      Store.sortSteps(cid);
      Store.save();
      return s;
    },
    updateStep: function (cid, sid, patch) {
      var c = Store.campaign(cid); if (!c) return;
      var s = c.steps.filter(function (x) { return x.id === sid; })[0]; if (!s) return;
      Object.keys(patch).forEach(function (k) { s[k] = patch[k]; });
      Store.sortSteps(cid);
      Store.save();
    },
    removeStep: function (cid, sid) {
      var c = Store.campaign(cid); if (!c) return;
      c.steps = c.steps.filter(function (x) { return x.id !== sid; });
      if (c.activeStep === sid) c.activeStep = c.steps[0] ? c.steps[0].id : null;
      Store.save();
    },
    sortSteps: function (cid) {
      var c = Store.campaign(cid); if (!c) return;
      c.steps.sort(function (a, b) { return a.day - b.day; });
    },
    duplicateStep: function (cid, sid) {
      var c = Store.campaign(cid); if (!c) return null;
      var s = c.steps.filter(function (x) { return x.id === sid; })[0]; if (!s) return null;
      var copy = clone(s);
      copy.id = uid('s'); copy.day = s.day + 2; copy.status = 'queued';
      c.steps.push(copy); Store.sortSteps(cid); Store.save();
      return copy;
    },
    /* the wait is the gap to the previous step; changing it shifts everything after */
    setWait: function (cid, sid, days) {
      var c = Store.campaign(cid); if (!c) return;
      var i = c.steps.map(function (x) { return x.id; }).indexOf(sid);
      if (i < 1) return;
      var want = Math.max(0, days);
      var delta = (c.steps[i - 1].day + want) - c.steps[i].day;
      for (var j = i; j < c.steps.length; j++) c.steps[j].day = Math.max(0, c.steps[j].day + delta);
      Store.save();
    },
    /* the text a step actually sends. A step that only points at a template
       gets that template resolved into it the first time it is read, so the
       editor never shows anyone a curly brace. */
    bodyFor: function (c, s) {
      if (s.body && s.body.trim()) return s.body;
      var t = Store.template(s.template);
      if (!t) return '';
      var p = c.contacts.filter(function (x) { return x.id === s.contact; })[0] || null;
      s.body = Store.fill(t.body, c, p);
      return s.body;
    },
    /* resolve every step in one pass, on the way into the builder */
    materialise: function (cid) {
      var c = Store.campaign(cid); if (!c) return;
      c.steps.forEach(function (s) { Store.bodyFor(c, s); });
      Store.save();
    },

    /* ---- templates -------------------------------------------------------- */
    template: function (id) { return state.templates.filter(function (t) { return t.id === id; })[0] || null; },
    /* what you would normally send to this kind of person at this point */
    templatesFor: function (persona, channel) {
      var all = state.templates.slice();
      return all.sort(function (a, b) {
        var sa = (a.persona === persona ? 2 : 0) + (a.channel === channel ? 1 : 0);
        var sb = (b.persona === persona ? 2 : 0) + (b.channel === channel ? 1 : 0);
        return sb - sa;
      });
    },
    addTemplate: function (data) {
      var t = { id: uid('tpl'), name: data.name || 'Untitled', persona: data.persona || 'Other',
                stage: data.stage || 'First touch', channel: data.channel || 'Email',
                body: data.body || '', stock: false };
      state.templates.push(t);
      Store.save();
      return t;
    },
    updateTemplate: function (id, patch) {
      var t = Store.template(id); if (!t) return;
      Object.keys(patch).forEach(function (k) { t[k] = patch[k]; });
      Store.save();
    },
    removeTemplate: function (id) {
      state.templates = state.templates.filter(function (t) { return t.id !== id; });
      state.campaigns.forEach(function (c) {
        c.steps.forEach(function (s) { if (s.template === id) s.template = null; });
      });
      Store.save();
    },

    /* Placeholders are resolved the moment a template lands in a step, so
       nobody ever has to look at a curly brace. */
    fill: function (body, campaign, contact) {
      var angle = (campaign.angles.filter(function (a) { return a.on; })[0] || campaign.angles[0] || {}).take || '';
      var first = contact ? String(contact.name).split(' ')[0] : 'there';
      var wins = Store.campaignWins(campaign);
      var win = wins[0] ? wins[0].text.charAt(0).toLowerCase() + wins[0].text.slice(1) : '';
      /* an angle that lands mid sentence should not start with a capital */
      var lower = angle ? angle.charAt(0).toLowerCase() + angle.slice(1) : '';
      return String(body)
        .replace(/, \{angle\}/g, ', ' + lower)
        .replace(/\{first\}/g, first)
        .replace(/\{name\}/g, contact ? contact.name : '')
        .replace(/\{title\}/g, contact ? contact.title : '')
        .replace(/\{company\}/g, campaign.company)
        .replace(/\{role\}/g, campaign.role)
        .replace(/\{slug\}/g, campaign.slug)
        .replace(/\{angle\}/g, angle)
        .replace(/\{win\}/g, win)
        .replace(/\{me\}/g, state.profile.name);
    },

    /* ---- profile ---------------------------------------------------------- */
    markImported: function (source) { state.profile.imported = true; state.profile.source = source; Store.save(); },
    setPhoto: function (data) { state.profile.photo = data; Store.save(); },
    toggleRole: function (id) {
      var r = state.profile.roles.filter(function (x) { return x.id === id; })[0];
      if (r) { r.on = !r.on; Store.save(); }
    },

    /* ---- per opportunity checklist ---------------------------------------- */
    toggleTask: function (cid, id) {
      var c = Store.campaign(cid); if (!c) return null;
      var t = c.tasks.filter(function (x) { return x.id === id; })[0];
      if (t) { t.on = !t.on; Store.save(); }
      return t;
    },
    completeTask: function (cid, id) {
      var c = Store.campaign(cid); if (!c) return;
      var t = c.tasks.filter(function (x) { return x.id === id; })[0];
      if (t && !t.on) { t.on = true; Store.save(); }
    },
    taskProgress: function (c) {
      if (!c) return { done: 0, total: 0 };
      return { done: c.tasks.filter(function (t) { return t.on; }).length, total: c.tasks.length };
    },

    reset: function () {
      try { window.localStorage.removeItem(KEY); } catch (e) {}
      state = defaults(); Store.state = state; emit();
    }
  };

  window.Store = Store;
})(window);

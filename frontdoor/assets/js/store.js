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

  var KEY = 'frontdoor.v5';

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

  /* ---- profile ----------------------------------------------------------
     Empty until a resume goes in. Nothing here is invented for you. ------- */
  function blankProfile() {
    return {
      name: '', email: '', phone: '', location: '', years: 0,
      photo: null, imported: false, source: null,
      voice: { traits: [] },
      roles: [], wins: [],
      stack: [],
      reference: { quote: '', who: '', role: '', initials: '' }
    };
  }

  /* The example, for anyone who wants to see it working before handing over
     their own history. */
  var EXAMPLE_RESUME = [
    'Evan Pogue',
    'Chicago, IL | evan@example.com | 312 555 0148',
    '',
    'EXPERIENCE',
    '',
    'Senior AE, Mid-Market - Brightline, Chicago (2023 to now)',
    '- Carried $1.2M and finished at 112% through a seat pricing change',
    '- Rebuilt discovery when cycles went from 30 days to 70',
    '- Held the team together through 40% attrition and still made the year',
    '',
    'Account Executive - Northwind, Chicago (2021 to 2023)',
    '- Grew territory ARR 41% year over year',
    '- Got four new AEs to quota in two quarters',
    '- Top 3 of 38 reps, two years running',
    '',
    'SDR, then AE - Cobalt, remote (2018 to 2021)',
    '- Closed the biggest deal the company had done at $340k',
    '- Built the outbound motion from nothing',
    '',
    'TOOLS',
    'Salesforce, HubSpot, Outreach, Gong, Clay, Sales Navigator, MEDDPICC'
  ].join('\n');

  /* words worth matching a listing against, per win */
  var TAGS = [
    [/pricing|reprice|packaging|seat/i,          ['pricing', 'packaging', 'seat', 'change']],
    [/quota|attainment|\bplan\b|number/i,        ['quota', 'attainment', 'number']],
    [/cycle|discovery|process|meddpicc|qualif/i, ['discovery', 'cycle', 'process', 'meddpicc']],
    [/territory|arr|growth|expansion|pipeline/i, ['territory', 'growth', 'arr', 'pipeline']],
    [/ramp|onboard|coach|mentor|train|hire/i,    ['ramp', 'coaching', 'onboarding', 'team']],
    [/top \d|rank|president|award|consistent/i,  ['performance', 'ranking', 'consistent']],
    [/enterprise|largest|biggest|strategic/i,    ['enterprise', 'strategic', 'large']],
    [/outbound|cold|prospect/i,                  ['outbound', 'prospecting']],
    [/mid[- ]market|smb|commercial/i,            ['mid-market', 'smb']],
    [/team|manage|lead|director/i,               ['team', 'lead', 'manager']]
  ];
  var TOOLS = ['Salesforce', 'HubSpot', 'Outreach', 'Salesloft', 'Gong', 'Chorus', 'Clay', 'Apollo',
    'ZoomInfo', 'Sales Navigator', 'MEDDPICC', 'MEDDIC', 'Challenger', 'Sandler',
    'Looker', 'Tableau', 'Excel', 'Notion', 'Slack', 'Zendesk', 'Intercom', 'Marketo', 'Pardot',
    'Pipedrive', 'Jira', 'Asana', 'Figma', 'SQL', 'Python'];

  /* ---- message templates ----------------------------------------------- */
  var TEMPLATES = [
    { id: 'tpl_peer', name: 'Ask a peer what it is really like', persona: 'Peer', stage: 'First touch', channel: 'LinkedIn', stock: true,
      body: "{first}, I applied for the {role} and figured I would go to the source rather than the portal.\n\nCurious what changed day to day when {company} moved upmarket. Longer cycles, or just more people in the room?\n\nEither way, appreciate you reading this." },
    { id: 'tpl_rec', name: 'Check the req is actually moving', persona: 'Recruiter', stage: 'First touch', channel: 'Email', stock: true,
      body: "{first}, I applied for the {role} on Tuesday. Quick context: {win}.\n\nIs the team still interviewing for this one, or is it further along than the posting suggests?" },
    { id: 'tpl_hm', name: 'Open with what you noticed', persona: 'Hiring manager', stage: 'First touch', channel: 'Email', stock: true,
      body: "{first}, {angle}\n\n{win}. [One sentence on what that actually took \u2014 the part a résumé bullet leaves out.]\n\nI applied for the {role}.\n\nWorth fifteen minutes, or should I stay in the queue?" },
    { id: 'tpl_hm2', name: 'Follow up with something new', persona: 'Hiring manager', stage: 'Follow up', channel: 'Email', stock: true,
      body: "{first}, [something you went and found out about {company} since you last wrote \u2014 a number, a friction, a thing they said].\n\n[Why it matters to the thing this role owns.]\n\nStill happy to trade fifteen minutes if useful." },
    { id: 'tpl_exec', name: 'Go one level up', persona: 'Skip level', stage: 'Escalation', channel: 'Email', stock: true,
      body: "{first}, {angle}\n\n{win}.\n\nApplied for the {role}.\n\nWorth passing down, or should I sit tight?" },
    { id: 'tpl_tie', name: 'Ask for the intro and write it for them', persona: 'Shared tie', stage: 'Referral ask', channel: 'LinkedIn', stock: true,
      body: "{first}, [where the two of you overlapped, and when].\n\nI am going after the {role} at {company}. If you are still in touch with anyone there, would you be up for forwarding me along? Totally fine if that bridge is not one you want to cross.\n\nSomething you could paste:\n\"{me} {win}. He has applied for the {role}.\"" },
    { id: 'tpl_ref', name: 'Ask a peer to refer you', persona: 'Peer', stage: 'Referral ask', channel: 'Reply', stock: true,
      body: "{first}, [the specific thing they told you] was the most useful thing anyone has said to me about this role.\n\nIf it feels right after one conversation, would you be open to dropping me in the referral portal? No pressure at all." },
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



  function seedCampaign() {
    return {
      id: 'c_acme',
      company: 'Acme', role: 'Mid-Market Account Executive',
      location: 'Chicago, hybrid', req: '4821', slug: 'evan-acme',
      listing: ACME_LISTING,
      postingUrl: 'https://boards.example.com/acme/jobs/4821',
      status: 'running', day: 3, createdAt: Date.now() - 3 * 864e5,
      facts: ['Series B', '340 people', 'Repriced in Q2', '6 AE reqs open'],
      requirements: ['5+ yrs SaaS', '$80 to 150k ACV', 'RevOps buyers', '60 to 90 day cycles', 'Sold through a reprice'],
      winIds: ['w1', 'w3', 'w2'],
      story: 'Brightline repriced to seat based in the middle of my best year. Forty per cent of the team left inside two quarters. I rewrote discovery around the new deal math, took cycles from 30 days to 70 without losing the number, and finished at 112%.',
      pageTemplate: 'case',
      match: [],
      agenda: [],
      questions: null,
      angles: clone(ANGLES),
      contacts: clone(CONTACTS),
      suggested: clone(SUGGESTED),
      steps: clone(STEPS),
      research: clone(RESEARCH),
      sections: clone(SECTIONS),
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
      profile: blankProfile(),
      templates: clone(TEMPLATES),
      campaigns: [],
      lastCampaign: null,
      ai: { mode: 'off', key: '', proxy: '', model: 'claude-opus-5' }
    };
  }

  var state = defaults();
  var subs = [];

  function read() {
    try { var raw = window.localStorage.getItem(KEY); return raw ? JSON.parse(raw) : null; }
    catch (e) { return null; }
  }
  var writeFailed = false;
  function write() {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(state));
      writeFailed = false;
      return true;
    } catch (e) {
      /* quota, a private window, or blocked site data. Losing work quietly is
         the worst of the three outcomes, so say it once. */
      if (!writeFailed) {
        writeFailed = true;
        if (window.UI && UI.toast) {
          UI.toast(/quota/i.test(e.name || '')
            ? 'This browser is full. Remove a photo or a company, or your work will not be saved.'
            : 'This browser will not let us save. Your work only lasts as long as this tab.');
        }
      }
      return false;
    }
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
      /* A campaign written by an older build is missing whatever was added
         since, and every view that touches the field unguarded shows a blank
         screen with no way back. Fill the shape in on the way through. */
      var shape = {
        facts: [], requirements: [], winIds: [], match: [], agenda: [], angles: [],
        contacts: [], suggested: [], steps: [], research: [], sections: []
      };
      state.campaigns.forEach(function (c) {
        Object.keys(shape).forEach(function (k) { if (!Array.isArray(c[k])) c[k] = clone(shape[k]); });
        if (!c.sections.length) c.sections = clone(SECTIONS);
        if (typeof c.story !== 'string') c.story = '';
        if (typeof c.sent !== 'number') c.sent = 0;
        if (typeof c.replies !== 'number') c.replies = 0;
        if (typeof c.views !== 'number') c.views = 0;
        if (typeof c.day !== 'number') c.day = 0;
        if (!c.cheered || typeof c.cheered !== 'object') c.cheered = {};
        if (typeof c.booked !== 'boolean') c.booked = false;
        delete c.tasks;
        Store.refreshDue(c);
        Store.syncCounts(c);
      });
      if (!state.profile || typeof state.profile !== 'object') state.profile = blankProfile();
      ['roles', 'wins', 'stack'].forEach(function (k) {
        if (!Array.isArray(state.profile[k])) state.profile[k] = [];
      });
      if (!state.profile.voice || !Array.isArray(state.profile.voice.traits)) {
        state.profile.voice = { traits: [] };
      }
      /* the previous schema's blob is dead weight in a 5MB budget */
      try { window.localStorage.removeItem('frontdoor.v4'); } catch (e) {}
      return state;
    },
    subscribe: function (fn) { subs.push(fn); return function () { subs = subs.filter(function (f) { return f !== fn; }); }; },
    save: function () { write(); emit(); },

    /* auth */
    /* a browser that has ever held a profile or a user has an account here */
    hasAccount: function () {
      return !!(state.profile && state.profile.imported) || !!state.user || !!state.everSignedIn;
    },
    signIn: function (email, name) {
      state.everSignedIn = true;
      /* the name they typed, else the résumé's, else the front of the address */
      var nm = (name && name.trim()) || state.profile.name ||
        String(email || '').split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); }) ||
        'You';
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
      if (!state.profile.imported) {
        Store.applyResume(Store.parseResume(EXAMPLE_RESUME, 'Evan_Pogue.pdf'));
      }
      var c = seedCampaign();
      c.example = true;
      c.winIds = Store.rankWins(ACME_LISTING).slice(0, 3).map(function (r) { return r.win.id; });
      c.match = Store.matchLocally(Store.parseListing(ACME_LISTING).requirements, ACME_LISTING);
      c.sections = clone(SECTIONS);
      state.campaigns.unshift(c);
      state.lastCampaign = c.id;
      Store.save();
      return c;
    },

    /* Read a pasted listing. Crude on purpose: it is a stand in for the
       parse that would happen server side, and it has to fail gracefully
       on whatever someone actually pastes. */
    /* ---- reading a job posting -------------------------------------------
       People paste whatever the site gave them: LinkedIn's "Role / Company ·
       Place", Greenhouse with the company first, Indeed with a salary line in
       the middle, a careers page with pipes, a labelled form, or one sentence
       of prose. The old reader assumed line one was the title and line two was
       "Company · Place", which is one shape out of eight.

       Nothing here guesses wildly: when a field cannot be found it is left
       empty and the screen asks for it, because a wrong company name is worse
       than a blank one. -------------------------------------------------- */

    parseListing: function (text) {
      var raw = String(text || '').replace(/\r/g, '').trim();
      var lines = raw.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
      var out = { role: '', company: '', location: '', req: '', requirements: [], facts: [] };
      if (!lines.length) return out;

      /* ---- words that make a line a job title ---- */
      var ROLE = new RegExp('\\b(account executive|sales|engineer|developer|designer|manager|' +
        'director|analyst|specialist|representative|consultant|architect|scientist|coordinator|' +
        'associate|partner|officer|lead|head of|vp|vice president|president|founder|recruiter|' +
        'marketer|controller|accountant|technician|administrator|strategist|producer|editor|' +
        'writer|counsel|advisor|planner|buyer|supervisor|principal|intern|nurse|teacher|' +
        'attorney|paralegal|solutions|success|support|operations|product|program|project|' +
        'ae|sdr|bdr|csm|pm|cto|ceo|cfo|coo|cro|cmo)\\b', 'i');

      /* chrome the sites wrap a posting in, which is never a title or a name */
      var CHROME = new RegExp('^(apply( now)?|share|save( job)?|back to .*|jobs?|careers?|home|' +
        'menu|search|sign in|log ?in|easy apply|show more|see more|posted.*|' +
        'full[- ]?time|part[- ]?time|contract|internship|permanent|temporary|' +
        '\\d[\\d,]*\\+? applicants?|over \\d[\\d,]* applicants?|' +
        '[\\d,]+ (second|minute|hour|day|week|month)s? ago|' +
        '\\$[\\d,]+.*(a year|per year|annually|/yr|- ?\\$[\\d,]+).*|' +
        'full job description|equal opportunity.*|department.*)$', 'i');

      /* headings that introduce the things they are asking for */
      var REQ_HEAD = new RegExp('^(requirements?|qualifications?|minimum qualifications?|' +
        'basic qualifications?|preferred qualifications?|what you.{0,14}(need|bring|have)|' +
        'who you are|about you|we.{0,4}re looking for|what we.{0,4}re looking for|' +
        'must haves?|you have|you.{0,4}ll need|skills( and experience)?|experience)\\b\\s*:?\\s*$', 'i');

      /* any other heading ends the list */
      var SECTION = new RegExp('^(about|responsibilities|what you.{0,14}do|the role|' +
        'benefits?|perks?|compensation|salary|pay|why|our|how to apply|interview|' +
        'nice to have|bonus points|equal opportunity|we offer)\\b', 'i');

      var LOC = new RegExp('\\b(remote|hybrid|on-?site|in[- ]office)\\b', 'i');
      /* "You have 3+ years" opens like a company sentence and is not one */
      var PRONOUN = /^(you|we|they|it|this|that|our|your|their|the|there|here|i)$/i;
      var CITY_RE = /\b([A-Z][A-Za-z.\-']+(?:\s+[A-Z][A-Za-z.\-']+)?,\s*(?:[A-Z]{2}\b|[A-Z][a-z]+))/;
      /* "Account Executive, Mid-Market" has the shape of "Cambridge, MA" and
         is not a place, so anything with a job word in it is refused */
      function CITY(t) {
        var g = new RegExp(CITY_RE.source, 'g'), hit;
        while ((hit = g.exec(String(t || '')))) {
          if (!ROLE.test(hit[1])) return hit;
        }
        return null;
      }

      function clean(s) {
        return String(s || '').replace(/\s+/g, ' ').replace(/[\s.,;:|·—–-]+$/, '').trim();
      }
      /* SHOUTED LINES come back as Shouted Lines; anything else is left alone */
      function unshout(s) {
        if (!s || s !== s.toUpperCase() || !/[A-Z]{3}/.test(s)) return s;
        return s.toLowerCase().replace(/\b[a-z]/g, function (m) { return m.toUpperCase(); });
      }
      function labelled(name) {
        var m = raw.match(new RegExp('^\\s*(?:' + name + ')\\s*[:\\-]\\s*(.+)$', 'im'));
        return m ? clean(m[1]) : '';
      }
      function isTitle(l) {
        if (!l || l.length < 3 || l.length > 80) return false;
        /* a bullet is a requirement, however many job words it contains */
        if (/^([-–—•*·▪●○]\s|\d+[.)]\s)/.test(l)) return false;
        if (CHROME.test(l) || REQ_HEAD.test(l) || SECTION.test(l)) return false;
        if (/[.!?]$/.test(l)) return false;              /* a sentence, not a title */
        if (l.split(/\s+/).length > 11) return false;
        return ROLE.test(l);
      }

      /* ---- the role ---- */
      out.role = labelled('(?:job\\s*)?title|position|role');
      if (!out.role) {
        /* "… is hiring an Enterprise Account Executive in Chicago" */
        var pro = raw.match(new RegExp('\\b(?:hiring|seeking|looking for|recruiting|' +
          'join .{1,40} as)\\s+(?:an?|our next|a new)?\\s*([A-Z][^.,;\\n]{2,60}?)' +
          '(?=\\s+(?:in|at|to|who|based|for|on)\\b|[.,;\\n]|$)', 'i'));
        if (pro && ROLE.test(pro[1])) out.role = clean(pro[1]);
      }
      if (!out.role) {
        for (var i = 0; i < Math.min(lines.length, 12); i++) {
          /* a title line may still carry "· Company · Place" after it */
          var head = lines[i].split(/\s+[·|]\s+|\s+[—–]\s+/)[0].trim();
          if (isTitle(head)) { out.role = clean(head); break; }
        }
      }
      out.role = unshout(out.role).slice(0, 70);

      /* ---- the company ---- */
      out.company = labelled('company|employer|organi[sz]ation');
      if (!out.company) {
        var m = raw.match(/^\s*([A-Z][A-Za-z0-9&.,'\-]*(?:\s+[A-Z][A-Za-z0-9&.,'\-]*){0,3})\s+(?:is|are)\s+(?:hiring|looking|seeking|searching|growing)/m);
        if (m) out.company = clean(m[1]);
        if (!out.company) {
          /* the sentence a posting opens its "about" with: "Brightline is
             changing how teams buy software" */
          var ab2 = raw.match(/^\s*([A-Z][A-Za-z0-9&.'\-]*(?:\s+[A-Z][A-Za-z0-9&.'\-]*){0,2})\s+(?:is|are|was|were|helps?|makes?|builds?|powers?|serves?|sells?)\s+[a-z]/m);
          if (ab2 && !ROLE.test(ab2[1]) && !CHROME.test(ab2[1]) && !PRONOUN.test(ab2[1])) {
            out.company = clean(ab2[1]);
          }
        }
      }
      if (!out.company) {
        var j = raw.match(/\b[Jj]oin\s+([A-Z][A-Za-z0-9&.'\-]*(?:\s+[A-Z][A-Za-z0-9&.'\-]*){0,2})\b/);
        if (j) out.company = clean(j[1]);
      }
      if (!out.company && out.role) {
        /* "Enterprise Account Executive at HubSpot" */
        var at = raw.match(new RegExp('\\bat\\s+([A-Z][A-Za-z0-9&.\'\\-]*(?:\\s+[A-Z][A-Za-z0-9&.\'\\-]*){0,2})\\b'));
        if (at && !LOC.test(at[1]) && !CITY(at[1] + ', XX')) out.company = clean(at[1]);
      }
      if (!out.company) {
        var ab = raw.match(/^\s*about\s+(?!the\b|us\b|this\b|our\b)([A-Z][A-Za-z0-9&.'\-]*(?:\s+[A-Z][A-Za-z0-9&.'\-]*){0,2})\s*$/im);
        if (ab) out.company = clean(ab[1]);
      }
      if (!out.company) {
        /* a "Role · Company · Place" or "Company · Place" strip near the top */
        for (var k = 0; k < Math.min(lines.length, 6) && !out.company; k++) {
          var parts = lines[k].split(/\s*[·|]\s*/).map(clean).filter(Boolean);
          if (parts.length < 2) continue;
          for (var q = 0; q < parts.length; q++) {
            var pt = parts[q];
            if (!pt || pt === out.role) continue;
            if (LOC.test(pt) || CITY(pt) || CHROME.test(pt)) continue;
            if (ROLE.test(pt)) continue;
            if (!/^[A-Z]/.test(pt) || pt.split(/\s+/).length > 4) continue;
            out.company = pt; break;
          }
        }
      }
      if (!out.company) {
        /* a short standalone name sitting next to the title line */
        var at3 = lines.indexOf(lines.filter(isTitle)[0]);
        [at3 - 1, at3 + 1, 0].forEach(function (n) {
          if (out.company || n < 0 || n >= lines.length) return;
          var l = clean(lines[n].split(/\s*[·|]\s*/)[0]);
          if (!l || l.length > 40 || l === out.role) return;
          if (CHROME.test(l) || REQ_HEAD.test(l) || SECTION.test(l)) return;
          if (ROLE.test(l) || LOC.test(l) || CITY(l)) return;
          if (/[.!?,]$/.test(l) || l.split(/\s+/).length > 4) return;
          if (!/^[A-Z0-9]/.test(l)) return;
          out.company = l;
        });
      }
      out.company = unshout(out.company).slice(0, 40);

      /* ---- where ---- */
      out.location = labelled('location|based in|office');
      if (!out.location) {
        var city = CITY(raw);
        if (city) out.location = clean(city[1]);
      }
      if (!out.location) {
        var inl = raw.match(/\bin\s+([A-Z][A-Za-z\-']+(?:\s+[A-Z][A-Za-z\-']+)?)(?=[.,;\n]|\s+(?:and|or)\b|$)/);
        if (inl && !ROLE.test(inl[1])) out.location = clean(inl[1]);
      }
      if (!out.location) {
        var l2 = raw.match(LOC);
        if (l2) out.location = clean(l2[1]);
      } else if (LOC.test(raw) && !LOC.test(out.location)) {
        out.location += ', ' + raw.match(LOC)[1].toLowerCase();
      }
      out.location = out.location.slice(0, 40);

      var reqid = raw.match(/\breq(?:uisition)?\.?\s*#?\s*([A-Za-z0-9-]{2,12})/i);
      if (reqid) out.req = reqid[1];

      /* ---- what they are asking for ------------------------------------
         Bullets when there are bullets, the lines under a "Requirements"
         heading when there are not, and failing both, the sentences that
         read like a requirement. */
      function add(t) {
        var b = clean(String(t).replace(/^[-–—•*·▪●○]\s*/, '').replace(/^\d+[.)]\s*/, ''));
        if (b.length < 8 || out.requirements.length >= 8) return;
        if (REQ_HEAD.test(b) || SECTION.test(b)) return;
        if (out.requirements.indexOf(b) > -1) return;
        out.requirements.push(b.length > 84 ? b.slice(0, 80).replace(/\s\S*$/, '') + '…' : b);
      }

      lines.forEach(function (l) {
        if (/^([-–—•*·▪●○]\s+|\d+[.)]\s+)/.test(l)) add(l);
      });

      if (!out.requirements.length) {
        var on = false;
        lines.forEach(function (l) {
          if (REQ_HEAD.test(l)) { on = true; return; }
          if (on && SECTION.test(l)) { on = false; return; }
          if (on) add(l);
        });
      }

      if (!out.requirements.length) {
        var HINT = new RegExp('\\b(\\d+\\+?\\s*years?|experience|must|proficien|familiar|' +
          'track record|ability to|quota|comfortable|you have|you.{0,4}ll|we need|' +
          'looking for someone|strong)\\b', 'i');
        raw.split(/(?<=[.!?])\s+|\n/).forEach(function (sn) {
          if (HINT.test(sn)) add(sn);
        });
      }

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
        postingUrl: data.postingUrl || '',
        status: 'running', day: 0, createdAt: Date.now(),
        facts: parsed.facts || [],
        requirements: parsed.requirements || [],
        winIds: (data.winIds || ranked.slice(0, 3).map(function (r) { return r.win.id; })),
        story: data.story || '',
        pageTemplate: 'case',
        match: [],
        agenda: [],
        questions: null,
        angles: [],
        contacts: [],
        suggested: Store.suggestFor(data.company || parsed.company, parsed.role),
        steps: [],
        research: [],
        sections: clone(SECTIONS),
        activeStep: null, activeContact: null, pendingInsert: null,
        sent: 0, replies: 0, views: 0, lastView: 'never'
      };
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
        { id: uid('g'), placeholder: true, name: 'Director, ' + seg, title: 'Likely hiring manager at ' + company, persona: 'Hiring manager',
          found: 'Not found yet \u2014 this is the seat, not the person', guessedEmail: true,
          why: 'Owns the number this role carries. The one person who can skip the queue.',
          email: 'first.last@' + dom, linkedin: '', mutuals: 0, tenure: '', prev: '', ask: 'Fifteen minutes' },
        { id: uid('g'), placeholder: true, name: 'Talent Partner', title: 'Recruiter on this req at ' + company, persona: 'Recruiter',
          found: 'Not found yet \u2014 this is the seat, not the person', guessedEmail: true,
          why: 'Knows whether the req is moving or already has a finalist.',
          email: 'talent@' + dom, linkedin: '', mutuals: 0, tenure: '', prev: '', ask: 'Whether the req is moving' },
        { id: uid('g'), placeholder: true, name: 'Someone you already know', title: 'Worked with you, now near ' + company, persona: 'Shared tie',
          found: 'Someone from your own history \u2014 you will know who', guessedEmail: false,
          why: 'A warm forward beats a cold email every time. Ask them to paste two lines.',
          email: '', linkedin: '', mutuals: 0, tenure: '', prev: '', ask: 'An introduction' }
      ];
    },

    /* ---- what the listing asks for against what you have -----------------
       The model does this properly. Without one, tags are matched against the
       requirement text, which is blunt but honest about being blunt. ------ */
    matchLocally: function (requirements, listing) {
      var wins = state.profile.wins;
      var STOP = /^(the|and|for|with|you|your|our|that|this|from|into|able|have|has|will|who|are|was|were|they|them|their|a|an|of|to|in|on|at|as|by|or|it|is|be|do|not|all|any|can|how|what|when|more|most|than|then|through|across|using|used|use|help|helps|work|works|working|new|next|every|each|per|up|out|off|over|under|about|also|its)$/;
      function words(t) {
        return String(t).toLowerCase().replace(/[^a-z0-9+ ]/g, ' ').split(/\s+/)
          .filter(function (w) { return w.length > 2 && !STOP.test(w); });
      }
      return (requirements || []).map(function (r) {
        var hay = String(r).toLowerCase();
        var rw = words(r);
        var hits = wins.map(function (w) {
          var tagHits = (w.tags || []).filter(function (t) { return hay.indexOf(t) > -1; }).length;
          var ww = words(w.text + ' ' + w.short);
          var shared = rw.filter(function (x) { return ww.indexOf(x) > -1; }).length;
          return { id: w.id, n: tagHits * 2 + shared };
        }).filter(function (x) { return x.n; }).sort(function (a, b) { return b.n - a.n; });
        return {
          id: uid('req'), text: r,
          priority: /\b(\d\+? years|must|required|minimum)\b/i.test(r) ? 'must' : 'nice',
          winIds: hits.slice(0, 2).map(function (x) { return x.id; }),
          strength: hits.length && hits[0].n >= 3 ? 'strong' : hits.length ? 'partial' : 'none',
          note: ''
        };
      });
    },

    setMatch: function (cid, match) {
      var c = Store.campaign(cid); if (!c) return;
      c.match = match || [];
      Store.save();
    },
    matchScore: function (c) {
      var m = (c && c.match) || [];
      return {
        total: m.length,
        covered: m.filter(function (r) { return r.strength !== 'none'; }).length,
        gaps: m.filter(function (r) { return r.strength === 'none'; })
      };
    },

    /* ---- the things worth nailing down before you write ------------------ */
    buildAgenda: function (cid) {
      var c = Store.campaign(cid); if (!c) return [];
      if (c.agenda && c.agenda.length) return c.agenda;
      var items = [];

      /* one per win you are leading with: the detail the bullet leaves out */
      Store.campaignWins(c).forEach(function (w) {
        items.push({ id: uid('ag'), kind: 'story', ref: w.id,
          label: w.text, ask: 'What actually happened behind this', text: '', done: false });
      });

      /* one per thing the listing wants that nothing on the resume answers */
      Store.matchScore(c).gaps.slice(0, 4).forEach(function (r) {
        items.push({ id: uid('ag'), kind: 'gap', ref: r.id,
          label: r.text, ask: 'Nothing on your résumé answers this', text: '', done: false });
      });

      c.agenda = items;
      Store.save();
      return items;
    },
    answerAgenda: function (cid, id, text) {
      var c = Store.campaign(cid); if (!c) return;
      var it = (c.agenda || []).filter(function (x) { return x.id === id; })[0];
      if (!it) return;
      it.text = text;
      it.done = !!(text && text.trim());
      /* the page's story is the first thing you nailed down, not a field
         nobody ever writes to */
      var first = Store.stories(c)[0];
      c.story = first ? first.text : '';
      Store.save();
    },
    /* leaving an item is a decision, and a decision is recorded */
    skipAgenda: function (cid, id) {
      var c = Store.campaign(cid); if (!c) return;
      var it = (c.agenda || []).filter(function (x) { return x.id === id; })[0];
      if (!it) return;
      it.skipped = true;
      Store.save();
    },

    /* A milestone is celebrated once and then never again. Returning false
       means it has already happened, which is how the views stay honest on
       a reload: the data says done, the confetti does not fire twice. */
    markCheered: function (cid, key) {
      var c = Store.campaign(cid); if (!c) return false;
      c.cheered = c.cheered || {};
      if (c.cheered[key]) return false;
      c.cheered[key] = true;
      Store.save();
      return true;
    },
    hasCheered: function (c, key) {
      return !!(c && c.cheered && c.cheered[key]);
    },

    /* ---- the five steps ---------------------------------------------------
       Going in the front door is one order of operations, not seven screens
       in a list. Everything in the app hangs off these: the rail numbers
       them, the overview draws each company's position on them, and the next
       thing to do is always whichever one is not finished yet.

       A step is done when the work is done, never when the screen was
       visited — otherwise the pipeline lies to you.                        */
    PHASES: [
      { key: 'role', n: 1, label: 'Role', icon: 'company',
        href: '/c/:id',
        done: function (c) { return !!(c.company && (c.listing || (c.requirements || []).length)); },
        next: 'Role' },

      /* Story is done when every win you lead with has a story. A gap is
         worth answering but never blocks the step: some gaps are gaps. */
      { key: 'story', n: 2, label: 'Story', icon: 'prep',
        href: '/c/:id/prep',
        sub: [{ key: 'page', label: 'Page', href: '/c/:id/page' }],
        done: function (c) {
          var wins = (c.agenda || []).filter(function (x) { return x.kind === 'story'; });
          return wins.length > 0 && wins.every(function (x) { return x.done; });
        },
        part: function (c) {
          var wins = (c.agenda || []).filter(function (x) { return x.kind === 'story'; });
          return { done: wins.filter(function (x) { return x.done; }).length, total: wins.length };
        },
        next: 'Story' },

      /* a placeholder seat is not a person */
      { key: 'people', n: 3, label: 'People', icon: 'contacts',
        href: '/c/:id/people',
        sub: [{ key: 'research', label: 'Research', href: '/c/:id/research' }],
        done: function (c) { return Store.realPeople(c).length >= 3; },
        part: function (c) { return { done: Math.min(Store.realPeople(c).length, 3), total: 3 }; },
        next: 'People' },

      /* every planned touch has gone out, been answered, or been dropped */
      { key: 'outreach', n: 4, label: 'Outreach', icon: 'sequence',
        href: '/c/:id/sequence',
        sub: [{ key: 'templates', label: 'Templates', href: '/templates' }],
        done: function (c) {
          var st = c.steps || [];
          return st.length > 0 && st.every(function (x) { return /^(sent|replied|skipped)$/.test(x.status); });
        },
        part: function (c) {
          var st = c.steps || [];
          return { done: st.filter(function (x) { return /^(sent|replied)$/.test(x.status); }).length,
                   total: st.length };
        },
        next: 'Outreach' },

      /* a fact you record, never something a screen decides for you */
      { key: 'interview', n: 5, label: 'Interview', icon: 'brief',
        href: '/c/:id/brief',
        done: function (c) { return !!c.booked; },
        part: function (c) { return { done: c.booked ? 1 : 0, total: 1 }; },
        next: 'Interview' }
    ],

    /* a contact with a real name, as opposed to a seat we suggested */
    realPeople: function (c) {
      return (c.contacts || []).filter(function (p) { return p.name && !p.placeholder; });
    },

    /* sent and replied are derived from the touches, never counted by hand:
       two counters that can drift is two versions of the truth */
    syncCounts: function (c) {
      if (!c) return;
      var st = c.steps || [];
      c.sent = st.filter(function (x) { return x.status === 'sent' || x.status === 'replied'; }).length;
      c.replies = st.filter(function (x) { return x.status === 'replied'; }).length;
    },

    /* a touch is due when its day has come, and the day is counted from
       the day the company was added */
    refreshDue: function (c) {
      if (!c || !c.createdAt) return;
      var today = Math.max(0, Math.floor((Date.now() - c.createdAt) / 86400000));
      c.day = today;
      (c.steps || []).forEach(function (x) {
        if (x.status === 'queued' && x.day <= today) x.status = 'due';
      });
    },

    setBooked: function (cid, on) {
      var c = Store.campaign(cid); if (!c) return;
      c.booked = !!on;
      Store.save();
    },

    /* an unresolved placeholder in a message is the one thing that must
       never go out: "[one sentence on what that took]" is not a sentence */
    unresolved: function (body) {
      return (String(body || '').match(/\[[^\]\n]{3,}\]/g) || []);
    },

    /* Each step with its state: done, the one you are on, or still ahead.
       Exactly one step is 'now' — the first unfinished one — unless every
       step is finished, and then none is. */
    phases: function (c) {
      if (!c) return [];
      var found = false;
      return Store.PHASES.map(function (s) {
        var done = !!s.done(c);
        var now = !done && !found;
        if (now) found = true;
        return {
          key: s.key, n: s.n, label: s.label, icon: s.icon,
          href: s.href.replace(':id', c.id),
          sub: (s.sub || []).map(function (x) {
            return { key: x.key, label: x.label, href: x.href.replace(':id', c.id) };
          }),
          part: s.part ? s.part(c) : { done: done ? 1 : 0, total: 1 },
          next: s.next,
          done: done, now: now
        };
      });
    },

    /* the step you are on, or null when there is nothing left to do */
    phaseNow: function (c) {
      return Store.phases(c).filter(function (s) { return s.now; })[0] || null;
    },

    phaseProgress: function (c) {
      var all = Store.phases(c);
      return { done: all.filter(function (s) { return s.done; }).length, total: all.length };
    },

    /* The step to go to next. From a given step it is the first unfinished
       one after it, so "Next" never points backwards from where you stand;
       with nothing after, it is the first unfinished one at all. */
    nextAction: function (c, hereKey) {
      var all = Store.phases(c);
      var idx = hereKey ? all.map(function (p) { return p.key; }).indexOf(hereKey) : -1;
      var ahead = all.slice(idx + 1).filter(function (p) { return !p.done; })[0];
      var any = all.filter(function (p) { return !p.done; })[0];
      var s = ahead || any;
      if (!s) return { label: 'Done', href: '/c/' + c.id + '/brief', done: true };
      return { label: s.label, href: s.href, stage: s.key, done: false };
    },

    agendaProgress: function (c) {
      var a = (c && c.agenda) || [];
      return { done: a.filter(function (x) { return x.done; }).length, total: a.length };
    },
    /* everything they have told us, for the page and the messages */
    stories: function (c) {
      return ((c && c.agenda) || []).filter(function (x) { return x.done && x.text; });
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

    /* ---- read a resume ---------------------------------------------------
       A real parse of real text, not a fake scan. Everything it cannot find
       it leaves blank rather than inventing. -------------------------------- */
    EXAMPLE_RESUME: EXAMPLE_RESUME,

    parseResume: function (text, source) {
      var raw = String(text || '').replace(/\r/g, '');
      var lines = raw.split('\n').map(function (l) { return l.trim(); });
      var out = blankProfile();
      out.imported = true;
      out.source = source || 'pasted text';

      var isBullet = function (l) { return /^[-\u2013\u2014\u2022*\u00b7]\s+/.test(l); };
      var strip = function (l) { return l.replace(/^[-\u2013\u2014\u2022*\u00b7]\s+/, '').replace(/[.;]$/, ''); };
      var isSection = function (l) {
        return /^[A-Z][A-Z \/&]{2,28}$/.test(l) ||
               /^(experience|work experience|employment|skills|tools|education|summary|profile|about)\b/i.test(l);
      };

      var email = raw.match(/[\w.+-]+@[\w-]+\.[\w.]{2,}/);
      if (email) out.email = email[0];
      var phone = raw.match(/(?:\+?\d[\d ().-]{8,}\d)/);
      if (phone) out.phone = phone[0].trim();
      var loc = raw.match(/\b([A-Z][a-zA-Z.\- ]{2,20},\s?(?:[A-Z]{2}\b|[A-Z][a-z]+))/);
      if (loc) out.location = loc[1].trim();

      /* the name is the first short line with no digits and no @ in it */
      for (var i = 0; i < lines.length && i < 8; i++) {
        var l = lines[i];
        if (!l || /[@\d]/.test(l) || isSection(l)) continue;
        if (l.split(/\s+/).length <= 4 && l.length <= 48) { out.name = l.replace(/[|,].*$/, '').trim(); break; }
      }

      /* roles: a heading followed by bullets */
      var section = '';
      var role = null;
      var years = [];
      lines.forEach(function (l, idx) {
        if (!l) return;
        if (isSection(l) && !isBullet(l)) { section = l.toLowerCase(); role = null; return; }

        if (isBullet(l)) {
          if (role) role.bullets.push(strip(l));
          else if (/tool|skill/.test(section)) {
            strip(l).split(/[,;\u00b7|]/).forEach(function (t) { if (t.trim()) out.stack.push(t.trim()); });
          }
          return;
        }

        if (/tool|skill/.test(section)) {
          l.split(/[,;\u00b7|]/).forEach(function (t) { if (t.trim()) out.stack.push(t.trim()); });
          return;
        }

        var next = lines.slice(idx + 1, idx + 4).filter(Boolean)[0] || '';
        var span = l.match(/\(?\b((?:19|20)\d{2})\s*(?:to|-|\u2013|\u2014|until)\s*((?:19|20)\d{2}|now|present|current)\b\)?/i);
        if (!span && !isBullet(next)) return;
        if (l.length > 120) return;

        var head = l.replace(span ? span[0] : '', '').replace(/[()]/g, '').trim();
        var bits = head.split(/\s+[-\u2013\u2014|]\s+|\s+\bat\b\s+/i);
        role = {
          id: uid('r'),
          title: (bits[0] || head).replace(/[,\s]+$/, ''),
          company: (bits[1] || '').replace(/[,\s]+$/, ''),
          span: span ? span[1] + ' to ' + span[2].toLowerCase() : '',
          on: true, bullets: []
        };
        if (span) years.push(parseInt(span[1], 10));
        out.roles.push(role);
      });
      out.roles = out.roles.filter(function (r) { return r.bullets.length; });

      if (years.length) {
        out.years = Math.max(0, Math.min(50, new Date().getFullYear() - Math.min.apply(null, years)));
      }

      /* wins are the bullets with a number in them. The label under the big
         number is the clause that number sits in, with the number taken back
         out, so it stays a sentence instead of a shredded one. */
      var METRIC = /\$[\d.,]+\s?[KkMmBb]?|\d+(?:\.\d+)?%|\b\d+(?:\s+\w+)?\s+to\s+\d+\b|\bTop\s?\d+\b|\b\d[\d,]*\s?[KkMmBb]?\b/;
      var TIDY = /^(?:and|to|at|of|in|on|through|from|with|by|the|a)\s+|\s+(?:and|to|at|of|in|on|through|from|with|by|the|a)$/gi;
      var seen = {};
      out.roles.forEach(function (r) {
        r.bullets.forEach(function (b) {
          var mm = b.match(METRIC);
          if (!mm || seen[b]) return;
          seen[b] = 1;
          var hit = mm[0].trim();

          var metric = /\sto\s/i.test(hit)
            ? hit.replace(/\s+\w+\s+to\s+|\s+to\s+/i, '\u2192')
            : hit;

          /* the clause holding the number, minus the number */
          var clauses = b.split(/,\s+|\s+and\s+|\s+with\s+/i);
          var at = 0;
          for (var k = 0; k < clauses.length; k++) if (clauses[k].indexOf(hit) > -1) { at = k; break; }
          var label = clauses[at].replace(hit, ' ').replace(/\s{2,}/g, ' ').trim().replace(TIDY, '').trim();
          if (label.split(/\s+/).length < 3 && clauses[at + 1]) {
            label = clauses[at + 1].replace(/\s{2,}/g, ' ').trim().replace(TIDY, '').trim();
          }
          if (label.length > 52) label = label.slice(0, 50).replace(/\s\S*$/, '') + '\u2026';

          var tags = [];
          TAGS.forEach(function (t) { if (t[0].test(b)) tags = tags.concat(t[1]); });
          out.wins.push({
            id: uid('w'), text: b, where: [r.company, r.span].filter(Boolean).join(', '),
            metric: metric, short: label.charAt(0).toLowerCase() + label.slice(1),
            tags: tags
          });
        });
      });
      out.wins = out.wins.slice(0, 12);

      /* tools: whatever a skills section listed, plus anything we recognise */
      TOOLS.forEach(function (t) {
        if (new RegExp('\\b' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i').test(raw)) out.stack.push(t);
      });
      var uniq = {};
      out.stack = out.stack.filter(function (t) {
        var k = t.toLowerCase();
        if (uniq[k] || t.length > 24) return false;
        uniq[k] = 1; return true;
      }).slice(0, 14);

      /* how they write, read off the bullets rather than guessed at */
      var all = [];
      out.roles.forEach(function (r) { all = all.concat(r.bullets); });
      if (all.length) {
        var avg = all.reduce(function (a, b) { return a + b.split(/\s+/).length; }, 0) / all.length;
        var numeric = all.filter(function (b) { return /\d/.test(b); }).length / all.length;
        if (avg < 15) out.voice.traits.push('Short lines');
        if (numeric > 0.5) out.voice.traits.push('Numbers first');
        if (avg >= 15) out.voice.traits.push('Full sentences');
        out.voice.traits.push('One ask');
      }
      return out;
    },

    /* the model returns content, not bookkeeping, so the ids are added here */
    fromModel: function (data, source) {
      var out = blankProfile();
      out.imported = true;
      out.source = source || 'your résumé';
      out.name = data.name || '';
      out.email = data.email || '';
      out.phone = data.phone || '';
      out.location = data.location || '';
      out.years = Math.max(0, Math.min(60, parseInt(data.years, 10) || 0));
      out.roles = (data.roles || []).map(function (r) {
        return {
          id: uid('r'), title: r.title || '', company: r.company || '', span: r.span || '',
          on: true, bullets: (r.bullets || []).filter(Boolean)
        };
      }).filter(function (r) { return r.title || r.company; });
      out.wins = (data.wins || []).map(function (w) {
        return {
          id: uid('w'), text: w.text || '', metric: w.metric || '', short: w.short || '',
          where: w.where || '', tags: (w.tags || []).map(function (t) { return String(t).toLowerCase(); })
        };
      }).filter(function (w) { return w.metric && w.text; }).slice(0, 12);
      out.stack = (data.tools || []).filter(Boolean).slice(0, 14);
      out.voice = { traits: (data.voice || []).filter(Boolean).slice(0, 4) };
      return out;
    },

    applyResume: function (parsed) {
      var photo = state.profile.photo;

      /* Wins are referenced by id from three places on every campaign. A
         re-import mints new ids, so without this every campaign silently
         loses its numbers, its evidence and its agenda. Match on the text,
         which is what actually identifies a win. */
      var remap = {};
      state.profile.wins.forEach(function (oldWin) {
        var hit = parsed.wins.filter(function (w) { return w.text === oldWin.text; })[0];
        if (hit) remap[oldWin.id] = hit.id;
      });
      var keep = function (id) { return remap[id]; };
      state.campaigns.forEach(function (c) {
        var before = (c.winIds || []).length;
        c.winIds = (c.winIds || []).map(keep).filter(Boolean);
        (c.match || []).forEach(function (r) {
          r.winIds = (r.winIds || []).map(keep).filter(Boolean);
          if (!r.winIds.length && r.strength !== 'none') r.strength = 'none';
        });
        /* an agenda pointing at a win that no longer exists is worse than none */
        if (c.agenda && c.agenda.some(function (a) { return a.kind === 'story' && !keep(a.ref); })) {
          c.agenda = c.agenda.filter(function (a) { return a.kind !== 'story' || keep(a.ref); });
          c.agenda.forEach(function (a) { if (a.kind === 'story') a.ref = keep(a.ref); });
        }
        if (before && !c.winIds.length) c.winIds = parsed.wins.slice(0, 3).map(function (w) { return w.id; });
      });

      state.profile = parsed;
      state.profile.photo = photo;
      if (state.user && parsed.name) {
        state.user.name = parsed.name;
        state.user.initials = Store.initials(parsed.name);
      }
      if (state.user && !parsed.email) state.profile.email = state.user.email;
      Store.save();
      return state.profile;
    },

    /* ---- research you add yourself --------------------------------------- */
    addResearch: function (cid, data) {
      var c = Store.campaign(cid); if (!c) return null;
      var o = {
        id: uid('res'), kind: data.kind || 'Note', date: data.date || 'just now',
        title: data.title || '', detail: data.detail || '',
        source: data.source || '', use: data.use || data.title || ''
      };
      c.research.unshift(o);
      Store.completeTask(cid, 't4');
      Store.save();
      return o;
    },
    removeResearch: function (cid, id) {
      var c = Store.campaign(cid); if (!c) return;
      c.research = c.research.filter(function (o) { return o.id !== id; });
      Store.save();
    },

    /* ---- build the fourteen days ----------------------------------------
       A plan of who to reach and when, matched against whoever is actually
       on the list. Anything with nobody to send it to is left out. -------- */
    PLAN: [
      { day: 0,  channel: 'ATS',      persona: null,             stage: null,
        note: 'Apply. You still have to exist in the system.' },
      { day: 0,  channel: 'LinkedIn', persona: 'Peer',           stage: 'First touch',
        note: 'Ask about the team, nothing else' },
      { day: 2,  channel: 'Email',    persona: 'Recruiter',      stage: 'First touch',
        note: 'Name the req, ask one question' },
      { day: 3,  channel: 'Email',    persona: 'Hiring manager', stage: 'First touch',
        note: 'Your angle, then the page' },
      { day: 5,  channel: 'LinkedIn', persona: 'Shared tie',     stage: 'Referral ask',
        note: 'Ask for the intro, write it for them' },
      { day: 7,  channel: 'Reply',    persona: 'Peer',           stage: 'Referral ask',
        note: 'Now you can ask for the referral' },
      { day: 8,  channel: 'Email',    persona: 'Hiring manager', stage: 'Follow up',
        note: 'Bring something new or do not write' },
      { day: 10, channel: 'Email',    persona: 'Skip level',     stage: 'Escalation',
        note: 'Eighty words, business first' },
      { day: 12, channel: 'Call',     persona: 'Recruiter',      stage: 'Follow up',
        note: 'Pick up the phone' },
      { day: 14, channel: 'Email',    persona: null,             stage: 'Breakup',
        note: 'Say you are stopping, leave the door open' }
    ],

    buildSequence: function (cid) {
      var c = Store.campaign(cid); if (!c) return [];
      var used = {};
      var steps = [];

      Store.PLAN.forEach(function (row) {
        var person = null;
        if (row.persona) {
          person = c.contacts.filter(function (p) { return p.persona === row.persona; })[0] || null;
          if (!person) return;            /* nobody to send it to */
        } else if (row.stage === 'Breakup') {
          person = c.contacts.filter(function (p) { return p.persona === 'Hiring manager'; })[0] ||
                   c.contacts[0] || null;
        }
        if (person) used[person.id] = (used[person.id] || 0) + 1;

        var t = null;
        if (row.stage) {
          var pool = state.templates.filter(function (x) { return x.stage === row.stage; });
          t = pool.filter(function (x) { return x.persona === (row.persona || (person ? person.persona : '')); })[0] ||
              pool.filter(function (x) { return x.channel === row.channel; })[0] || pool[0] || null;
        }
        var subject = '';
        if (row.channel === 'Email') {
          subject = row.stage === 'Follow up' ? 'one more thing on ' + c.company
                  : row.stage === 'Breakup'   ? 'closing the loop'
                  : row.stage === 'Escalation' ? c.company + ' and the number'
                  : 'applied for the ' + c.role;
        }
        steps.push({
          id: uid('s'), day: row.day, contact: person ? person.id : null,
          template: t ? t.id : null, channel: t ? t.channel : row.channel,
          note: row.note, status: 'queued', subject: subject,
          body: t ? Store.fill(t.body, c, person) : ''
        });
      });

      c.steps = steps;
      c.activeStep = steps[0] ? steps[0].id : null;
      Store.completeTask(cid, 't5');
      Store.save();
      return steps;
    },

    /* ---- look someone up by their profile URL ----------------------------
       Stands in for the server call. It resolves against everyone we already
       know about; anything else comes back as a name and nothing more, which
       is honest about what a URL alone can tell you. ------------------------ */
    lookupLinkedIn: function (raw, cid) {
      var s = String(raw || '').trim();
      if (!s) return { ok: false, reason: 'Paste their LinkedIn URL first.' };
      var m = s.match(/linkedin\.com\/(?:in|pub)\/([A-Za-z0-9\-_%]+)/i) ||
              s.match(/^\/?in\/([A-Za-z0-9\-_%]+)/i) ||
              s.match(/^([A-Za-z0-9\-_]{3,})$/);
      if (!m) return { ok: false, reason: 'That does not look like a LinkedIn profile URL.' };

      var slug = decodeURIComponent(m[1]).toLowerCase().replace(/-[0-9a-b]{6,}$/, '');
      var c = Store.campaign(cid);

      /* already on this list? */
      var dupe = c && c.contacts.filter(function (p) {
        return String(p.linkedin || '').toLowerCase().indexOf(slug) > -1;
      })[0];
      if (dupe) return { ok: false, reason: dupe.name + ' is already on your list.' };

      /* everyone this workspace has ever seen */
      var known = [];
      state.campaigns.forEach(function (x) {
        known = known.concat(x.contacts, x.suggested || []);
      });
      var hit = known.filter(function (p) {
        return String(p.linkedin || '').toLowerCase().replace('in/', '') === slug;
      })[0];

      if (hit) {
        return { ok: true, exact: true, person: {
          name: hit.name, title: hit.title, persona: hit.persona, tenure: hit.tenure,
          prev: hit.prev, mutuals: hit.mutuals, email: hit.email,
          linkedin: 'in/' + slug, ask: hit.ask, activity: clone(hit.activity || [])
        } };
      }

      var name = slug.split(/[-_]/)
        .filter(function (w) { return w && !/^\d+$/.test(w); })
        .slice(0, 3)
        .map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1); })
        .join(' ');
      if (!name) return { ok: false, reason: 'Could not read a name out of that URL.' };
      return { ok: true, exact: false, person: {
        name: name, title: '', persona: 'Other', tenure: '', prev: '', mutuals: 0,
        email: '', linkedin: 'in/' + slug, ask: '', activity: []
      } };
    },

    /* ---- the brief -------------------------------------------------------
       Everything known about one company, assembled. The interview prep
       screen renders it and every model prompt that needs context reads the
       same thing, so what you rehearse and what gets written are one story. */
    brief: function (c) {
      if (!c) return null;
      var wins = Store.campaignWins(c);
      var stories = Store.stories(c);
      var answered = {};
      stories.forEach(function (a) { answered[a.ref] = a; });

      return {
        company: c.company, role: c.role, location: c.location,
        req: c.req, postingUrl: c.postingUrl, day: c.day,

        /* what you lead with, with the story behind it where there is one */
        wins: wins.map(function (w) {
          return { win: w, story: (answered[w.id] || {}).text || '' };
        }),

        /* what they asked for, what answers it, and what you will say if not */
        match: (c.match || []).map(function (r) {
          return {
            req: r, strength: r.strength, note: r.note,
            evidence: (r.winIds || []).map(function (id) {
              return wins.filter(function (w) { return w.id === id; })[0] ||
                     state.profile.wins.filter(function (w) { return w.id === id; })[0];
            }).filter(Boolean),
            answer: (answered[r.id] || {}).text || ''
          };
        }),

        /* who you have actually spoken to, and what passed between you */
        people: c.contacts.map(function (p) {
          var touches = c.steps.filter(function (s) {
            return s.contact === p.id && (s.status === 'sent' || s.status === 'replied');
          }).map(function (s) {
            return { day: s.day, channel: s.channel, note: s.note,
                     replied: s.status === 'replied', body: s.body };
          });
          return { person: p, touches: touches, activity: p.activity || [], notes: p.notes || '' };
        }),

        research: c.research || [],
        stories: stories,
        gaps: (c.match || []).filter(function (r) { return r.strength === 'none'; }),
        questions: c.questions || null
      };
    },

    setQuestions: function (cid, q) {
      var c = Store.campaign(cid); if (!c) return;
      c.questions = q;
      Store.save();
    },

    /* What they will probably ask, worked out from the listing rather than
       from a list of generic interview questions. */
    questionsLocally: function (c) {
      /* coach.js does the reading; this just hands it what it needs */
      return Coach.questions(c, { wins: Store.campaignWins(c) });
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
        ask: data.ask || '', notes: '', activity: data.activity || [],
        placeholder: !!data.placeholder, guessedEmail: !!data.guessedEmail
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
                template: null, channel: 'Email', note: 'New touch', status: 'queued',
                subject: '', body: '' };
      c.steps.push(s);
      Store.sortSteps(cid);
      Store.save();
      return s;
    },
    updateStep: function (cid, sid, patch) {
      var c = Store.campaign(cid); if (!c) return;
      var s = c.steps.filter(function (x) { return x.id === sid; })[0]; if (!s) return;
      /* a reply is a stronger fact than a send; never walk it back */
      if (patch.status === 'sent' && s.status === 'replied') delete patch.status;
      Object.keys(patch).forEach(function (k) { s[k] = patch[k]; });
      Store.sortSteps(cid);
      Store.syncCounts(c);
      Store.save();
    },

    /* Somebody wrote back. The rest of the plan for that person is off:
       you are in a conversation now, not a sequence. Returns how many
       touches were dropped so the screen can say so. */
    logReply: function (cid, sid) {
      var c = Store.campaign(cid); if (!c) return 0;
      var s = c.steps.filter(function (x) { return x.id === sid; })[0]; if (!s) return 0;
      s.status = 'replied';
      var dropped = 0;
      c.steps.forEach(function (x) {
        if (x.id !== sid && x.contact === s.contact && /^(queued|due)$/.test(x.status)) {
          x.status = 'skipped'; dropped++;
        }
      });
      Store.syncCounts(c);
      Store.save();
      return dropped;
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
      /* a placeholder that resolves to nothing takes its line with it, rather
         than leaving "Marcus, " sitting on its own */
      var out = String(body);
      if (!angle) out = out.replace(/^.*\{angle\}.*$\n?/gm, function (line) {
        return /\{first\}/.test(line) ? '{first},\n' : '';
      });
      if (!win) out = out.replace(/^\s*\{win\}\.?\s*$\n?/gm, '');
      return out
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
    /* The hand-ticked checklist is gone; the five steps are the only record
       of progress. These stay so nothing that still calls them can throw. */
    completeTask: function () {},
    taskProgress: function (c) { return Store.phaseProgress(c); },

    reset: function () {
      try {
        window.localStorage.removeItem(KEY);
        Object.keys(window.localStorage).forEach(function (k) {
          if (k.indexOf('frontdoor.') === 0) window.localStorage.removeItem(k);
        });
      } catch (e) {}
      state = defaults(); Store.state = state; emit();
    }
  };

  window.Store = Store;
})(window);

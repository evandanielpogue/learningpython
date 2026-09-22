/* ==========================================================================
   store.js — application state
   Stands in for the backend. Everything persists to localStorage so a reload
   behaves like a real session. Wrapped in try/catch because private windows
   and blocked site data both throw on access.
   ========================================================================== */
(function (window) {
  'use strict';

  var KEY = 'frontdoor.v1';

  var SEED_PROFILE = {
    name: 'Evan Pogue',
    email: 'evan@example.com',
    initials: 'EP',
    location: 'Chicago, IL',
    years: 8,
    imported: false,
    source: null,
    voice: { tone: 'Peer', length: 'Short', traits: ['Direct', 'Numbers first', 'One ask'] },
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
    wins: [
      { id: 'w1', text: 'Finished at 112% through a pricing change', where: 'Brightline, FY25', metric: '112%', short: 'through a pricing change', on: true },
      { id: 'w2', text: 'Carried a $1.2M quota and hit it', where: 'Brightline, FY25', metric: '$1.2M', short: 'quota carried and hit', on: true },
      { id: 'w3', text: 'Rebuilt discovery when cycles went 30 to 70 days', where: 'Brightline, Q2', metric: '30→70', short: 'day cycles, rebuilt discovery', on: true },
      { id: 'w4', text: 'Grew territory ARR 41% year over year', where: 'Northwind, FY23', metric: '41%', short: 'territory ARR growth', on: false },
      { id: 'w5', text: 'Ramped four new AEs to quota in two quarters', where: 'Northwind, FY23', metric: '4 AEs', short: 'ramped to quota in two quarters', on: false },
      { id: 'w6', text: 'Top 3 of 38 reps, two years running', where: 'Northwind', metric: 'Top 3', short: 'of 38 reps, two years running', on: false },
      { id: 'w7', text: 'Closed the biggest deal the company had done', where: 'Cobalt, FY21', metric: '$340k', short: 'largest deal in company history', on: false }
    ],
    stack: ['Salesforce', 'HubSpot', 'Outreach', 'Gong', 'Clay', 'Sales Navigator', 'MEDDPICC'],
    reference: { quote: 'Evan rebuilt our discovery script in the middle of a pricing change and we still made the year. He is who you want in the room when the motion breaks.', who: 'Dev Nair', role: 'VP Sales at Brightline', initials: 'DN' }
  };

  var PEOPLE = [
    { id: 'p1', initials: 'DK', name: 'Dana Koh', role: 'Mid-Market AE', persona: 'Peer', colour: '--p-peer',
      equiv: 'Your coach', ask: 'Just information', why: 'The cheapest thing to ask a stranger for' },
    { id: 'p2', initials: 'PS', name: 'Priya Shah', role: 'Talent Partner', persona: 'Recruiter', colour: '--p-recruiter',
      equiv: 'Runs the process', ask: 'Where it stands', why: 'She can tell you whether the req is real' },
    { id: 'p3', initials: 'MR', name: 'Marcus Reed', role: 'Director, Mid-Market', persona: 'Hiring manager', colour: '--p-manager',
      equiv: 'Makes the call', ask: 'Fifteen minutes', why: 'The only yes that actually counts' },
    { id: 'p4', initials: 'DW', name: 'Diane Walsh', role: 'VP Sales', persona: 'Skip level', colour: '--p-exec',
      equiv: 'Signs off', ask: 'A point of view', why: 'Can create a seat that did not exist' },
    { id: 'p5', initials: 'SL', name: 'Sam Lowe', role: 'Left Acme in 2024', persona: 'Shared tie', colour: '--p-tie',
      equiv: 'The warm path', why: 'No politics, and nothing to lose by helping', ask: 'An introduction' }
  ];

  var TOUCHES = [
    { day: 0,  who: 'Apply anyway',      note: 'You still have to exist in the system', channel: 'ATS',      person: null, colour: '--line-3', status: 'sent' },
    { day: 0,  who: 'Dana Koh',          note: 'Ask about the team, nothing else',      channel: 'LinkedIn', person: 'p1', colour: '--p-peer', status: 'replied' },
    { day: 2,  who: 'Priya Shah',        note: 'Name the req, ask one question',        channel: 'Email',    person: 'p2', colour: '--p-recruiter', status: 'sent' },
    { day: 3,  who: 'Marcus Reed',       note: 'Your angle, then the page',             channel: 'Email',    person: 'p3', colour: '--p-manager', status: 'due' },
    { day: 5,  who: 'Sam Lowe',          note: 'Ask for the intro, write it for him',   channel: 'LinkedIn', person: 'p5', colour: '--p-tie', status: 'queued' },
    { day: 7,  who: 'Dana Koh',          note: 'Now you can ask for the referral',      channel: 'Reply',    person: 'p1', colour: '--p-peer', status: 'queued' },
    { day: 8,  who: 'Marcus Reed',       note: 'Bring something new or do not write',   channel: 'Email',    person: 'p3', colour: '--p-manager', status: 'queued' },
    { day: 10, who: 'Diane Walsh',       note: 'Eighty words, business first',          channel: 'Email',    person: 'p4', colour: '--p-exec', status: 'queued' },
    { day: 12, who: 'Priya Shah',        note: 'Pick up the phone',                     channel: 'Call',     person: 'p2', colour: '--p-recruiter', status: 'queued' },
    { day: 14, who: 'Whoever went quiet', note: 'Say you are stopping, leave the door open', channel: 'Email', person: null, colour: '--line-3', status: 'queued' }
  ];

  var ANGLES = [
    { id: 'a1', title: 'Seat pricing moved the SMB floor to five seats', sub: 'Reps turn into qualifiers overnight', on: true,
      take: 'Seat pricing moved your SMB floor to five seats. Reps stop selling and start qualifying, and anyone who cannot run a two call close gets found out fast.' },
    { id: 'a2', title: 'Six AE reqs open at the same time', sub: 'Ramp is the constraint, not headcount', on: false,
      take: 'Six AE reqs open at once means ramp is the constraint, not headcount. The team that gets people productive in 45 days instead of 90 makes the number.' },
    { id: 'a3', title: 'Series B, 340 people, repriced in Q2', sub: 'Forecasting breaks after a reprice', on: false,
      take: 'You repriced in Q2 at 340 people. Every forecast built on the old motion is guesswork now, and that lands on the front line first.' }
  ];

  var SECTIONS = [
    { key: 'hero',  label: 'Header',            on: true },
    { key: 'why',   label: 'Why Acme',          on: true },
    { key: 'proof', label: 'The short version', on: true },
    { key: 'exp',   label: 'Where I have been', on: true },
    { key: 'plan',  label: 'First 90 days',     on: true },
    { key: 'video', label: 'Video',             on: true },
    { key: 'said',  label: 'Reference',         on: true },
    { key: 'stack', label: 'Tools',             on: true }
  ];

  function seedCampaign() {
    return {
      id: 'c_acme',
      company: 'Acme',
      role: 'Mid-Market Account Executive',
      location: 'Chicago, hybrid',
      req: '4821',
      slug: 'evan-acme',
      status: 'running',
      day: 3,
      createdAt: Date.now() - 3 * 864e5,
      facts: ['Series B', '340 people', 'Repriced in Q2', '6 AE reqs open'],
      requirements: ['5+ yrs SaaS', '$80 to 150k ACV', 'RevOps buyers', '60 to 90 day cycles'],
      angles: JSON.parse(JSON.stringify(ANGLES)),
      people: JSON.parse(JSON.stringify(PEOPLE)),
      touches: JSON.parse(JSON.stringify(TOUCHES)),
      sections: JSON.parse(JSON.stringify(SECTIONS)),
      tone: 0,
      length: 0,
      views: 4,
      lastView: '2 hours ago'
    };
  }

  function defaults() {
    return {
      user: null,
      profile: JSON.parse(JSON.stringify(SEED_PROFILE)),
      campaigns: [],
      tasks: [
        { id: 't1', text: 'Add your résumé',        sub: 'Pulled 3 roles and 7 wins',           on: false },
        { id: 't2', text: 'Pick your three wins',   sub: 'The numbers a sales leader cares about', on: false },
        { id: 't3', text: 'Paste the job listing',  sub: 'One company, one role',               on: false },
        { id: 't4', text: 'Find five people',       sub: 'Peer, recruiter, manager, VP, tie',   on: false },
        { id: 't5', text: 'Send the first message', sub: 'Start with the peer',                 on: false }
      ]
    };
  }

  var state = defaults();
  var subs = [];

  function read() {
    try {
      var raw = window.localStorage.getItem(KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) { return null; }
  }

  function write() {
    try { window.localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* private window */ }
  }

  function emit() { subs.forEach(function (fn) { try { fn(state); } catch (e) {} }); }

  var Store = {
    state: state,

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

    /* ---- auth --------------------------------------------------------- */
    signIn: function (email) {
      var nm = state.profile.name;
      state.user = {
        email: email || state.profile.email,
        name: nm,
        initials: nm.split(' ').map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase()
      };
      Store.save();
      return state.user;
    },
    signOut: function () { state.user = null; Store.save(); },
    isAuthed: function () { return !!state.user; },

    /* ---- campaigns ---------------------------------------------------- */
    campaigns: function () { return state.campaigns; },
    campaign: function (id) {
      return state.campaigns.filter(function (c) { return c.id === id; })[0] || null;
    },
    createSeedCampaign: function () {
      if (Store.campaign('c_acme')) return Store.campaign('c_acme');
      var c = seedCampaign();
      state.campaigns.unshift(c);
      // the résumé import is the only thing we can honestly claim is done,
      // so the checklist opens partly filled rather than finished
      state.tasks[0].on = true;
      state.tasks[1].on = true;
      Store.save();
      return c;
    },
    removeCampaign: function (id) {
      state.campaigns = state.campaigns.filter(function (c) { return c.id !== id; });
      Store.save();
    },

    /* ---- profile ------------------------------------------------------ */
    markImported: function (source) {
      state.profile.imported = true;
      state.profile.source = source;
      Store.save();
    },
    selectedWins: function () { return state.profile.wins.filter(function (w) { return w.on; }); },
    toggleWin: function (id) {
      var w = state.profile.wins.filter(function (x) { return x.id === id; })[0];
      if (!w) return;
      if (!w.on && Store.selectedWins().length >= 3) return;
      w.on = !w.on;
      Store.save();
    },
    toggleRole: function (id) {
      var r = state.profile.roles.filter(function (x) { return x.id === id; })[0];
      if (r) { r.on = !r.on; Store.save(); }
    },

    /* ---- tasks -------------------------------------------------------- */
    toggleTask: function (id) {
      var t = state.tasks.filter(function (x) { return x.id === id; })[0];
      if (t) { t.on = !t.on; Store.save(); }
      return t;
    },
    taskProgress: function () {
      var done = state.tasks.filter(function (t) { return t.on; }).length;
      return { done: done, total: state.tasks.length };
    },

    reset: function () {
      try { window.localStorage.removeItem(KEY); } catch (e) {}
      state = defaults();
      Store.state = state;
      emit();
    }
  };

  window.Store = Store;
})(window);

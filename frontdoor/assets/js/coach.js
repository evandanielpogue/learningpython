/* ==========================================================================
   coach.js — the questions, worked out rather than listed.

   Two callers. Prep asks it what to say next in a conversation: an opening
   that names the actual number or the actual tool, then a follow-up chosen
   by what is missing from what the person just said. The brief asks it what
   this company is likely to ask, built out of the listing, the résumé, the
   gaps between them, the research and what the people involved said in
   public.

   Nothing here invents a fact. Every question is assembled out of text the
   user already gave us, and where there is nothing to build on the function
   says so instead of producing filler. When a model is configured, ai.js
   takes over and this becomes the fallback — same shape, same contract.
   ========================================================================== */
(function (window) {
  'use strict';

  var Coach = {};

  /* ---------------------------------------------------------------- read --
     What kind of number is this, and what does that make it worth asking? */
  var MONEY  = /\$\s?([\d.,]+)\s*([kmb])?/i;
  var PCT    = /(\d+(?:\.\d+)?)\s?%/;
  var SHIFT  = /(\d+)\s*(?:->|→|to)\s*(\d+)/;
  var MULT   = /(\d+(?:\.\d+)?)\s?x\b/i;
  var COUNT  = /\b(\d{1,4})\b/;

  Coach.readWin = function (win) {
    var m = String((win && win.metric) || '');
    var t = String((win && win.text) || '');
    var hay = m + ' ' + t;
    var out = { kind: 'none', metric: m, text: t };

    if (SHIFT.test(m)) {
      var s = m.match(SHIFT);
      out.kind = 'shift'; out.from = s[1]; out.to = s[2];
      out.worse = Number(s[2]) > Number(s[1]);
    } else if (MONEY.test(m)) {
      out.kind = 'money';
    } else if (PCT.test(m)) {
      var p = Number(m.match(PCT)[1]);
      out.kind = /attrition|churn|turnover|left|lost/i.test(hay) ? 'loss'
               : p > 100 ? 'over' : 'pct';
      out.pct = p;
    } else if (MULT.test(m)) {
      out.kind = 'multiple';
    } else if (COUNT.test(m)) {
      out.kind = 'count';
    }
    return out;
  };

  /* what a listing line is really asking for */
  var CATS = [
    ['tool',      /salesforce|hubspot|outreach|salesloft|gong|chorus|clari|looker|tableau|zoominfo|apollo|jira|netsuite|workday|marketo|pardot|sfdc|crm\b/i],
    ['method',    /meddpicc|meddic|challenger|spin|sandler|bant|command of the message|force management|value selling|qualification|forecast/i],
    ['segment',   /mid[- ]?market|enterprise|smb\b|commercial|strategic account|named account|fortune \d/i],
    ['motion',    /outbound|full[- ]?cycle|land and expand|product[- ]?led|plg\b|channel|partner|renewal|expansion|upsell|cross[- ]?sell|inbound/i],
    ['scale',     /quota|\$[\d.,]+\s?[kmb]?|arr\b|acv\b|pipeline|book of business|territory/i],
    ['leadership',/mentor|coach|lead a team|manage|player[- ]?coach|ramp|onboard|enable/i],
    ['domain',    /healthcare|fintech|security|devops|revops|hr tech|legal|manufactur|logistics|saas|api|data platform/i],
    ['years',     /\b\d\+?\s*years?\b/i]
  ];

  Coach.readReq = function (req) {
    var text = String((req && req.text) || req || '');
    for (var i = 0; i < CATS.length; i++) {
      if (CATS[i][1].test(text)) {
        var hit = text.match(CATS[i][1]);
        return { cat: CATS[i][0], term: (hit && hit[0]) || '', text: text };
      }
    }
    return { cat: 'other', term: '', text: text };
  };

  /* --------------------------------------------------------------- shape --
     Turn a requirement line into something a person would actually say out
     loud. "Experience with a track record of X" is a listing; "Tell me about
     X" is a question. */
  function bare(text) {
    return String(text)
      .replace(/^(proven |demonstrated |strong |deep |solid )/i, '')
      .replace(/^(experience|expertise|background|a track record|track record|familiarity|comfort(?:able)?|ability)\s*(with|in|of|to)?\s*/i, '')
      .replace(/^(you|we)('| a)?re\s+/i, '')
      .replace(/[.;]\s*$/, '')
      .trim();
  }
  Coach.bare = bare;

  /* cut at a word boundary, and never leave a dangling opening quote */
  function clip(text, n) {
    var t = String(text || '').replace(/\s+/g, ' ').trim();
    if (t.length <= n) return t;
    var cut = t.slice(0, n);
    var sp = cut.lastIndexOf(' ');
    if (sp > n * 0.5) cut = cut.slice(0, sp);
    var quotes = (cut.match(/"/g) || []).length;
    if (quotes % 2) cut = cut.slice(0, cut.lastIndexOf('"')).replace(/\s+$/, '');
    return cut.replace(/[,;:\s]+$/, '') + '\u2026';
  }
  Coach.clip = clip;

  /* join a fragment to a following sentence without stacking punctuation:
     a clipped ellipsis is dropped, and a quote that already closes on a full
     stop is left exactly as its author wrote it. */
  function join(stem, next) {
    var t = String(stem || '').replace(/[\s.\u2026]+$/, '');
    if (/["'\u201d][.!?]?$/.test(String(stem).trim())) t = String(stem).trim().replace(/\u2026$/, '');
    return t + (/[.!?]["'\u201d]?$/.test(t) ? ' ' : '. ') + next;
  }
  Coach.join = join;

  function lower(t) { return t ? t.charAt(0).toLowerCase() + t.slice(1) : t; }

  /* Listing lines come in three grammatical shapes and each one needs a
     different question around it, or you get "tell me about your experience
     with work RevOps buyers through an evaluation". */
  var VERBS = /^(work|run|build|manage|own|drive|close|source|prospect|partner|lead|ramp|help|sell|forecast|negotiate|develop|execute|collaborate|maintain|deliver|create|support|identify|grow|expand|carry|hit|exceed|navigate|qualify|handle|present|demo|coach|mentor|report|track|use)\b/i;
  var YEARS = /^(\d+)\+?\s*years?\b/i;

  Coach.shape = function (text) {
    var t = bare(text);
    if (YEARS.test(t)) return 'years';
    if (VERBS.test(t)) return 'action';
    return 'thing';
  };

  /* the line, turned into something a person would say out loud */
  Coach.asQuestion = function (text) {
    var t = bare(text);
    switch (Coach.shape(t)) {
      case 'years':
        var n = t.match(YEARS)[1];
        return 'You have ' + n + '-odd years in this. Where were they, and which of them ' +
               'look most like this job?';
      case 'action':
        return 'Walk me through how you ' + lower(t) + '.';
      default:
        return 'Tell me about ' + lower(t) + '.';
    }
  };

  /* ----------------------------------------------------------- variation --
     A conversation that says the same sentence every time reads like a form.
     These pick from a set, seeded on the item and the turn, so the wording
     moves between items and between turns but stays put when the view
     repaints — nothing jumps around under the person mid-sentence. */
  function seed(str) {
    var h = 2166136261, i;
    str = String(str);
    for (i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function pick(list, key) {
    if (!list || !list.length) return null;
    return list[seed(key) % list.length];
  }
  Coach.pick = pick;

  /* Asking the same sentence twice is the single most robotic thing a
     conversation can do, so a line that has already been said is taken out
     of the running. When every variant is spent the caller moves on. */
  function pickUnused(list, key, used) {
    if (!list || !list.length) return null;
    var free = list.filter(function (t) { return (used || []).indexOf(t) === -1; });
    return free.length ? free[seed(key) % free.length] : null;
  }
  Coach.pickUnused = pickUnused;

  /* ------------------------------------------------------------- opening --
     The first question on an agenda item. Specific to the number or the
     term; never "tell me about yourself". */
  var GAP_OPENERS = {
    tool: [
      'They name {term} specifically. What did you actually run this in, and what did you do with what came out of it?',
      'So — {term}. Have you touched it, or is this one of those where you learned the thing next to it?',
      '{term} is on the list. Tell me what your stack actually was, and I will tell you how close that is.'
    ],
    method: [
      'The listing asks for {term}. What did you use to qualify instead, and name a deal you lost because a step got skipped.',
      '{term}. Be honest — did your team actually run that, or was it a slide?',
      'They want {term}. Forget the acronym for a second: how did you decide a deal was real?'
    ],
    segment: [
      'This is a {term} seat. What is the real difference between that and what you have been selling — the cycle, the committee, or the price?',
      '{term}. How far is that from the deals you have been running, honestly?',
      'They are buying {term} experience. What is the closest thing on your side, and where does it stop being the same?'
    ],
    motion: [
      'They want {term}. What share of your pipeline did you actually source that way, and what did the first touch look like?',
      '{term}. Have you run that end to end, or picked it up somewhere in the middle?',
      'On {term} — walk me through one that worked, from the first touch.'
    ],
    scale: [
      'They are describing the number: {label}. What is the biggest you have personally carried, and did you hit it?',
      'The number in this listing is the thing to get straight. What have you actually carried, and what did you land?',
      'Numbers first: what was your quota, and what did you finish at? Both figures.'
    ],
    leadership: [
      'They want someone who can {labelLower}. Who have you actually brought up, and what did they do after?',
      'This one is about other people. Who is the last person you got good at something, and how?',
      'Have you done this for anyone by name? That is what makes the answer land.'
    ],
    domain: [
      'You have not sold into {term}. What is the closest buyer you have worked, and what did they care about that others did not?',
      '{term} is new for you. Which buyer on your side has the most in common with them?',
      'No {term} on the résumé. So let us build the bridge: who have you sold to that thinks the same way?'
    ],
    years: [
      'The listing asks for {term}. Where is the gap between that and what you have, and what did you pack into the time you did have?',
      '{term} is what they wrote. What do you actually have, and what happened in it?',
      'They want {term}. Numbers aside, what did your time cover that someone with longer might not have?'
    ],
    other: [
      'Nothing on your résumé answers this: {labelLower}. What is the closest thing you have done?',
      'This one is uncovered: {labelLower}. Where have you come nearest to it?',
      '{label} — not on the résumé anywhere. What would you say if they asked cold?'
    ]
  };

  var WIN_OPENERS = {
    money: [
      '{metric}. What was the number before you took it, and how much of {metric} was new business rather than renewal?',
      'Start with {metric}. Whose book was it before yours, and what shape was it in?',
      '{metric} is the headline. What is the bit underneath it that you would only say out loud?'
    ],
    over: [
      '{metric} of quota. What was quota, and which quarter did it actually get won in?',
      '{metric}. Was that even across the year, or did one deal carry it?',
      'You finished at {metric}. What was the number you were chasing, and when did you know you had it?'
    ],
    loss: [
      '{metric} is the kind of number people ask about carefully. Who left, and what did you change the week after?',
      '{metric}. That is a hard year. What was actually going on?',
      'Take me back to {metric}. Where were you standing when it started?'
    ],
    shiftWorse: [
      'It went from {from} to {to}. What broke first, and how did you find out?',
      '{from} to {to} is a real slide. What was the first sign?',
      'So {from} became {to}. Who noticed first — you, or someone above you?'
    ],
    shiftBetter: [
      'It went from {from} to {to}. What did you change first, and how long before it showed?',
      '{from} down to {to}. What was the one change that actually moved it?',
      'From {from} to {to} — was that one fix or twenty small ones?'
    ],
    multiple: [
      '{metric}. Off what base, and over how long?',
      '{metric} sounds good until someone asks the starting number. What was it?',
      'Give me the two figures behind {metric} and the window they sit in.'
    ],
    plain: [
      'You put {metric} on the résumé. What was it before, and what did you personally do to move it?',
      '{metric}. Where did that number come from?',
      'Tell me about {metric} — the version with the mess still in it.'
    ],
    none: [
      'Take me through what happened here. Start where it went wrong.',
      'No number on this one, so tell it as a story. Where does it start?',
      'Set the scene for me. What was the situation when you walked into it?'
    ]
  };

  function fill(tpl, vars) {
    return String(tpl).replace(/\{(\w+)\}/g, function (_, k) {
      return vars[k] === undefined || vars[k] === null ? '' : String(vars[k]);
    }).replace(/\s{2,}/g, ' ').trim();
  }

  Coach.opening = function (item, ctx) {
    ctx = ctx || {};
    if (!item) return null;
    var key = (item.id || item.label || '') + '|open';

    if (item.kind === 'gap') {
      var r = Coach.readReq(item.label);
      var vars = {
        term: r.term || bare(item.label),
        label: bare(item.label),
        labelLower: lower(bare(item.label))
      };
      return fill(pick(GAP_OPENERS[r.cat] || GAP_OPENERS.other, key + r.cat), vars);
    }

    var w = ctx.win || { metric: '', text: item.label };
    var n = Coach.readWin(w);
    var bucket = n.kind === 'shift' ? (n.worse ? 'shiftWorse' : 'shiftBetter')
               : n.kind === 'pct' || n.kind === 'count' ? 'plain'
               : WIN_OPENERS[n.kind] ? n.kind : 'none';
    return fill(pick(WIN_OPENERS[bucket], key + bucket),
                { metric: n.metric, from: n.from, to: n.to });
  };

  /* ------------------------------------------------------------ follow-up --
     Chosen by what is missing from what they just said, so the second
     question is never the same as the first. Returns null when the answer
     is already complete enough to bank. */
  var HEDGE = /\b(basically|kind of|sort of|pretty much|a lot of|various|several|stuff|things)\b/i;

  Coach.readAnswer = function (text) {
    var t = String(text || '').trim();
    var words = t ? t.split(/\s+/).length : 0;
    return {
      words: words,
      hasNumber: /\d/.test(t),
      hasI: /\bI\b/.test(t),
      weOnly: /\bwe\b/i.test(t) && !/\bI\b/.test(t),
      hasOutcome: /\b(ended|closed|landed|result|finished|went from|grew|cut|saved|won|lost|renew)/i.test(t),
      hasObstacle: new RegExp('\\b(but|however|although|though|problem|issue|pushed? ?back|push-?back|' +
        'blocked|resist|refus|reluctan|sceptic|skeptic|hated|hate|complain|fought|friction|' +
        'failed|fail|broke|broken|stalled|stall|churn|slipped|slip|missed|behind|late|' +
        'took longer|harder|hard part|tough|messy|chaos|mess|nobody wanted|no one wanted|' +
        'struggl|painful|rough|fell over|went wrong)', 'i').test(t),
      vague: HEDGE.test(t) && words < 60
    };
  };

  /* what is still missing, named, so both the probe and the tests can see it */
  Coach.missing = function (answers, letGo) {
    var last = answers[answers.length - 1] || '';
    var a = Coach.readAnswer(answers.join(' '));
    var l = Coach.readAnswer(last);
    var drop = letGo || [];
    var order = [
      ['thin',     l.words < 8],
      ['we',       a.weOnly],
      ['obstacle', !a.hasObstacle],
      ['number',   !a.hasNumber],
      ['outcome',  !a.hasOutcome],
      ['vague',    a.vague],
      ['learned',  a.words < 45]
    ];
    for (var i = 0; i < order.length; i++) {
      if (order[i][1] && drop.indexOf(order[i][0]) === -1) return order[i][0];
    }
    return null;
  };

  var PROBES = {
    thin: [
      'That is the headline. Give me the version you would tell someone over a drink — what was actually going on?',
      'Bit short. Back up: what was happening around it?',
      'Say more. What did the week look like?'
    ],
    we: [
      'That is what the team did. What was yours specifically — the part that would not have happened without you?',
      'You keep saying we. What did you do that nobody else was going to?',
      'Split it out for me: which bit of that was actually you?'
    ],
    obstacle: [
      'What got in the way? An interviewer is listening for the part that nearly did not work.',
      'Where did it nearly fall over?',
      'Nothing goes that cleanly. What was the hard part?'
    ],
    number: [
      'Put a number on it. Before and after, or how long it took — whichever you actually remember.',
      'Give me a figure. Any of them: the size, the drop, the weeks.',
      'What does that look like in numbers? Even roughly.'
    ],
    outcome: [
      'And how did it end? Say the outcome the way you would want it repeated.',
      'Finish it — where did it land?',
      'What happened in the end?'
    ],
    vague: [
      'Two things in there are still fuzzy. Name the account, the team, or the quarter — specifics are what make it sound true.',
      'Get specific for me. Which account, which quarter?',
      'Names and dates. That is what makes it sound true rather than rehearsed.'
    ],
    learned: [
      'One more layer: what would you say if they asked "and what did you learn?"',
      'Last thing — what would you do differently now?',
      'If they follow up with "what did that teach you", what comes out?'
    ]
  };

  Coach.probe = function (what, key, used) {
    var list = PROBES[what] || PROBES.thin;
    return used ? pickUnused(list, (key || '') + what, used)
                : pick(list, (key || '') + what);
  };

  /* kept for anything that wants a single line rather than a whole turn */
  Coach.followUp = function (item, answers, ctx) {
    var what = Coach.missing(answers);
    return what ? Coach.probe(what, (item && item.id) + '|' + answers.length) : null;
  };

  /* ---------------------------------------------------------------- talk --
     A turn of actual conversation. Three things make this read like a person
     rather than a form: it says back the detail it heard before asking the
     next thing, it varies its wording, and it answers what was actually
     typed — "I don't know" and "what do you mean" get a different reply from
     a real answer. It stops when nothing is missing, reads the story back in
     the person's own words, and banks it once they say that is right. */

  var DUNNO   = /^(i (do not|don'?t) (know|remember)|not sure|no idea|dunno|cannot remember|can'?t remember|nope|no)\b/i;
  var HUH     = /^(what do you mean|what\?|huh|sorry\?|i do not follow|i don'?t follow|meaning\?|like what)/i;
  var YES     = /^(yes|yeah|yep|yup|that is right|that'?s right|correct|exactly|spot on|right|perfect|good|sounds right|ok|okay)\b/i;
  var NO      = /^(no|not quite|not really|nope|change|wrong|that is not|that'?s not)\b/i;

  var DUNNO_REPLIES = {
    thin:     ['Fine. Smaller question: what is the first thing you remember about it?',
               'No problem. What sticks in your head from that time?'],
    we:       ['Try it this way: if your manager wrote your part of it down, what would the line say?',
               'What would someone who was there say you did?'],
    obstacle: ['Then it may have been smoother than most. Was there anyone who did not want it to happen?',
               'Fair. Did anything take longer than it should have?'],
    number:   ['Rough is fine. Order of magnitude — tens, hundreds, thousands?',
               'A guess beats nothing. Roughly what size are we talking?'],
    outcome:  ['Even "it is still running" is an ending. Where did it get to?',
               'What was true at the end that was not true at the start?'],
    vague:    ['Then leave the names out. What was the shape of it?',
               'Fine — no names. What happened, in order?'],
    learned:  ['Then say the honest version: "nothing I would change" is an answer too.',
               'Leave it. Not every story has a lesson bolted on.']
  };

  Coach.mirror = function (text, key) {
    var t = String(text || '').replace(/\s+/g, ' ').trim();
    if (!t) return null;
    /* the most quotable thing in what they said: a figure with its unit,
       then a proper noun, then nothing — we never mirror a whole sentence
       back, because that is what a chatbot does, not a person */
    var UNIT = '(?:\\s?(?:%|k\\b|m\\b|bn?\\b|x\\b|days?|weeks?|months?|quarters?|years?|reps?|' +
               'accounts?|deals?|calls?|logos?|people|hours?))';
    /* money first, then a figure that carries its unit, then a bare number:
       "$1.2M" is worth saying back, "30" on its own usually is not */
    var got = null;
    var money = t.match(/[$£€]\s?\d[\d.,]*\s?[kmb]?n?\b/i);
    var united = t.match(new RegExp('\\d[\\d.,]*' + UNIT, 'i'));
    var name = t.match(/\b([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})?)\b/);
    /* a month or a weekday is a proper noun but saying it back tells the
       person nothing, so those do not count as something worth mirroring */
    var WEAK = /^(January|February|March|April|May|June|July|August|September|October|November|December|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|The|This|That|There|They|We|It|And|But|So|Then|After|Before|When|What|My|Our)$/i;
    if (money) got = money[0].trim();
    else if (united) got = united[0].trim();
    else if (name && !/^I\b/.test(name[1]) && !WEAK.test(name[1])) got = name[1];
    if (!got) return null;
    return fill(pick([
      '{got} — okay.',
      'Right, {got}.',
      '{got}. Got it.',
      'Noted: {got}.'
    ], (key || '') + got), { got: got });
  };

  /* their own words, trimmed — never a rewrite, never an invention */
  function dedupe(list) {
    var seen = {}, out = [];
    (list || []).forEach(function (x) {
      var k = String(x).toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
      if (!k || seen[k]) return;
      seen[k] = 1;
      out.push(x);
    });
    return out;
  }

  Coach.summary = function (answers) {
    /* someone who types the same thing three times gets it back once */
    var all = dedupe(answers || []).join(' ').replace(/\s+/g, ' ').trim();
    if (!all) return '';
    var sentences = all.split(/(?<=[.!?])\s+/)
      .map(function (x) { return x.trim(); })
      .filter(function (x) { return x.length > 12; });
    if (!sentences.length) sentences = [all];
    var unique = dedupe(sentences);
    var strong = unique.filter(function (x) { return /\d/.test(x) || /\bI\b/.test(x); });
    return (strong.length ? strong : unique).slice(0, 3).join(' ').trim();
  };

  /* is there enough here to be worth putting on a page at all? */
  Coach.worthKeeping = function (story) {
    var t = String(story || '').trim();
    if (!t) return false;
    var words = t.split(/\s+/).length;
    return words >= 14 && (/\d/.test(t) || /\bI\b/.test(t));
  };

  var CONFIRM = [
    'Here is what I have, in your words: "{story}" Is that the version you would say out loud?',
    'So it comes out as: "{story}" Does that sound like you?',
    'Read this back: "{story}" Right, or do you want to change it?'
  ];

  /* history entries are { role, content, stage } — stage is what this
     function set last time, which is how it knows where it is */
  Coach.turn = function (item, history, ctx) {
    ctx = ctx || {};
    history = history || [];
    var answers = history.filter(function (m) { return m.role === 'user'; })
                         .map(function (m) { return m.content; });
    var assistants = history.filter(function (m) { return m.role === 'assistant'; });
    var prev = assistants[assistants.length - 1] || {};
    var key = (item && item.id ? item.id : 'x') + '|' + answers.length;

    if (!answers.length) {
      return { bubbles: [Coach.opening(item, ctx)], stage: 'open', complete: false, story: null };
    }

    var last = answers[answers.length - 1] || '';

    /* they were asked to confirm the write-up */
    if (prev.stage === 'confirm') {
      if (YES.test(last.trim())) {
        return {
          bubbles: [pick(['Good. That is banked — pick the next one on the left.',
                          'Saved. Next one whenever you are ready.',
                          'That is yours now. Take the next one.'], key)],
          stage: 'done', complete: true, story: prev.story || Coach.summary(answers.slice(0, -1))
        };
      }
      if (NO.test(last.trim()) || last.trim().length < 40) {
        return {
          bubbles: [pick(['Then say it the way you would want it said, and I will keep that instead.',
                          'Fair. Put it in your own words and that is what goes in.'], key)],
          stage: 'dig', complete: false, story: null
        };
      }
      /* they rewrote it themselves, which is the best possible outcome */
      return {
        bubbles: [pick(['Better. Keeping that one.', 'That is stronger. Banked.'], key)],
        stage: 'done', complete: true, story: last
      };
    }

    /* What has already been said, and what has already been asked about.
       Anything asked twice is let go: pressing a third time on the same
       thing is interrogation, not conversation. */
    var used = assistants.map(function (m) { return m.content; });
    var asked = assistants.map(function (m) { return m.want; }).filter(Boolean);
    var letGo = asked.filter(function (w, i) { return asked.indexOf(w) !== i; });
    var what = Coach.missing(answers, letGo);

    /* and a conversation that never ends is worse than one that ends early */
    if (asked.length >= 5) what = null;

    /* "I don't know" is an answer, and pretending otherwise is what makes
       these things infuriating */
    if (DUNNO.test(last.trim())) {
      var soft = DUNNO_REPLIES[what || 'learned'] || DUNNO_REPLIES.thin;
      return {
        bubbles: [pickUnused(soft, key, used) || pick(soft, key)],
        stage: 'dig', want: what, complete: false, story: null
      };
    }
    /* they did not understand the question, so ask it another way rather
       than repeating the same sentence louder */
    if (HUH.test(last.trim())) {
      var again = Coach.probe(what || 'thin', key + '|again', used);
      return {
        bubbles: [again || 'Put it however you would say it to a colleague. Anything is a start.'],
        stage: 'dig', want: what, complete: false, story: null
      };
    }

    if (what) {
      var line = Coach.probe(what, key, used);
      if (line) {
        var bubbles = [];
        var m = answers.length > 1 || Coach.readAnswer(last).words > 14
          ? Coach.mirror(last, key) : null;
        if (m && used.indexOf(m) === -1) bubbles.push(m);
        bubbles.push(line);
        return { bubbles: bubbles, stage: 'dig', want: what, complete: false, story: null };
      }
      /* every way of asking that has been spent, so stop asking it */
    }

    /* nothing missing: read it back and let them own it. If there is nothing
       worth reading back, say that instead of quoting filler at them. */
    var story = Coach.summary(answers);
    if (!Coach.worthKeeping(story)) {
      return {
        bubbles: [pick([
          'There is not enough here yet to put in front of anyone. Leave it and come back ' +
            'when it is fresher — a thin story is worse than no story.',
          'I would not use this one. Skip it for now and take a topic you can actually see.'
        ], key)],
        stage: 'stall', want: null, complete: false, story: null
      };
    }
    return {
      bubbles: [fill(pick(CONFIRM, key), { story: story })],
      stage: 'confirm', complete: false, story: story
    };
  };

  /* ---------------------------------------------------------- the brief ---
     Likely questions, questions worth asking back, and the things to be
     careful about — all assembled out of this campaign. */
  Coach.questions = function (c, opts) {
    opts = opts || {};
    var wins = opts.wins || [];
    var likely = [], toAsk = [], watch = [];

    (c.match || []).forEach(function (r) {
      var q = Coach.readReq(r);
      if (r.strength === 'none') {
        likely.push({
          question: Coach.asQuestion(r.text),
          why: 'They asked for it and nothing on your résumé answers it. This one is coming.',
          gap: r.note ? '' : 'You have not worked out what to say. Do it in Prep.',
          answer: r.note || '',
          kind: 'gap', ref: r.id
        });
        watch.push('Nothing backs "' + clip(bare(r.text), 70) + '". Have the nearest thing ' +
                   'you have done ready, and be the one to say what it is not.');
      } else if (r.priority === 'must') {
        likely.push({
          question: Coach.asQuestion(r.text),
          why: 'A must-have you can answer. Have one story, not three.',
          answer: r.note || '',
          kind: 'strength', ref: r.id
        });
      }
      if (q.cat === 'method' && q.term) {
        toAsk.push({ question: 'How strictly is ' + q.term + ' actually run here?',
                     why: 'Listings name a methodology more often than teams run one.' });
      }
      if (q.cat === 'scale' && q.term) {
        toAsk.push({ question: 'What did the last three people in this seat hit against that number?',
                     why: 'The quota is in the listing. The attainment never is.' });
      }
    });

    wins.forEach(function (w) {
      var n = Coach.readWin(w);
      if (n.kind === 'none') return;
      likely.push({
        question: n.kind === 'loss'
          ? 'You mention ' + w.metric + '. What was your part in that?'
          : 'You mention ' + w.metric + '. How did you get there?',
        why: 'Any number on a résumé is an invitation. They will pick this one.',
        kind: 'win', ref: w.id
      });
    });

    /* a question someone reported being asked beats anything we could infer,
       so those go to the top of the list and say where they came from */
    (c.research || []).forEach(function (r) {
      if (r.kind !== 'Interview question' || !r.title) return;
      likely.unshift({
        question: clip(r.title, 200),
        why: 'Reported by a candidate' + (r.source ? ' on ' + r.source : '') +
             '. This is not inference — someone was actually asked it.',
        answer: r.use || '',
        kind: 'reported', ref: r.id
      });
    });

    /* what the product's own customers complain about is the best material
       a salesperson can walk in with */
    var gripes = (c.research || []).filter(function (r) { return r.kind === 'Customer gripe' && r.title; });
    gripes.slice(0, 3).forEach(function (r) {
      toAsk.unshift({
        question: 'Customers keep saying ' + lower(clip(r.title, 110)) + ' How does the team handle that on a call?',
        why: 'From a review' + (r.source ? ' on ' + r.source : '') + '. Asking it shows you did the work.'
      });
    });
    if (gripes.length > 1) {
      watch.push(gripes.length + ' customer complaints are on the same theme. Expect a question about ' +
                 'selling against it, and have an answer that is not a denial.');
    }

    (c.research || []).filter(function (r) {
      return r.kind !== 'Interview question' && r.kind !== 'Customer gripe' && r.kind !== 'Customer voice';
    }).slice(0, 3).forEach(function (r) {
      if (!r.title) return;
      toAsk.push({
        question: 'On ' + clip(r.title, 80) + ' \u2014 what has changed since?',
        why: 'Asking about something you actually found lands differently from a generic question.'
      });
    });

    (c.contacts || []).forEach(function (p) {
      var act = (p.activity || [])[0];
      if (!act || !act.text) return;
      /* activity is our description of what they posted, not their words, so
         it goes in as a description and never inside quote marks */
      likely.push({
        question: join((p.name || 'Someone on the panel') + ' ' + lower(clip(act.text, 120)),
                       'How would you handle that?'),
        why: 'Said in public. If they are in the room, it is already on their mind.',
        kind: 'person', ref: p.id
      });
    });

    var unanswered = (c.match || []).filter(function (r) {
      return r.strength === 'none' && !r.note;
    }).length;
    if (unanswered > 2) {
      watch.unshift(unanswered + ' requirements have nothing behind them and no answer written. ' +
                    'That is the interview, not a detail.');
    }

    return {
      likely: likely.slice(0, 10),
      toAsk: toAsk.slice(0, 6),
      watch: watch.slice(0, 5),
      source: 'local'
    };
  };

  window.Coach = Coach;
})(window);

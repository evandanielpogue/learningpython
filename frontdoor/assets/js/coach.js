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

  /* ------------------------------------------------------------- opening --
     The first question on an agenda item. Specific to the number or the
     term; never "tell me about yourself". */
  Coach.opening = function (item, ctx) {
    ctx = ctx || {};
    if (!item) return null;

    if (item.kind === 'gap') {
      var r = Coach.readReq(item.label);
      var term = r.term || bare(item.label);
      switch (r.cat) {
        case 'tool':
          return 'They name ' + term + ' specifically. What did you actually run this in, ' +
                 'and what did you do with what came out of it?';
        case 'method':
          return 'The listing asks for ' + term + '. What did you use to qualify instead, ' +
                 'and name a deal you lost because a step got skipped.';
        case 'segment':
          return 'This is a ' + term + ' seat. What is the real difference between that and ' +
                 'what you have been selling — the cycle, the committee, or the price?';
        case 'motion':
          return 'They want ' + term + '. What share of your pipeline did you actually ' +
                 'source that way, and what did the first touch look like?';
        case 'scale':
          return 'They are describing the number: ' + bare(item.label).toLowerCase() + '. ' +
                 'What is the biggest you have personally carried, and did you hit it?';
        case 'leadership':
          return 'They want someone who can ' + lower(bare(item.label)) + '. ' +
                 'Who have you actually brought up, and what did they do after?';
        case 'domain':
          return 'You have not sold into ' + term + '. What is the closest buyer you have ' +
                 'worked, and what did they care about that others did not?';
        case 'years':
          return 'The listing asks for ' + term + '. Where is the gap between that and what ' +
                 'you have, and what did you pack into the time you did have?';
        default:
          return 'Nothing on your résumé answers this: ' + bare(item.label).toLowerCase() + '. ' +
                 'What is the closest thing you have done?';
      }
    }

    /* a story behind a number */
    var w = ctx.win || { metric: '', text: item.label };
    var n = Coach.readWin(w);
    switch (n.kind) {
      case 'money':
        return n.metric + '. What was the number before you took it, and how much of ' +
               n.metric + ' was new business rather than renewal?';
      case 'over':
        return n.metric + ' of quota. What was quota, and which quarter did it actually ' +
               'get won in?';
      case 'loss':
        return n.metric + ' is the kind of number people ask about carefully. ' +
               'Who left, and what did you change the week after?';
      case 'shift':
        return 'It went from ' + n.from + ' to ' + n.to + '. ' +
               (n.worse ? 'What broke first, and how did you find out?'
                        : 'What did you change first, and how long before it showed?');
      case 'multiple':
        return n.metric + '. Off what base, and over how long?';
      case 'pct':
      case 'count':
        return 'You put ' + n.metric + ' on the résumé. What was it before, and what did ' +
               'you personally do to move it?';
      default:
        return 'Take me through what happened here. Start where it went wrong.';
    }
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
      hasObstacle: /\b(but|however|problem|pushed back|blocked|resisted|failed|broke|stalled|churn)/i.test(t),
      vague: HEDGE.test(t) && words < 60
    };
  };

  Coach.followUp = function (item, answers, ctx) {
    ctx = ctx || {};
    var last = answers[answers.length - 1] || '';
    var all = answers.join(' ');
    var a = Coach.readAnswer(all);
    var l = Coach.readAnswer(last);

    if (l.words < 8) {
      return 'That is the headline. Give me the version you would tell someone ' +
             'over a drink — what was actually going on?';
    }
    if (a.weOnly) {
      return 'That is what the team did. What was yours specifically — the part that ' +
             'would not have happened without you?';
    }
    if (!a.hasObstacle) {
      return 'What got in the way? An interviewer is listening for the part that ' +
             'nearly did not work.';
    }
    if (!a.hasNumber) {
      return 'Put a number on it. Before and after, or how long it took — ' +
             'whichever you actually remember.';
    }
    if (!a.hasOutcome) {
      return 'And how did it end? Say the outcome the way you would want it repeated.';
    }
    if (a.vague) {
      return 'Two things in there are still fuzzy. Name the account, the team, or the ' +
             'quarter — specifics are what make it sound true.';
    }
    if (a.words < 45) {
      return 'One more layer: what would you say if they asked "and what did you learn?"';
    }
    return null; /* enough to bank */
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

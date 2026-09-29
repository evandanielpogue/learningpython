/* ==========================================================================
   sources.js — where the prep material actually comes from.

   Three honest categories, because they behave differently:

     open    the page is public and a model can read it, so we can offer to
             fetch it when Claude is on.
     login   the page is behind a login and its terms do not allow automated
             collection. Glassdoor and Blind are the obvious ones. We send
             you there with the search already built and take a paste back.
             We do not scrape them, and we do not pretend to.
     manual  no stable URL worth guessing; you go and look.

   Each entry knows how to build its own search URL from a company name, so
   one click lands on the right page instead of a homepage.
   ========================================================================== */
(function (window) {
  'use strict';

  var Sources = {};
  var q = encodeURIComponent;

  var CATALOGUE = [
    /* ---- what they ask in interviews ---- */
    { id: 'gd-int', group: 'Interviews', name: 'Glassdoor interviews', access: 'login',
      good: 'Questions candidates say they were actually asked, by role.',
      url: function (co, role) {
        return 'https://www.glassdoor.com/Search/results.htm?keyword=' + q(co + ' ' + (role || '') + ' interview');
      },
      paste: 'questions' },
    { id: 'blind', group: 'Interviews', access: 'login',
      name: 'Blind', good: 'What employees say anonymously. Blunt, and often current.',
      url: function (co) { return 'https://www.teamblind.com/search/' + q(co); },
      paste: 'notes' },
    { id: 'reddit', group: 'Interviews', access: 'open',
      name: 'Reddit', good: 'r/sales and the industry subs on this company and its process.',
      url: function (co) { return 'https://www.reddit.com/search/?q=' + q(co + ' interview'); },
      paste: 'questions' },

    /* ---- what it is like inside ---- */
    { id: 'gd-rev', group: 'Inside', access: 'login',
      name: 'Glassdoor reviews', good: 'Ratings and the written reviews, including the recent trend.',
      url: function (co) { return 'https://www.glassdoor.com/Search/results.htm?keyword=' + q(co); },
      paste: 'notes' },
    { id: 'indeed', group: 'Inside', access: 'login',
      name: 'Indeed reviews', good: 'A different population than Glassdoor. Worth the second read.',
      url: function (co) { return 'https://www.indeed.com/cmp/' + q(String(co).replace(/\s+/g, '-')) + '/reviews'; },
      paste: 'notes' },
    { id: 'levels', group: 'Inside', access: 'open',
      name: 'Levels.fyi', good: 'What the band actually pays, so you are not guessing in the call.',
      url: function (co) { return 'https://www.levels.fyi/companies/' + q(String(co).toLowerCase().replace(/\s+/g, '-')) + '/salaries'; },
      paste: 'notes' },

    /* ---- what their customers say — the best material for a sales seat ---- */
    { id: 'g2', group: 'Customers', access: 'open',
      name: 'G2', good: 'Customer reviews. The complaints are your discovery questions.',
      url: function (co) { return 'https://www.g2.com/search?query=' + q(co); },
      paste: 'customers' },
    { id: 'capterra', group: 'Customers', access: 'open',
      name: 'Capterra', good: 'Skews smaller buyers. Good if the role is SMB or mid-market.',
      url: function (co) { return 'https://www.capterra.com/search/?query=' + q(co); },
      paste: 'customers' },
    { id: 'trustradius', group: 'Customers', access: 'open',
      name: 'TrustRadius', good: 'Longer reviews, usually from people who actually run the tool.',
      url: function (co) { return 'https://www.trustradius.com/search?q=' + q(co); },
      paste: 'customers' },

    /* ---- what the company says about itself ---- */
    { id: 'news', group: 'The company', access: 'open',
      name: 'Their newsroom', good: 'Launches, funding, leadership changes — in their own words.',
      url: function (co) { return 'https://news.google.com/search?q=' + q(co); },
      paste: 'notes' },
    { id: 'careers', group: 'The company', access: 'open',
      name: 'The rest of the reqs', good: 'What else they are hiring tells you where the money is going.',
      url: function (co, role) { return 'https://www.google.com/search?q=' + q(co + ' careers ' + (role || '')); },
      paste: 'notes' }
  ];

  Sources.all = function () { return CATALOGUE.slice(); };
  Sources.groups = function () {
    var seen = [], out = [];
    CATALOGUE.forEach(function (s) {
      if (seen.indexOf(s.group) > -1) return;
      seen.push(s.group);
      out.push({ name: s.group, items: CATALOGUE.filter(function (x) { return x.group === s.group; }) });
    });
    return out;
  };
  Sources.get = function (id) {
    return CATALOGUE.filter(function (s) { return s.id === id; })[0] || null;
  };
  Sources.linkFor = function (id, company, role) {
    var s = Sources.get(id);
    return s ? s.url(company || '', role || '') : '';
  };

  /* Sites a model must not be pointed at: their terms do not allow it and the
     page needs a login anyway, so a fetch returns a wall, not an answer. */
  Sources.noFetch = ['glassdoor.com', 'www.glassdoor.com', 'teamblind.com', 'www.teamblind.com',
                     'indeed.com', 'www.indeed.com', 'linkedin.com', 'www.linkedin.com'];

  Sources.fetchable = function (url) {
    var u = String(url || '').toLowerCase();
    return !Sources.noFetch.some(function (h) { return u.indexOf('//' + h + '/') > -1 || u.indexOf('.' + h + '/') > -1; });
  };

  /* ----------------------------------------------------------------- parse --
     People paste a screenful, not a tidy object. Split it into items the way
     a person would read it: one per line or bullet, blank lines ignored, the
     numbering and bullet glyphs stripped, anything too short thrown away. */
  function lines(text) {
    return String(text || '')
      .split(/\r?\n+/)
      .map(function (l) {
        return l.replace(/^\s*(?:[-*•●–]|\d+[.)])\s*/, '').trim();
      })
      .filter(function (l) { return l.length > 8; });
  }
  Sources.lines = lines;

  /* a pasted block of interview questions */
  Sources.parseQuestions = function (text, where) {
    return lines(text).filter(function (l) {
      /* a question, or something phrased as one of the standard prompts */
      return /\?\s*$/.test(l) || /^(tell|walk|describe|give|how|what|why|when|which|explain|talk)\b/i.test(l);
    }).map(function (l) {
      return {
        kind: 'Interview question',
        title: l.replace(/\s+/g, ' '),
        source: where || 'pasted',
        use: ''
      };
    });
  };

  /* a pasted block of customer reviews, which for a sales seat is the best
     material in the whole exercise: a complaint is a discovery question */
  var GRIPE = /\b(slow|clunky|expensive|confusing|buggy|support|missing|wish|lacks|hard to|difficult|no way to|limited|disappoint)\b/i;
  Sources.parseReviews = function (text, where) {
    return lines(text).map(function (l) {
      return {
        kind: GRIPE.test(l) ? 'Customer gripe' : 'Customer voice',
        title: l.replace(/\s+/g, ' ').slice(0, 160),
        source: where || 'pasted',
        use: ''
      };
    });
  };

  /* anything else: keep it as notes, one per paragraph */
  Sources.parseNotes = function (text, where) {
    return lines(text).map(function (l) {
      return { kind: 'Note', title: l.replace(/\s+/g, ' ').slice(0, 160), source: where || 'pasted', use: '' };
    });
  };

  Sources.parse = function (mode, text, where) {
    if (mode === 'questions') return Sources.parseQuestions(text, where);
    if (mode === 'customers') return Sources.parseReviews(text, where);
    return Sources.parseNotes(text, where);
  };

  window.Sources = Sources;
})(window);

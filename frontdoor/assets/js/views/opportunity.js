/* ==========================================================================
   views/opportunity.js — one company: the checklist, the numbers, what is
   next. Plus the flow that creates one from a pasted job listing.
   ========================================================================== */
(function (window, document) {
  'use strict';

  var esc = UI.esc;
  window.Views = window.Views || {};

  /* ======================================================================
     ADD A COMPANY
     ====================================================================== */
  var READ = [
    ['Role and company', function (p) { return p.role ? p.role.split(',')[0] : 'found'; }],
    ['Where it sits', function (p) { return p.location || 'not stated'; }],
    ['What they are asking for', function (p) { return p.requirements.length + ' lines'; }],
    ['Wins of yours that answer it', function (p, r) { return r.filter(function (x) { return x.score; }).length + ' matched'; }]
  ];

  window.Views.newOpp = function () {
    var stage = 1;
    var listing = '';
    var parsed = null;
    var ranked = [];
    var chosen = [];
    var story = '';
    var asked = 0;

    function paint() {
      var body;

      if (stage === 1) {
        body =
          '<div class="card p6">' +
            '<h3 class="mb2">Paste the job listing</h3>' +
            '<p class="dim mb5" style="font-size:var(--fs-sm)">All of it. The boring requirements section is the part that tells us which of your wins to lead with.</p>' +
            '<textarea class="input listing-in" id="listing" placeholder="Paste the whole posting here" spellcheck="false"></textarea>' +
            '<div class="row between wrap mt4 g3">' +
              '<button class="btn btn-ghost btn-sm" id="use-sample">Use an example listing</button>' +
              '<button class="btn btn-primary" id="read" disabled>Read it <span class="arr">→</span></button>' +
            '</div>' +
            '<div class="hide mt5" id="scan-box"><p class="cap mb3">Reading the listing</p><div id="scan"></div></div>' +
          '</div>';
      } else {
        var matched = ranked.filter(function (r) { return r.score > 0; });
        body =
          '<div class="card p6 mb4">' +
            '<div class="row between wrap g3 mb4">' +
              '<div><p class="cap mb1">The role</p><h3>' + esc(parsed.role || 'Untitled role') + '</h3>' +
                '<p class="dim" style="font-size:var(--fs-sm)">' + esc(parsed.company) +
                (parsed.location ? ' · ' + esc(parsed.location) : '') +
                (parsed.req ? ' · Req ' + esc(parsed.req) : '') + '</p></div>' +
              '<button class="btn btn-ghost btn-sm" id="back">Paste a different one</button>' +
            '</div>' +
            (parsed.requirements.length
              ? '<div class="row wrap g2">' + parsed.requirements.slice(0, 6).map(function (r) {
                  return '<span class="chip">' + esc(r.length > 44 ? r.slice(0, 42) + '…' : r) + '</span>';
                }).join('') + '</div>'
              : '<p class="hint">No bullet list in there, so we will go on the body text.</p>') +
          '</div>' +

          '<div class="card p6 mb4">' +
            '<div class="row between wrap g3 mb2"><h3>What you lead with</h3>' +
            '<span class="cap" id="pick-count">' + chosen.length + ' of 3</span></div>' +
            '<p class="dim mb5" style="font-size:var(--fs-sm)">' +
            (matched.length
              ? 'Picked by matching your résumé against the listing. Swap any of them.'
              : 'Nothing in the listing lined up cleanly with your wins, so these are your strongest three. Swap any of them.') +
            '</p>' +
            '<div class="grid" style="gap:var(--s-2)" id="wins"></div>' +
          '</div>' +

          '<div class="card assist-card mb4" style="min-height:280px">' +
            '<div class="assist-head"><b>One more thing</b>' +
            '<span class="hint">Answers here become the story on your page</span></div>' +
            '<div class="assist-log" id="log"></div>' +
            '<form class="assist-in" id="story-form">' +
              '<input id="story-q" placeholder="Type your answer" autocomplete="off" aria-label="Your answer">' +
              '<button type="submit" aria-label="Send">↑</button></form>' +
          '</div>' +

          '<div class="row g2 wrap">' +
            '<button class="btn btn-primary" id="create">Add ' + esc(parsed.company) + ' <span class="arr">→</span></button>' +
            '<button class="btn btn-ghost" id="skip-story">Skip the story for now</button>' +
          '</div>';
      }

      var v = Shell.mount({
        nav: 'home',
        crumbs: [{ label: 'Overview', href: '/' }, { label: 'Add a company' }],
        html: '<div class="page-head"><h1>Add a company</h1>' +
              '<p>One listing in, a whole campaign out. Takes about two minutes.</p></div>' + body
      });

      if (stage === 1) wireOne(v); else wireTwo(v);
    }

    function wireOne(v) {
      var ta = v.querySelector('#listing');
      var go = v.querySelector('#read');
      ta.value = listing;
      go.disabled = ta.value.trim().length < 40;

      ta.addEventListener('input', function () {
        listing = ta.value;
        go.disabled = ta.value.trim().length < 40;
      });
      v.querySelector('#use-sample').addEventListener('click', function () {
        ta.value = Store.SAMPLE_LISTING;
        listing = ta.value;
        go.disabled = false;
        ta.focus();
      });
      go.addEventListener('click', function () {
        parsed = Store.parseListing(listing);
        ranked = Store.rankWins(listing);
        chosen = ranked.slice(0, 3).map(function (r) { return r.win.id; });
        go.disabled = true;
        var box = v.querySelector('#scan-box');
        box.classList.remove('hide');
        v.querySelector('#scan').innerHTML = READ.map(function (s, i) {
          return '<div class="scan-line" id="sl' + i + '"><span class="dot"></span><span>' + esc(s[0]) + '</span><em><span class="skel"></span></em></div>';
        }).join('');
        READ.forEach(function (s, i) {
          setTimeout(function () {
            var ln = v.querySelector('#sl' + i);
            if (!ln) return;
            ln.classList.add('done');
            ln.querySelector('em').textContent = s[1](parsed, ranked);
            if (i === READ.length - 1) setTimeout(function () { stage = 2; paint(); }, 420);
          }, 320 * (i + 1));
        });
      });
    }

    function wireTwo(v) {
      var winsEl = v.querySelector('#wins');

      function paintWins() {
        winsEl.innerHTML = ranked.map(function (r) {
          var on = chosen.indexOf(r.win.id) > -1;
          var locked = !on && chosen.length >= 3;
          return '<button class="opt' + (locked ? ' locked' : '') + '" data-win="' + r.win.id + '" aria-pressed="' + on + '">' +
            '<span class="box"></span><span class="ot">' + esc(r.win.text) +
            '<em>' + (r.score
              ? 'Matches the listing on ' + esc(r.hits.slice(0, 3).join(', '))
              : esc(r.win.where)) + '</em></span>' +
            '<span class="om">' + esc(r.win.metric) + '</span></button>';
        }).join('');
        v.querySelector('#pick-count').textContent = chosen.length + ' of 3';
      }
      paintWins();

      UI.on(v, 'click', '[data-win]', function (e, el) {
        var id = el.dataset.win;
        var at = chosen.indexOf(id);
        if (at > -1) chosen.splice(at, 1);
        else if (chosen.length < 3) chosen.push(id);
        paintWins();
      });

      /* the chat only wants one thing: the detail a résumé bullet leaves out */
      var log = v.querySelector('#log');
      function say(cls, text) {
        log.insertAdjacentHTML('beforeend', '<div class="bubble ' + cls + '">' + esc(text) + '</div>');
        log.scrollTop = log.scrollHeight;
      }
      var top = Store.state.profile.wins.filter(function (w) { return w.id === chosen[0]; })[0];
      var QS = [
        top ? 'You are leading with "' + top.text + '". What actually broke first?' : 'What is the hardest thing you have fixed at work?',
        'And what did you do about it, in the order you did it?',
        'Last one. How did it end, with a number if you have one?'
      ];
      say('ai', QS[0]);

      v.querySelector('#story-form').addEventListener('submit', function (e) {
        e.preventDefault();
        var i = v.querySelector('#story-q');
        var text = i.value.trim();
        if (!text) return;
        say('me', text);
        story += (story ? ' ' : '') + text;
        i.value = '';
        asked += 1;
        setTimeout(function () {
          if (asked < QS.length) say('ai', QS[asked]);
          else say('ai', 'That is the story. It goes on your page and into the first message to the hiring manager.');
        }, 380);
      });

      v.querySelector('#back').addEventListener('click', function () { stage = 1; paint(); });
      v.querySelector('#skip-story').addEventListener('click', create);
      v.querySelector('#create').addEventListener('click', create);

      function create() {
        if (!chosen.length) { UI.toast('Pick at least one win to lead with.'); return; }
        var c = Store.createCampaign({
          listing: listing, parsed: parsed, winIds: chosen.slice(), story: story
        });
        UI.toast(c.company + ' added. Three people to look at.');
        Router.go('/c/' + c.id);
      }
    }

    paint();
  };

  /* ======================================================================
     ONE OPPORTUNITY
     ====================================================================== */
  function stepRow(c, s) {
    var p = c.contacts.filter(function (x) { return x.id === s.contact; })[0];
    var cls = 'touch' + (s.status === 'sent' || s.status === 'replied' ? ' sent' : '');
    var badge = s.status === 'replied' ? '<span class="chip chip-pos">Replied</span>'
              : s.status === 'due'     ? '<span class="chip chip-accent">Due today</span>'
              : s.status === 'sent'    ? '<span class="chip">Sent</span>'
              : '<span class="chip">Queued</span>';
    return '<button class="touch-row ' + cls + '" data-step="' + s.id + '" style="--pc:var(' + (p ? p.colour : '--line-3') + ')">' +
      '<span class="td">Day ' + s.day + '</span>' +
      '<span class="tw">' + esc(p ? p.name : 'No contact') + '<em>' + esc(s.note) + '</em></span>' +
      badge + '<span class="tc">' + esc(s.channel) + '</span></button>';
  }

  window.Views.opportunity = function (params) {
    var c = Store.campaign(params.id);
    if (!c) return Router.go('/', true);
    Store.touch(c.id);

    var pr = Store.taskProgress(c);
    var wins = Store.campaignWins(c);
    var upNext = c.steps.filter(function (s) { return s.status === 'due' || s.status === 'queued'; }).slice(0, 4);
    var sugg = c.suggested || [];

    function taskList() {
      return c.tasks.map(function (t) {
        return '<button class="task" data-task="' + t.id + '" aria-pressed="' + t.on + '">' +
          '<span class="tick"></span>' +
          '<span class="tt">' + esc(t.text) + '<em>' + esc(t.sub) + '</em></span>' +
          '<span class="cap">' + (t.on ? 'Done' : 'Open') + '</span></button>';
      }).join('');
    }

    var html =
      '<div class="page-head">' +
        '<div class="row between wrap g3">' +
          '<div><h1>' + esc(c.company) + '</h1>' +
          '<p>' + esc(c.role) + (c.location ? ' · ' + esc(c.location) : '') + '</p></div>' +
        '</div>' +
      '</div>' +

      '<div class="grid cols-4 mb4">' +
        '<div class="card hover p5"><p class="cap mb3">People</p><h2 class="mono">' + c.contacts.length + '</h2><p class="dimmer" style="font-size:var(--fs-sm)">' + (sugg.length ? sugg.length + ' more suggested' : 'all added') + '</p></div>' +
        '<div class="card hover p5"><p class="cap mb3">Touches sent</p><h2 class="mono">' + c.sent + '</h2><p class="dimmer" style="font-size:var(--fs-sm)">of ' + c.steps.length + ' planned</p></div>' +
        '<div class="card hover p5"><p class="cap mb3">Replies</p><h2 class="mono">' + c.replies + '</h2><p class="dimmer" style="font-size:var(--fs-sm)">' + (c.replies ? 'keep going' : 'early days') + '</p></div>' +
        '<div class="card hover p5"><p class="cap mb3">Page opens</p><h2 class="mono">' + c.views + '</h2><p class="dimmer" style="font-size:var(--fs-sm)">Last one ' + esc(c.lastView) + '</p></div>' +
      '</div>' +

      '<div class="split-wide">' +
        '<div class="col g4">' +
          '<div class="card p5">' +
            '<div class="row g4" style="align-items:flex-start">' +
              Views.ringSVG(pr.done, pr.total) +
              '<div class="col g2 grow">' +
                '<div class="row between wrap"><h3>Getting ' + esc(c.company) + ' off the ground</h3>' +
                '<span class="cap" id="ring-label">' + pr.done + ' of ' + pr.total + ' done</span></div>' +
                '<p class="dim" style="font-size:var(--fs-sm)">Each one is a screen away. Nothing here takes longer than five minutes.</p>' +
              '</div>' +
            '</div>' +
            '<div class="mt3" id="tasks" style="display:grid;gap:1px">' + taskList() + '</div>' +
          '</div>' +

          '<div class="card p5">' +
            '<div class="row between mb4"><h3>Up next</h3>' +
            '<a class="btn btn-ghost btn-sm" href="#/c/' + c.id + '/sequence">Open the sequence <span class="arr">→</span></a></div>' +
            (upNext.length
              ? '<div class="seq">' + upNext.map(function (s) { return stepRow(c, s); }).join('') + '</div>'
              : '<p class="dim mb4" style="font-size:var(--fs-sm)">' +
                (c.contacts.length
                  ? 'Nothing scheduled yet. Ten touches across your ' + c.contacts.length + ' contacts, built from your templates.'
                  : 'Add the people we found first, then the fourteen days build around them.') + '</p>' +
                '<a class="btn btn-primary btn-sm" href="#/c/' + c.id +
                (c.contacts.length ? '/sequence">Build the sequence' : '/people">Add contacts') +
                ' <span class="arr">→</span></a>') +
          '</div>' +
        '</div>' +

        '<div class="col g4">' +
          '<div class="card p5">' +
            '<p class="cap mb3">What you lead with</p>' +
            (wins.length
              ? '<div class="leadwins">' + wins.map(function (w) {
                  return '<div><b>' + esc(w.metric) + '</b><span>' + esc(w.short) + '</span></div>';
                }).join('') + '</div>'
              : '<p class="hint">Nothing picked yet.</p>') +
            (c.story ? '<p class="storyline">' + esc(c.story) + '</p>' : '') +
            '<a class="btn btn-secondary btn-sm mt4" href="#/c/' + c.id + '/page">See the page <span class="arr">→</span></a>' +
          '</div>' +

          (sugg.length
            ? '<div class="card p5">' +
                '<p class="cap mb2">People we found</p>' +
                '<p class="dim mb4" style="font-size:var(--fs-sm)">The hiring manager, the recruiter, and someone who could forward you along.</p>' +
                '<div class="col g2">' + sugg.slice(0, 3).map(function (s) {
                  return '<div class="sugg"><span class="avatar avatar-md" style="background:var(' + Store.colourFor(s.persona) + ')">' +
                    esc(Store.initials(s.name)) + '</span>' +
                    '<span class="grow" style="min-width:0"><b>' + esc(s.name) + '</b>' +
                    '<em>' + esc(s.title) + '</em></span>' +
                    '<button class="btn btn-secondary btn-sm" data-take="' + s.id + '">Add</button></div>';
                }).join('') + '</div>' +
                '<a class="btn btn-ghost btn-sm mt3" href="#/c/' + c.id + '/people">See all of them <span class="arr">→</span></a>' +
              '</div>'
            : '') +

          (c.requirements.length
            ? '<div class="card p5"><p class="cap mb3">What the listing asks for</p>' +
              '<ul class="ticks">' + c.requirements.slice(0, 6).map(function (r) {
                return '<li>' + esc(r) + '</li>';
              }).join('') + '</ul></div>'
            : '') +
        '</div>' +
      '</div>';

    var v = Shell.mount({
      nav: 'opp',
      crumbs: [{ label: 'Overview', href: '/' }, { label: c.company }],
      actions: '<span class="chip chip-pos">Day ' + c.day + ' of 14</span>' +
               '<a class="btn btn-secondary btn-sm" href="#/c/' + c.id + '/page">View page</a>',
      html: html
    });

    UI.on(v, 'click', '[data-task]', function (e, el) {
      var t = Store.toggleTask(c.id, el.dataset.task);
      var p2 = Store.taskProgress(c);
      el.setAttribute('aria-pressed', t.on);
      el.querySelector('.cap').textContent = t.on ? 'Done' : 'Open';
      var r = 17, C = 2 * Math.PI * r;
      v.querySelector('.ring .fill').setAttribute('stroke-dashoffset', (C - (p2.done / p2.total) * C).toFixed(1));
      v.querySelector('#ring-label').textContent = p2.done + ' of ' + p2.total + ' done';
      if (t.on) UI.toast(p2.done === p2.total ? 'That is all of them. Go send the first message.' : 'Nice. ' + p2.done + ' of ' + p2.total + '.');
    });
    UI.on(v, 'click', '[data-step]', function (e, el) {
      c.activeStep = el.dataset.step; Store.save();
      Router.go('/c/' + c.id + '/sequence');
    });
    UI.on(v, 'click', '[data-take]', function (e, el) {
      var p = Store.acceptSuggestion(c.id, el.dataset.take);
      if (p) { Store.completeTask(c.id, 't3'); UI.toast(p.name + ' added.'); Views.opportunity(params); }
    });
  };
})(window, document);

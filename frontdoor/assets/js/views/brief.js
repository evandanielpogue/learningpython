/* ==========================================================================
   views/brief.js — the interview.

   Everything this company campaign has accumulated, on one page, for the
   thirty minutes before you walk in: what you said you would lead with and
   the story behind it, where you line up and what you will say about the
   gaps, who you have spoken to and what they told you, what the company
   said in public, and the questions to expect on both sides.

   This is the only screen written to be printed.
   ========================================================================== */
(function (window, document) {
  'use strict';

  var esc = UI.esc;
  window.Views = window.Views || {};

  window.Views.brief = function (params) {
    var c = Store.campaign(params.id);
    if (!c) return Router.go('/', true);
    Store.touch(c.id);

    /* the questions panel is never empty: work them out from the listing and
       the gaps on first open, and let Claude redo them properly if it is on */
    if (!c.questions) Store.setQuestions(c.id, Store.questionsLocally(c));

    var b = Store.brief(c);
    var pf = Store.state.profile;
    var busy = false;

    /* ---------------- what you lead with ---------------- */
    function leadHTML() {
      if (!b.wins.length) return '<p class="dim">Nothing picked yet.</p>';
      return '<div class="bf-wins">' + b.wins.map(function (w) {
        return '<div class="bf-win">' +
          '<div class="bf-win-top"><b class="mono">' + esc(w.win.metric) + '</b>' +
          '<span>' + esc(w.win.text) + '</span></div>' +
          '<p class="bf-where">' + esc(w.win.where) + '</p>' +
          (w.story
            ? '<p class="bf-story">' + esc(w.story) + '</p>'
            : '<p class="bf-todo"><a href="#/c/' + c.id + '/prep">Add a story</a></p>') +
        '</div>';
      }).join('') + '</div>';
    }

    /* ---------------- the match, with your answers ---------------- */
    function matchHTML() {
      if (!b.match.length) return '<p class="dim">No requirements found.</p>';
      return '<div class="bf-match">' + b.match.map(function (m) {
        return '<div class="bf-row ' + m.strength + '">' +
          '<span class="mr-dot"></span>' +
          '<div><b>' + esc(m.req.text) + '</b>' +
            (m.evidence.length
              ? '<p class="bf-ev">' + m.evidence.map(function (w) {
                  return '<span class="chip"><b class="mono">' + esc(w.metric) + '</b> ' + esc(w.short) + '</span>';
                }).join('') + '</p>'
              : '') +
            (m.answer
              ? '<p class="bf-answer"><em>You will say:</em> ' + esc(m.answer) + '</p>'
              : m.strength === 'none'
                ? '<p class="bf-todo"><a href="#/c/' + c.id + '/prep">Add an answer</a></p>'
                : '') +
          '</div></div>';
      }).join('') + '</div>';
    }

    /* ---------------- the people ---------------- */
    function peopleHTML() {
      if (!b.people.length) return '<p class="dim">Nobody added yet.</p>';
      return '<div class="bf-people">' + b.people.map(function (p) {
        var t = p.touches;
        return '<div class="bf-person">' +
          '<div class="row g3" style="align-items:flex-start">' +
            '<span class="avatar avatar-md" style="background:var(' + p.person.colour + ')">' +
              esc(Store.initials(p.person.name)) + '</span>' +
            '<span class="grow" style="min-width:0"><b>' + esc(p.person.name) + '</b>' +
            '<em class="bf-role">' + esc(p.person.title || p.person.persona) + '</em></span>' +
            (t.length
              ? '<span class="chip' + (t.some(function (x) { return x.replied; }) ? ' chip-pos' : '') + '">' +
                t.length + ' touch' + (t.length === 1 ? '' : 'es') +
                (t.some(function (x) { return x.replied; }) ? ', replied' : '') + '</span>'
              : '<span class="chip">no touches</span>') +
          '</div>' +
          (t.length
            ? '<ul class="bf-touches">' + t.map(function (x) {
                return '<li><span class="mono">Day ' + x.day + '</span> ' + esc(x.channel) + ' &mdash; ' + esc(x.note) + '</li>';
              }).join('') + '</ul>'
            : '') +
          (p.activity.length
            ? '<p class="bf-said"><em>Said in public:</em> ' +
              esc(p.activity[0].text) + '</p>'
            : '') +
          (p.notes ? '<p class="bf-note"><em>Your note:</em> ' + esc(p.notes) + '</p>' : '') +
        '</div>';
      }).join('') + '</div>';
    }

    /* ---------------- what the company said ---------------- */
    function researchHTML() {
      if (!b.research.length) {
        return '<p class="dim"><a href="#/c/' + c.id + '/research">Add finding</a></p>';
      }
      return '<ul class="bf-research">' + b.research.map(function (r) {
        return '<li><b>' + esc(r.title) + '</b>' +
          (r.detail ? '<p>' + esc(r.detail) + '</p>' : '') +
          '<span class="bf-src">' + esc(r.source || r.kind) + (r.date ? ' · ' + esc(r.date) : '') + '</span></li>';
      }).join('') + '</ul>';
    }

    /* ---------------- the questions ---------------- */
    function questionsHTML() {
      var q = c.questions;
      if (!q || !(q.likely || []).length) {
        return '<div class="bf-empty">' +
          '<a class="btn btn-secondary btn-sm" href="#/c/' + c.id + '">Role</a></div>';
      }
      return '<div class="bf-qs">' + (q.likely || []).map(function (x) {
        return '<div class="bf-q">' +
          '<b>' + esc(x.question) + '</b>' +
          '<p class="bf-why">' + esc(x.why) + '</p>' +
          (x.answer ? '<p class="bf-answer">' + esc(x.answer) + '</p>' : '') +
          (x.gap ? '<p class="bf-todo">' + esc(x.gap) + '</p>' : '') +
        '</div>';
      }).join('') + '</div>' +
      ((q.toAsk && q.toAsk.length)
        ? '<h3 class="bf-sub">Ask them</h3><ul class="bf-ask">' + q.toAsk.map(function (x) {
            return '<li><b>' + esc(x.question) + '</b><span>' + esc(x.why) + '</span></li>';
          }).join('') + '</ul>'
        : '') +
      ((q.watch && q.watch.length)
        ? '<h3 class="bf-sub">Watch</h3><ul class="bf-watch">' + q.watch.map(function (x) {
            return '<li>' + esc(x) + '</li>';
          }).join('') + '</ul>'
        : '') +
      '<button class="btn btn-secondary btn-sm mt3" id="gen-q">' +
        (AI.ready() ? 'Redo with Claude' : 'Redo') + '</button>';
    }

    /* ---------------- the dashboard ---------------- */
    function panel(id, title, sub, body, span, tall, count) {
      return '<section class="bf-panel' + (span ? ' sp-' + span : '') + (tall ? ' bf-tall' : '') +
        '" id="bf-' + id + '">' +
        '<div class="bf-head"><h2>' + esc(title) + '</h2>' +
        (count != null ? '<span class="chip bf-count">' + count + '</span>' : '') +
        (sub ? '<p>' + esc(sub) + '</p>' : '') + '</div>' +
        '<div class="bf-body">' + body + '</div></section>';
    }

    function tile(cap, value, tone) {
      return '<div class="bf-tile' + (tone ? ' ' + tone : '') + '">' +
        '<span class="cap">' + esc(cap) + '</span>' +
        '<p class="kpi">' + esc(String(value)) + '</p></div>';
    }

    var ready = b.wins.filter(function (w) { return w.story; }).length;
    var spoken = b.people.filter(function (p) { return p.touches.length; }).length;
    var replied = b.people.filter(function (p) {
      return p.touches.some(function (x) { return x.replied; });
    }).length;
    var answered = b.match.filter(function (m) { return m.strength !== 'none' || m.answer; }).length;
    var qCount = ((c.questions || {}).likely || []).length;

    var html =
      '<div class="bf-bar">' +
        '<div class="bf-id">' +
          '<h1>Interview</h1>' +
          '<p>' + esc(c.company) + ' &middot; ' + esc(c.role) + (c.location ? ' &middot; ' + esc(c.location) : '') + '</p>' +
        '</div>' +
        '<div class="bf-bar-acts">' +
          (/^https?:\/\//i.test(c.postingUrl || '')
            ? '<a class="btn btn-ghost btn-sm" href="' + esc(c.postingUrl) +
              '" target="_blank" rel="noopener noreferrer">The listing \u2197</a>'
            : '') +
          /* the one fact this step records: it is a thing you did, not a
             thing a screen decided */
          '<button class="btn ' + (c.booked ? 'btn-secondary' : 'btn-primary') + ' btn-sm" id="booked" aria-pressed="' + !!c.booked + '">' +
            (c.booked ? 'Interview booked' : 'Mark interview booked') + '</button>' +
          '<button class="btn btn-ghost btn-sm" id="print">Print</button>' +
        '</div>' +
      '</div>' +

      '<div class="bf-tiles">' +
        tile('Stories', ready + '/' + b.wins.length,
             ready === b.wins.length && b.wins.length ? 'ok' : (ready ? '' : 'warn')) +
        tile('Requirements', answered + '/' + b.match.length,
             b.match.length && answered === b.match.length ? 'ok' : '') +
        tile('Gaps', b.gaps.length, b.gaps.length ? 'warn' : 'ok') +
        tile('Replies', replied + '/' + spoken, replied ? 'ok' : '') +
        tile('Questions', qCount, qCount ? '' : 'warn') +
      '</div>' +

      '<div class="bf-grid">' +
        panel('lead', 'Proof', '', leadHTML(), 12, false, b.wins.length) +
        panel('questions', 'Questions', '', '<div id="qbox">' + questionsHTML() + '</div>', 7, true, qCount) +
        panel('match', 'Match', '', matchHTML(), 5, true, b.match.length) +
        panel('people', 'People', '', peopleHTML(), 7, true, b.people.length) +
        panel('research', 'Research', '', researchHTML(), 5, true, b.research.length) +
      '</div>';

    var v = Shell.mount({
      nav: 'brief',
      crumbs: [{ label: 'Overview', href: '/' }, { label: c.company, href: '/c/' + c.id }, { label: 'Interview' }],
      html: html
    });

    function paintQ() { v.querySelector('#qbox').innerHTML = questionsHTML(); }

    UI.on(v, 'click', '#gen-q', function (e, el) {
      if (busy) return;
      busy = true;
      el.disabled = true;
      el.textContent = 'Working…';
      if (!AI.ready()) {
        Store.setQuestions(c.id, Store.questionsLocally(c));
        busy = false;
        paintQ();
        UI.toast('Done.');
        return;
      }
      AI.interviewPrep(c).then(function (q) {
        q.source = 'claude';
        Store.setQuestions(c.id, q);
        paintQ();
        UI.toast((q.likely || []).length + ' questions.');
      }).catch(function (err) {
        Store.setQuestions(c.id, Store.questionsLocally(c));
        paintQ();
        UI.toast('Claude could not (' + err.message + ').');
      }).then(function () { busy = false; });
    });

    v.querySelector('#print').addEventListener('click', function () { window.print(); });
    v.querySelector('#booked').addEventListener('click', function () {
      Store.setBooked(c.id, !c.booked);
      if (c.booked) {
        UI.cheerOnce(c.id, 'booked', { title: 'Interview booked' });
      }
      Views.brief(params);
    });
  };
})(window, document);

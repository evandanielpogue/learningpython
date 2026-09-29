/* ==========================================================================
   views/brief.js — the interview brief.

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

    var b = Store.brief(c);
    var pf = Store.state.profile;
    var busy = false;

    function sec(id, title, sub, body) {
      return '<section class="bf-sec" id="bf-' + id + '">' +
        '<div class="bf-head"><h2>' + esc(title) + '</h2>' +
        (sub ? '<p>' + esc(sub) + '</p>' : '') + '</div>' + body + '</section>';
    }

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
            : '<p class="bf-todo">No story behind this yet. ' +
              '<a href="#/c/' + c.id + '/prep">Work it out in Prep</a> before someone asks.</p>') +
        '</div>';
      }).join('') + '</div>';
    }

    /* ---------------- the match, with your answers ---------------- */
    function matchHTML() {
      if (!b.match.length) return '<p class="dim">No requirements were parsed out of the listing.</p>';
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
                ? '<p class="bf-todo">Nothing answers this and you have not worked out what to say. ' +
                  '<a href="#/c/' + c.id + '/prep">Do that first.</a></p>'
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
              : '<span class="chip">not contacted</span>') +
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
        return '<p class="dim">Nothing gathered. <a href="#/c/' + c.id + '/research">Add what you have found</a> — ' +
          'one specific thing they said is worth more than a page of company history.</p>';
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
      if (!q) {
        return '<div class="bf-empty">' +
          '<p>' + (AI.ready()
            ? 'Claude can work out what this company is likely to ask you, from the listing, your gaps and what these people have said.'
            : 'Without a model these come from the listing and your gaps. Turn Claude on in Settings for the good version.') + '</p>' +
          '<button class="btn btn-primary btn-sm" id="gen-q">Work out the questions</button></div>';
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
        ? '<h3 class="bf-sub">Worth asking them</h3><ul class="bf-ask">' + q.toAsk.map(function (x) {
            return '<li><b>' + esc(x.question) + '</b><span>' + esc(x.why) + '</span></li>';
          }).join('') + '</ul>'
        : '') +
      ((q.watch && q.watch.length)
        ? '<h3 class="bf-sub">Be careful about</h3><ul class="bf-watch">' + q.watch.map(function (x) {
            return '<li>' + esc(x) + '</li>';
          }).join('') + '</ul>'
        : '') +
      '<button class="btn btn-ghost btn-sm mt3" id="gen-q">Work them out again</button>';
    }

    var ready = b.wins.filter(function (w) { return w.story; }).length;
    var html =
      '<div class="page-head">' +
        '<div class="row between wrap g3">' +
          '<div><h1>' + esc(c.company) + ' brief</h1>' +
          '<p>Everything this campaign knows, on one page. Read it the night before.</p></div>' +
          '<button class="btn btn-secondary btn-sm" id="print">Print it</button>' +
        '</div>' +
      '</div>' +

      '<div class="bf-top">' +
        '<div><span class="cap">Role</span><b>' + esc(c.role) + '</b></div>' +
        (c.location ? '<div><span class="cap">Where</span><b>' + esc(c.location) + '</b></div>' : '') +
        '<div><span class="cap">Stories ready</span><b>' + ready + ' of ' + b.wins.length + '</b></div>' +
        '<div><span class="cap">Gaps</span><b>' + b.gaps.length + '</b></div>' +
        (/^https?:\/\//i.test(c.postingUrl || '')
          ? '<div><span class="cap">Posting</span><a href="' + esc(c.postingUrl) +
            '" target="_blank" rel="noopener noreferrer">the listing \u2197</a></div>'
          : '') +
      '</div>' +

      sec('lead', 'What you lead with', 'The three numbers and the story behind each one.', leadHTML()) +
      sec('questions', 'What they will ask', 'Worked out from this listing and your gaps, not from a list.', '<div id="qbox">' + questionsHTML() + '</div>') +
      sec('match', 'Where you line up', 'And what you have decided to say about the places you do not.', matchHTML()) +
      sec('people', 'Who you have talked to', 'What passed between you, and what they have said in public.', peopleHTML()) +
      sec('research', 'What ' + c.company + ' said', 'Specific things, said recently, that you can quote back.', researchHTML());

    var v = Shell.mount({
      nav: 'brief',
      crumbs: [{ label: 'Overview', href: '/' }, { label: c.company, href: '/c/' + c.id }, { label: 'Brief' }],
      html: html
    });

    function paintQ() { v.querySelector('#qbox').innerHTML = questionsHTML(); }

    UI.on(v, 'click', '#gen-q', function (e, el) {
      if (busy) return;
      busy = true;
      el.disabled = true;
      el.textContent = 'Working them out…';
      if (!AI.ready()) {
        Store.setQuestions(c.id, Store.questionsLocally(c));
        busy = false;
        paintQ();
        UI.toast('From the listing and your gaps. Claude does this properly.');
        return;
      }
      AI.interviewPrep(c).then(function (q) {
        Store.setQuestions(c.id, q);
        paintQ();
        UI.toast((q.likely || []).length + ' questions, with what you already have to answer them.');
      }).catch(function (err) {
        Store.setQuestions(c.id, Store.questionsLocally(c));
        paintQ();
        UI.toast('Claude could not (' + err.message + '). Fell back to the listing.');
      }).then(function () { busy = false; });
    });

    v.querySelector('#print').addEventListener('click', function () { window.print(); });
  };
})(window, document);

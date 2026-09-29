/* ==========================================================================
   views/prep.js — the conversation before you write anything.

   Two jobs, worked one item at a time: get the story behind each win you are
   leading with, and find something real to say about the things the listing
   asked for that your resume does not answer. What comes out goes on the page
   and into the messages.
   ========================================================================== */
(function (window, document) {
  'use strict';

  var esc = UI.esc;
  window.Views = window.Views || {};

  /* With no model configured, coach.js works the questions out of the same
     material a model would get: this listing line, this number, and what the
     person has said so far. It is not a script — the second question depends
     on what is missing from the first answer. */
  function ctxFor(c, a) {
    return { win: a.kind === 'story'
      ? Store.campaignWins(c).filter(function (w) { return w.id === a.ref; })[0]
      : null };
  }
  function said(history) {
    return history.filter(function (m) { return m.role === 'user'; })
                  .map(function (m) { return m.content; });
  }

  window.Views.prep = function (params) {
    var c = Store.campaign(params.id);
    if (!c) return Router.go('/', true);
    Store.touch(c.id);

    var agenda = Store.buildAgenda(c.id);
    var openId = (agenda.filter(function (x) { return !x.done; })[0] || agenda[0] || {}).id;
    var history = [];
    var turns = 0;
    var busy = false;
    var stage = 'open';

    var v = Shell.mount({
      nav: 'prep',
      crumbs: [{ label: 'Overview', href: '/' }, { label: c.company, href: '/c/' + c.id }, { label: 'Prep' }],
      actions: '<span class="chip" id="prep-chip"></span>' +
               '<a class="btn btn-secondary btn-sm" href="#/c/' + c.id + '/page">See the page</a>',
      html: '<div class="page-head"><h1>Before you write</h1>' +
            '<p>A résumé bullet is the headline. This is where the rest of it comes out, one thing at a time.</p></div>' +
            UI.tipHTML('prep-specifics') +
            (agenda.length
              ? '<div class="prep"><div id="agenda"></div><div id="talk"></div></div>'
              : '<div class="card"><div class="empty"><span class="art">◈</span>' +
                '<h2>Nothing to work on yet</h2><p>Add a company from a listing and the things worth nailing down show up here.</p>' +
                '<a class="btn btn-primary btn-lg" href="#/new">Add a company <span class="arr">→</span></a></div></div>')
    });
    if (!agenda.length) return;

    function item() { return agenda.filter(function (x) { return x.id === openId; })[0] || agenda[0]; }

    /* ---------------- the list of things to get through ---------------- */
    function paintAgenda() {
      var pr = Store.agendaProgress(c);
      v.querySelector('#agenda').innerHTML =
        '<div class="card p5">' +
          '<div class="row between wrap g2 mb4"><h3>Agenda</h3>' +
          '<span class="cap">' + pr.done + ' of ' + pr.total + '</span></div>' +
          '<div class="col g2">' + agenda.map(function (a) {
            return '<button class="agitem' + (a.id === openId ? ' on' : '') + (a.done ? ' done' : '') +
              '" data-ag="' + a.id + '"' + (a.id === openId ? ' aria-current="true"' : '') + '>' +
              '<span class="ag-tick"></span>' +
              '<span class="ag-main"><span class="ag-kind">' + (a.kind === 'gap' ? 'Gap' : 'Story') + '</span>' +
              '<span class="ag-label">' + esc(a.label) + '</span></span></button>';
          }).join('') + '</div>' +
          (pr.done === pr.total
            ? '<a class="btn btn-primary btn-sm mt4" href="#/c/' + c.id + '/sequence">Go and write it <span class="arr">→</span></a>'
            : '') +
        '</div>' +
        (Store.stories(c).length
          ? '<div class="card p5 mt4"><p class="cap mb3">In your words</p>' +
            Store.stories(c).map(function (a) {
              return '<p class="storyline">' + esc(a.text) + '</p>';
            }).join('') + '</div>'
          : '');

      var chip = document.getElementById('prep-chip');
      if (chip) {
        chip.className = 'chip' + (pr.done === pr.total ? ' chip-pos' : '');
        chip.innerHTML = '<b>' + pr.done + '</b> of <b>' + pr.total + '</b> nailed down';
      }
    }

    /* ---------------- the conversation ---------------- */
    function paintTalk() {
      var a = item();
      v.querySelector('#talk').innerHTML =
        '<div class="card assist-card prep-talk">' +
          '<div class="assist-head">' +
            '<span class="ag-kind">' + (a.kind === 'gap' ? 'Gap' : 'Story') + '</span>' +
            '<b>' + esc(a.label) + '</b>' +
          '</div>' +
          '<div class="assist-log" id="log"></div>' +
          '<form class="assist-in" id="ask-form">' +
            '<input id="ask-q" placeholder="Answer in your own words" autocomplete="off" aria-label="Your answer">' +
            '<button type="submit" aria-label="Send">↑</button></form>' +
        '</div>' +
        '<div class="row g2 wrap mt3">' +
          '<button class="btn btn-secondary btn-sm" id="save-it">Save what I said</button>' +
          '<button class="btn btn-ghost btn-sm" id="skip-it">Skip this one</button>' +
        '</div>';
      wireTalk();
    }

    function say(cls, text) {
      var log = v.querySelector('#log');
      if (!log) return null;
      log.insertAdjacentHTML('beforeend', '<div class="bubble ' + cls + '">' + esc(text) + '</div>');
      log.scrollTop = log.scrollHeight;
      return log.lastElementChild;
    }

    /* A reply lands as one or two short bubbles with a pause between them,
       the way someone types rather than the way a form submits. The pause is
       proportional to the line, capped so nobody waits on a long one. */
    function typing() {
      var log = v.querySelector('#log');
      if (!log) return null;
      log.insertAdjacentHTML('beforeend',
        '<div class="bubble ai typing" aria-hidden="true"><i></i><i></i><i></i></div>');
      log.scrollTop = log.scrollHeight;
      return log.lastElementChild;
    }
    function beat(text) { return Math.min(340 + String(text || '').length * 9, 1100); }

    function sayAll(bubbles, mine, then) {
      var i = 0;
      (function next() {
        if (openId !== mine || !v.querySelector('#log')) return;
        if (i >= bubbles.length) { if (then) then(); return; }
        var text = bubbles[i++];
        var dots = typing();
        setTimeout(function () {
          if (openId !== mine || !dots || !dots.isConnected) return;
          dots.remove();
          say('ai', text);
          next();
        }, beat(text));
      })();
    }

    function open(id) {
      openId = id;
      history = [];
      turns = 0;
      stage = 'open';
      paintAgenda();
      paintTalk();

      var a = item();
      if (a.done && a.text) {
        say('ai', 'You already answered this one:');
        say('me', a.text);
        say('ai', 'Say more and it gets replaced, or pick another on the left.');
        return;
      }
      if (!AI.ready()) {
        var first = Coach.turn(a, [], ctxFor(c, a));
        stage = first.stage;
        sayAll(first.bubbles, openId, function () {
          first.bubbles.forEach(function (t) {
            history.push({ role: 'assistant', content: t, stage: first.stage, want: first.want });
          });
        });
        return;
      }

      busy = true;
      var b = say('ai', '…');
      var mine = openId;                       /* the item this answer belongs to */
      AI.prepTurn(c, a, [{ role: 'user', content: 'Ask me your first question.' }])
        .then(function (out) {
          if (openId !== mine || !b.isConnected) return;
          b.textContent = out.reply;
          history.push({ role: 'assistant', content: out.reply });
        })
        .catch(function () { if (openId === mine && b.isConnected) b.textContent = Coach.opening(a, ctxFor(c, a)); })
        .then(function () { if (openId === mine) busy = false; });
    }

    function wireTalk() {
      v.querySelector('#ask-form').addEventListener('submit', function (e) {
        e.preventDefault();
        var i = v.querySelector('#ask-q');
        var text = i.value.trim();
        if (!text || busy) return;
        say('me', text);
        history.push({ role: 'user', content: text });
        i.value = '';
        turns += 1;

        var a = item();
        if (!AI.ready()) {
          /* no model: coach.js carries the conversation. It answers what was
             actually typed, mirrors a detail back before it asks the next
             thing, and stops when nothing is missing. */
          var mine = openId;
          busy = true;
          var out = Coach.turn(a, history, ctxFor(c, a));
          sayAll(out.bubbles, mine, function () {
            if (openId !== mine) return;
            out.bubbles.forEach(function (t) {
              history.push({ role: 'assistant', content: t, stage: out.stage,
                             want: out.want, story: out.story });
            });
            stage = out.stage;
            if (out.complete && out.story) {
              Store.answerAgenda(c.id, a.id, out.story);
              Store.completeTask(c.id, 't7');
              paintAgenda();
            }
            busy = false;
          });
          return;
        }

        busy = true;
        var b = say('ai', '…');
        var mine = openId;
        AI.prepTurn(c, a, history).then(function (out) {
          if (openId !== mine || !b.isConnected) return;
          b.textContent = out.reply;
          history.push({ role: 'assistant', content: out.reply });
          if (out.complete && out.story) {
            Store.answerAgenda(c.id, a.id, out.story);
            Store.completeTask(c.id, 't7');
            paintAgenda();
            say('ai', 'Saved. Pick the next one on the left.');
          }
        }).catch(function (err) {
          if (openId === mine && b.isConnected) b.textContent = 'That did not go through: ' + err.message;
        }).then(function () { if (openId === mine) busy = false; });
      });

      v.querySelector('#save-it').addEventListener('click', function () {
        var said = history.filter(function (m) { return m.role === 'user'; })
          .map(function (m) { return m.content; }).join(' ');
        if (!said) { UI.toast('Say something first.'); return; }
        Store.answerAgenda(c.id, item().id, said);
        Store.completeTask(c.id, 't7');
        paintAgenda();
        UI.toast('Saved in your words.');
      });
      v.querySelector('#skip-it').addEventListener('click', function () {
        var next = agenda.filter(function (x) { return !x.done && x.id !== openId; })[0];
        if (next) open(next.id);
        else UI.toast('That is everything.');
      });
    }

    UI.on(v, 'click', '[data-ag]', function (e, el) { open(el.dataset.ag); });

    paintAgenda();
    open(openId);
  };
})(window, document);

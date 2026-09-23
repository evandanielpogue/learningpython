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

  /* what to ask when there is no model to ask it */
  var CANNED = {
    story: ['What actually happened? Start where it went wrong.',
            'What did you do about it, in the order you did it?',
            'How did it end? A number if you have one.'],
    gap: ['Nothing on your résumé answers this. What is the closest thing you have done?',
          'What did that look like day to day?',
          'If you had to say this out loud in an interview, how would you put it?']
  };

  window.Views.prep = function (params) {
    var c = Store.campaign(params.id);
    if (!c) return Router.go('/', true);
    Store.touch(c.id);

    var agenda = Store.buildAgenda(c.id);
    var openId = (agenda.filter(function (x) { return !x.done; })[0] || agenda[0] || {}).id;
    var history = [];
    var turns = 0;
    var busy = false;

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
          '<div class="row between wrap g2 mb4"><h3>To get through</h3>' +
          '<span class="cap">' + pr.done + ' of ' + pr.total + '</span></div>' +
          '<div class="col g2">' + agenda.map(function (a) {
            return '<button class="agitem' + (a.id === openId ? ' on' : '') + (a.done ? ' done' : '') +
              '" data-ag="' + a.id + '">' +
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
            '<b>' + (a.kind === 'gap' ? 'They asked for: ' : 'Your win: ') + esc(a.label) + '</b>' +
            '<span class="hint">' + esc(a.ask) + '</span>' +
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
      log.insertAdjacentHTML('beforeend', '<div class="bubble ' + cls + '">' + esc(text) + '</div>');
      log.scrollTop = log.scrollHeight;
      return log.lastElementChild;
    }

    function open(id) {
      openId = id;
      history = [];
      turns = 0;
      paintAgenda();
      paintTalk();

      var a = item();
      if (a.done && a.text) {
        say('ai', 'You already answered this one:');
        say('me', a.text);
        say('ai', 'Say more and it gets replaced, or pick another on the left.');
        return;
      }
      if (!AI.ready()) return say('ai', CANNED[a.kind][0]);

      busy = true;
      var b = say('ai', '…');
      AI.prepTurn(c, a, [{ role: 'user', content: 'Ask me your first question.' }])
        .then(function (out) { b.textContent = out.reply; history.push({ role: 'assistant', content: out.reply }); })
        .catch(function () { b.textContent = CANNED[a.kind][0]; })
        .then(function () { busy = false; });
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
          /* no model: bank what they typed and walk the canned questions */
          Store.answerAgenda(c.id, a.id, history.filter(function (m) { return m.role === 'user'; })
            .map(function (m) { return m.content; }).join(' '));
          paintAgenda();
          setTimeout(function () {
            if (turns < CANNED[a.kind].length) say('ai', CANNED[a.kind][turns]);
            else say('ai', 'Good. That is banked. Pick the next one on the left.');
          }, 380);
          return;
        }

        busy = true;
        var b = say('ai', '…');
        AI.prepTurn(c, a, history).then(function (out) {
          b.textContent = out.reply;
          history.push({ role: 'assistant', content: out.reply });
          if (out.complete && out.story) {
            Store.answerAgenda(c.id, a.id, out.story);
            Store.completeTask(c.id, 't7');
            paintAgenda();
            say('ai', 'Saved. Pick the next one on the left.');
          }
        }).catch(function (err) {
          b.textContent = 'That did not go through: ' + err.message;
        }).then(function () { busy = false; });
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

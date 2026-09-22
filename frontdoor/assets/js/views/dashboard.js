/* ==========================================================================
   views/dashboard.js — overview, campaign list, empty state, settings
   ========================================================================== */
(function (window, document) {
  'use strict';

  var esc = UI.esc;

  function ringSVG(done, total) {
    var C = 2 * Math.PI * 17;
    var off = C - (done / total) * C;
    return '<svg class="ring" width="42" height="42" viewBox="0 0 42 42" aria-hidden="true">' +
      '<circle class="track" cx="21" cy="21" r="17"></circle>' +
      '<circle class="fill" cx="21" cy="21" r="17" stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '"></circle></svg>';
  }

  function taskList() {
    return Store.state.tasks.map(function (t) {
      return '<button class="task" data-task="' + t.id + '" aria-pressed="' + t.on + '">' +
        '<span class="tick"></span>' +
        '<span class="tt">' + esc(t.text) + '<em>' + esc(t.sub) + '</em></span>' +
        '<span class="cap">' + (t.on ? 'Done' : 'Open') + '</span></button>';
    }).join('');
  }

  function touchRow(t, i) {
    var cls = 'touch' + (t.status === 'sent' || t.status === 'replied' ? ' sent' : '');
    var badge = t.status === 'replied' ? '<span class="chip chip-pos">Replied</span>'
              : t.status === 'due'     ? '<span class="chip chip-accent">Due today</span>'
              : t.status === 'sent'    ? '<span class="chip">Sent</span>'
              : '<span class="chip">Queued</span>';
    return '<button class="' + cls + '" data-touch="' + i + '" style="--pc:var(' + t.colour + ')">' +
      '<span class="td">Day ' + t.day + '</span>' +
      '<span class="tw">' + esc(t.who) + '<em>' + esc(t.note) + '</em></span>' +
      badge +
      '<span class="tc">' + esc(t.channel) + '</span></button>';
  }

  /* ---- empty state ---------------------------------------------------- */
  function emptyHome() {
    return '<div class="card" style="overflow:hidden">' +
      '<div class="empty">' +
        '<span class="art">◎</span>' +
        '<h2>No campaign yet</h2>' +
        '<p>Pick one company you actually want to work at. Five people, ten touches, fourteen days, and a page written for them.</p>' +
        '<button class="btn btn-primary btn-lg" id="start-campaign">Start a campaign <span class="arr">→</span></button>' +
      '</div></div>';
  }

  /* ---- overview ------------------------------------------------------- */
  window.Views = window.Views || {};

  window.Views.home = function () {
    var c = Store.campaigns()[0];

    if (!c) {
      var v0 = Shell.mount({ nav: 'home', crumbs: [{ label: 'Overview' }], html: emptyHome() });
      v0.querySelector('#start-campaign').addEventListener('click', function () {
        Store.createSeedCampaign();
        UI.toast('Acme campaign created.');
        Router.go('/c/c_acme/people');
      });
      return;
    }

    var p = Store.taskProgress();
    var hour = new Date().getHours();
    var greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    var name = (Store.state.user && Store.state.user.name || 'there').split(' ')[0];
    var upNext = c.touches.map(function (t, i) { return { t: t, i: i }; })
      .filter(function (x) { return x.t.status === 'due' || x.t.status === 'queued'; }).slice(0, 3);

    var html =
      '<div class="page-head">' +
        '<h1>' + esc(greet) + ', ' + esc(name) + '</h1>' +
        '<p>One company at a time. Here is where ' + esc(c.company) + ' stands on day ' + c.day + '.</p>' +
      '</div>' +

      '<div class="card p5 mb4">' +
        '<div class="row g4" style="align-items:flex-start">' +
          ringSVG(p.done, p.total) +
          '<div class="col g2 grow">' +
            '<div class="row between wrap"><h3>Getting ' + esc(c.company) + ' off the ground</h3>' +
            '<span class="cap" id="ring-label">' + p.done + ' of ' + p.total + ' done</span></div>' +
            '<p class="dim" style="font-size:var(--fs-sm)">We filled the first two in from your résumé. The rest take about twenty minutes.</p>' +
          '</div>' +
        '</div>' +
        '<div class="mt3" id="tasks" style="display:grid;gap:1px">' + taskList() + '</div>' +
      '</div>' +

      '<div class="grid cols-3 mb4">' +
        '<div class="card hover p5"><p class="cap mb3">Touches sent</p><h2 class="mono">3</h2><p class="dimmer" style="font-size:var(--fs-sm)">of 10 planned</p></div>' +
        '<div class="card hover p5"><p class="cap mb3">Replies</p><h2 class="mono">1</h2><p class="dimmer" style="font-size:var(--fs-sm)">Dana, on day 1</p></div>' +
        '<div class="card hover p5"><p class="cap mb3">Page opens</p><h2 class="mono">' + c.views + '</h2><p class="dimmer" style="font-size:var(--fs-sm)">Last one ' + esc(c.lastView) + '</p></div>' +
      '</div>' +

      '<div class="card p5">' +
        '<div class="row between mb4"><h3>Up next</h3>' +
        '<a class="btn btn-ghost btn-sm" href="#/c/' + c.id + '/sequence">See all <span class="arr">→</span></a></div>' +
        '<div class="seq">' + upNext.map(function (x) { return touchRow(x.t, x.i); }).join('') + '</div>' +
      '</div>';

    var v = Shell.mount({
      nav: 'home',
      crumbs: [{ label: c.company, href: '/' }, { label: 'Overview' }],
      actions: '<span class="chip chip-pos">Day ' + c.day + ' of 14</span>' +
               '<a class="btn btn-secondary btn-sm" href="#/c/' + c.id + '/page">View page</a>',
      html: html
    });

    UI.on(v, 'click', '[data-task]', function (e, el) {
      var t = Store.toggleTask(el.dataset.task);
      var pr = Store.taskProgress();
      el.setAttribute('aria-pressed', t.on);
      el.querySelector('.cap').textContent = t.on ? 'Done' : 'Open';
      var C = 2 * Math.PI * 17;
      v.querySelector('.ring .fill').setAttribute('stroke-dashoffset', (C - (pr.done / pr.total) * C).toFixed(1));
      v.querySelector('#ring-label').textContent = pr.done + ' of ' + pr.total + ' done';
      if (t.on) UI.toast(pr.done === pr.total ? 'That is all of them. Go send the first message.' : 'Nice. ' + pr.done + ' of ' + pr.total + '.');
    });
    UI.on(v, 'click', '[data-touch]', function () { Router.go('/c/' + c.id + '/messages'); });
  };

  /* ---- settings ------------------------------------------------------- */
  window.Views.settings = function () {
    var pf = Store.state.profile;
    var u = Store.state.user;

    var html =
      '<div class="page-head"><h1>Settings</h1><p>Your profile feeds every message and every page. Change it here and it changes everywhere.</p></div>' +

      '<div class="card p5 mb4">' +
        '<h3 class="mb4">Account</h3>' +
        '<div class="grid cols-2">' +
          '<div class="field"><label for="s-name">Name</label><input class="input" id="s-name" value="' + esc(pf.name) + '"></div>' +
          '<div class="field"><label for="s-email">Email</label><input class="input" id="s-email" value="' + esc(u ? u.email : pf.email) + '"></div>' +
        '</div>' +
        '<div class="row mt4"><button class="btn btn-primary btn-sm" id="s-save">Save changes</button>' +
        '<span class="hint" id="s-saved" style="opacity:0;transition:opacity var(--t-2)">Saved</span></div>' +
      '</div>' +

      '<div class="card p5 mb4">' +
        '<h3 class="mb3">How you write</h3>' +
        '<p class="dim mb4" style="font-size:var(--fs-sm)">Pulled from the writing sample you handed over. Every draft starts from this.</p>' +
        '<div class="row wrap g2">' + pf.voice.traits.map(function (t) { return '<span class="chip chip-accent">' + esc(t) + '</span>'; }).join('') + '</div>' +
        '<p class="dim mt4" style="font-size:var(--fs-sm)">Reads like: short, leads with a number, one ask, no throat clearing.</p>' +
      '</div>' +

      '<div class="card p5 mb4">' +
        '<h3 class="mb3">Where your history came from</h3>' +
        '<div class="row between wrap g3">' +
          '<span class="dim" style="font-size:var(--fs-sm)">' +
            (pf.imported ? esc(pf.source) : 'Nothing imported yet') + '</span>' +
          '<button class="btn btn-secondary btn-sm" id="s-reimport">Import again</button>' +
        '</div>' +
      '</div>' +

      '<div class="card p5">' +
        '<h3 class="mb3">Danger zone</h3>' +
        '<p class="dim mb4" style="font-size:var(--fs-sm)">Everything lives in this browser. Clearing it cannot be undone.</p>' +
        '<button class="btn btn-danger btn-sm" id="s-reset">Clear all data</button>' +
      '</div>';

    var v = Shell.mount({ nav: 'settings', crumbs: [{ label: 'Settings' }], html: html });

    v.querySelector('#s-save').addEventListener('click', function () {
      Store.state.profile.name = v.querySelector('#s-name').value.trim() || pf.name;
      if (Store.state.user) Store.state.user.email = v.querySelector('#s-email').value.trim();
      Store.save();
      var f = v.querySelector('#s-saved');
      f.style.opacity = 1;
      setTimeout(function () { f.style.opacity = 0; }, 1600);
      UI.toast('Saved.');
    });
    v.querySelector('#s-reimport').addEventListener('click', function () { Router.go('/import'); });
    v.querySelector('#s-reset').addEventListener('click', function () {
      UI.confirm({ title: 'Clear all data?', body: 'The campaign, the profile and the sign in all go. You will land back at the login screen.', confirm: 'Clear it', danger: true })
        .then(function (ok) { if (ok) { Store.reset(); Router.go('/login'); location.reload(); } });
    });
  };
})(window, document);

/* ==========================================================================
   views/dashboard.js — the overview (every opportunity you are running)
   and settings. One company per row, each with its own checklist.
   ========================================================================== */
(function (window, document) {
  'use strict';

  var esc = UI.esc;
  window.Views = window.Views || {};

  function ringSVG(done, total, size) {
    var s = size || 42, r = (s / 2) - 4;
    var C = 2 * Math.PI * r;
    var off = C - (total ? done / total : 0) * C;
    return '<svg class="ring" width="' + s + '" height="' + s + '" viewBox="0 0 ' + s + ' ' + s + '" aria-hidden="true">' +
      '<circle class="track" cx="' + s / 2 + '" cy="' + s / 2 + '" r="' + r + '"></circle>' +
      '<circle class="fill" cx="' + s / 2 + '" cy="' + s / 2 + '" r="' + r + '" stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '"></circle></svg>';
  }
  window.Views.ringSVG = ringSVG;

  function nextUp(c) {
    var s = c.steps.filter(function (x) { return x.status === 'due'; })[0] ||
            c.steps.filter(function (x) { return x.status === 'queued'; })[0];
    if (!s) return c.steps.length ? 'Everything is sent' : 'No sequence yet';
    var p = c.contacts.filter(function (x) { return x.id === s.contact; })[0];
    return (p ? p.name : 'Nobody yet') + ' · ' + s.note;
  }

  /* ---- overview -------------------------------------------------------- */
  window.Views.home = function () {
    var list = Store.campaigns();
    var hour = new Date().getHours();
    var greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    var name = (Store.state.user && Store.state.user.name || 'there').split(' ')[0];
    var imported = Store.state.profile.imported;

    function oppCard(c) {
      var pr = Store.taskProgress(c);
      var due = c.steps.filter(function (s) { return s.status === 'due'; }).length;
      return '<a class="opp" href="#/c/' + c.id + '">' +
        '<div class="opp-ring">' + ringSVG(pr.done, pr.total, 44) +
          '<span class="opp-pct">' + pr.done + '/' + pr.total + '</span></div>' +
        '<div class="opp-main">' +
          '<div class="row g2 wrap" style="align-items:baseline">' +
            '<b class="opp-co">' + esc(c.company) + '</b>' +
            '<span class="opp-role">' + esc(c.role) + '</span>' +
          '</div>' +
          '<p class="opp-next">' + esc(nextUp(c)) + '</p>' +
        '</div>' +
        '<div class="opp-nums">' +
          '<span><b>' + c.contacts.length + '</b>people</span>' +
          '<span><b>' + c.sent + '</b>sent</span>' +
          '<span><b>' + c.replies + '</b>replies</span>' +
          '<span><b>' + c.views + '</b>opens</span>' +
        '</div>' +
        '<div class="opp-end">' +
          (due ? '<span class="chip chip-accent">' + due + ' due</span>'
               : '<span class="chip">Day ' + c.day + '</span>') +
          '<span class="arr">→</span>' +
        '</div></a>';
    }

    var html =
      '<div class="page-head">' +
        '<h1>' + esc(greet) + ', ' + esc(name) + '</h1>' +
        '<p>' + (list.length
          ? 'Every company you are working, and what each one is waiting on.'
          : 'Start with the company you actually want. Everything else is built from the listing.') + '</p>' +
      '</div>';

    if (!imported) {
      html += '<div class="card" style="overflow:hidden"><div class="empty">' +
        '<span class="art">↑</span><h2>Start with your résumé</h2>' +
        '<p>We read it once. Every company you add after that gets its wins picked from it, matched to the listing.</p>' +
        '<button class="btn btn-primary btn-lg" id="go-import">Add your résumé <span class="arr">→</span></button>' +
        '<p class="hint mt4">Want to look around first? <button class="linkish" id="go-demo">Load an example workspace</button></p>' +
        '</div></div>';
    } else if (!list.length) {
      html += '<div class="card" style="overflow:hidden"><div class="empty">' +
        '<span class="art">◎</span><h2>Add your first company</h2>' +
        '<p>Paste the job listing. We pull the role apart, pick the three wins that answer it, and go looking for the people behind the req.</p>' +
        '<button class="btn btn-primary btn-lg" id="go-new">Paste a job listing <span class="arr">→</span></button>' +
        '<p class="hint mt4">Or <button class="linkish" id="go-demo">load an example workspace</button> to see a finished one.</p>' +
        '</div></div>';
    } else {
      html += '<div class="opps">' + list.map(oppCard).join('') +
        '<button class="addrow addrow-lg" id="go-new">+ Add a company</button></div>';

      var totals = list.reduce(function (a, c) {
        a.sent += c.sent; a.rep += c.replies; a.views += c.views;
        a.due += c.steps.filter(function (s) { return s.status === 'due'; }).length;
        return a;
      }, { sent: 0, rep: 0, views: 0, due: 0 });

      html += '<div class="grid cols-4 mt5">' +
        '<div class="card hover p5"><p class="cap mb3">Companies</p><h2 class="mono">' + list.length + '</h2><p class="dimmer" style="font-size:var(--fs-sm)">running at once</p></div>' +
        '<div class="card hover p5"><p class="cap mb3">Due today</p><h2 class="mono">' + totals.due + '</h2><p class="dimmer" style="font-size:var(--fs-sm)">across all of them</p></div>' +
        '<div class="card hover p5"><p class="cap mb3">Replies</p><h2 class="mono">' + totals.rep + '</h2><p class="dimmer" style="font-size:var(--fs-sm)">of ' + totals.sent + ' sent</p></div>' +
        '<div class="card hover p5"><p class="cap mb3">Page opens</p><h2 class="mono">' + totals.views + '</h2><p class="dimmer" style="font-size:var(--fs-sm)">people reading</p></div>' +
        '</div>';
    }

    var v = Shell.mount({
      nav: 'home',
      crumbs: [{ label: 'Overview' }],
      actions: imported ? '<button class="btn btn-primary btn-sm" id="new-top">Add a company</button>' : '',
      html: html
    });

    UI.on(v, 'click', '#go-import', function () { Router.go('/import'); });
    UI.on(v, 'click', '#go-demo', function () {
      var c = Store.createSeedCampaign();
      UI.toast('Example loaded. Acme, three days in.');
      Router.go('/c/' + c.id);
    });
    UI.on(v, 'click', '#go-new', function () { Router.go('/new'); });
    var top = document.getElementById('new-top');
    if (top) top.addEventListener('click', function () { Router.go('/new'); });
  };

  /* ---- settings -------------------------------------------------------- */
  window.Views.settings = function () {
    var pf = Store.state.profile;
    var u = Store.state.user;

    var html =
      '<div class="page-head"><h1>Settings</h1><p>Your profile feeds every message and every page. Change it here and it changes everywhere.</p></div>' +

      '<div class="card p5 mb4">' +
        '<h3 class="mb4">You</h3>' +
        '<div class="row g4 wrap" style="align-items:flex-start">' +
          '<div class="photo-set">' +
            '<div class="photo-ring" id="photo-prev">' + Views.photoHTML(88) + '</div>' +
            '<label class="btn btn-secondary btn-sm" for="photo-in">' + (pf.photo ? 'Replace' : 'Add a photo') + '</label>' +
            '<input type="file" id="photo-in" accept="image/*" hidden>' +
            (pf.photo ? '<button class="btn btn-ghost btn-sm" id="photo-clear">Remove</button>' : '') +
          '</div>' +
          '<div class="grow" style="min-width:260px">' +
            '<div class="grid cols-2">' +
              '<div class="field"><label for="s-name">Name</label><input class="input" id="s-name" value="' + esc(pf.name) + '"></div>' +
              '<div class="field"><label for="s-email">Email</label><input class="input" id="s-email" value="' + esc(u ? u.email : pf.email) + '"></div>' +
              '<div class="field"><label for="s-phone">Phone</label><input class="input" id="s-phone" value="' + esc(pf.phone) + '"></div>' +
              '<div class="field"><label for="s-loc">Where you are</label><input class="input" id="s-loc" value="' + esc(pf.location) + '"></div>' +
            '</div>' +
            '<div class="row mt4"><button class="btn btn-primary btn-sm" id="s-save">Save changes</button>' +
            '<span class="hint" id="s-saved" style="opacity:0;transition:opacity var(--t-2)">Saved</span></div>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="card p5 mb4">' +
        '<h3 class="mb3">How you write</h3>' +
        '<p class="dim mb4" style="font-size:var(--fs-sm)">Read off your own bullets. Every draft starts from this.</p>' +
        (pf.voice.traits.length
          ? '<div class="row wrap g2">' + pf.voice.traits.map(function (t) { return '<span class="chip chip-accent">' + esc(t) + '</span>'; }).join('') + '</div>'
          : '<p class="hint">Nothing read yet. Import a résumé and this fills in from how you write.</p>') +
      '</div>' +

      '<div class="card p5 mb4">' +
        '<h3 class="mb3">Where your history came from</h3>' +
        '<div class="row between wrap g3">' +
          '<span class="dim" style="font-size:var(--fs-sm)">' +
            (pf.imported ? esc(pf.source) + ' · ' + pf.roles.length + ' roles, ' + pf.wins.length + ' wins' : 'Nothing imported yet') + '</span>' +
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
      var pfx = Store.state.profile;
      pfx.name = v.querySelector('#s-name').value.trim() || pfx.name;
      pfx.phone = v.querySelector('#s-phone').value.trim();
      pfx.location = v.querySelector('#s-loc').value.trim();
      if (Store.state.user) {
        Store.state.user.email = v.querySelector('#s-email').value.trim();
        Store.state.user.name = pfx.name;
        Store.state.user.initials = Store.initials(pfx.name);
      }
      Store.save();
      var f = v.querySelector('#s-saved');
      f.style.opacity = 1;
      setTimeout(function () { f.style.opacity = 0; }, 1600);
      UI.toast('Saved.');
    });

    v.querySelector('#photo-in').addEventListener('change', function () {
      var file = this.files && this.files[0];
      if (!file) return;
      if (file.size > 900000) { UI.toast('That one is too big. Try something under 900KB.'); return; }
      var fr = new FileReader();
      fr.onload = function () {
        Store.setPhoto(fr.result);
        UI.toast('Photo added. It shows up on your page.');
        Views.settings();
      };
      fr.onerror = function () { UI.toast('Could not read that file.'); };
      fr.readAsDataURL(file);
    });
    var clear = v.querySelector('#photo-clear');
    if (clear) clear.addEventListener('click', function () { Store.setPhoto(null); Views.settings(); });

    v.querySelector('#s-reimport').addEventListener('click', function () { Router.go('/import'); });
    v.querySelector('#s-reset').addEventListener('click', function () {
      UI.confirm({ title: 'Clear all data?', body: 'Every company, the profile and the sign in all go. You will land back at the login screen.', confirm: 'Clear it', danger: true })
        .then(function (ok) { if (ok) { Store.reset(); Router.go('/login'); location.reload(); } });
    });
  };

  /* a portrait if there is one, initials if there is not */
  window.Views.photoHTML = function (size) {
    var pf = Store.state.profile;
    if (pf.photo) return '<img class="portrait" src="' + pf.photo + '" alt="' + esc(pf.name) + '" style="width:' + size + 'px;height:' + size + 'px">';
    return '<span class="portrait portrait-mono" style="width:' + size + 'px;height:' + size + 'px;font-size:' + Math.round(size / 2.6) + 'px">' +
      esc(Store.initials(pf.name)) + '</span>';
  };
})(window, document);

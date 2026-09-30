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

    /* One pipeline, five columns, every company sitting in the step it is
       actually on. A salesperson already reads a board this way: what is
       stuck, what is moving, what is nearly out the door. Dragging is not
       the point — the board is a picture of the truth, and the cards are
       the way into the work. */
    function card(c) {
      var next = Store.nextAction(c);
      var due = c.steps.filter(function (s) { return s.status === 'due'; }).length;
      var pr = Store.phaseProgress(c);
      return '<div class="pcard' + (due ? ' pcard-due' : '') + '">' +
        /* the card opens the company, not the step: the column already says
           which step it is on, and the company screen carries the strip and
           the next action */
        '<a class="pcard-id" href="#/c/' + c.id + '"' +
          ' title="' + esc(c.company + (next.done ? '' : ' \u2014 next: ' + next.label)) + '">' +
          '<b>' + esc(c.company) + (c.example ? ' <span class="chip chip-xs">Example</span>' : '') + '</b>' +
          '<span class="pcard-role">' + esc(c.role || 'None') + '</span></a>' +
        '<div class="pcard-foot">' +
          '<span class="pcard-dots" aria-label="' + pr.done + ' of ' + pr.total + ' steps done">' +
            Store.phases(c).map(function (st) {
              return '<i class="pdot' + (st.done ? ' on' : st.now ? ' here' : '') + '"></i>';
            }).join('') + '</span>' +
          (next.done ? '' : '<a class="pcard-next linkish" href="#' + next.href + '">' + esc(next.label) + ' \u2192</a>') +
          (due ? '<span class="chip chip-accent">' + due + ' due</span>'
               : c.replies ? '<span class="chip chip-pos">' + c.replies + ' replied</span>'
               : '<span class="pcard-day">Day ' + c.day + '</span>') +
          '<button class="icon-btn opp-x" data-drop="' + c.id + '" aria-label="' + (c.example ? 'Remove example ' : 'Remove ') + esc(c.company) + '" ' +
            'title="' + (c.example ? 'Remove example' : 'Remove') + '">' + Icon.svg('close', 13) + '</button>' +
        '</div></div>';
    }

    function boardHTML(list) {
      var phases = Store.PHASES;
      return '<div class="board">' + phases.map(function (def, i) {
        var here = list.filter(function (c) {
          var now = Store.phaseNow(c);
          return now ? now.key === def.key : def.key === 'interview';
        });
        return '<section class="bcol' + (here.length ? '' : ' bcol-empty') + '">' +
          '<div class="bcol-head">' +
            '<span class="bcol-n">' + def.n + '</span>' +
            '<span class="bcol-name">' + esc(def.label) + '</span>' +
            (here.length ? '<span class="bcol-count">' + here.length + '</span>' : '') +
          '</div>' +
          '<div class="bcol-body">' +
            (here.length ? here.map(card).join('') : '<span class="bcol-none"></span>') +
          '</div>' +
        '</section>';
      }).join('') + '</div>';
    }

    var html =
      '<div class="page-head"><h1>Overview</h1></div>';

    if (!imported) {
      html += '<div class="card" style="overflow:hidden"><div class="empty">' +
        '<span class="art">↑</span><h2>Start with your résumé</h2>' +
        '<button class="btn btn-primary btn-lg" id="go-import">Add your résumé <span class="arr">→</span></button>' +
        '<p class="hint mt4"><button class="linkish" id="go-demo">Load an example</button></p>' +
        '</div></div>';
    } else if (!list.length) {
      html += '<div class="card" style="overflow:hidden"><div class="empty">' +
        '<span class="art">◎</span><h2>Add a company</h2>' +
        '<button class="btn btn-primary btn-lg" id="go-new">Paste a listing <span class="arr">\u2192</span></button>' +
        '<p class="hint mt4"><button class="linkish" id="go-demo">Load an example</button></p>' +
        '</div></div>';
    } else {
      html += boardHTML(list) +
        '<button class="addrow addrow-lg mt4" id="go-new">+ Add a company</button>';

      function kpi(label, value, of) {
        return '<div class="card hover p5"><p class="cap mb3">' + esc(label) + '</p>' +
          '<p class="kpi mono"><span data-count="' + value + '">0</span>' +
          (of === undefined ? '' : '<span class="kpi-of">/' + of + '</span>') + '</p></div>';
      }

      var totals = list.reduce(function (a, c) {
        a.sent += c.sent; a.rep += c.replies; a.views += c.views;
        a.due += c.steps.filter(function (s) { return s.status === 'due'; }).length;
        return a;
      }, { sent: 0, rep: 0, views: 0, due: 0 });

      /* A figure and what it is. Nothing underneath narrating it: a
         denominator that matters goes into the figure, and anything that
         only restated the label is gone. */
      html += '<div class="grid cols-4 mt5">' +
        kpi('Companies', list.length) +
        kpi('Due today', totals.due) +
        kpi('Replies', totals.rep, totals.sent) +
        kpi('Page opens', totals.views) +
        '</div>';
    }

    var v = Shell.mount({
      nav: 'home',
      crumbs: [{ label: 'Overview' }],
      actions: imported ? '<button class="btn btn-primary btn-sm" id="new-top">Add a company</button>' : '',
      html: html
    });

    UI.on(v, 'click', '[data-drop]', function (e, el) {
      e.preventDefault();
      e.stopPropagation();
      var c = Store.campaign(el.dataset.drop);
      if (!c) return;
      UI.confirm({
        title: (c.example ? 'Remove example ' : 'Remove ') + c.company + '?',
        body: 'The people, the touches, the research and your stories go with it. This cannot be undone.',
        confirm: c.example ? 'Remove example' : 'Remove', danger: true
      }).then(function (ok) {
        if (!ok) return;
        Store.removeCampaign(c.id);
        Views.home();
        UI.toast(c.company + ' removed.');
      });
    });
    UI.on(v, 'click', '#go-import', function () { Router.go('/import'); });
    UI.on(v, 'click', '#go-demo', function () {
      var c = Store.createSeedCampaign();
      UI.toast('Example loaded.');
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
      '<div class="page-head"><h1>Settings</h1></div>' +

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
              '<div class="field"><label for="s-loc">Location</label><input class="input" id="s-loc" value="' + esc(pf.location) + '"></div>' +
            '</div>' +
            '<div class="row mt4"><button class="btn btn-primary btn-sm" id="s-save">Save</button>' +
            '<span class="hint" id="s-saved" style="opacity:0;transition:opacity var(--t-2)">Saved</span></div>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="card p5 mb4" id="ai-card">' +
        '<div class="row between wrap g3 mb3"><h3>Claude</h3>' +
        '<span class="chip' + (AI.ready() ? ' chip-pos' : '') + '" id="ai-state">' + esc(AI.describe()) + '</span></div>' +
        '<div class="segmented mb4" id="ai-mode">' +
          ['off', 'key', 'proxy'].map(function (m) {
            var label = m === 'off' ? 'No model' : m === 'key' ? 'My API key' : 'My server';
            return '<button class="seg' + (Store.state.ai.mode === m ? ' on' : '') + '" data-mode="' + m + '">' + label + '</button>';
          }).join('') +
        '</div>' +
        '<div id="ai-fields"></div>' +
      '</div>' +

      '<div class="card p5 mb4">' +
        '<h3 class="mb3">Voice</h3>' +
        (pf.voice.traits.length
          ? '<div class="row wrap g2">' + pf.voice.traits.map(function (t) { return '<span class="chip">' + esc(t) + '</span>'; }).join('') + '</div>'
          : '<p class="hint">None yet.</p>') +
      '</div>' +

      '<div class="card p5 mb4">' +
        '<h3 class="mb3">R\u00e9sum\u00e9</h3>' +
        '<div class="row between wrap g3">' +
          '<span class="dim" style="font-size:var(--fs-sm)">' +
            (pf.imported ? esc(pf.source) + ' · ' + pf.roles.length + ' roles, ' + pf.wins.length + ' wins' : 'Nothing imported yet') + '</span>' +
          '<button class="btn btn-secondary btn-sm" id="s-reimport">' + (pf.imported ? 'Replace' : 'Add') + '</button>' +
        '</div>' +
      '</div>' +

      '<div class="card p5">' +
        '<h3 class="mb3">Data</h3>' +
        '<button class="btn btn-danger btn-sm" id="s-reset">Clear all data</button>' +
      '</div>';

    var v = Shell.mount({ nav: 'settings', crumbs: [{ label: 'Settings' }], html: html });

    v.querySelector('#s-save').addEventListener('click', function () {
      var pfx = Store.state.profile;
      pfx.name = v.querySelector('#s-name').value.trim() || pfx.name;
      pfx.email = v.querySelector('#s-email').value.trim() || pfx.email;
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
      var fr = new FileReader();
      fr.onload = function () {
        /* everything lives in one 5MB localStorage blob, so a 900KB portrait
           is a third of the budget. 320px is plenty for a 112px slot. */
        var img = new Image();
        img.onload = function () {
          var n = 320, sc = Math.min(1, n / Math.max(img.width, img.height));
          var cv = document.createElement('canvas');
          cv.width = Math.round(img.width * sc); cv.height = Math.round(img.height * sc);
          cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
          var small;
          try { small = cv.toDataURL('image/jpeg', 0.82); } catch (e) { small = fr.result; }
          Store.setPhoto(small.length < String(fr.result).length ? small : fr.result);
          UI.toast('Photo added.');
          Views.settings();
        };
        img.onerror = function () { UI.toast('That did not look like an image.'); };
        img.src = fr.result;
      };
      fr.onerror = function () { UI.toast('Could not read that file.'); };
      fr.readAsDataURL(file);
    });
    var clear = v.querySelector('#photo-clear');
    if (clear) clear.addEventListener('click', function () { Store.setPhoto(null); Views.settings(); });

    /* ---- model settings ---- */
    function paintAI() {
      var a = Store.state.ai;
      var box = v.querySelector('#ai-fields');
      var models = '<div class="field"><label for="ai-model">Model</label><select class="input" id="ai-model">' +
        AI.MODELS.map(function (m) {
          return '<option value="' + m.id + '"' + (m.id === a.model ? ' selected' : '') + '>' + esc(m.name) + ' — ' + esc(m.note) + '</option>';
        }).join('') + '</select></div>';

      if (a.mode === 'off') {
        box.innerHTML = '<p class="hint">No model. Pattern matching only.</p>';
        return;
      }
      if (a.mode === 'key') {
        box.innerHTML =
          '<div class="field mb3"><label for="ai-key">Anthropic API key</label>' +
            '<input class="input mono" id="ai-key" type="password" autocomplete="off" spellcheck="false" ' +
            'placeholder="sk-ant-..." value="' + esc(a.key) + '"></div>' +
          models +
          '<p class="warnbox mt3">Stored in this browser. Use a key you can revoke.</p>' +
          '<div class="row g2 wrap mt3"><button class="btn btn-secondary btn-sm" id="ai-test">Test it</button>' +
          '<span class="hint" id="ai-msg"></span></div>';
      } else {
        box.innerHTML =
          '<div class="field mb3"><label for="ai-proxy">Your endpoint</label>' +
            '<input class="input mono" id="ai-proxy" type="url" autocomplete="off" spellcheck="false" ' +
            'placeholder="https://your-server.example.com/claude" value="' + esc(a.proxy) + '"></div>' +
          models +
          '<p class="hint mt3">Must be https.</p>' +
          '<div class="row g2 wrap mt3"><button class="btn btn-secondary btn-sm" id="ai-test">Test it</button>' +
          '<span class="hint" id="ai-msg"></span></div>';
      }

      var key = box.querySelector('#ai-key');
      if (key) key.addEventListener('change', function () { Store.state.ai.key = this.value.trim(); Store.save(); paintState(); });
      var prox = box.querySelector('#ai-proxy');
      if (prox) prox.addEventListener('change', function () { Store.state.ai.proxy = this.value.trim(); Store.save(); paintState(); });
      var mod = box.querySelector('#ai-model');
      if (mod) mod.addEventListener('change', function () { Store.state.ai.model = this.value; Store.save(); paintState(); });

      var test = box.querySelector('#ai-test');
      if (test) test.addEventListener('click', function () {
        var out = box.querySelector('#ai-msg');
        if (key) { Store.state.ai.key = key.value.trim(); }
        if (prox) { Store.state.ai.proxy = prox.value.trim(); }
        Store.save();
        if (!AI.ready()) { out.textContent = 'Fill that in first.'; return; }
        out.textContent = 'Asking...';
        AI.test().then(function () {
          out.textContent = 'Working.';
          out.style.color = 'var(--pos)';
          paintState();
        }).catch(function (e) {
          out.textContent = e.message;
          out.style.color = 'var(--neg)';
        });
      });
    }
    function paintState() {
      var chip = v.querySelector('#ai-state');
      chip.textContent = AI.describe();
      chip.className = 'chip' + (AI.ready() ? ' chip-pos' : '');
    }
    UI.on(v, 'click', '[data-mode]', function (e, el) {
      Store.state.ai.mode = el.dataset.mode;
      Store.save();
      v.querySelectorAll('[data-mode]').forEach(function (b) { b.classList.toggle('on', b.dataset.mode === el.dataset.mode); });
      paintAI(); paintState();
    });
    paintAI();

    v.querySelector('#s-reimport').addEventListener('click', function () { Router.go('/import'); });
    v.querySelector('#s-reset').addEventListener('click', function () {
      UI.confirm({ title: 'Clear all data?', body: 'Every company, your profile and your sign-in are deleted. This cannot be undone.', confirm: 'Clear', danger: true })
        .then(function (ok) { if (ok) { Store.reset(); Router.go('/login'); location.reload(); } });
    });
  };

  /* a portrait if there is one, initials if there is not */
  window.Views.photoHTML = function (size) {
    var pf = Store.state.profile;
    if (pf.photo && /^data:image\//.test(pf.photo)) {
      return '<img class="portrait" src="' + esc(pf.photo) + '" alt="' + esc(pf.name) + '" ' +
        'style="width:' + size + 'px;height:' + size + 'px">';
    }
    return '<span class="portrait portrait-mono" style="width:' + size + 'px;height:' + size + 'px;font-size:' + Math.round(size / 2.6) + 'px">' +
      esc(Store.initials(pf.name)) + '</span>';
  };
})(window, document);

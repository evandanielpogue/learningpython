/* ==========================================================================
   views/importer.js — read a resume once. Which wins matter is decided per
   company, against that listing, so nothing is picked here.
   ========================================================================== */
(function (window, document) {
  'use strict';

  var esc = UI.esc;
  window.Views = window.Views || {};

  var TEXTY = /\.(txt|md|markdown|text|csv|json|rtf)$/i;
  var PDF = /\.pdf$/i;

  window.Views.importer = function () {
    var pf = Store.state.profile;
    var step = pf.imported ? 2 : 1;
    var parsed = null;
    var pending = '';

    function pips(active) {
      return '<div class="steps-bar">' + ['Your resume', 'Check it', 'Add a company'].map(function (l, i) {
        var n = i + 1;
        var st = n < active ? 'done' : n === active ? 'active' : 'todo';
        return '<span class="step-pip" data-state="' + st + '"><span class="n"><span>' + n + '</span></span>' + esc(l) + '</span>' +
          (i < 2 ? '<span style="color:var(--ink-4)">→</span>' : '');
      }).join('') + '</div>';
    }

    /* ------------------------------------------------------------ step 1 -- */
    function stepOne() {
      return pips(1) +
        '<div class="card p6">' +
          '<h3 class="mb2">Hand over your history</h3>' +
          '<p class="dim mb5" style="font-size:var(--fs-sm)">We read it once. Every company you add after this pulls from it.</p>' +
          '<label class="drop" id="drop" for="file-in">' +
            '<span class="drop-ic">↑</span>' +
            '<b>Drop your resume here</b>' +
            '<span class="hint">PDF, or plain text. Or click to choose a file.</span>' +
            '<input type="file" id="file-in" accept=".txt,.md,.rtf,.pdf,.doc,.docx,text/plain" hidden>' +
          '</label>' +
          '<p class="lookup-msg hide" id="file-msg"></p>' +

          '<div class="or"><span>or paste it</span></div>' +
          '<textarea class="input listing-in" id="paste" spellcheck="false" ' +
            'placeholder="Open your resume, select all, paste it here. Plain text is fine."></textarea>' +
          '<div class="row between wrap mt4 g3">' +
            '<button class="btn btn-ghost btn-sm" id="use-example">Use an example resume</button>' +
            '<button class="btn btn-primary" id="read" disabled>Read it <span class="arr">→</span></button>' +
          '</div>' +
        '</div>';
    }

    function wireOne(v) {
      var ta = v.querySelector('#paste');
      var go = v.querySelector('#read');
      var msg = v.querySelector('#file-msg');
      var drop = v.querySelector('#drop');

      function check() { go.disabled = ta.value.trim().length < 60; }
      ta.value = pending;
      check();
      ta.addEventListener('input', function () { pending = ta.value; check(); });

      function say(text, ok) {
        msg.classList.remove('hide');
        msg.classList.toggle('ok', !!ok);
        msg.textContent = text;
      }

      function take(file) {
        if (!file) return;
        if (PDF.test(file.name) || file.type === 'application/pdf') return takePdf(file);
        if (!TEXTY.test(file.name) && !/^text\//.test(file.type)) {
          say('We cannot read ' + (file.name.split('.').pop() || 'that').toUpperCase() +
            ' in the browser. Open it, select all, and paste it below.');
          ta.focus();
          return;
        }
        var fr = new FileReader();
        fr.onload = function () {
          ta.value = String(fr.result).replace(/\u0000/g, '');
          pending = ta.value;
          check();
          say('Read ' + file.name + '. Have a look, then read it in.', true);
        };
        fr.onerror = function () { say('Could not open that file.'); };
        fr.readAsText(file);
      }

      /* The PDF parser is a few hundred KB, so it is only fetched when a PDF
         actually turns up. No network, no parser, so we say so and fall back
         to the box underneath rather than leaving a spinner running. */
      function takePdf(file) {
        drop.classList.add('busy');
        say('Reading ' + file.name + '\u2026', true);
        Doc.readPdf(file).then(function (text) {
          drop.classList.remove('busy');
          if (!text || text.replace(/\s/g, '').length < 40) {
            say('That PDF has no text in it, only pictures of text. Paste it below instead.');
            ta.focus();
            return;
          }
          ta.value = text;
          pending = text;
          check();
          say('Read ' + file.name + '. Check it reads properly, then read it in.', true);
        }).catch(function (err) {
          drop.classList.remove('busy');
          say(err && err.message === 'offline'
            ? 'The PDF reader could not load, so we are offline or it is blocked. Paste the text below instead.'
            : 'Could not get the text out of that PDF. Paste it below instead.');
          ta.focus();
        });
      }

      v.querySelector('#file-in').addEventListener('change', function () { take(this.files && this.files[0]); });
      ['dragenter', 'dragover'].forEach(function (e) {
        drop.addEventListener(e, function (ev) { ev.preventDefault(); drop.classList.add('over'); });
      });
      ['dragleave', 'drop'].forEach(function (e) {
        drop.addEventListener(e, function (ev) { ev.preventDefault(); drop.classList.remove('over'); });
      });
      drop.addEventListener('drop', function (ev) {
        take(ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0]);
      });

      v.querySelector('#use-example').addEventListener('click', function () {
        ta.value = Store.EXAMPLE_RESUME;
        pending = ta.value;
        check();
        ta.focus();
      });

      go.addEventListener('click', function () {
        var src = pending === Store.EXAMPLE_RESUME ? 'the example resume' : 'your resume';
        var text = ta.value;

        function land(p, how) {
          Store.applyResume(p);
          Store.state.profile.readBy = how;
          Store.save();
          step = 2;
          paint();
          UI.toast(p.roles.length + ' roles and ' + p.wins.length + ' wins.');
        }

        if (!AI.ready()) return land(Store.parseResume(text, src), 'pattern');

        go.disabled = true;
        go.textContent = 'Reading\u2026';
        AI.readResume(text).then(function (data) {
          land(Store.fromModel(data, src), 'model');
        }).catch(function (err) {
          /* a resume still has to get in, so fall back rather than stop */
          UI.toast('Claude could not read it (' + err.message + '). Fell back to pattern matching.');
          land(Store.parseResume(text, src), 'pattern');
        });
      });
    }

    /* ------------------------------------------------------------ step 2 -- */
    function stepTwo() {
      var p = Store.state.profile;
      var missing = [];
      if (!p.name) missing.push('a name');
      if (!p.roles.length) missing.push('any roles');
      if (!p.wins.length) missing.push('a win with a number in it');

      return pips(2) +
        '<div class="card p6 mb4">' +
          '<div class="row between wrap mb3 g3"><h3>Here is what came out</h3>' +
          '<span class="chip' + (p.readBy === 'model' ? ' chip-pos' : '') + '">' +
            (p.readBy === 'model' ? 'Read by Claude' : 'Read by pattern matching') + '</span></div>' +
          '<p class="dim mb4" style="font-size:var(--fs-sm)">From ' + esc(p.source || 'your resume') +
          (p.readBy === 'model' ? '.' : '. <a href="#/settings">Turn on a model</a> and it reads this properly.') + '</p>' +
          (missing.length
            ? '<p class="lookup-msg mb4">We could not find ' + esc(missing.join(', ')) +
              '. Go back and paste more of it, or fix it in Settings later.</p>'
            : '') +
          '<dl class="facts mb5">' +
            '<div><dt>Name</dt><dd>' + esc(p.name || '—') + '</dd></div>' +
            '<div><dt>Where</dt><dd>' + esc(p.location || '—') + '</dd></div>' +
            '<div><dt>Email</dt><dd class="mono" style="font-size:var(--fs-sm)">' + esc(p.email || '—') + '</dd></div>' +
            (p.years ? '<div><dt>Years</dt><dd>' + p.years + '</dd></div>' : '') +
          '</dl>' +
          '<p class="cap mb3" style="margin-top:var(--s-5)">Roles</p>' +
          (p.roles.length
            ? '<div class="grid" style="gap:var(--s-2)" id="roles"></div>'
            : '<p class="hint">None found.</p>') +
        '</div>' +

        '<div class="card p6 mb4">' +
          '<h3 class="mb3">' + p.wins.length + ' win' + (p.wins.length === 1 ? '' : 's') + ' with a number in them</h3>' +
          (p.wins.length
            ? '<p class="dim mb4" style="font-size:var(--fs-sm)">Which three you lead with gets decided per company, against that listing.</p>' +
              '<div class="leadwins">' + p.wins.map(function (w) {
                return '<div><b>' + esc(w.metric) + '</b><span>' + esc(w.short) + '</span></div>';
              }).join('') + '</div>'
            : '<p class="hint">Nothing with a number in it. Bullets like "grew ARR 41%" are what we match against a listing.</p>') +
        '</div>' +

        (Store.state.profile.stack.length
          ? '<div class="card p6 mb4"><h3 class="mb3">Tools</h3><div class="row wrap g2">' +
            Store.state.profile.stack.map(function (t) { return '<span class="chip">' + esc(t) + '</span>'; }).join('') +
            '</div></div>'
          : '') +

        '<div class="row g2 wrap">' +
          '<button class="btn btn-primary" id="done-import">Looks right <span class="arr">→</span></button>' +
          '<button class="btn btn-ghost" id="redo-import">Read a different one</button>' +
        '</div>';
    }

    function wireTwo(v) {
      var rolesEl = v.querySelector('#roles');
      function paintRoles() {
        if (!rolesEl) return;
        rolesEl.innerHTML = Store.state.profile.roles.map(function (r) {
          return '<button class="opt" data-role="' + r.id + '" aria-pressed="' + r.on + '">' +
            '<span class="box"></span><span class="ot">' + esc(r.title || 'Untitled role') +
            '<em>' + esc([r.company, r.span].filter(Boolean).join(', ')) + '</em></span>' +
            '<span class="om mono">' + r.bullets.length + '</span></button>';
        }).join('');
      }
      paintRoles();
      UI.on(v, 'click', '[data-role]', function (e, el) { Store.toggleRole(el.dataset.role); paintRoles(); });

      v.querySelector('#done-import').addEventListener('click', function () {
        if (Store.campaigns().length) { UI.toast('Saved.'); Router.go('/'); return; }
        UI.toast('Saved. Now paste a job listing.');
        Router.go('/new');
      });
      v.querySelector('#redo-import').addEventListener('click', function () {
        step = 1; pending = ''; paint();
      });
    }

    function paint() {
      var v = Shell.mount({
        nav: 'home',
        crumbs: [{ label: 'Overview', href: '/' }, { label: 'Your resume' }],
        html: '<div class="page-head"><h1>Your history</h1>' +
              '<p>Two minutes of setup that every message and every page is built from.</p></div>' +
              (step === 1 ? stepOne() : stepTwo())
      });
      if (step === 1) wireOne(v); else wireTwo(v);
    }

    paint();
  };
})(window, document);

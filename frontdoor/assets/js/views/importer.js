/* ==========================================================================
   views/importer.js — read the résumé once. Which wins matter is decided
   per company, against the listing, so nothing is picked here.
   ========================================================================== */
(function (window, document) {
  'use strict';

  var esc = UI.esc;
  window.Views = window.Views || {};

  var SCAN = [
    ['Name and where you are', 'Chicago'],
    ['Roles', '3'],
    ['Wins with a number in them', '7'],
    ['Tools and methodology', '7'],
    ['How you write', 'from your summary']
  ];

  window.Views.importer = function () {
    var step = Store.state.profile.imported ? 2 : 1;

    function pips(active) {
      return '<div class="steps-bar">' + ['Import', 'Check it', 'Add a company'].map(function (l, i) {
        var n = i + 1;
        var state = n < active ? 'done' : n === active ? 'active' : 'todo';
        return '<span class="step-pip" data-state="' + state + '"><span class="n"><span>' + n + '</span></span>' + esc(l) + '</span>' +
          (i < 2 ? '<span style="color:var(--ink-4)">→</span>' : '');
      }).join('') + '</div>';
    }

    function paint() {
      var pf = Store.state.profile;
      var body;

      if (step === 1) {
        body = pips(1) +
          '<div class="card p6">' +
            '<h3 class="mb3">Where does your history live?</h3>' +
            '<p class="dim mb5" style="font-size:var(--fs-sm)">We read it once. Every company you add after this pulls from it.</p>' +
            '<div class="grid cols-2">' +
              '<button class="dropzone" data-src="linkedin.com/in/evanpogue"><span class="dz-ic dz-li">' + UI.liMark(18) + '</span><b>LinkedIn profile</b><span class="hint">Paste the URL</span></button>' +
              '<button class="dropzone" data-src="Evan_Pogue.pdf"><span class="dz-ic">↑</span><b>Résumé</b><span class="hint">PDF or Word</span></button>' +
            '</div>' +
            '<div class="hide mt5" id="scan-box"><p class="cap mb3" id="scan-src">Reading</p><div id="scan"></div></div>' +
          '</div>';
      } else {
        body = pips(2) +
          '<div class="card p6 mb4">' +
            '<div class="row between wrap mb3 g3"><h3>Here is what came out</h3>' +
            '<span class="cap">' + esc(pf.source || 'your résumé') + '</span></div>' +
            '<p class="dim mb5" style="font-size:var(--fs-sm)">Turn off anything you would not put in front of a hiring manager. Which of your wins to lead with gets decided per company, against that listing.</p>' +
            '<div class="grid" style="gap:var(--s-2)" id="roles"></div>' +
          '</div>' +

          '<div class="card p6 mb4">' +
            '<h3 class="mb3">' + pf.wins.length + ' wins with a number in them</h3>' +
            '<div class="row wrap g2">' + pf.wins.map(function (w) {
              return '<span class="chip"><b class="mono">' + esc(w.metric) + '</b> ' + esc(w.short) + '</span>';
            }).join('') + '</div>' +
          '</div>' +

          '<div class="row g2 wrap">' +
            '<button class="btn btn-primary" id="done-import">Looks right <span class="arr">→</span></button>' +
            '<button class="btn btn-ghost" id="redo-import">Import something else</button>' +
          '</div>';
      }

      var v = Shell.mount({
        nav: 'home',
        crumbs: [{ label: 'Overview', href: '/' }, { label: 'Your history' }],
        html: '<div class="page-head"><h1>Your history</h1><p>Two minutes of setup that every message and page is built from.</p></div>' + body
      });

      if (step === 1) {
        UI.on(v, 'click', '[data-src]', function (e, el) {
          var src = el.dataset.src;
          v.querySelectorAll('.dropzone').forEach(function (d) { d.disabled = true; d.style.opacity = .4; });
          var box = v.querySelector('#scan-box');
          box.classList.remove('hide');
          v.querySelector('#scan-src').textContent = 'Reading ' + src;
          v.querySelector('#scan').innerHTML = SCAN.map(function (s, i) {
            return '<div class="scan-line" id="sl' + i + '"><span class="dot"></span><span>' + esc(s[0]) + '</span><em><span class="skel"></span></em></div>';
          }).join('');
          SCAN.forEach(function (s, i) {
            setTimeout(function () {
              var ln = v.querySelector('#sl' + i);
              if (!ln) return;
              ln.classList.add('done');
              ln.querySelector('em').textContent = s[1];
              if (i === SCAN.length - 1) {
                Store.markImported(src);
                setTimeout(function () { step = 2; paint(); UI.toast('Got it. Three roles, seven wins.'); }, 420);
              }
            }, 300 * (i + 1));
          });
        });
      } else {
        var rolesEl = v.querySelector('#roles');
        function paintRoles() {
          rolesEl.innerHTML = Store.state.profile.roles.map(function (r) {
            return '<button class="opt" data-role="' + r.id + '" aria-pressed="' + r.on + '">' +
              '<span class="box"></span><span class="ot">' + esc(r.title) + '<em>' + esc(r.company) + ', ' + esc(r.span) + '</em></span>' +
              '<span class="om mono">' + r.bullets.length + '</span></button>';
          }).join('');
        }
        paintRoles();
        UI.on(v, 'click', '[data-role]', function (e, el) { Store.toggleRole(el.dataset.role); paintRoles(); });

        v.querySelector('#done-import').addEventListener('click', function () {
          var first = Store.campaigns()[0];
          if (first) { UI.toast('Saved.'); Router.go('/'); return; }
          UI.toast('Saved. Now paste a job listing.');
          Router.go('/new');
        });
        v.querySelector('#redo-import').addEventListener('click', function () { step = 1; paint(); });
      }
    }

    paint();
  };
})(window, document);

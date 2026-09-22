/* ==========================================================================
   views/importer.js — the two step import wizard
   ========================================================================== */
(function (window, document) {
  'use strict';

  var esc = UI.esc;
  window.Views = window.Views || {};

  /* ======================================================================
     IMPORT WIZARD
     ====================================================================== */
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
      return '<div class="steps-bar">' + ['Import', 'Pick your wins', 'Done'].map(function (l, i) {
        var n = i + 1;
        var state = n < active ? 'done' : n === active ? 'active' : 'todo';
        return '<span class="step-pip" data-state="' + state + '"><span class="n"><span>' + n + '</span></span>' + esc(l) + '</span>' +
          (i < 2 ? '<span style="color:var(--ink-4)">→</span>' : '');
      }).join('') + '</div>';
    }

    function paint() {
      var pf = Store.state.profile;
      var picked = Store.selectedWins().length;
      var body;

      if (step === 1) {
        body = pips(1) +
          '<div class="card p6">' +
            '<h3 class="mb3">Where does your history live?</h3>' +
            '<p class="dim mb5" style="font-size:var(--fs-sm)">We read it once and use it for every campaign after this.</p>' +
            '<div class="grid cols-2">' +
              '<button class="dropzone" data-src="linkedin.com/in/evanpogue"><span class="dz-ic">in</span><b>LinkedIn profile</b><span class="hint">Paste the URL</span></button>' +
              '<button class="dropzone" data-src="Evan_Pogue.pdf"><span class="dz-ic">↑</span><b>Résumé</b><span class="hint">PDF or Word</span></button>' +
            '</div>' +
            '<div class="hide mt5" id="scan-box"><p class="cap mb3" id="scan-src">Reading</p><div id="scan"></div></div>' +
          '</div>';
      } else {
        body = pips(2) +
          '<div class="card p6 mb4">' +
            '<div class="row between wrap mb3"><h3>Which three go on the page?</h3><span class="cap">' + picked + ' of 3 picked</span></div>' +
            '<p class="dim mb5" style="font-size:var(--fs-sm)">Seven came out of ' + esc(pf.source || 'your résumé') + '. Pick the ones a sales leader would care about, not the ones you are proudest of.</p>' +
            '<div class="grid" style="gap:var(--s-2)" id="wins"></div>' +
          '</div>' +
          '<div class="card p6 mb4">' +
            '<h3 class="mb3">Roles to show</h3>' +
            '<div class="grid" style="gap:var(--s-2)" id="roles"></div>' +
          '</div>' +
          '<div class="row g2">' +
            '<button class="btn btn-primary" id="done-import">Looks right <span class="arr">→</span></button>' +
            '<button class="btn btn-ghost" id="redo-import">Import something else</button>' +
          '</div>';
      }

      var v = Shell.mount({
        nav: 'home',
        crumbs: [{ label: 'Overview', href: '/' }, { label: 'Import' }],
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
                Store.state.tasks[0].on = true;
                Store.save();
                setTimeout(function () { step = 2; paint(); UI.toast('Got it. Seven wins to choose from.'); }, 420);
              }
            }, 300 * (i + 1));
          });
        });
      } else {
        var winsEl = v.querySelector('#wins');
        var rolesEl = v.querySelector('#roles');

        function paintWins() {
          var n = Store.selectedWins().length;
          winsEl.innerHTML = Store.state.profile.wins.map(function (w) {
            var locked = !w.on && n >= 3;
            return '<button class="opt' + (locked ? ' locked' : '') + '" data-win="' + w.id + '" aria-pressed="' + w.on + '">' +
              '<span class="box"></span><span class="ot">' + esc(w.text) + '<em>' + esc(w.where) + '</em></span>' +
              '<span class="om">' + esc(w.metric) + '</span></button>';
          }).join('');
          var lab = v.querySelector('.cap');
          if (lab) lab.textContent = n + ' of 3 picked';
        }
        function paintRoles() {
          rolesEl.innerHTML = Store.state.profile.roles.map(function (r) {
            return '<button class="opt" data-role="' + r.id + '" aria-pressed="' + r.on + '">' +
              '<span class="box"></span><span class="ot">' + esc(r.title) + '<em>' + esc(r.company) + ', ' + esc(r.span) + '</em></span>' +
              '<span></span></button>';
          }).join('');
        }
        paintWins(); paintRoles();

        UI.on(v, 'click', '[data-win]', function (e, el) { Store.toggleWin(el.dataset.win); paintWins(); });
        UI.on(v, 'click', '[data-role]', function (e, el) { Store.toggleRole(el.dataset.role); paintRoles(); });

        v.querySelector('#done-import').addEventListener('click', function () {
          Store.state.tasks[1].on = true;
          Store.save();
          var c = Store.createSeedCampaign();
          UI.toast('Saved. Now pick who to talk to.');
          Router.go('/c/' + c.id + '/people');
        });
        v.querySelector('#redo-import').addEventListener('click', function () { step = 1; paint(); });
      }
    }

    paint();
  };

})(window, document);

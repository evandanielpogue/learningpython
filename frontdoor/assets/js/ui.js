/* ==========================================================================
   ui.js — shared primitives: escaping, toasts, modal, menu, command palette
   ========================================================================== */
(function (window, document) {
  'use strict';

  var UI = {};

  /* ---- helpers -------------------------------------------------------- */
  UI.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  UI.el = function (sel, root) { return (root || document).querySelector(sel); };
  UI.all = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  UI.on = function (root, event, sel, fn) {
    root.addEventListener(event, function (e) {
      var t = e.target.closest(sel);
      if (t && root.contains(t)) fn(e, t);
    });
  };

  /* ---- toasts --------------------------------------------------------- */
  var toastHost;
  UI.toast = function (msg, kind) {
    if (!toastHost) {
      toastHost = document.createElement('div');
      toastHost.className = 'toasts';
      document.body.appendChild(toastHost);
    }
    var t = document.createElement('div');
    t.className = 'toast' + (kind ? ' ' + kind : '');
    t.innerHTML = '<i></i><span>' + UI.esc(msg) + '</span>';
    toastHost.appendChild(t);
    setTimeout(function () {
      t.classList.add('leaving');
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 220);
    }, 3200);
  };

  /* ---- modal ---------------------------------------------------------- */
  UI.confirm = function (opts) {
    return new Promise(function (resolve) {
      var scrim = document.createElement('div');
      scrim.className = 'scrim modal-scrim';
      scrim.innerHTML =
        '<div class="modal" role="dialog" aria-modal="true" aria-label="' + UI.esc(opts.title) + '">' +
          '<h3>' + UI.esc(opts.title) + '</h3>' +
          '<p>' + UI.esc(opts.body || '') + '</p>' +
          '<div class="modal-actions">' +
            '<button class="btn btn-ghost" data-act="no">' + UI.esc(opts.cancel || 'Never mind') + '</button>' +
            '<button class="btn ' + (opts.danger ? 'btn-danger' : 'btn-primary') + '" data-act="yes">' +
              UI.esc(opts.confirm || 'Do it') + '</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(scrim);
      requestAnimationFrame(function () { scrim.classList.add('open'); });

      function done(v) {
        scrim.classList.remove('open');
        setTimeout(function () { if (scrim.parentNode) scrim.parentNode.removeChild(scrim); }, 200);
        document.removeEventListener('keydown', esc);
        resolve(v);
      }
      function esc(e) { if (e.key === 'Escape') done(false); }
      document.addEventListener('keydown', esc);
      scrim.addEventListener('click', function (e) {
        if (e.target === scrim) return done(false);
        var b = e.target.closest('[data-act]');
        if (b) done(b.dataset.act === 'yes');
      });
      setTimeout(function () { var y = scrim.querySelector('[data-act="yes"]'); if (y) y.focus(); }, 60);
    });
  };

  /* ---- dropdown menu -------------------------------------------------- */
  var openMenu = null;
  UI.menu = function (anchor, items) {
    UI.closeMenu();
    var m = document.createElement('div');
    m.className = 'menu';
    m.setAttribute('role', 'menu');
    m.innerHTML = items.map(function (it) {
      if (it.sep) return '<div class="menu-sep"></div>';
      return '<button role="menuitem" data-k="' + UI.esc(it.key) + '"' + (it.danger ? ' class="danger"' : '') + '>' +
        (it.icon ? '<span style="width:15px;display:grid;place-items:center;color:var(--ink-3)">' + it.icon + '</span>' : '') +
        UI.esc(it.label) + '</button>';
    }).join('');
    document.body.appendChild(m);

    var r = anchor.getBoundingClientRect();
    var top = r.bottom + 6;
    var left = r.left;
    if (left + m.offsetWidth > window.innerWidth - 12) left = window.innerWidth - m.offsetWidth - 12;
    if (top + m.offsetHeight > window.innerHeight - 12) top = r.top - m.offsetHeight - 6;
    m.style.top = Math.max(8, top) + 'px';
    m.style.left = Math.max(8, left) + 'px';

    m.addEventListener('click', function (e) {
      var b = e.target.closest('[data-k]');
      if (!b) return;
      var it = items.filter(function (x) { return x.key === b.dataset.k; })[0];
      UI.closeMenu();
      if (it && it.run) it.run();
    });
    openMenu = m;
    setTimeout(function () { document.addEventListener('click', outside); }, 0);
    document.addEventListener('keydown', escKey);

    function outside(e) { if (openMenu && !openMenu.contains(e.target)) UI.closeMenu(); }
    function escKey(e) { if (e.key === 'Escape') UI.closeMenu(); }
    UI._menuCleanup = function () {
      document.removeEventListener('click', outside);
      document.removeEventListener('keydown', escKey);
    };
  };
  UI.closeMenu = function () {
    if (UI._menuCleanup) { UI._menuCleanup(); UI._menuCleanup = null; }
    if (openMenu && openMenu.parentNode) openMenu.parentNode.removeChild(openMenu);
    openMenu = null;
  };

  /* ---- command palette ------------------------------------------------ */
  var pal = { scrim: null, input: null, list: null, items: [], shown: [], cursor: 0 };

  UI.paletteSource = function () { return []; };

  function paintPalette() {
    if (!pal.shown.length) {
      pal.list.innerHTML = '<div class="palette-empty">Nothing matches that.</div>';
      return;
    }
    var html = '', lastGroup = null;
    pal.shown.forEach(function (c, i) {
      if (c.group && c.group !== lastGroup) {
        html += '<p class="cap palette-group">' + UI.esc(c.group) + '</p>';
        lastGroup = c.group;
      }
      html += '<button class="palette-item' + (i === pal.cursor ? ' cursor' : '') + '" data-i="' + i + '">' +
        '<span class="pi">' + (c.icon || '•') + '</span><span>' + UI.esc(c.label) + '</span>' +
        (c.hint ? '<kbd>' + UI.esc(c.hint) + '</kbd>' : '') + '</button>';
    });
    pal.list.innerHTML = html;
    var cur = pal.list.querySelector('.cursor');
    if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest' });
  }

  function filterPalette() {
    var q = pal.input.value.trim().toLowerCase();
    pal.shown = !q ? pal.items : pal.items.filter(function (c) {
      return (c.label + ' ' + (c.group || '')).toLowerCase().indexOf(q) > -1;
    });
    pal.cursor = 0;
    paintPalette();
  }

  UI.openPalette = function () {
    pal.items = UI.paletteSource();
    pal.input.value = '';
    filterPalette();
    pal.scrim.classList.add('open');
    setTimeout(function () { pal.input.focus(); }, 50);
  };
  UI.closePalette = function () { pal.scrim.classList.remove('open'); };

  UI.mountPalette = function () {
    var s = document.createElement('div');
    s.className = 'scrim palette-scrim';
    s.innerHTML =
      '<div class="palette" role="dialog" aria-label="Command palette">' +
        '<div class="palette-input"><span style="color:var(--ink-3)">⌕</span>' +
          '<input id="pal-q" placeholder="Jump to, or run something" autocomplete="off" spellcheck="false"></div>' +
        '<div class="palette-list" id="pal-list"></div>' +
      '</div>';
    document.body.appendChild(s);
    pal.scrim = s;
    pal.input = s.querySelector('#pal-q');
    pal.list = s.querySelector('#pal-list');

    pal.input.addEventListener('input', filterPalette);
    pal.input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); pal.cursor = Math.min(pal.cursor + 1, pal.shown.length - 1); paintPalette(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); pal.cursor = Math.max(pal.cursor - 1, 0); paintPalette(); }
      else if (e.key === 'Enter') { e.preventDefault(); run(pal.shown[pal.cursor]); }
    });
    pal.list.addEventListener('click', function (e) {
      var b = e.target.closest('[data-i]');
      if (b) run(pal.shown[+b.dataset.i]);
    });
    s.addEventListener('click', function (e) { if (e.target === s) UI.closePalette(); });

    document.addEventListener('keydown', function (e) {
      var k = (e.key || '').toLowerCase();
      if ((e.metaKey || e.ctrlKey) && k === 'k') {
        e.preventDefault();
        s.classList.contains('open') ? UI.closePalette() : UI.openPalette();
      }
      if (e.key === 'Escape') UI.closePalette();
    });

    function run(c) { if (!c) return; UI.closePalette(); if (c.run) c.run(); }
  };

  /* ---- misc ----------------------------------------------------------- */
  UI.copy = function (text) {
    try { return navigator.clipboard.writeText(text); }
    catch (e) { return Promise.resolve(); }
  };

  UI.busy = function (btn, ms) {
    btn.classList.add('loading');
    return new Promise(function (r) {
      setTimeout(function () { btn.classList.remove('loading'); r(); }, ms || 700);
    });
  };

  window.UI = UI;
})(window, document);

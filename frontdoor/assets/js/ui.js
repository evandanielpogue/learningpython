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

  /* The real LinkedIn mark. A rounded square with two lowercase letters in
     it is every social app's icon, so draw the actual glyph instead. */
  UI.liMark = function (size) {
    var n = size || 18;
    return '<span class="li-mark" aria-hidden="true" style="width:' + n + 'px;height:' + n + 'px">' +
      '<svg viewBox="0 0 24 24" fill="currentColor" focusable="false">' +
      '<path d="M4.98 3.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM3.2 9.5h3.6v11H3.2v-11z' +
      'M9.6 9.5h3.45v1.5h.05c.5-.92 1.75-1.9 3.63-1.9 3.88 0 4.6 2.4 4.6 5.55v5.85h-3.6v-5.19' +
      'c0-1.24-.02-2.83-1.75-2.83-1.75 0-2.02 1.34-2.02 2.74v5.28H9.6v-11z"/></svg></span>';
  };

  /* A model call takes seconds, and in that time the user can switch steps,
     open another item or navigate away. Everything that lands late checks it
     is still wanted before it touches the DOM. */
  UI.stillHere = function (node) {
    var hash = location.hash;
    return function () {
      return location.hash === hash && (!node || node.isConnected);
    };
  };

  /* ---- tips ------------------------------------------------------------
     A tactic worth knowing, shown where you would use it. Dismissed once and
     it stays dismissed, because a tip you have read is clutter. -------- */
  var TIPS = {
    'find-contacts': {
      title: 'How to find who is actually hiring',
      body: 'Search LinkedIn for <b>hiring [role] at [company]</b> and filter to Posts. ' +
        'The people posting the role are the hiring manager and the recruiter, and a reply to ' +
        'their post lands better than anything sent through the portal.',
      cta: { label: 'Run that search', href: 'https://www.linkedin.com/search/results/content/?keywords=' }
    }
  };

  UI.tipSeen = function (id) {
    try { return window.localStorage.getItem('frontdoor.tip.' + id) === '1'; }
    catch (e) { return false; }
  };
  /* opts.q fills a search-shaped cta in, so the tip is one click from useful */
  UI.tipHTML = function (id, opts) {
    var t = TIPS[id];
    if (!t || UI.tipSeen(id)) return '';
    var href = t.cta ? t.cta.href + (opts && opts.q ? encodeURIComponent(opts.q) : '') : '';
    return '<div class="tip" data-tip="' + id + '">' +
      '<span class="tip-ic">' + (window.Icon ? Icon.svg('idea', 16) : '') + '</span>' +
      '<div class="tip-body"><b>' + UI.esc(t.title) + '</b><p>' + t.body + '</p>' +
        (t.cta ? '<a class="tip-cta" href="' + UI.esc(href) + '" target="_blank" rel="noopener noreferrer">' +
          UI.esc(t.cta.label) + ' \u2197</a>' : '') +
      '</div>' +
      '<button class="icon-btn" data-tip-close="' + id + '" aria-label="Dismiss this tip" title="Got it">' +
        (window.Icon ? Icon.svg('close', 14) : '\u2715') + '</button></div>';
  };
  /* one listener for every tip on the page */
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-tip-close]');
    if (!b) return;
    var id = b.dataset.tipClose;
    try { window.localStorage.setItem('frontdoor.tip.' + id, '1'); } catch (err) {}
    var box = b.closest('.tip');
    if (box) { box.classList.add('going'); setTimeout(function () { box.remove(); }, 180); }
  });

  /* ---- toasts --------------------------------------------------------- */
  var toastHost;
  UI.toast = function (msg, kind) {
    if (!toastHost) {
      toastHost = document.createElement('div');
      toastHost.className = 'toasts';
      toastHost.setAttribute('role', 'status');
      toastHost.setAttribute('aria-live', 'polite');
      toastHost.setAttribute('aria-atomic', 'false');
      document.body.appendChild(toastHost);
    }
    /* one at a time: a stack of toasts is a stack of things nobody read */
    while (toastHost.firstChild) toastHost.removeChild(toastHost.firstChild);
    var t = document.createElement('div');
    t.className = 'toast' + (kind ? ' ' + kind : '');
    t.innerHTML = '<i></i><span>' + UI.esc(msg) + '</span>';
    toastHost.appendChild(t);
    setTimeout(function () {
      t.classList.add('leaving');
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 220);
    }, 3200);
  };

  /* ---- focus containment ----------------------------------------------
     A dialog that does not hold focus is a dialog a keyboard user tabs
     straight out of, into a page they cannot see. Every overlay goes
     through here: the rest of the app is marked inert, Tab wraps inside
     the dialog, and whatever had focus gets it back on close. */
  var FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),' +
    'select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

  UI.trap = function (scrim) {
    var was = document.activeElement;
    var siblings = [];
    var kids = document.body.children, i;
    for (i = 0; i < kids.length; i++) {
      if (kids[i] !== scrim && !kids[i].inert) { kids[i].inert = true; siblings.push(kids[i]); }
    }
    function key(e) {
      if (e.key !== 'Tab') return;
      var f = [].filter.call(scrim.querySelectorAll(FOCUSABLE), function (n) {
        return n.offsetWidth || n.offsetHeight || n.getClientRects().length;
      });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || !scrim.contains(document.activeElement))) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    }
    document.addEventListener('keydown', key, true);
    return function release() {
      document.removeEventListener('keydown', key, true);
      siblings.forEach(function (n) { n.inert = false; });
      if (was && was.isConnected && was.focus) { try { was.focus(); } catch (e) {} }
    };
  };

  UI.clearToasts = function () {
    if (toastHost) while (toastHost.firstChild) toastHost.removeChild(toastHost.firstChild);
  };
  /* a toast belongs to the screen that raised it */
  window.addEventListener('hashchange', UI.clearToasts);

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
      var release = UI.trap(scrim);
      requestAnimationFrame(function () { scrim.classList.add('open'); });

      function done(v) {
        scrim.classList.remove('open');
        setTimeout(function () { if (scrim.parentNode) scrim.parentNode.removeChild(scrim); }, 200);
        document.removeEventListener('keydown', esc);
        release();
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

  UI.sheet = function (opts) {
    var scrim = document.createElement('div');
    scrim.className = 'scrim modal-scrim';
    scrim.innerHTML = '<div class="modal modal-wide' + (opts.cls ? ' ' + opts.cls : '') + '" role="dialog" aria-modal="true" aria-label="' + UI.esc(opts.title) + '">' +
      '<div class="row between"><h3>' + UI.esc(opts.title) + '</h3>' +
      '<button class="icon-btn" data-close aria-label="Close">✕</button></div>' + opts.html + '</div>';
    document.body.appendChild(scrim);
    var release = UI.trap(scrim);
    requestAnimationFrame(function () { scrim.classList.add('open'); });
    function close() {
      scrim.classList.remove('open');
      setTimeout(function () { if (scrim.parentNode) scrim.parentNode.removeChild(scrim); }, 200);
      document.removeEventListener('keydown', key);
      release();
    }
    function key(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', key);
    scrim.addEventListener('click', function (e) { if (e.target === scrim || e.target.closest('[data-close]')) close(); });
    /* hand the caller the node so it can wire its own controls without
       hanging a listener off the document that outlives the sheet */
    if (opts.onMount) opts.onMount(scrim.firstChild, close);
    setTimeout(function () {
      if (!scrim.isConnected || scrim.contains(document.activeElement)) return;
      var f = scrim.querySelector('input:not([type="hidden"]),textarea,select,button:not([data-close])') ||
              scrim.querySelector('[data-close]');
      if (f) try { f.focus(); } catch (e) {}
    }, 60);
    return close;
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
    if (pal.scrim.classList.contains('open')) return;
    pal.items = UI.paletteSource();
    pal.input.value = '';
    filterPalette();
    pal.scrim.classList.add('open');
    pal.release = UI.trap(pal.scrim);
    setTimeout(function () { pal.input.focus(); }, 50);
  };
  UI.closePalette = function () {
    if (!pal.scrim.classList.contains('open')) return;
    pal.scrim.classList.remove('open');
    if (pal.release) { pal.release(); pal.release = null; }
  };

  UI.mountPalette = function () {
    var s = document.createElement('div');
    s.className = 'scrim palette-scrim';
    s.innerHTML =
      '<div class="palette" role="dialog" aria-modal="true" aria-label="Command palette">' +
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

  /* ---- progress, and the feeling of it --------------------------------
     Three pieces, all of which take a fraction and show it moving: a meter
     for a row, a ring for a corner, and a counter for a figure. Each one
     starts at where it was and animates to where it is, because the point
     is the change, not the value. */

  UI.calm = function () {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch (e) { return false; }
  };

  UI.meterHTML = function (done, total, label) {
    var pct = total ? Math.round((done / total) * 100) : 0;
    return '<div class="meter-row">' +
        (label
          ? '<div class="meter-cap"><span>' + UI.esc(label) + '</span>' +
            '<b>' + done + '/' + total + '</b></div>'
          : '') +
        '<div class="meter' + (total && done >= total ? ' done' : '') + '" role="progressbar" ' +
          'aria-valuenow="' + done + '" aria-valuemin="0" aria-valuemax="' + total + '" ' +
          'aria-label="' + UI.esc(label || 'Progress') + '">' +
          '<span class="meter-fill" data-pct="' + pct + '"></span>' +
        '</div></div>';
  };

  /* the fill is written after a frame so the transition has somewhere to go */
  UI.fillMeters = function (root) {
    var fills = (root || document).querySelectorAll('.meter-fill[data-pct]');
    requestAnimationFrame(function () {
      [].forEach.call(fills, function (f) { f.style.width = f.dataset.pct + '%'; });
    });
  };

  UI.ringHTML = function (done, total, size) {
    size = size || 38;
    var r = 15.5, circ = 2 * Math.PI * r;
    var pct = total ? done / total : 0;
    return '<svg class="ring' + (total && done >= total ? ' done' : '') + '" viewBox="0 0 38 38" ' +
      'width="' + size + '" height="' + size + '" role="img" ' +
      'aria-label="' + done + ' of ' + total + ' done">' +
      '<circle class="ring-track" cx="19" cy="19" r="' + r + '"></circle>' +
      '<circle class="ring-fill" cx="19" cy="19" r="' + r + '" ' +
        'stroke-dasharray="' + circ.toFixed(1) + '" ' +
        'stroke-dashoffset="' + circ.toFixed(1) + '" ' +
        'data-off="' + (circ * (1 - pct)).toFixed(1) + '"></circle>' +
      '<text class="ring-label" x="19" y="19">' + done + '</text></svg>';
  };

  UI.fillRings = function (root) {
    var arcs = (root || document).querySelectorAll('.ring-fill[data-off]');
    requestAnimationFrame(function () {
      [].forEach.call(arcs, function (a) { a.setAttribute('stroke-dashoffset', a.dataset.off); });
    });
  };

  /* A figure climbs to its value. Short, eased, and it always lands exactly
     on the number — a counter that stops at 47 of 48 is worse than no
     counter at all. */
  UI.countUp = function (el, to, ms) {
    if (!el) return;
    var target = Number(to) || 0;
    el.classList.add('counting');
    if (UI.calm() || !target) { el.textContent = String(to); return; }
    var from = 0, start = null, dur = ms || 620;
    function step(t) {
      if (!el.isConnected) return;
      if (start === null) start = t;
      var k = Math.min((t - start) / dur, 1);
      var eased = 1 - Math.pow(1 - k, 3);
      el.textContent = String(Math.round(from + (target - from) * eased));
      if (k < 1) requestAnimationFrame(step);
      else el.textContent = String(to);   /* land on the real value, always */
    }
    requestAnimationFrame(step);
  };

  UI.countAll = function (root) {
    var els = (root || document).querySelectorAll('[data-count]');
    [].forEach.call(els, function (e) { UI.countUp(e, e.dataset.count); });
  };

  /* run every entrance in one call, from a view that has just painted */
  UI.animate = function (root) {
    UI.fillMeters(root);
    UI.fillRings(root);
    UI.countAll(root);
  };

  /* ---- the three moments ----------------------------------------------
     Reserved for finishing the agenda, the first reply, and the last message
     going out. Each fires once per campaign and is remembered, so nobody is
     congratulated twice for the same thing. Under reduced motion it is a
     toast — the news still arrives, it just does not fly. */
  var CHEER_COLOURS = ['--glow', '--brand', '--pos', '--p-recruiter', '--glow-deep'];

  function burst(host) {
    var w = window.innerWidth, h = window.innerHeight;
    var css = getComputedStyle(document.documentElement);
    var i, n = 34;
    for (i = 0; i < n; i++) {
      var s = document.createElement('span');
      var ang = (Math.PI * 2 * i) / n + Math.random() * 0.4;
      var dist = 140 + Math.random() * 260;
      s.className = 'confetti';
      s.style.left = (w / 2) + 'px';
      s.style.top = (h / 2) + 'px';
      s.style.background = css.getPropertyValue(CHEER_COLOURS[i % CHEER_COLOURS.length]).trim();
      s.style.setProperty('--dx', Math.cos(ang) * dist + 'px');
      s.style.setProperty('--dy', (Math.sin(ang) * dist + 180) + 'px');
      s.style.setProperty('--rot', Math.round(Math.random() * 720 - 360) + 'deg');
      s.style.setProperty('--dur', (1100 + Math.random() * 700) + 'ms');
      host.appendChild(s);
    }
  }

  UI.cheer = function (opts) {
    opts = opts || {};
    if (UI.calm()) { UI.toast(opts.title + ' ' + (opts.line || '')); return; }
    var layer = document.createElement('div');
    layer.className = 'cheer-layer';
    layer.setAttribute('role', 'status');
    layer.innerHTML =
      '<div class="cheer-card">' +
        '<div class="cheer-mark">' +
          '<svg class="tick-draw" width="22" height="22" viewBox="0 0 24 24" fill="none" ' +
            'stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" ' +
            'aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>' +
        '</div>' +
        '<h3>' + UI.esc(opts.title || 'Done') + '</h3>' +
        (opts.line ? '<p>' + UI.esc(opts.line) + '</p>' : '') +
      '</div>';
    document.body.appendChild(layer);
    burst(layer);
    setTimeout(function () { if (layer.parentNode) layer.parentNode.removeChild(layer); }, 2800);
  };

  /* fires only the first time this campaign reaches this milestone */
  UI.cheerOnce = function (campaignId, key, opts) {
    if (!Store.markCheered(campaignId, key)) return false;
    UI.cheer(opts);
    return true;
  };

  window.UI = UI;
})(window, document);

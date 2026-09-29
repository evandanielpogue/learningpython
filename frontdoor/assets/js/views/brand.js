/* ==========================================================================
   views/brand.js — the brand, on one screen.

   Not a product page: it is the reference, reachable from the command
   palette, so the next person to touch this reads the rules rather than
   guessing them from a screenshot.
   ========================================================================== */
(function (window, document) {
  'use strict';

  var esc = UI.esc;
  window.Views = window.Views || {};

  /* The hex is never written here — it is read out of the token at render
     time. A sheet that keeps its own copy of a colour is a sheet that goes
     out of date the first time the brand moves. */
  var SWATCHES = [
    { group: 'Brand',
      note: 'Porch carries every link, focus ring and active row. Glow is the light itself: ' +
            'fills, glints and the three moments. Glow never carries text.',
      items: [
        ['--brand', 'Porch', 'links, focus, the active row'],
        ['--brand-deep', 'Porch deep', 'hover and pressed'],
        ['--brand-wash', 'Porch wash', 'tips, active fills'],
        ['--glow', 'Glow', 'graphic only, never text'],
        ['--info', 'Threshold', 'neutral information, demoted'],
        ['--solid', 'Door', 'primary buttons']
      ] },
    { group: 'Ink and surface', note: 'Four inks, three lines. If a fifth is needed the layout is wrong.',
      items: [
        ['--ink', 'Ink', 'headings and body'],
        ['--ink-2', 'Ink 2', 'secondary text'],
        ['--ink-3', 'Ink 3', 'labels, captions'],
        ['--ink-4', 'Ink 4', 'the quietest ink that is still text'],
        ['--ink-faint', 'Faint', 'separators and dots, never text'],
        ['--bg', 'Canvas', 'the app behind the cards'],
        ['--panel', 'Panel', 'cards, inputs, sheets']
      ] },
    { group: 'Semantic', note: 'Meaning, never decoration. A green chip means it happened.',
      items: [
        ['--pos', 'Positive', 'replied, done, covered'],
        ['--warn', 'Warning', 'due, needs a name'],
        ['--neg', 'Negative', 'gaps, delete, errors']
      ] },
    { group: 'The five people', note: 'One hue each, assigned by who they are to you. All dark enough to take white initials.',
      items: [
        ['--p-peer', 'Peer', 'least to lose by helping'],
        ['--p-recruiter', 'Recruiter', 'owns the req'],
        ['--p-manager', 'Hiring manager', 'owns the number'],
        ['--p-exec', 'Skip level', 'one above them'],
        ['--p-tie', 'Shared tie', 'already knows you']
      ] }
  ];

  /* resolve a token to the hex the browser actually paints */
  function hexOf(token) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
    if (/^#/.test(v)) return v.toUpperCase();
    var probe = document.createElement('span');
    probe.style.color = v;
    document.body.appendChild(probe);
    var rgb = getComputedStyle(probe).color;
    probe.remove();
    var m = rgb.match(/(\d+),\s*(\d+),\s*(\d+)/);
    if (!m) return v;
    return '#' + [m[1], m[2], m[3]].map(function (n) {
      return ('0' + Number(n).toString(16)).slice(-2);
    }).join('').toUpperCase();
  }

  var ICONS = ['overview', 'company', 'prep', 'contacts', 'research', 'sequence', 'page',
               'templates', 'settings', 'search', 'email', 'call', 'reply', 'ats', 'text',
               'plus', 'arrow', 'check', 'upload', 'link', 'close', 'copy', 'play', 'idea'];

  window.Views.brand = function () {
    var html =
      '<div class="page-head"><h1>The brand</h1>' +
      '<p>A door, with the light left on. Everything here is a token: change it in one file and it changes everywhere.</p></div>' +

      '<div class="card p6 mb4">' +
        '<div class="brandhero">' +
          '<div class="brandhero-mark">' + Icon.mark(96) + '</div>' +
          '<div>' +
            '<h2 style="font-size:var(--fs-2xl);letter-spacing:-.035em">Frontdoor</h2>' +
            '<p class="brand-line">Go in the front.</p>' +
            '<p class="dim mt3" style="font-size:var(--fs-sm);max-width:52ch">The applicant tracking system is the back of the queue. ' +
            'The mark is a door with a light beside it, because the promise is that someone is expecting you.</p>' +
          '</div>' +
        '</div>' +
        '<div class="markrow">' +
          '<span class="markbox">' + Icon.mark(40) + '<em>40</em></span>' +
          '<span class="markbox">' + Icon.mark(24) + '<em>24</em></span>' +
          '<span class="markbox">' + Icon.mark(16) + '<em>16</em></span>' +
          '<span class="markbox dark">' + Icon.mark(24, true) + '<em>mono</em></span>' +
          '<span class="markbox"><img src="' + Icon.favicon() + '" width="24" height="24" alt="favicon"><em>tab</em></span>' +
        '</div>' +
      '</div>' +

      SWATCHES.map(function (s) {
        return '<div class="card p6 mb4">' +
          '<h3 class="mb2">' + esc(s.group) + '</h3>' +
          '<p class="dim mb5" style="font-size:var(--fs-sm)">' + esc(s.note) + '</p>' +
          '<div class="swatches">' + s.items.map(function (i) {
            return '<div class="swatch">' +
              '<span class="sw-chip" style="background:var(' + i[0] + ')"></span>' +
              '<b>' + esc(i[1]) + '</b>' +
              '<code>' + esc(hexOf(i[0])) + '</code>' +
              '<em>' + esc(i[2]) + '</em>' +
              '<span class="sw-tok mono">' + esc(i[0]) + '</span>' +
            '</div>';
          }).join('') + '</div></div>';
      }).join('') +

      '<div class="card p6 mb4">' +
        '<h3 class="mb2">Icons</h3>' +
        '<p class="dim mb5" style="font-size:var(--fs-sm)">One 24 grid, 1.7 stroke, round caps. Every icon inherits currentColor, so it is coloured by what it sits in and never carries a colour of its own.</p>' +
        '<div class="iconwall">' + ICONS.map(function (n) {
          return '<span class="iconcell">' + Icon.svg(n, 20) + '<em>' + esc(n) + '</em></span>';
        }).join('') + '</div>' +
      '</div>' +

      '<div class="card p6">' +
        '<h3 class="mb2">Type</h3>' +
        '<p class="dim mb5" style="font-size:var(--fs-sm)">Instrument Sans for everything you read, JetBrains Mono for anything you would copy: numbers, ids, drafts, keys.</p>' +
        '<p style="font-size:var(--fs-3xl);letter-spacing:-.035em;font-weight:680;line-height:1.1">Five people, ten touches</p>' +
        '<p style="font-size:var(--fs-lg);color:var(--ink-2);margin-top:var(--s-3)">One company at a time, worked properly.</p>' +
        '<p class="mono mt4" style="font-size:13px;color:var(--ink-2)">112% · $1.2M · 30→70 · day 3 of 14</p>' +
      '</div>';

    Shell.mount({ nav: '', crumbs: [{ label: 'The brand' }], html: html });
  };
})(window, document);

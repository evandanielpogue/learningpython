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

  var SWATCHES = [
    { group: 'Brand', note: 'Threshold carries every link, focus ring and active row. Porch is the light in the mark and nothing else.',
      items: [
        ['--brand', 'Threshold', '#0D6E88', '5.8:1 on white, both ways'],
        ['--brand-deep', 'Threshold deep', '#0A5E76', 'hover and pressed'],
        ['--brand-wash', 'Threshold wash', '#E9F3F7', 'tips, active fills'],
        ['--porch', 'Porch', '#D98A18', 'graphic only, never text'],
        ['--solid', 'Door', '#15181C', 'primary buttons']
      ] },
    { group: 'Ink and surface', note: 'Four inks, three lines. If a fifth is needed the layout is wrong.',
      items: [
        ['--ink', 'Ink', '#0F1214', 'headings and body'],
        ['--ink-2', 'Ink 2', '#555963', 'secondary text'],
        ['--ink-3', 'Ink 3', '#868B96', 'labels, captions'],
        ['--ink-4', 'Ink 4', '#B0B4BD', 'placeholders'],
        ['--bg', 'Canvas', '#F7F7F8', 'the app behind the cards'],
        ['--panel', 'Panel', '#FFFFFF', 'cards, inputs, sheets']
      ] },
    { group: 'Semantic', note: 'Meaning, never decoration. A green chip means it happened.',
      items: [
        ['--pos', 'Positive', '#0F7A50', 'replied, done, covered'],
        ['--warn', 'Warning', '#9A6206', 'due, needs a name'],
        ['--neg', 'Negative', '#BE3226', 'gaps, delete, errors']
      ] },
    { group: 'The five people', note: 'One hue each, assigned by who they are to you. All dark enough to take white initials.',
      items: [
        ['--p-peer', 'Peer', '#14785C', 'least to lose by helping'],
        ['--p-recruiter', 'Recruiter', '#6B4FC4', 'owns the req'],
        ['--p-manager', 'Hiring manager', '#0D6E88', 'owns the number'],
        ['--p-exec', 'Skip level', '#9A6206', 'one above them'],
        ['--p-tie', 'Shared tie', '#B03F63', 'already knows you']
      ] }
  ];

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
              '<code>' + esc(i[2]) + '</code>' +
              '<em>' + esc(i[3]) + '</em>' +
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

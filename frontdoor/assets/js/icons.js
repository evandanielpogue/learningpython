/* ==========================================================================
   icons.js — the icon set and the mark.

   One 24 grid, one 1.7 stroke, round caps and joins, drawn to read at 16px.
   Everything inherits currentColor, so an icon is coloured by the thing it
   sits in and never carries a colour of its own. Text glyphs were doing this
   job before, which meant the set changed shape with the font.
   ========================================================================== */
(function (window) {
  'use strict';

  /* paths only; the wrapper supplies the svg, stroke and size */
  var P = {
    /* navigation */
    overview:  '<path d="M4 6.5h6.5v5H4zM13.5 6.5H20v11h-6.5zM4 14.5h6.5v3H4z"/>',
    company:   '<path d="M4.5 20V5.2a1.2 1.2 0 0 1 1.2-1.2h7.6a1.2 1.2 0 0 1 1.2 1.2V20"/><path d="M14.5 10.5h3.8A1.2 1.2 0 0 1 19.5 11.7V20"/><path d="M3 20h18M8 8h3M8 11.5h3M8 15h3"/>',
    prep:      '<path d="M20 14.5a2 2 0 0 1-2 2h-6.5L7 20v-3.5H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2Z"/><path d="M9 8.5h6M9 12h3.5"/>',
    contacts:  '<circle cx="9" cy="8.5" r="3"/><path d="M3.5 19.5a5.5 5.5 0 0 1 11 0"/><path d="M16 5.8a3 3 0 0 1 0 5.4M17.5 14.6a5.5 5.5 0 0 1 3 4.9"/>',
    research:  '<circle cx="11" cy="11" r="6.5"/><path d="M15.8 15.8 20.5 20.5"/><path d="M8.6 11.4l1.8 1.8 3.4-3.6"/>',
    sequence:  '<circle cx="6" cy="6.5" r="2"/><circle cx="6" cy="17.5" r="2"/><path d="M6 8.5v7"/><path d="M11 6.5h9M11 17.5h9M11 12h6"/>',
    page:      '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M3.5 9h17M7 13h6M7 16h9"/>',
    templates: '<rect x="7.5" y="3.5" width="13" height="13" rx="2"/><path d="M16.5 20.5h-10a3 3 0 0 1-3-3v-10"/>',
    settings:  '<path d="M4 7.5h4M12.5 7.5H20M4 16.5h9M17 16.5h3"/><circle cx="10.2" cy="7.5" r="2.2"/><circle cx="14.8" cy="16.5" r="2.2"/>',
    search:    '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/>',

    /* channels */
    email:     '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.6 6.5 12 13l8.4-6.5"/>',
    call:      '<path d="M6.3 4h3l1.6 4-2 1.4a10.5 10.5 0 0 0 5.7 5.7l1.4-2 4 1.6v3a1.7 1.7 0 0 1-1.9 1.7A15.6 15.6 0 0 1 4.6 5.9 1.7 1.7 0 0 1 6.3 4Z"/>',
    reply:     '<path d="M9 5.5 3.5 11 9 16.5"/><path d="M3.5 11h10.8a5.7 5.7 0 0 1 5.7 5.7V19"/>',
    ats:       '<path d="M3.5 13.5h4l1.2 2.5h6.6l1.2-2.5h4"/><path d="M5.6 5.2A1.5 1.5 0 0 1 7 4.2h10a1.5 1.5 0 0 1 1.4 1l2.1 8.3v4A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5v-4Z"/>',
    text:      '<path d="M20.5 13.5a2 2 0 0 1-2 2H9l-4.5 3.5V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2Z"/>',

    /* actions and states */
    plus:      '<path d="M12 5v14M5 12h14"/>',
    arrow:     '<path d="M4.5 12h14M13 6.5 18.5 12 13 17.5"/>',
    check:     '<path d="M5 12.5 9.5 17 19 7"/>',
    upload:    '<path d="M12 16.5V4.5M7.5 9 12 4.5 16.5 9"/><path d="M4.5 15v3.5a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5V15"/>',
    link:      '<path d="M10.5 13.5a4 4 0 0 0 5.7 0l2.6-2.6a4 4 0 1 0-5.7-5.7l-1.4 1.4"/><path d="M13.5 10.5a4 4 0 0 0-5.7 0l-2.6 2.6a4 4 0 1 0 5.7 5.7l1.4-1.4"/>',
    close:     '<path d="M6 6l12 12M18 6 6 18"/>',
    copy:      '<rect x="8.5" y="8.5" width="12" height="12" rx="2"/><path d="M15.5 5.5h-9a2 2 0 0 0-2 2v9"/>',
    play:      '<path d="M8.5 5.5 18 12l-9.5 6.5Z"/>',
    idea:      '<path d="M9.5 18.5h5M10 21h4"/><path d="M12 2.8a6.2 6.2 0 0 1 3.7 11.2c-.6.45-.95 1.05-.95 1.7v.3h-5.5v-.3c0-.65-.35-1.25-.95-1.7A6.2 6.2 0 0 1 12 2.8Z"/>'
  };

  /* the light source in the mark, and anything that wants a filled look */
  var FILLED = { play: 1 };

  window.Icon = {
    has: function (name) { return !!P[name]; },

    /* an icon inherits its colour; it never sets one */
    svg: function (name, size) {
      var d = P[name];
      if (!d) return '';
      var n = size || 18;
      return '<svg class="ic" viewBox="0 0 24 24" width="' + n + '" height="' + n + '" ' +
        'fill="' + (FILLED[name] ? 'currentColor' : 'none') + '" stroke="currentColor" ' +
        'stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" ' +
        'aria-hidden="true" focusable="false">' + d + '</svg>';
    },

    /* The mark: a door, with the light left on beside it.
       Solid enough to survive a 16px favicon. */
    mark: function (size, mono) {
      var n = size || 24;
      var door = mono ? 'currentColor' : 'var(--solid)';
      var light = mono ? 'currentColor' : 'var(--porch)';
      return '<svg class="mark" viewBox="0 0 24 24" width="' + n + '" height="' + n + '" ' +
        'aria-hidden="true" focusable="false">' +
        '<path d="M4 4.4A2.4 2.4 0 0 1 6.4 2h7.2A2.4 2.4 0 0 1 16 4.4V22H4Z" fill="' + door + '"/>' +
        '<rect x="18" y="2" width="2.6" height="20" rx="1.3" fill="' + light + '"' +
          (mono ? ' opacity=".55"' : '') + '/>' +
        '<circle cx="12.9" cy="12.6" r="1.25" fill="#fff"' + (mono ? ' opacity=".9"' : '') + '/>' +
        '</svg>';
    },

    /* the same mark as a data URI, for the tab */
    favicon: function () {
      var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">' +
        '<rect width="24" height="24" rx="5" fill="#15181C"/>' +
        '<path d="M5.5 6.2A1.9 1.9 0 0 1 7.4 4.3h5.3a1.9 1.9 0 0 1 1.9 1.9V20H5.5Z" fill="#fff"/>' +
        '<rect x="16.1" y="4.3" width="2.4" height="15.7" rx="1.2" fill="#D98A18"/>' +
        '<circle cx="11.9" cy="12.6" r="1.1" fill="#15181C"/></svg>';
      return 'data:image/svg+xml,' + encodeURIComponent(svg);
    }
  };
})(window);

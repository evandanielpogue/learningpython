/* ==========================================================================
   views/shell.js — sidebar, topbar, and the mount point every app view
   renders into. Rebuilt only when the shell itself is not already up.
   ========================================================================== */
(function (window, document) {
  'use strict';

  var esc = UI.esc;
  /* `hint` is what the tooltip adds past the label. It earns its keep on the
     collapsed rail, where the label is hidden and an icon alone is a guess. */
  var NAV = [
    { group: 'Workspace', items: [
      { key: 'home', icon: '◉', label: 'Overview', href: '/', hint: 'where the campaign stands today', sc: 'G then O' }
    ] },
    { group: 'Campaign', needsCampaign: true, items: [
      { key: 'people',   icon: '◎', label: 'Contacts', href: '/c/:id/people',   count: 'contacts', hint: 'the people you are working, ranked', sc: 'G then P' },
      { key: 'research', icon: '◈', label: 'Research', href: '/c/:id/research', hint: 'what they said recently, in public', sc: 'G then R' },
      { key: 'sequence', icon: '≡', label: 'Sequence', href: '/c/:id/sequence', count: 'steps', hint: 'the touches and the days between them', sc: 'G then S' },
      { key: 'page',     icon: '▤', label: 'Page',     href: '/c/:id/page', hint: 'the public page you send them to' }
    ] },
    { group: 'Library', items: [
      { key: 'templates', icon: '❏', label: 'Templates', href: '/templates', hint: 'messages you reuse across steps', sc: 'G then T' },
      { key: 'settings',  icon: '⚙', label: 'Settings',  href: '/settings', hint: 'your name, role and wins' }
    ] }
  ];

  function tip(n) {
    var t = n.label;
    if (n.hint) t += ' — ' + n.hint;
    if (n.sc) t += '  (' + n.sc + ')';
    return t;
  }

  function activeCampaignId() {
    var cs = Store.campaigns();
    return cs.length ? cs[0].id : null;
  }

  function buildShell() {
    var root = document.getElementById('root');
    if (root.querySelector('.shell')) return;

    var u = Store.state.user || { name: 'You', email: '', initials: 'Y' };
    root.className = '';
    root.innerHTML =
      '<div class="shell">' +
        '<aside class="sidebar">' +
          '<a class="brand" href="#/" title="Frontdoor — back to the overview"><span class="glyph"></span><b>Frontdoor</b></a>' +
          '<button class="side-search" id="side-search" title="Search and jump anywhere  (\u2318K)"><span>⌕</span><span>Search</span><kbd>⌘K</kbd></button>' +
          '<nav class="side-nav" id="side-nav" aria-label="Sections"></nav>' +
          '<div class="side-foot">' +
            '<button class="user-btn" id="user-btn" title="' + esc(u.name) + ' — account, settings and sign out">' +
              '<span class="avatar avatar-sm" style="background:var(--p-recruiter)">' + esc(u.initials) + '</span>' +
              '<span class="grow"><span class="un">' + esc(u.name) + '</span>' +
              '<span class="ue">' + esc(u.email) + '</span></span>' +
              '<span style="color:var(--ink-4)">⌄</span>' +
            '</button>' +
          '</div>' +
        '</aside>' +
        '<div class="main">' +
          '<header class="topbar"><div class="crumbs" id="crumbs"></div><div class="row g2" id="top-actions"></div></header>' +
          '<div id="view"></div>' +
        '</div>' +
      '</div>';

    document.getElementById('side-search').addEventListener('click', UI.openPalette);
    document.getElementById('user-btn').addEventListener('click', function () {
      UI.menu(this, [
        { key: 'settings', icon: '⚙', label: 'Settings', run: function () { Router.go('/settings'); } },
        { key: 'help', icon: '?', label: 'How this works', run: function () { UI.toast('Five people, ten touches, fourteen days.'); } },
        { sep: true },
        { key: 'reset', icon: '↺', label: 'Reset the demo', run: function () {
          UI.confirm({ title: 'Clear everything?', body: 'This wipes the campaign and the profile out of this browser and drops you back at the sign in screen.', confirm: 'Clear it', danger: true })
            .then(function (ok) { if (ok) { Store.reset(); Router.go('/login'); location.reload(); } });
        } },
        { key: 'out', icon: '→', label: 'Sign out', danger: true, run: function () { Store.signOut(); Router.go('/login'); } }
      ]);
    });
  }

  function paintNav(activeKey) {
    var cid = activeCampaignId();
    var c = cid ? Store.campaign(cid) : null;
    document.getElementById('side-nav').innerHTML = NAV.map(function (g) {
      if (g.needsCampaign && !cid) return '';
      var items = g.items.map(function (n) {
        var href = n.href.replace(':id', cid || '');
        var count = '';
        if (c && n.count === 'contacts') count = String(c.contacts.length);
        if (c && n.count === 'steps') count = String(c.steps.length);
        return '<a class="nav-item" href="#' + href + '" data-key="' + n.key + '"' +
          ' title="' + esc(tip(n)) + '"' +
          (n.key === activeKey ? ' aria-current="page"' : '') + '>' +
          '<span class="nav-ico">' + n.icon + '</span>' +
          '<span class="nav-label">' + esc(n.label) + '</span>' +
          (count ? '<span class="nav-count">' + count + '</span>' : '') + '</a>';
      }).join('');
      return '<div class="nav-group"><p class="cap nav-group-label">' + esc(g.group) + '</p>' + items + '</div>';
    }).join('');
  }

  function paintCrumbs(trail) {
    document.getElementById('crumbs').innerHTML = trail.map(function (c, i) {
      var last = i === trail.length - 1;
      var node = c.href && !last ? '<a href="#' + c.href + '">' + esc(c.label) + '</a>'
                                 : (last ? '<b>' + esc(c.label) + '</b>' : esc(c.label));
      return (i ? '<span class="sep">/</span>' : '') + node;
    }).join('');
  }

  function paintActions(html) {
    document.getElementById('top-actions').innerHTML = html || '';
  }

  window.Shell = {
    mount: function (opts) {
      buildShell();
      paintNav(opts.nav);
      paintCrumbs(opts.crumbs || [{ label: 'Overview' }]);
      paintActions(opts.actions);
      var v = document.getElementById('view');
      v.className = 'view view-enter';
      v.innerHTML = opts.html;
      window.scrollTo({ top: 0 });
      return v;
    },
    activeCampaignId: activeCampaignId,
    teardown: function () { document.getElementById('root').innerHTML = ''; }
  };
})(window, document);

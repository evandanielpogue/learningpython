/* ==========================================================================
   views/shell.js — sidebar, topbar, and the mount point every app view
   renders into. Rebuilt only when the shell itself is not already up.
   ========================================================================== */
(function (window, document) {
  'use strict';

  var esc = UI.esc;
  var NAV = [
    { key: 'home',     icon: '◉', label: 'Overview',  href: '/' },
    { key: 'people',   icon: '◎', label: 'People',    href: '/c/:id/people',   needsCampaign: true, count: '5' },
    { key: 'sequence', icon: '≡', label: 'Sequence',  href: '/c/:id/sequence', needsCampaign: true, count: '10' },
    { key: 'messages', icon: '✎', label: 'Messages',  href: '/c/:id/messages', needsCampaign: true },
    { key: 'page',     icon: '▤', label: 'Page',      href: '/c/:id/page',     needsCampaign: true },
    { key: 'settings', icon: '⚙', label: 'Settings',  href: '/settings' }
  ];

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
          '<a class="brand" href="#/"><span class="glyph"></span><b>Frontdoor</b></a>' +
          '<button class="side-search" id="side-search"><span>⌕</span><span>Search</span><kbd>⌘K</kbd></button>' +
          '<div>' +
            '<p class="cap side-label">Acme campaign</p>' +
            '<nav class="side-nav" id="side-nav" aria-label="Sections"></nav>' +
          '</div>' +
          '<div class="side-foot">' +
            '<button class="user-btn" id="user-btn">' +
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
    document.getElementById('side-nav').innerHTML = NAV.map(function (n) {
      if (n.needsCampaign && !cid) return '';
      var href = n.href.replace(':id', cid || '');
      return '<a class="nav-item" href="#' + href + '" data-key="' + n.key + '"' +
        (n.key === activeKey ? ' aria-current="page"' : '') + '>' +
        '<span class="nav-ico">' + n.icon + '</span>' +
        '<span class="nav-label">' + esc(n.label) + '</span>' +
        (n.count ? '<span class="nav-count">' + n.count + '</span>' : '') + '</a>';
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

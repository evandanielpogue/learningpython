/* ==========================================================================
   main.js — wiring. Routes, palette contents, keyboard shortcuts, boot.
   ========================================================================== */
(function (window, document) {
  'use strict';

  /* opened inside claude.ai with no model set up: use the one it lends */
  if (window.AI && AI.whenPage) AI.whenPage().then(function (fn) {
    if (fn && Store.state.ai && Store.state.ai.mode === 'off') { Store.state.ai.mode = 'page'; Store.save(); }
  });

  Store.init();
  UI.mountPalette();

  /* ---- routes --------------------------------------------------------- */
  Router
    .add('/login',  Views.login,  { public: true })
    .add('/signup', Views.signup, { public: true })
    .add('/',        Views.home)
    .add('/new',     Views.newOpp)
    .add('/import',  Views.importer)
    .add('/settings', Views.settings)
    .add('/templates', Views.templates)
    .add('/brand',     Views.brand)
    .add('/c/:id',          Views.opportunity)
    .add('/c/:id/prep',     Views.prep)
    .add('/c/:id/people',   Views.people)
    .add('/c/:id/research', Views.research)
    .add('/c/:id/sequence', Views.sequence)
    .add('/c/:id/page',     Views.page)
    .add('/c/:id/brief',    Views.brief)
    .notFound(function () { Router.go(Store.isAuthed() ? '/' : (Store.hasAccount() ? '/login' : '/signup'), true); });

  /* ---- command palette contents --------------------------------------- */
  UI.paletteSource = function () {
    var cid = Shell.activeCampaignId();
    var items = [
      { group: 'Go to', icon: '◉', label: 'Overview', hint: 'G O', run: function () { Router.go('/'); } },
      { group: 'Do', icon: '+', label: 'Add a company', run: function () { Router.go('/new'); } }
    ];
    if (cid) {
      items.push(
        { group: 'Go to', icon: '◆', label: 'Role', hint: 'G C', run: function () { Router.go('/c/' + cid); } },
        { group: 'Go to', icon: '◍', label: 'Story', hint: 'G E', run: function () { Router.go('/c/' + cid + '/prep'); } },
        { group: 'Go to', icon: '◎', label: 'People', hint: 'G P', run: function () { Router.go('/c/' + cid + '/people'); } },
        { group: 'Go to', icon: '◈', label: 'Research', hint: 'G R', run: function () { Router.go('/c/' + cid + '/research'); } },
        { group: 'Go to', icon: '≡', label: 'Outreach', hint: 'G S', run: function () { Router.go('/c/' + cid + '/sequence'); } },
        { group: 'Go to', icon: '▤', label: 'Page', run: function () { Router.go('/c/' + cid + '/page'); } },
        { group: 'Go to', icon: '◫', label: 'Interview', hint: 'G B', run: function () { Router.go('/c/' + cid + '/brief'); } }
      );
    }
    items.push(
      { group: 'Go to', icon: '❏', label: 'Templates', run: function () { Router.go('/templates'); } },
      { group: 'Go to', icon: '⚙', label: 'Settings', run: function () { Router.go('/settings'); } },
      { group: 'Go to', icon: '◆', label: 'Brand', run: function () { Router.go('/brand'); } },
      { group: 'Do', icon: '↑', label: 'Replace résumé', run: function () { Router.go('/import'); } }
    );
    if (cid) {
      items.push(
        { group: 'Do', icon: '⧉', label: 'Copy page link', run: function () {
          var c = Store.campaign(cid);
          UI.copy('https://frontdoor.app/p/' + c.slug);
          UI.toast('Link copied.');
        } }
      );
    }
    items.push({ group: 'Account', icon: '→', label: 'Sign out', run: function () { Store.signOut(); Router.go('/login'); } });
    return items;
  };

  /* ---- g-then-key shortcuts ------------------------------------------- */
  var awaitingG = false, gTimer = null;
  document.addEventListener('keydown', function (e) {
    var tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || e.metaKey || e.ctrlKey || e.altKey) return;
    var k = (e.key || '').toLowerCase();
    var cid = Shell.activeCampaignId();

    if (awaitingG) {
      awaitingG = false;
      clearTimeout(gTimer);
      if (k === 'o') Router.go('/');
      else if (k === 'c' && cid) Router.go('/c/' + cid);
      else if (k === 'n') Router.go('/new');
      else if (k === 'p' && cid) Router.go('/c/' + cid + '/people');
      else if (k === 'e' && cid) Router.go('/c/' + cid + '/prep');
      else if (k === 'b' && cid) Router.go('/c/' + cid + '/brief');
      else if (k === 's' && cid) Router.go('/c/' + cid + '/sequence');
      else if (k === 'r' && cid) Router.go('/c/' + cid + '/research');
      else if (k === 't') Router.go('/templates');
      return;
    }
    if (k === 'g') {
      awaitingG = true;
      gTimer = setTimeout(function () { awaitingG = false; }, 1100);
    }
  });

  /* ---- boot ------------------------------------------------------------ */
  Router.start();
})(window, document);

/* ==========================================================================
   main.js — wiring. Routes, palette contents, keyboard shortcuts, boot.
   ========================================================================== */
(function (window, document) {
  'use strict';

  Store.init();
  UI.mountPalette();

  /* ---- routes --------------------------------------------------------- */
  Router
    .add('/login',  Views.login,  { public: true })
    .add('/signup', Views.signup, { public: true })
    .add('/',        Views.home)
    .add('/import',  Views.importer)
    .add('/settings', Views.settings)
    .add('/templates', Views.templates)
    .add('/c/:id/people',   Views.people)
    .add('/c/:id/research', Views.research)
    .add('/c/:id/sequence', Views.sequence)
    .add('/c/:id/messages', Views.messages)
    .add('/c/:id/page',     Views.page)
    .notFound(function () { Router.go(Store.isAuthed() ? '/' : '/login', true); });

  /* ---- command palette contents --------------------------------------- */
  UI.paletteSource = function () {
    var cid = Shell.activeCampaignId();
    var items = [
      { group: 'Go to', icon: '◉', label: 'Overview', hint: 'G O', run: function () { Router.go('/'); } }
    ];
    if (cid) {
      items.push(
        { group: 'Go to', icon: '◎', label: 'Contacts', hint: 'G P', run: function () { Router.go('/c/' + cid + '/people'); } },
        { group: 'Go to', icon: '◈', label: 'Research on the company and the people', hint: 'G R', run: function () { Router.go('/c/' + cid + '/research'); } },
        { group: 'Go to', icon: '≡', label: 'The fourteen day sequence', hint: 'G S', run: function () { Router.go('/c/' + cid + '/sequence'); } },
        { group: 'Go to', icon: '✎', label: 'Write day 3 to Marcus', hint: 'G M', run: function () { Router.go('/c/' + cid + '/messages'); } },
        { group: 'Go to', icon: '▤', label: 'Your public page', run: function () { Router.go('/c/' + cid + '/page'); } }
      );
    }
    items.push(
      { group: 'Go to', icon: '❏', label: 'Message templates', run: function () { Router.go('/templates'); } },
      { group: 'Go to', icon: '⚙', label: 'Settings', run: function () { Router.go('/settings'); } },
      { group: 'Do', icon: '↑', label: 'Import a résumé or LinkedIn profile', run: function () { Router.go('/import'); } }
    );
    if (cid) {
      items.push(
        { group: 'Do', icon: '⧉', label: 'Copy the public page link', run: function () {
          var c = Store.campaign(cid);
          UI.copy('https://frontdoor.app/p/' + c.slug);
          UI.toast('Link copied.');
        } },
        { group: 'Do', icon: '◈', label: 'Simulate a page view', run: function () {
          var c = Store.campaign(cid);
          c.views += 1; c.lastView = 'just now'; Store.save();
          UI.toast('Marcus opened your page. Just now.');
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
      else if (k === 'p' && cid) Router.go('/c/' + cid + '/people');
      else if (k === 's' && cid) Router.go('/c/' + cid + '/sequence');
      else if (k === 'm' && cid) Router.go('/c/' + cid + '/messages');
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

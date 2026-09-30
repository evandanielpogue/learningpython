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
      { key: 'home', icon: 'overview', label: 'Overview', href: '/', sc: 'G then O' }
    ] },
    { group: 'Account', items: [
      { key: 'settings',  icon: 'settings', label: 'Settings',  href: '/settings', sc: 'G then S' }
    ] }
  ];

  /* which step a route belongs to, so the rail can light the right one even
     when the screen you are on is a step's second screen */
  var OF_STAGE = {
    opp: 'role', prep: 'story', page: 'story',
    people: 'people', research: 'people',
    sequence: 'outreach', templates: 'outreach', brief: 'interview'
  };

  function tip(n) {
    var t = n.label;
    if (n.hint) t += ' — ' + n.hint;
    if (n.sc) t += '  (' + n.sc + ')';
    return t;
  }

  /* the campaign group follows the route you are on, then the last one you
     opened, so the nav never points at a company you are not looking at */
  function activeCampaignId() {
    var m = (location.hash || '').match(/#\/c\/([^\/]+)/);
    if (m && Store.campaign(m[1])) return m[1];
    if (Store.campaign(Store.state.lastCampaign)) return Store.state.lastCampaign;
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
        '<button class="skip" id="skip" type="button">Skip to content</button>' +
        '<aside class="sidebar">' +
          '<a class="brand" href="#/" title="Frontdoor — back to the overview">' + Icon.mark(24) + '<b>Frontdoor</b></a>' +
          '<button class="side-search" id="side-search" title="Search and jump anywhere  (\u2318K)">' + Icon.svg('search', 15) + '<span>Search</span><kbd>⌘K</kbd></button>' +
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
          '<div id="stepbar"></div>' +
          '<main id="view" class="view-host" tabindex="-1"></main>' +
        '</div>' +
      '</div>';

    document.getElementById('skip').addEventListener('click', function () {
      var v = document.getElementById('view');
      if (v) { v.focus(); v.scrollIntoView(); }
    });
    document.getElementById('side-search').addEventListener('click', UI.openPalette);
    document.getElementById('user-btn').addEventListener('click', function () {
      UI.menu(this, [

        { key: 'reset', icon: '↺', label: 'Clear all data', run: function () {
          UI.confirm({ title: 'Clear all data?', body: 'Every company, your profile and your sign-in are deleted. This cannot be undone.', confirm: 'Clear', danger: true })
            .then(function (ok) { if (ok) { Store.reset(); Router.go('/login'); location.reload(); } });
        } },
        { key: 'out', icon: '→', label: 'Sign out', danger: true, run: function () { Store.signOut(); Router.go('/login'); } }
      ]);
    });
  }

  function stepsHTML(c, activeKey) {
    var here = OF_STAGE[activeKey] || null;
    return Store.phases(c).map(function (st) {
      var on = st.key === here;
      var state = st.done ? 'done' : st.now ? 'now' : 'todo';
      var mark = st.done
        ? '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" ' +
          'stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
          '<path d="M20 6L9 17l-5-5"/></svg>'
        : String(st.n);
      return '<a class="nav-item step step-' + state + (on ? ' on' : '') + '" href="#' + st.href + '"' +
          ' data-step="' + st.key + '"' + (on ? ' aria-current="page"' : '') +
          ' title="' + esc('Step ' + st.n + ', ' + st.label + (st.done ? ' — done' : '')) + '">' +
          '<span class="step-mark" aria-hidden="true">' + mark + '</span>' +
          '<span class="nav-label">' + esc(st.label) + '</span>' +
          (st.part && st.part.total > 1 && !st.done
            ? '<span class="nav-count">' + st.part.done + '/' + st.part.total + '</span>'
            : '') +
        '</a>' +
        /* the step you are on opens up to show its second screen */
        (on && st.sub.length
          ? '<div class="step-sub">' + st.sub.map(function (x) {
              return '<a class="nav-sub" href="#' + x.href + '"' +
                (x.key === activeKey ? ' aria-current="page"' : '') + '>' + esc(x.label) + '</a>';
            }).join('') + '</div>'
          : '');
    }).join('');
  }

  function switcherHTML(c) {
    var pr = Store.phaseProgress(c);
    return '<button class="switch" id="co-switch" title="' + esc(c.company) + '">' +
      '<span class="switch-ring">' + UI.ringHTML(pr.done, pr.total, 26) + '</span>' +
      '<span class="switch-main"><span class="switch-co">' + esc(c.company) + '</span>' +
      '<span class="switch-role">' + esc(c.role || 'No role') + '</span></span>' +
      '<span class="switch-arr" aria-hidden="true">\u2304</span></button>';
  }

  function paintNav(activeKey) {
    var cid = activeCampaignId();
    var c = cid ? Store.campaign(cid) : null;
    var out = NAV[0].items.map(function (n) {
      return '<a class="nav-item" href="#' + n.href + '" data-key="' + n.key + '"' +
        ' title="' + esc(tip(n)) + '"' + (n.key === activeKey ? ' aria-current="page"' : '') + '>' +
        '<span class="nav-ico">' + Icon.svg(n.icon, 17) + '</span>' +
        '<span class="nav-label">' + esc(n.label) + '</span></a>';
    }).join('');

    var html = '<div class="nav-group">' + out + '</div>';

    if (c) {
      html += '<div class="nav-group nav-steps">' + switcherHTML(c) +
              stepsHTML(c, activeKey) + '</div>';
    }

    html += '<div class="nav-group nav-foot">' +
      NAV[1].items.map(function (n) {
        return '<a class="nav-item" href="#' + n.href + '" data-key="' + n.key + '"' +
          ' title="' + esc(tip(n)) + '"' + (n.key === activeKey ? ' aria-current="page"' : '') + '>' +
          '<span class="nav-ico">' + Icon.svg(n.icon, 17) + '</span>' +
          '<span class="nav-label">' + esc(n.label) + '</span></a>';
      }).join('') + '</div>';

    var host = document.getElementById('side-nav');
    host.innerHTML = html;
    UI.animate(host);

    var sw = document.getElementById('co-switch');
    if (sw) sw.addEventListener('click', function () {
      var items = Store.campaigns().map(function (x) {
        var pr = Store.phaseProgress(x);
        return {
          key: x.id,
          icon: x.id === c.id ? '\u2022' : '',
          label: x.company + '  ' + pr.done + '/' + pr.total,
          run: function () { Router.go('/c/' + x.id); }
        };
      });
      items.push({ sep: true });
      items.push({ key: 'add', icon: '+', label: 'Add a company', run: function () { Router.go('/new'); } });
      UI.menu(this, items);
    });
  }

  /* The same five steps as the overview, compact, above whatever screen you
     are on. It is the one piece of orientation that never moves: where you
     are, what is behind you, and what is next. */
  function paintStepbar(activeKey) {
    var host = document.getElementById('stepbar');
    if (!host) return;
    var here = OF_STAGE[activeKey];
    var cid = activeCampaignId();
    var c = here && cid ? Store.campaign(cid) : null;
    if (!c) { host.innerHTML = ''; host.className = ''; return; }

    var steps = Store.phases(c);
    var next = Store.nextAction(c, here);
    host.className = 'stepbar';
    host.innerHTML =
      '<nav class="track track-slim" aria-label="Where you are">' + steps.map(function (st, i) {
        var state = st.done ? 'done' : st.now ? 'now' : 'todo';
        var on = st.key === here;
        var mark = st.done
          ? '<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" ' +
            'stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
            '<path d="M20 6L9 17l-5-5"/></svg>'
          : String(st.n);
        return (i ? '<span class="tline' + (steps[i - 1].done ? ' done' : '') + '"></span>' : '') +
          '<a class="tnode t-' + state + (on ? ' t-here' : '') + '" href="#' + st.href + '"' +
            (on ? ' aria-current="step"' : '') +
            ' title="' + esc('Step ' + st.n + ', ' + st.label) + '">' +
            '<span class="tdot">' + mark + '</span>' +
            '<span class="tlab">' + esc(st.label) + '</span></a>';
      }).join('') + '</nav>' +
      (next.done
        ? '<span class="stepbar-next done">Done</span>'
        : '<a class="stepbar-next" href="#' + next.href + '">Next: ' + esc(next.label) +
          ' <span class="arr">\u2192</span></a>');
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
      paintStepbar(opts.nav);
      paintCrumbs(opts.crumbs || [{ label: 'Overview' }]);
      paintActions(opts.actions);
      var v = document.getElementById('view');
      v.className = 'view view-enter';
      v.innerHTML = opts.html;
      window.scrollTo({ top: 0 });
      /* every entrance animation in the view runs from here, so no view has
         to remember to start its own meters, rings and counters */
      UI.animate(v);
      return v;
    },
    activeCampaignId: activeCampaignId,
    teardown: function () { document.getElementById('root').innerHTML = ''; }
  };
})(window, document);

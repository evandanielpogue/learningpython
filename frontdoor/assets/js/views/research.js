/* ==========================================================================
   views/research.js — what the company and the people have said lately
   Each item carries a ready line you can drop straight into a message.
   ========================================================================== */
(function (window, document) {
  'use strict';

  var esc = UI.esc;
  window.Views = window.Views || {};

  window.Views.research = function (params) {
    var c = Store.campaign(params.id);
    if (!c) return Router.go('/', true);
    var tab = 'company';

    var v = Shell.mount({
      nav: 'research',
      crumbs: [{ label: c.company, href: '/' }, { label: 'Research' }],
      actions: '<button class="btn btn-secondary btn-sm" id="refresh">Refresh</button>',
      html: Views.tabs(c, 'research') +
        '<div class="page-head"><h1>What they said, recently, in public</h1>' +
        '<p>Nobody replies to a message that could have been sent to anyone. Take a line from here and the first sentence is already specific.</p></div>' +
        '<div class="subtabs" id="subtabs"></div>' +
        '<div id="feed"></div>'
    });

    function subtabs() {
      var names = [['company', c.company], ['people', 'People (' + c.contacts.length + ')']];
      v.querySelector('#subtabs').innerHTML = names.map(function (n) {
        return '<button class="subtab" data-sub="' + n[0] + '" aria-selected="' + (tab === n[0]) + '">' + esc(n[1]) + '</button>';
      }).join('');
    }

    function item(o, who) {
      return '<article class="feed-item">' +
        '<div class="fi-side"><span class="fi-kind">' + esc(o.kind) + '</span>' +
          '<span class="fi-when">' + esc(o.when || o.date) + '</span></div>' +
        '<div class="fi-main">' +
          (who ? '<p class="fi-who">' + esc(who) + '</p>' : '') +
          '<h4>' + esc(o.title || o.text) + '</h4>' +
          (o.detail ? '<p class="fi-detail">' + esc(o.detail) + '</p>' : '') +
          (o.source ? '<p class="fi-src">' + esc(o.source) + '</p>' : '') +
          '<div class="fi-use"><span class="fi-line">' + esc(o.use) + '</span>' +
            '<button class="btn btn-secondary btn-sm" data-use="' + esc(o.use) + '">Use this</button></div>' +
        '</div></article>';
    }

    function paint() {
      subtabs();
      var feed = v.querySelector('#feed');
      if (tab === 'company') {
        feed.innerHTML = '<div class="feed">' + c.research.map(function (o) { return item(o, null); }).join('') + '</div>';
      } else {
        var any = c.contacts.some(function (p) { return p.activity && p.activity.length; });
        feed.innerHTML = any
          ? '<div class="feed">' + c.contacts.map(function (p) {
              return (p.activity || []).map(function (a) { return item(a, p.name + ', ' + (p.title || p.persona)); }).join('');
            }).join('') + '</div>'
          : '<div class="card"><div class="empty"><span class="art">◎</span><h2>Nothing found for these people yet</h2>' +
            '<p>We check public posts, comments and interviews. Someone who never posts will come back empty, which is itself worth knowing.</p></div></div>';
      }
    }

    UI.on(v, 'click', '[data-sub]', function (e, el) { tab = el.dataset.sub; paint(); });
    UI.on(v, 'click', '[data-use]', function (e, el) {
      c.pendingInsert = el.dataset.use;
      Store.completeTask('t5');
      Store.save();
      UI.toast('Dropped into your draft.');
      Router.go('/c/' + c.id + '/messages');
    });
    document.getElementById('refresh').addEventListener('click', function () {
      var b = this;
      UI.busy(b, 900).then(function () { UI.toast('Nothing new since this morning.'); });
    });

    paint();
  };
})(window, document);

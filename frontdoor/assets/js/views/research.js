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
    Store.touch(c.id);
    var tab = 'company';

    var v = Shell.mount({
      nav: 'research',
      crumbs: [{ label: 'Overview', href: '/' }, { label: c.company, href: '/c/' + c.id }, { label: 'Research' }],
      actions: '<button class="btn btn-secondary btn-sm" id="add-find">Add something you found</button>' +
               '<button class="btn btn-secondary btn-sm" id="refresh">Refresh</button>',
      html:
        '<div class="page-head"><h1>What they said, recently, in public</h1>' +
        '<p>Nobody replies to a message that could have been sent to anyone. Take a line from here and the first sentence is already specific.</p></div>' +
        UI.tipHTML('research-where') +
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
        feed.innerHTML = c.research.length
          ? '<div class="feed">' + c.research.map(function (o) { return item(o, null); }).join('') + '</div>'
          : '<div class="card"><div class="empty"><span class="art">\u25c8</span>' +
            '<h2>Nothing on ' + esc(c.company) + ' yet</h2>' +
            '<p>Paste anything you come across: a post, a podcast line, a pricing change. One specific sentence is what separates a reply from a delete.</p>' +
            '<button class="btn btn-primary btn-lg" id="add-empty">Add what you found <span class="arr">\u2192</span></button></div></div>';
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
      Store.completeTask(c.id, 't4');
      Store.save();
      UI.toast('Dropped into your draft.');
      Router.go('/c/' + c.id + '/sequence');
    });
    function addSheet() {
      UI.sheet({
        title: 'Something you found',
        html: '<form id="res-form" class="col g3">' +
          '<div class="grid cols-2">' +
            '<div class="field"><label for="r-kind">What kind</label>' +
              '<select class="input" id="r-kind">' +
              ['Leadership', 'Product', 'Hiring', 'Funding', 'Earnings', 'Post', 'Podcast', 'Note']
                .map(function (k) { return '<option>' + k + '</option>'; }).join('') + '</select></div>' +
            '<div class="field"><label for="r-src">Where it came from</label>' +
              '<input class="input" id="r-src" placeholder="LinkedIn, their pricing page, a podcast"></div>' +
          '</div>' +
          '<div class="field"><label for="r-title">In a line</label>' +
            '<input class="input" id="r-title" placeholder="Moved SMB to a five seat minimum"></div>' +
          '<div class="field"><label for="r-detail">What it actually says</label>' +
            '<textarea class="input" id="r-detail" placeholder="Paste the post, or write what you took from it."></textarea></div>' +
          '<div class="field"><label for="r-use">The sentence you would put in a message</label>' +
            '<input class="input" id="r-use" placeholder="The five seat floor turns a one call close into a two call close."></div>' +
          '<div class="row g2 wrap"><button class="btn btn-primary btn-sm" type="submit">Add it</button></div></form>',
        onMount: function (node, close) {
          node.querySelector('#res-form').addEventListener('submit', function (e) {
            e.preventDefault();
            var title = node.querySelector('#r-title').value.trim();
            if (!title) { node.querySelector('#r-title').classList.add('err'); return; }
            Store.addResearch(c.id, {
              kind: node.querySelector('#r-kind').value,
              source: node.querySelector('#r-src').value.trim(),
              title: title,
              detail: node.querySelector('#r-detail').value.trim(),
              use: node.querySelector('#r-use').value.trim() || title
            });
            close();
            tab = 'company';
            paint();
            UI.toast('Added. Use it in a step when it fits.');
          });
          setTimeout(function () { node.querySelector('#r-title').focus(); }, 60);
        }
      });
    }
    UI.on(v, 'click', '#add-empty', addSheet);
    document.getElementById('add-find').addEventListener('click', addSheet);
    document.getElementById('refresh').addEventListener('click', function () {
      var b = this;
      UI.busy(b, 900).then(function () { UI.toast('Nothing new since this morning.'); });
    });

    paint();
  };
})(window, document);

/* ==========================================================================
   views/research.js — what the company and the people have said lately
   Each item carries a ready line you can drop straight into a touch.
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
      actions: '<button class="btn btn-secondary btn-sm" id="add-find">Add finding</button>' +
               '<button class="btn btn-secondary btn-sm" id="refresh">Check again</button>',
      html:
        '<div class="page-head"><h1>Research</h1></div>' +
        '<div class="subtabs" id="subtabs"></div>' +
        '<div id="feed"></div>'
    });

    function subtabs() {
      var names = [['company', c.company + ' (' + c.research.length + ')'],
                   ['people', 'People (' + c.contacts.length + ')'],
                   ['sources', 'Where to look']];
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
            '<button class="btn btn-primary btn-lg" id="add-empty">Add finding <span class="arr">\u2192</span></button></div></div>';
      } else if (tab === 'sources') {
        feed.innerHTML = sourcesHTML();
      } else {
        var any = c.contacts.some(function (p) { return p.activity && p.activity.length; });
        feed.innerHTML = any
          ? '<div class="feed">' + c.contacts.map(function (p) {
              return (p.activity || []).map(function (a) { return item(a, p.name + ', ' + (p.title || p.persona)); }).join('');
            }).join('') + '</div>'
          : '<div class="card"><div class="empty"><span class="art">◎</span><h2>Nothing on these people yet</h2></div></div>';
      }
    }

    /* ---------------- where to look ----------------
       Every row lands on a search that is already filled in. The ones behind
       a login say so: we send you and take a paste back rather than pretending
       to read a page we are not allowed to read. */
    function sourcesHTML() {
      return '' +
        Sources.groups().map(function (g) {
          return '<div class="card p5 mt4"><p class="cap mb3">' + esc(g.name) + '</p>' +
            '<div class="src-list">' + g.items.map(function (s) {
              return '<div class="src-row">' +
                '<div class="src-main">' +
                  '<b>' + esc(s.name) + '</b>' +
                  '<span class="src-tag ' + (s.access === 'login' ? 'src-login' : 'src-open') + '">' +
                    (s.access === 'login' ? 'login, paste back' : 'open') + '</span>' +
                  '<p>' + esc(s.good) + '</p>' +
                '</div>' +
                '<div class="src-acts">' +
                  '<a class="btn btn-ghost btn-sm" href="' + esc(s.url(c.company, c.role)) +
                    '" target="_blank" rel="noopener noreferrer">Open \u2197</a>' +
                  '<button class="btn btn-secondary btn-sm" data-paste="' + esc(s.id) + '">Paste what you found</button>' +
                '</div></div>';
            }).join('') + '</div></div>';
        }).join('');
    }

    var PASTE_COPY = {
      questions: { title: 'Interview questions you found',
        hint: 'One per line.' },
      customers: { title: 'What customers said',
        hint: 'One per line.' },
      notes:     { title: 'What you found',
        hint: 'One per line.' }
    };

    function pasteSheet(sid) {
      var src = Sources.get(sid);
      if (!src) return;
      var mode = src.paste || 'notes';
      var copy = PASTE_COPY[mode] || PASTE_COPY.notes;
      UI.sheet({
        title: copy.title + ' \u2014 ' + src.name,
        html: '<form id="paste-form" class="col g3">' +
          '<p class="dim" style="font-size:var(--fs-sm);line-height:1.6">' + esc(copy.hint) + '</p>' +
          '<div class="field"><label for="p-text">Paste it here</label>' +
            '<textarea class="input" id="p-text" rows="10"></textarea></div>' +
          '<div id="p-prev" class="src-prev"></div>' +
          '<div class="row g2 wrap"><button class="btn btn-primary btn-sm" type="submit">Keep these</button>' +
          '<span class="dim" id="p-count" style="font-size:var(--fs-sm)"></span></div></form>',
        onMount: function (node, close) {
          var box = node.querySelector('#p-text');
          var prev = node.querySelector('#p-prev');
          var count = node.querySelector('#p-count');
          function preview() {
            var items = Sources.parse(mode, box.value, src.name);
            count.textContent = items.length ? items.length + ' item' + (items.length === 1 ? '' : 's') : '';
            prev.innerHTML = items.slice(0, 6).map(function (i) {
              return '<div class="src-prev-row"><span class="fi-kind">' + esc(i.kind) + '</span>' +
                '<span>' + esc(i.title) + '</span></div>';
            }).join('') + (items.length > 6 ? '<p class="dim" style="font-size:var(--fs-xs)">and ' +
              (items.length - 6) + ' more</p>' : '');
          }
          box.addEventListener('input', preview);
          node.querySelector('#paste-form').addEventListener('submit', function (e) {
            e.preventDefault();
            var items = Sources.parse(mode, box.value, src.name);
            if (!items.length) { UI.toast('Nothing in there to keep.'); return; }
            items.forEach(function (i) { Store.addResearch(c.id, i); });
            close();
            tab = 'company';
            paint();
            UI.toast('Kept ' + items.length + '.');
          });
          setTimeout(function () { box.focus(); }, 60);
        }
      });
    }

    UI.on(v, 'click', '[data-paste]', function (e, el) { pasteSheet(el.dataset.paste); });
    UI.on(v, 'click', '[data-sub]', function (e, el) { tab = el.dataset.sub; paint(); });
    UI.on(v, 'click', '[data-use]', function (e, el) {
      c.pendingInsert = el.dataset.use;
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
          '<div class="field"><label for="r-use">The line you would use</label>' +
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
            UI.toast('Added.');
          });
          setTimeout(function () { node.querySelector('#r-title').focus(); }, 60);
        }
      });
    }
    UI.on(v, 'click', '[data-res-x]', function (e, el) {
      Store.removeResearch(c.id, el.dataset.resX);
      paint();
      UI.toast('Removed.');
    });
    UI.on(v, 'click', '#add-empty', addSheet);
    document.getElementById('add-find').addEventListener('click', addSheet);
    document.getElementById('refresh').addEventListener('click', function () {
      var b = this;
      UI.busy(b, 900).then(function () { UI.toast('Checked.'); });
    });

    paint();
  };
})(window, document);

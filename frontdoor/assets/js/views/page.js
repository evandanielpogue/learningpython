/* ==========================================================================
   views/page.js — the public account plan, plus the shared tab strip
   ========================================================================== */
(function (window, document) {
  'use strict';

  var esc = UI.esc;
  window.Views = window.Views || {};

  Views.tabs = function (c, active) {
    var T = [
      ['people',   'Contacts',  '/c/' + c.id + '/people'],
      ['research', 'Research',  '/c/' + c.id + '/research'],
      ['sequence', 'Sequence',  '/c/' + c.id + '/sequence'],
      ['messages', 'Messages',  '/c/' + c.id + '/messages'],
      ['page',     'Page',      '/c/' + c.id + '/page']
    ];
    return '<div class="tabs" role="tablist">' + T.map(function (t) {
      return '<a class="tab" role="tab" href="#' + t[2] + '" aria-selected="' + (t[0] === active) + '">' + t[1] + '</a>';
    }).join('') + '</div>';
  };

  window.Views.page = function (params) {
    var c = Store.campaign(params.id);
    if (!c) return Router.go('/', true);
    var pf = Store.state.profile;
    var angle = c.angles.filter(function (a) { return a.on; })[0] || c.angles[0];

    function stats() {
      return Store.selectedWins().map(function (w) {
        return '<div><b>' + esc(w.metric) + '</b><span>' + esc(w.short) + '</span></div>';
      }).join('');
    }
    function history() {
      return pf.roles.filter(function (r) { return r.on; }).map(function (r) {
        return '<div class="job"><div class="jt"><b>' + esc(r.title) + '</b><em>' + esc(r.span) + '</em></div>' +
          '<p class="jw">' + esc(r.company) + '</p><ul>' +
          r.bullets.map(function (b) { return '<li>' + esc(b) + '</li>'; }).join('') + '</ul></div>';
      }).join('');
    }

    var html = Views.tabs(c, 'page') +
      '<div class="page-head"><h1>What they see</h1>' +
      '<p>One page, written for one company. Turn a section off if it is not earning its place.</p></div>' +
      '<div class="preview">' +
        '<div><p class="cap" style="padding:0 var(--s-3) var(--s-2)">Sections</p>' +
        '<div class="sec-toggles" id="toggles"></div>' +
        '<div class="card p4 mt4"><p class="cap mb2">Opens</p><h3 class="mono">' + c.views + '</h3>' +
        '<p class="dimmer" style="font-size:var(--fs-sm)">Last one ' + esc(c.lastView) + '</p></div></div>' +
        '<div class="browser">' +
          '<div class="browser-bar"><i></i><i></i><i></i><span class="url">frontdoor.app/p/' + esc(c.slug) + '</span></div>' +
          '<div class="pub">' +
            '<section class="hero" data-sec="hero">' +
              '<p class="cap">Written for ' + esc(c.company) + ', ' + esc(c.role) + '</p>' +
              '<h2>' + esc(pf.name) + '</h2>' +
              '<p class="thesis">I have already run the change ' + esc(c.company) + ' is in the middle of. Seat pricing, longer cycles, and a team that has to relearn how to open a deal.</p>' +
              '<div class="row wrap g2"><span class="chip">' + esc(pf.location) + '</span>' +
              '<span class="chip">' + pf.years + ' years in SaaS</span><span class="chip">Mid-market and SMB</span></div>' +
            '</section>' +
            '<section data-sec="why"><h3 class="cap">Why ' + esc(c.company) + '</h3>' +
              '<p class="take">' + esc(angle.take) + '</p></section>' +
            '<section data-sec="proof"><h3 class="cap">The short version</h3><div class="stats">' + stats() + '</div></section>' +
            '<section data-sec="exp"><h3 class="cap">Where I have been</h3><div class="history">' + history() + '</div></section>' +
            '<section data-sec="plan"><h3 class="cap">First 90 days at ' + esc(c.company) + '</h3><div class="days">' +
              '<div><span>30</span>Sit on twenty calls. Find out where mid-market deals actually stall against the five seat floor.</div>' +
              '<div><span>60</span>Rewrite discovery for a two call close and hand the team a working script, not a deck.</div>' +
              '<div><span>90</span>Two closed won on the new motion, and a written teardown of what moved the number.</div>' +
            '</div></section>' +
            '<section data-sec="video"><h3 class="cap">Ninety seconds</h3><div class="reel"><b>▶</b></div></section>' +
            '<section data-sec="said"><h3 class="cap">Someone who worked with me</h3>' +
              '<div class="said"><p>"' + esc(pf.reference.quote) + '"</p>' +
              '<div class="by"><span class="avatar avatar-md" style="background:var(--p-tie)">' + esc(pf.reference.initials) + '</span>' +
              '<span>' + esc(pf.reference.who) + ', ' + esc(pf.reference.role) + '</span></div></div></section>' +
            '<section data-sec="stack"><h3 class="cap">Tools I live in</h3><div class="row wrap g2">' +
              pf.stack.map(function (s) { return '<span class="chip">' + esc(s) + '</span>'; }).join('') + '</div></section>' +
            '<div class="pub-foot"><div class="row wrap g2"><span class="chip">' + esc(pf.email) + '</span>' +
              '<span class="chip">312 555 0148</span></div>' +
              '<button class="btn btn-secondary btn-sm">Download résumé</button></div>' +
          '</div>' +
        '</div>' +
      '</div>';

    var v = Shell.mount({
      nav: 'page',
      crumbs: [{ label: c.company, href: '/' }, { label: 'Page' }],
      actions: '<button class="btn btn-secondary btn-sm" id="copy-link">Copy link</button>' +
               '<button class="btn btn-primary btn-sm" id="sim">Simulate a view</button>',
      html: html
    });

    function paintToggles() {
      v.querySelector('#toggles').innerHTML = c.sections.map(function (s) {
        return '<button class="sec-tog" data-sec-key="' + s.key + '" aria-pressed="' + s.on + '">' +
          '<span class="box"></span>' + esc(s.label) + '</button>';
      }).join('');
      c.sections.forEach(function (s) {
        var node = v.querySelector('[data-sec="' + s.key + '"]');
        if (node) node.classList.toggle('hide', !s.on);
      });
    }
    paintToggles();

    UI.on(v, 'click', '[data-sec-key]', function (e, el) {
      var s = c.sections.filter(function (x) { return x.key === el.dataset.secKey; })[0];
      s.on = !s.on; Store.save(); paintToggles();
    });
    document.getElementById('copy-link').addEventListener('click', function () {
      UI.copy('https://frontdoor.app/p/' + c.slug); UI.toast('Link copied.');
    });
    document.getElementById('sim').addEventListener('click', function () {
      c.views += 1; c.lastView = 'just now'; Store.save();
      UI.toast('Marcus opened your page. Just now.');
      Views.page(params);
    });
  };
})(window, document);

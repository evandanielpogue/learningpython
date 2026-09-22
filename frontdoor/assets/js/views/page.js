/* ==========================================================================
   views/page.js — the public page, the one thing you link to in a message.
   Three layouts over the same content, because a hiring manager who skims
   and one who reads want different shapes.
   ========================================================================== */
(function (window, document) {
  'use strict';

  var esc = UI.esc;
  window.Views = window.Views || {};

  var LAYOUTS = [
    { key: 'case',   name: 'The case',   sub: 'Portrait, a thesis, then the proof. Reads top to bottom.' },
    { key: 'brief',  name: 'The brief',  sub: 'Two columns, everything above the fold. For skimmers.' },
    { key: 'letter', name: 'The letter', sub: 'One narrow column addressed to a person. For a warm intro.' }
  ];

  window.Views.page = function (params) {
    var c = Store.campaign(params.id);
    if (!c) return Router.go('/', true);
    Store.touch(c.id);
    var pf = Store.state.profile;
    var angle = c.angles.filter(function (a) { return a.on; })[0] || c.angles[0] || null;
    var wins = Store.campaignWins(c);
    var hm = c.contacts.filter(function (p) { return p.persona === 'Hiring manager'; })[0] ||
             c.contacts[0] || null;

    function on(key) { return (c.sections.filter(function (s) { return s.key === key; })[0] || {}).on; }

    /* ---------------- page sections ---------------- */
    function sHero() {
      return '<section class="pg-hero" data-sec="hero">' +
        '<div class="pg-portrait">' + Views.photoHTML(112) + '</div>' +
        '<div class="pg-hero-txt">' +
          '<p class="pg-eyebrow">Written for ' + esc(c.company) + ' · ' + esc(c.role) + '</p>' +
          '<h1>' + esc(pf.name) + '</h1>' +
          '<p class="pg-thesis">' + esc(angle ? angle.take : (c.story || 'Here is why this company, and what I would do in the first ninety days.')) + '</p>' +
          '<div class="pg-chips">' +
            '<span>' + esc(pf.location) + '</span>' +
            '<span>' + pf.years + ' years in SaaS</span>' +
            (c.req ? '<span>Req ' + esc(c.req) + '</span>' : '') +
          '</div>' +
        '</div></section>';
    }
    function sProof() {
      if (!wins.length) return '';
      return '<section data-sec="proof"><h2 class="pg-h">The numbers</h2>' +
        '<div class="pg-stats">' + wins.map(function (w) {
          return '<div><b>' + esc(w.metric) + '</b><span>' + esc(w.short) + '</span>' +
            '<em>' + esc(w.where) + '</em></div>';
        }).join('') + '</div></section>';
    }
    /* the hero already carries the lead angle, so this section carries what
       comes after it: the other reads, or what the listing asked for */
    function sWhy() {
      var rest = c.angles.filter(function (a) { return a !== angle; });
      var inner = '';
      if (!on('hero') && angle) {
        inner = '<p class="pg-take">' + esc(angle.take) + '</p>';
      } else if (rest.length) {
        inner = '<div class="pg-reads">' + rest.map(function (a) {
          return '<div><b>' + esc(a.title) + '</b><p>' + esc(a.take) + '</p></div>';
        }).join('') + '</div>';
      } else if (c.requirements.length) {
        inner = '<ul class="pg-ticks">' + c.requirements.slice(0, 6).map(function (r) {
          return '<li>' + esc(r) + '</li>';
        }).join('') + '</ul>';
      }
      if (!inner) return '';
      return '<section data-sec="why"><h2 class="pg-h">Why ' + esc(c.company) + '</h2>' + inner + '</section>';
    }
    function sStory() {
      if (!c.story) return '';
      return '<section data-sec="story"><h2 class="pg-h">What happened last time</h2>' +
        '<p class="pg-story">' + esc(c.story) + '</p></section>';
    }
    function sPlan() {
      return '<section data-sec="plan"><h2 class="pg-h">First 90 days at ' + esc(c.company) + '</h2>' +
        '<div class="pg-days">' +
          '<div><span>30</span><p>Sit on twenty calls. Find out where deals actually stall against the new deal math.</p></div>' +
          '<div><span>60</span><p>Rewrite discovery for a two call close and hand the team a working script, not a deck.</p></div>' +
          '<div><span>90</span><p>Two closed won on the new motion, and a written teardown of what moved the number.</p></div>' +
        '</div></section>';
    }
    function sExp() {
      var roles = pf.roles.filter(function (r) { return r.on; });
      if (!roles.length) return '';
      return '<section data-sec="exp"><h2 class="pg-h">Where I have been</h2>' +
        '<div class="pg-jobs">' + roles.map(function (r) {
          return '<div class="pg-job"><div class="pg-job-h"><b>' + esc(r.title) + '</b><em>' + esc(r.span) + '</em></div>' +
            '<p class="pg-job-co">' + esc(r.company) + '</p><ul>' +
            r.bullets.map(function (b) { return '<li>' + esc(b) + '</li>'; }).join('') + '</ul></div>';
        }).join('') + '</div></section>';
    }
    function sSaid() {
      return '<section data-sec="said"><h2 class="pg-h">Someone who worked with me</h2>' +
        '<figure class="pg-quote"><blockquote>' + esc(pf.reference.quote) + '</blockquote>' +
        '<figcaption><span class="avatar avatar-md" style="background:var(--p-tie)">' + esc(pf.reference.initials) + '</span>' +
        '<span><b>' + esc(pf.reference.who) + '</b><em>' + esc(pf.reference.role) + '</em></span></figcaption></figure></section>';
    }
    function sStack() {
      return '<section data-sec="stack"><h2 class="pg-h">Tools I live in</h2>' +
        '<div class="pg-chips">' + pf.stack.map(function (s) { return '<span>' + esc(s) + '</span>'; }).join('') + '</div></section>';
    }
    function sVideo() {
      return '<section data-sec="video"><h2 class="pg-h">Ninety seconds</h2>' +
        '<div class="pg-reel"><b>▶</b><span>A short video, if reading is not your thing</span></div></section>';
    }
    function sFoot() {
      return '<footer class="pg-foot">' +
        '<div><b>' + esc(pf.name) + '</b><p>' + esc(pf.email) + (pf.phone ? ' · ' + esc(pf.phone) : '') + '</p></div>' +
        '<div class="row g2"><button class="pg-btn pg-btn-ghost">Résumé</button>' +
        '<button class="pg-btn">Book fifteen minutes</button></div></footer>';
    }

    /* ---------------- layouts ---------------- */
    function pick(fns) {
      return fns.map(function (f) { return f(); }).join('');
    }
    function pageBody() {
      var keep = { hero: sHero, why: sWhy, proof: sProof, story: sStory,
                   plan: sPlan, exp: sExp, said: sSaid, stack: sStack, video: sVideo };
      function part(k) { return on(k) ? keep[k] : function () { return ''; }; }

      if (c.pageTemplate === 'brief') {
        return '<div class="pub pub-brief">' +
          part('hero')() +
          '<div class="pb-cols">' +
            '<div>' + pick([part('why'), part('story'), part('plan')]) + '</div>' +
            '<div>' + pick([part('proof'), part('exp'), part('said'), part('stack'), part('video')]) + '</div>' +
          '</div>' + sFoot() + '</div>';
      }
      if (c.pageTemplate === 'letter') {
        var first = hm ? String(hm.name).split(' ')[0] : 'there';
        return '<div class="pub pub-letter">' +
          (on('hero') ? '<section class="pl-top" data-sec="hero">' +
            '<p class="pg-eyebrow">' + esc(pf.name) + ' · for ' + esc(c.company) + '</p>' +
            '<h1>' + esc(first) + ',</h1>' +
            '<p class="pg-thesis">' + esc(angle ? angle.take : c.story) + '</p></section>' : '') +
          pick([part('story'), part('proof'), part('plan'), part('why'), part('exp'), part('said'), part('stack'), part('video')]) +
          '<div class="pl-sign">' + Views.photoHTML(56) +
            '<div><b>' + esc(pf.name) + '</b><p>' + esc(pf.email) + '</p></div></div>' +
          sFoot() + '</div>';
      }
      return '<div class="pub pub-case">' +
        pick([part('hero'), part('proof'), part('why'), part('story'), part('plan'),
              part('exp'), part('said'), part('stack'), part('video')]) +
        sFoot() + '</div>';
    }

    /* ---------------- the editor around it ---------------- */
    var html =
      '<div class="page-head"><h1>What they see</h1>' +
      '<p>One page, written for one company. Pick a shape, then turn off anything that is not earning its place.</p></div>' +
      '<div class="preview">' +
        '<div class="col g4">' +
          '<div class="card p4">' +
            '<p class="cap mb3">Layout</p>' +
            '<div class="laypick" id="lay">' + LAYOUTS.map(function (l) {
              return '<button class="lay' + (c.pageTemplate === l.key ? ' on' : '') + '" data-lay="' + l.key + '">' +
                '<span class="lay-art lay-' + l.key + '"><i></i><i></i><i></i></span>' +
                '<b>' + esc(l.name) + '</b><em>' + esc(l.sub) + '</em></button>';
            }).join('') + '</div>' +
          '</div>' +
          '<div class="card p4">' +
            '<p class="cap mb3">Sections</p>' +
            '<div class="sec-toggles" id="toggles"></div>' +
          '</div>' +
          '<div class="card p4">' +
            '<p class="cap mb2">Opens</p><h3 class="mono">' + c.views + '</h3>' +
            '<p class="dimmer" style="font-size:var(--fs-sm)">Last one ' + esc(c.lastView) + '</p>' +
            (pf.photo ? '' : '<p class="hint mt3">No photo yet. A face on this page is worth more than another bullet. <a href="#/settings">Add one</a>.</p>') +
          '</div>' +
        '</div>' +
        '<div class="browser">' +
          '<div class="browser-bar"><i></i><i></i><i></i><span class="url">frontdoor.app/p/' + esc(c.slug) + '</span></div>' +
          '<div id="pub-mount">' + pageBody() + '</div>' +
        '</div>' +
      '</div>';

    var v = Shell.mount({
      nav: 'page',
      crumbs: [{ label: 'Overview', href: '/' }, { label: c.company, href: '/c/' + c.id }, { label: 'Page' }],
      actions: '<button class="btn btn-secondary btn-sm" id="copy-link">Copy link</button>' +
               '<button class="btn btn-primary btn-sm" id="sim">Simulate a view</button>',
      html: html
    });

    function repaintPage() {
      v.querySelector('#pub-mount').innerHTML = pageBody();
      var el = v.querySelector('.pub');
      if (el) { el.classList.remove('pub-in'); void el.offsetWidth; el.classList.add('pub-in'); }
    }

    function paintToggles() {
      v.querySelector('#toggles').innerHTML = c.sections.map(function (s) {
        return '<button class="sec-tog" data-sec-key="' + s.key + '" aria-pressed="' + s.on + '">' +
          '<span class="box"></span>' + esc(s.label) + '</button>';
      }).join('');
    }
    paintToggles();

    UI.on(v, 'click', '[data-sec-key]', function (e, el) {
      var s = c.sections.filter(function (x) { return x.key === el.dataset.secKey; })[0];
      s.on = !s.on; Store.save();
      paintToggles(); repaintPage();
    });
    UI.on(v, 'click', '[data-lay]', function (e, el) {
      Store.updateCampaign(c.id, { pageTemplate: el.dataset.lay });
      v.querySelectorAll('[data-lay]').forEach(function (b) { b.classList.toggle('on', b.dataset.lay === el.dataset.lay); });
      repaintPage();
      UI.toast('Switched to ' + LAYOUTS.filter(function (l) { return l.key === el.dataset.lay; })[0].name.toLowerCase() + '.');
    });

    document.getElementById('copy-link').addEventListener('click', function () {
      UI.copy('https://frontdoor.app/p/' + c.slug); UI.toast('Link copied.');
    });
    document.getElementById('sim').addEventListener('click', function () {
      c.views += 1; c.lastView = 'just now'; Store.save();
      UI.toast((hm ? hm.name.split(' ')[0] : 'Someone') + ' opened your page. Just now.');
      Views.page(params);
    });
  };
})(window, document);

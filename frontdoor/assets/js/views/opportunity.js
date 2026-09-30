/* ==========================================================================
   views/opportunity.js — one company: the checklist, the numbers, what is
   next. Plus the flow that creates one from a pasted job listing.
   ========================================================================== */
(function (window, document) {
  'use strict';

  var esc = UI.esc;
  window.Views = window.Views || {};

  /* ======================================================================
     ADD A COMPANY
     ====================================================================== */
  var READ = [
    ['Role and company', function (p) { return p.role ? p.role.split(',')[0] : 'found'; }],
    ['Where it sits', function (p) { return p.location || 'not stated'; }],
    ['What they are asking for', function (p) { return p.requirements.length + ' lines'; }],
    ['Where your résumé lines up', function (p, r, m) {
      return (m || []).filter(function (x) { return x.strength !== 'none'; }).length + ' of ' + (m || []).length;
    }]
  ];

  window.Views.newOpp = function () {
    var stage = 1;
    var listing = '';
    var postingUrl = '';
    var parsed = null;
    var ranked = [];
    /* how many we put forward, not how many they are allowed */
    var SUGGEST = 3;
    var chosen = [];
    var match = [];
    var matchedBy = 'keywords';

    function paint() {
      var body;

      if (stage === 1) {
        body =
          '<div class="card p6">' +
            '<h3 class="mb2">Listing</h3>' +

            /* the link row exists only when something can read a link */
            (AI.canFetch()
              ? '<div class="lookup">' +
                  '<span class="link-ic">\u26ad</span>' +
                  '<input class="lookup-in" id="post-url" placeholder="Link to the posting" autocomplete="off" spellcheck="false" value="' + esc(postingUrl) + '">' +
                  '<button class="btn btn-secondary btn-sm" type="button" id="post-get">Read link</button>' +
                '</div>' +
                '<p class="hint mb4" id="post-msg" style="margin-top:var(--s-2)"></p>' +
                '<div class="or"><span>or</span></div>'
              : '') +
            '<textarea class="input listing-in" id="listing" placeholder="Paste the whole posting here" spellcheck="false"></textarea>' +
            '<div class="row between wrap mt4 g3">' +
              '<button class="btn btn-ghost btn-sm" id="use-sample">Use an example</button>' +
              '<button class="btn btn-primary" id="read" disabled>Read <span class="arr">\u2192</span></button>' +
            '</div>' +
            '<div class="hide mt5" id="scan-box"><p class="cap mb3">Reading the listing</p><div id="scan"></div></div>' +
          '</div>';
      } else {
        var sc = { total: match.length, covered: match.filter(function (r) { return r.strength !== 'none'; }).length };
        body =
          '<div class="card p6 mb4">' +
            '<div class="row between wrap g3 mb4">' +
              '<p class="cap">Read from the listing</p>' +
              '<button class="btn btn-ghost btn-sm" id="back">Paste again</button>' +
            '</div>' +
            /* A reader that is right most of the time is still wrong
               sometimes, and a wrong company name follows you into every
               message. So these are fields, not statements. */
            '<div class="grid cols-3 mb4">' +
              '<label class="field"><span>Company</span>' +
                '<input class="input" id="f-company" value="' + esc(parsed.company) + '"' +
                (parsed.company ? '' : ' placeholder="Who is hiring?"') + '></label>' +
              '<label class="field"><span>Role</span>' +
                '<input class="input" id="f-role" value="' + esc(parsed.role) + '"' +
                (parsed.role ? '' : ' placeholder="What is the job called?"') + '></label>' +
              '<label class="field"><span>Where</span>' +
                '<input class="input" id="f-location" value="' + esc(parsed.location) + '" placeholder="City, or remote"></label>' +
            '</div>' +
            (match.length
              ? '<div class="matchbar"><div class="matchbar-fill" style="width:' +
                Math.round((sc.covered / Math.max(1, sc.total)) * 100) + '%"></div></div>' +
                '<p class="hint mt2">' + sc.covered + ' of ' + sc.total + '</p>'
              : '') +
          '</div>' +

          '<div class="card p6 mb4">' +
            '<div class="row between wrap g3 mb2"><h3>Match</h3>' +
            '<span class="chip">' + (matchedBy === 'model' ? 'Matched by Claude' : 'Matched on keywords') + '</span></div>' +
            '<div id="match" class="matchlist"></div>' +
          '</div>' +

          '<div class="card p6 mb4">' +
            '<div class="row between wrap g3 mb2"><h3>Proof</h3>' +
            '<span class="chip chip-accent" id="pick-count"></span></div>' +
            '<div class="grid optlist" style="gap:var(--s-2)" id="wins"></div>' +
          '</div>' +

          '<div class="row g2 wrap">' +
            '<button class="btn btn-primary" id="create">Add ' + esc(parsed.company) + ' <span class="arr">→</span></button>' +
          '</div>';
      }

      var v = Shell.mount({
        nav: 'home',
        crumbs: [{ label: 'Overview', href: '/' }, { label: 'Add a company' }],
        html: '<div class="page-head"><h1>Company</h1></div>' + body
      });

      if (stage === 1) wireOne(v); else wireTwo(v);
    }

    function wireOne(v) {
      var ta = v.querySelector('#listing');
      var go = v.querySelector('#read');
      ta.value = listing;
      go.disabled = ta.value.trim().length < 40;

      ta.addEventListener('input', function () {
        listing = ta.value;
        go.disabled = ta.value.trim().length < 40;
      });
      var url = v.querySelector('#post-url');
      var get = v.querySelector('#post-get');
      var pmsg = v.querySelector('#post-msg');

      function grab() {
        if (!url) return;
        var link = url.value.trim();
        if (!link) { pmsg.className = 'lookup-msg'; pmsg.textContent = 'Paste a link.'; return; }
        postingUrl = link;
        get.disabled = true;
        get.textContent = 'Reading\u2026';
        pmsg.className = 'hint';
        pmsg.textContent = 'Reading\u2026';
        AI.fetchPosting(link).then(function (out) {
          ta.value = out.text;
          listing = out.text;
          go.disabled = listing.trim().length < 40;
          pmsg.className = 'lookup-msg ok';
          var host = '';
          try { host = new URL(out.url).hostname.replace(/^www\./, ''); } catch (e) {}
          pmsg.textContent = 'Read' + (host ? ' from ' + host : '') + '.';
        }).catch(function (err) {
          pmsg.className = 'lookup-msg';
          pmsg.textContent = err.message + ' Paste the text below instead.';
          ta.focus();
        }).then(function () {
          get.disabled = false;
          get.textContent = 'Read link';
        });
      }
      if (get && AI.canFetch()) {
        if (get) get.addEventListener('click', grab);
        url.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); grab(); } });
      }

      v.querySelector('#use-sample').addEventListener('click', function () {
        ta.value = Store.SAMPLE_LISTING;
        listing = ta.value;
        go.disabled = false;
        ta.focus();
      });
      go.addEventListener('click', function () {
        parsed = Store.parseListing(listing);
        ranked = Store.rankWins(listing);
        chosen = ranked.slice(0, SUGGEST).map(function (r) { return r.win.id; });
        match = Store.matchLocally(parsed.requirements, listing);
        matchedBy = 'keywords';
        go.disabled = true;

        var box = v.querySelector('#scan-box');
        box.classList.remove('hide');
        v.querySelector('#scan').innerHTML = READ.map(function (s, i) {
          return '<div class="scan-line" id="sl' + i + '"><span class="dot"></span><span>' + esc(s[0]) + '</span><em><span class="skel"></span></em></div>';
        }).join('');

        function tick(i) {
          var ln = v.querySelector('#sl' + i);
          if (!ln) return;
          ln.classList.add('done');
          ln.querySelector('em').textContent = READ[i][1](parsed, ranked, match);
        }
        [0, 1, 2].forEach(function (i) { setTimeout(function () { tick(i); }, 320 * (i + 1)); });

        var here = UI.stillHere(null);
        function land() {
          if (!here()) return;      /* they navigated away while we were reading */
          setTimeout(function () {
            if (!here()) return;
            tick(3);
            setTimeout(function () { if (here()) { stage = 2; paint(); } }, 420);
          }, 300);
        }
        if (!AI.ready()) return land();

        AI.matchListing(listing, parsed.requirements).then(function (out) {
          if (out.requirements && out.requirements.length) {
            match = out.requirements.map(function (r) {
              return {
                id: Store.uid('req'), text: r.text, priority: r.priority || 'nice',
                winIds: (r.winIds || []).filter(function (id) {
                  return Store.state.profile.wins.some(function (w) { return w.id === id; });
                }),
                strength: ['strong', 'partial', 'none'].indexOf(r.strength) > -1 ? r.strength : 'none',
                note: r.note || ''
              };
            });
            matchedBy = 'model';
          }
          var lead = (out.leadWith || []).filter(function (id) {
            return Store.state.profile.wins.some(function (w) { return w.id === id; });
          });
          if (lead.length) chosen = lead.slice(0, SUGGEST);
        }).catch(function (err) {
          UI.toast('Claude could not match it (' + err.message + '). Fell back to keywords.');
        }).then(land);
      });
    }

    function wireTwo(v) {
      var winsEl = v.querySelector('#wins');
      var matchEl = v.querySelector('#match');

      function paintMatch() {
        if (!match.length) {
          matchEl.innerHTML = '<p class="hint">No requirements found.</p>';
          return;
        }
        matchEl.innerHTML = match.map(function (r) {
          var wins = (r.winIds || []).map(function (id) {
            return Store.state.profile.wins.filter(function (w) { return w.id === id; })[0];
          }).filter(Boolean);
          return '<div class="matchrow ' + esc(r.strength) + '" data-open="0">' +
            '<span class="mr-dot" title="' + esc(r.strength) + '"></span>' +
            '<button class="mr-ask" type="button" aria-expanded="false">' +
              '<b>' + esc(r.text) + '</b>' +
              (r.priority === 'must' ? '<em class="mr-must">must have</em>' : '') +
              (r.note ? '<p class="mr-note">' + esc(r.note) + '</p>' : '') +
              '<span class="mr-caret" aria-hidden="true">' + Icon.svg('arrow', 14) + '</span>' +
            '</button>' +
            '<div class="mr-with mr-have">' +
              (wins.length
                ? wins.map(function (w) {
                    return '<span class="chip mr-proof"><b class="mono">' + esc(w.metric) + '</b> ' +
                      '<span class="mr-short">' + esc(w.short) + '</span>' +
                      '<span class="mr-full">' + esc(w.text) + (w.where ? ' <i>' + esc(w.where) + '</i>' : '') + '</span></span>';
                  }).join('')
                : '<span class="mr-none">nothing on your résumé</span>') +
            '</div></div>';
        }).join('');
      }
      UI.on(v, 'click', '.mr-ask', function (e, el) {
        var row = el.closest('.matchrow');
        var open = row.dataset.open !== '1';
        row.dataset.open = open ? '1' : '0';
        el.setAttribute('aria-expanded', String(open));
      });

      function paintWins() {
        winsEl.innerHTML = ranked.map(function (r) {
          var on = chosen.indexOf(r.win.id) > -1;
          return '<button class="opt" data-win="' + r.win.id + '" aria-pressed="' + on + '">' +
            '<span class="box"></span><span class="ot">' + esc(r.win.text) +
            '<em>' + (r.score
              ? 'Matches ' + esc(r.hits.slice(0, 3).join(', '))
              : esc(r.win.where)) + '</em></span>' +
            '<span class="om">' + esc(r.win.metric) + '</span></button>';
        }).join('');
        v.querySelector('#pick-count').textContent = chosen.length + ' picked';
      }
      paintMatch();
      paintWins();

      UI.on(v, 'click', '[data-win]', function (e, el) {
        var id = el.dataset.win;
        var at = chosen.indexOf(id);
        if (at > -1) chosen.splice(at, 1);
        else chosen.push(id);
        paintWins();
      });

      v.querySelector('#back').addEventListener('click', function () { stage = 1; paint(); });
      function typed(id) {
        var el = v.querySelector(id);
        return el ? el.value.trim() : '';
      }
      ['#f-company', '#f-role', '#f-location'].forEach(function (id) {
        var el = v.querySelector(id);
        if (el) el.addEventListener('input', function () {
          parsed.company = typed('#f-company');
          parsed.role = typed('#f-role');
          parsed.location = typed('#f-location');
        });
      });

      v.querySelector('#create').addEventListener('click', function () {
        parsed.company = typed('#f-company');
        parsed.role = typed('#f-role');
        parsed.location = typed('#f-location');
        if (!parsed.company) {
          var f = v.querySelector('#f-company');
          if (f) { f.classList.add('err'); f.focus(); }
          UI.toast('Who is hiring?');
          return;
        }
        if (!chosen.length) { UI.toast('Pick at least one win.'); return; }
        var c = Store.createCampaign({
          listing: listing, parsed: parsed, winIds: chosen.slice(),
          story: '', postingUrl: postingUrl
        });
        Store.setMatch(c.id, match);
        Store.buildAgenda(c.id);
        var gaps = Store.matchScore(c).gaps.length;
        UI.toast(c.company + ' added.' + (gaps ? ' ' + gaps + (gaps === 1 ? ' gap.' : ' gaps.') : ''));
        Router.go('/c/' + c.id + '/prep');
      });
    }

    paint();
  };

  /* ======================================================================
     ONE OPPORTUNITY
     ====================================================================== */
  /* A figure and what it is. Nothing underneath narrating it. */
  function kpi(label, value, of) {
    return '<div class="card hover p5"><p class="cap mb3">' + esc(label) + '</p>' +
      '<p class="kpi"><span data-count="' + value + '">0</span>' +
      (of === undefined ? '' : '<span class="kpi-of">/' + of + '</span>') + '</p></div>';
  }

  function stepRow(c, s) {
    var p = c.contacts.filter(function (x) { return x.id === s.contact; })[0];
    var cls = 'touch' + (s.status === 'sent' || s.status === 'replied' ? ' sent' : '');
    var badge = s.status === 'replied' ? '<span class="chip chip-pos">Replied</span>'
              : s.status === 'due'     ? '<span class="chip chip-accent">Due today</span>'
              : s.status === 'sent'    ? '<span class="chip">Sent</span>'
              : '<span class="chip">Queued</span>';
    return '<button class="touch-row ' + cls + '" data-step="' + s.id + '" style="--pc:var(' + (p ? p.colour : '--line-3') + ')">' +
      '<span class="td">Day ' + s.day + '</span>' +
      '<span class="tw">' + esc(p ? p.name : 'No person') + '<em>' + esc(s.note) + '</em></span>' +
      badge + '<span class="tc">' + esc(s.channel) + '</span></button>';
  }

  window.Views.opportunity = function (params) {
    var c = Store.campaign(params.id);
    if (!c) return Router.go('/', true);
    Store.touch(c.id);

    var wins = Store.campaignWins(c);
    var match = c.match || [];
    var covered = match.filter(function (r) { return r.strength !== 'none'; }).length;

    /* the requirement, and the win that answers it */
    function matchRows() {
      if (!match.length) {
        return '<p class="hint">No requirement list came out of the listing.</p>';
      }
      return '<div class="matchlist">' + match.map(function (r) {
        var ws = (r.winIds || []).map(function (id) {
          return Store.state.profile.wins.filter(function (w) { return w.id === id; })[0];
        }).filter(Boolean);
        var strength = ['strong', 'partial', 'none'].indexOf(r.strength) > -1 ? r.strength : 'none';
        /* a row is a summary; opening it shows the whole requirement and
           the whole story behind each piece of proof */
        return '<div class="matchrow ' + strength + '" data-open="0">' +
          '<span class="mr-dot" title="' + strength + '"></span>' +
          '<button class="mr-ask" type="button" aria-expanded="false">' +
            '<b>' + esc(Store.fullRequirement(c, r.text)) + '</b>' +
            (r.priority === 'must' ? '<em class="mr-must">must have</em>' : '') +
            (r.note ? '<p class="mr-note">' + esc(r.note) + '</p>' : '') +
            '<span class="mr-caret" aria-hidden="true">' + Icon.svg('arrow', 14) + '</span>' +
          '</button>' +
          '<div class="mr-with">' + (ws.length
            ? ws.map(function (w) {
                return '<span class="chip mr-proof"><b class="mono">' + esc(w.metric) + '</b> ' +
                  '<span class="mr-short">' + esc(w.short) + '</span>' +
                  '<span class="mr-full">' + esc(w.text) + (w.where ? ' <i>' + esc(w.where) + '</i>' : '') + '</span></span>';
              }).join('')
            : '<span class="mr-gap">Gap</span>') + '</div>' +
        '</div>';
      }).join('') + '</div>';
    }

    var html =
      '<div class="page-head">' +
        '<h1>Role</h1>' +
        '<p class="role-line">' + esc(c.company) + ' &middot; ' + esc(c.role) +
          (c.location ? ' &middot; ' + esc(c.location) : '') +
          (/^https?:\/\//i.test(c.postingUrl || '')
            ? ' <a href="' + esc(c.postingUrl) + '" target="_blank" rel="noopener noreferrer">the posting \u2197</a>'
            : '') +
        '</p>' +
      '</div>' +

      '<div class="split-wide">' +
        '<div class="card p5">' +
          '<div class="row between wrap g2 mb4"><h3>Match</h3>' +
            '<span class="chip">' + covered + ' of ' + match.length + '</span></div>' +
          matchRows() +
        '</div>' +
        '<div class="col g4">' +
          '<div class="card p5">' +
            '<div class="row between wrap g2 mb3"><h3>Proof</h3><span class="chip">' + wins.length + '</span></div>' +
            (wins.length
              ? '<div class="prooflist">' + wins.map(function (w) {
                  return '<div class="proof"><b class="mono">' + esc(w.metric) + '</b>' +
                    '<span><span class="proof-text">' + esc(w.text) + '</span>' +
                    (w.where ? '<span class="proof-where">' + esc(w.where) + '</span>' : '') + '</span></div>';
                }).join('') + '</div>'
              : '<p class="hint">None picked.</p>') +
          '</div>' +
          (c.listing
            ? '<details class="card p5 listing-fold"><summary><h3>Listing</h3></summary>' +
              '<pre class="listing-raw">' + esc(c.listing) + '</pre></details>'
            : '') +
        '</div>' +
      '</div>';

    var v = Shell.mount({
      nav: 'opp',
      crumbs: [{ label: 'Overview', href: '/' }, { label: c.company }],
      actions: '<span class="chip">Day ' + c.day + '</span>' +
        '<button class="icon-btn" id="co-more" aria-haspopup="menu" aria-label="More for ' + esc(c.company) + '" title="More">' + Icon.svg('more', 16) + '</button>',
      html: html
    });

    var more = document.getElementById('co-more');
    if (more) more.addEventListener('click', function () {
      UI.menu(this, [
        { key: 'drop', icon: '\u2715', label: c.example ? 'Remove example' : 'Remove ' + c.company, danger: true, run: function () {
          Views.removeCompany(c).then(function (ok) { if (ok) Router.go('/'); });
        } }
      ]);
    });

    UI.on(v, 'click', '[data-step]', function (e, el) {
      c.activeStep = el.dataset.step; Store.save();
      Router.go('/c/' + c.id + '/sequence');
    });
    UI.on(v, 'click', '.mr-ask', function (e, el) {
      var row = el.closest('.matchrow');
      var open = row.dataset.open !== '1';
      row.dataset.open = open ? '1' : '0';
      el.setAttribute('aria-expanded', String(open));
    });
  };
})(window, document);

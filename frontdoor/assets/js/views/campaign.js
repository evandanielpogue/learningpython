/* ==========================================================================
   views/campaign.js — import wizard, people, sequence, composer, public page
   ========================================================================== */
(function (window, document) {
  'use strict';

  var esc = UI.esc;
  window.Views = window.Views || {};

  function tabs(c, active) {
    var T = [
      ['people', 'People', '/c/' + c.id + '/people'],
      ['sequence', 'Sequence', '/c/' + c.id + '/sequence'],
      ['messages', 'Messages', '/c/' + c.id + '/messages'],
      ['page', 'Page', '/c/' + c.id + '/page']
    ];
    return '<div class="tabs" role="tablist">' + T.map(function (t) {
      return '<a class="tab" role="tab" href="#' + t[2] + '" aria-selected="' + (t[0] === active) + '">' + t[1] + '</a>';
    }).join('') + '</div>';
  }

  /* ======================================================================
     IMPORT WIZARD
     ====================================================================== */
  var SCAN = [
    ['Name and where you are', 'Chicago'],
    ['Roles', '3'],
    ['Wins with a number in them', '7'],
    ['Tools and methodology', '7'],
    ['How you write', 'from your summary']
  ];

  window.Views.importer = function () {
    var step = Store.state.profile.imported ? 2 : 1;

    function pips(active) {
      return '<div class="steps-bar">' + ['Import', 'Pick your wins', 'Done'].map(function (l, i) {
        var n = i + 1;
        var state = n < active ? 'done' : n === active ? 'active' : 'todo';
        return '<span class="step-pip" data-state="' + state + '"><span class="n"><span>' + n + '</span></span>' + esc(l) + '</span>' +
          (i < 2 ? '<span style="color:var(--ink-4)">→</span>' : '');
      }).join('') + '</div>';
    }

    function paint() {
      var pf = Store.state.profile;
      var picked = Store.selectedWins().length;
      var body;

      if (step === 1) {
        body = pips(1) +
          '<div class="card p6">' +
            '<h3 class="mb3">Where does your history live?</h3>' +
            '<p class="dim mb5" style="font-size:var(--fs-sm)">We read it once and use it for every campaign after this.</p>' +
            '<div class="grid cols-2">' +
              '<button class="dropzone" data-src="linkedin.com/in/evanpogue"><span class="dz-ic">in</span><b>LinkedIn profile</b><span class="hint">Paste the URL</span></button>' +
              '<button class="dropzone" data-src="Evan_Pogue.pdf"><span class="dz-ic">↑</span><b>Résumé</b><span class="hint">PDF or Word</span></button>' +
            '</div>' +
            '<div class="hide mt5" id="scan-box"><p class="cap mb3" id="scan-src">Reading</p><div id="scan"></div></div>' +
          '</div>';
      } else {
        body = pips(2) +
          '<div class="card p6 mb4">' +
            '<div class="row between wrap mb3"><h3>Which three go on the page?</h3><span class="cap">' + picked + ' of 3 picked</span></div>' +
            '<p class="dim mb5" style="font-size:var(--fs-sm)">Seven came out of ' + esc(pf.source || 'your résumé') + '. Pick the ones a sales leader would care about, not the ones you are proudest of.</p>' +
            '<div class="grid" style="gap:var(--s-2)" id="wins"></div>' +
          '</div>' +
          '<div class="card p6 mb4">' +
            '<h3 class="mb3">Roles to show</h3>' +
            '<div class="grid" style="gap:var(--s-2)" id="roles"></div>' +
          '</div>' +
          '<div class="row g2">' +
            '<button class="btn btn-primary" id="done-import">Looks right <span class="arr">→</span></button>' +
            '<button class="btn btn-ghost" id="redo-import">Import something else</button>' +
          '</div>';
      }

      var v = Shell.mount({
        nav: 'home',
        crumbs: [{ label: 'Overview', href: '/' }, { label: 'Import' }],
        html: '<div class="page-head"><h1>Your history</h1><p>Two minutes of setup that every message and page is built from.</p></div>' + body
      });

      if (step === 1) {
        UI.on(v, 'click', '[data-src]', function (e, el) {
          var src = el.dataset.src;
          v.querySelectorAll('.dropzone').forEach(function (d) { d.disabled = true; d.style.opacity = .4; });
          var box = v.querySelector('#scan-box');
          box.classList.remove('hide');
          v.querySelector('#scan-src').textContent = 'Reading ' + src;
          v.querySelector('#scan').innerHTML = SCAN.map(function (s, i) {
            return '<div class="scan-line" id="sl' + i + '"><span class="dot"></span><span>' + esc(s[0]) + '</span><em><span class="skel"></span></em></div>';
          }).join('');
          SCAN.forEach(function (s, i) {
            setTimeout(function () {
              var ln = v.querySelector('#sl' + i);
              if (!ln) return;
              ln.classList.add('done');
              ln.querySelector('em').textContent = s[1];
              if (i === SCAN.length - 1) {
                Store.markImported(src);
                Store.state.tasks[0].on = true;
                Store.save();
                setTimeout(function () { step = 2; paint(); UI.toast('Got it. Seven wins to choose from.'); }, 420);
              }
            }, 300 * (i + 1));
          });
        });
      } else {
        var winsEl = v.querySelector('#wins');
        var rolesEl = v.querySelector('#roles');

        function paintWins() {
          var n = Store.selectedWins().length;
          winsEl.innerHTML = Store.state.profile.wins.map(function (w) {
            var locked = !w.on && n >= 3;
            return '<button class="opt' + (locked ? ' locked' : '') + '" data-win="' + w.id + '" aria-pressed="' + w.on + '">' +
              '<span class="box"></span><span class="ot">' + esc(w.text) + '<em>' + esc(w.where) + '</em></span>' +
              '<span class="om">' + esc(w.metric) + '</span></button>';
          }).join('');
          var lab = v.querySelector('.cap');
          if (lab) lab.textContent = n + ' of 3 picked';
        }
        function paintRoles() {
          rolesEl.innerHTML = Store.state.profile.roles.map(function (r) {
            return '<button class="opt" data-role="' + r.id + '" aria-pressed="' + r.on + '">' +
              '<span class="box"></span><span class="ot">' + esc(r.title) + '<em>' + esc(r.company) + ', ' + esc(r.span) + '</em></span>' +
              '<span></span></button>';
          }).join('');
        }
        paintWins(); paintRoles();

        UI.on(v, 'click', '[data-win]', function (e, el) { Store.toggleWin(el.dataset.win); paintWins(); });
        UI.on(v, 'click', '[data-role]', function (e, el) { Store.toggleRole(el.dataset.role); paintRoles(); });

        v.querySelector('#done-import').addEventListener('click', function () {
          Store.state.tasks[1].on = true;
          Store.save();
          var c = Store.createSeedCampaign();
          UI.toast('Saved. Now pick who to talk to.');
          Router.go('/c/' + c.id + '/people');
        });
        v.querySelector('#redo-import').addEventListener('click', function () { step = 1; paint(); });
      }
    }

    paint();
  };

  /* ======================================================================
     PEOPLE
     ====================================================================== */
  window.Views.people = function (params) {
    var c = Store.campaign(params.id);
    if (!c) return Router.go('/', true);

    var html = tabs(c, 'people') +
      '<div class="page-head"><h1>Five people at ' + esc(c.company) + '</h1>' +
      '<p>You would not open an account by calling the CEO. Same rule here. Start with the peer and finish with the VP.</p></div>' +
      '<div class="orgmap mb5">' +
        '<div class="anchor"><p class="cap">Target</p><h3 style="font-size:var(--fs-lg)">' + esc(c.company) + '</h3>' +
        '<p style="font-size:var(--fs-sm);opacity:.65">' + esc(c.role) + '</p></div>' +
        '<div class="people" id="people"></div>' +
      '</div>' +
      '<div class="grid cols-3" id="detail"></div>' +
      '<div class="row mt6"><a class="btn btn-primary" href="#/c/' + c.id + '/sequence">Build the sequence <span class="arr">→</span></a></div>';

    var v = Shell.mount({
      nav: 'people',
      crumbs: [{ label: c.company, href: '/' }, { label: 'People' }],
      actions: '<button class="btn btn-secondary btn-sm" id="refind">Find again</button>',
      html: html
    });

    function paintPeople(sel) {
      v.querySelector('#people').innerHTML = c.people.map(function (p, i) {
        return '<button class="person" data-p="' + i + '" aria-pressed="' + (i === sel) + '" style="--pc:var(' + p.colour + ')">' +
          '<span class="avatar avatar-md" style="background:var(' + p.colour + ')">' + esc(p.initials) + '</span>' +
          '<span><span class="pn">' + esc(p.name) + '</span><span class="pr">' + esc(p.role) + '</span></span>' +
          '<span class="pt">' + esc(p.persona) + '</span></button>';
      }).join('');
      var p = c.people[sel];
      v.querySelector('#detail').innerHTML =
        '<div class="card p5"><p class="cap mb2">In sales terms</p><h3>' + esc(p.equiv) + '</h3></div>' +
        '<div class="card p5"><p class="cap mb2">Why bother</p><h3 style="font-size:var(--fs-base);font-weight:600;line-height:1.4">' + esc(p.why) + '</h3></div>' +
        '<div class="card p5" style="border-color:var(' + p.colour + ')"><p class="cap mb2">What you ask for</p>' +
        '<h3 style="color:var(' + p.colour + ')">' + esc(p.ask) + '</h3></div>';
    }
    paintPeople(0);
    UI.on(v, 'click', '[data-p]', function (e, el) { paintPeople(+el.dataset.p); });
    document.getElementById('refind').addEventListener('click', function () {
      var b = this;
      UI.busy(b, 900).then(function () { UI.toast('Same five. Nothing has changed at ' + c.company + '.'); });
    });
  };

  /* ======================================================================
     SEQUENCE
     ====================================================================== */
  window.Views.sequence = function (params) {
    var c = Store.campaign(params.id);
    if (!c) return Router.go('/', true);

    function row(t, i) {
      var cls = 'touch' + (t.status === 'sent' || t.status === 'replied' ? ' sent' : '');
      var badge = t.status === 'replied' ? '<span class="chip chip-pos">Replied</span>'
                : t.status === 'due'     ? '<span class="chip chip-accent">Due today</span>'
                : t.status === 'sent'    ? '<span class="chip">Sent</span>'
                : '<span class="chip">Queued</span>';
      return '<button class="' + cls + '" data-t="' + i + '" style="--pc:var(' + t.colour + ')">' +
        '<span class="td">Day ' + t.day + '</span>' +
        '<span class="tw">' + esc(t.who) + '<em>' + esc(t.note) + '</em></span>' +
        badge + '<span class="tc">' + esc(t.channel) + '</span></button>';
    }

    var html = tabs(c, 'sequence') +
      '<div class="page-head"><h1>Fourteen days</h1>' +
      '<p>Ten touches, two per person. The cap is the point. Nothing sends on its own, you send it from your own inbox.</p></div>' +
      '<div class="seq mb5">' + c.touches.map(row).join('') + '</div>' +
      '<div class="row wrap g2"><span class="chip"><b>5</b> people</span><span class="chip"><b>10</b> touches</span>' +
      '<span class="chip"><b>0</b> sent for you</span></div>' +
      '<div class="row mt6"><a class="btn btn-primary" href="#/c/' + c.id + '/messages">Write day 3 <span class="arr">→</span></a></div>';

    var v = Shell.mount({
      nav: 'sequence',
      crumbs: [{ label: c.company, href: '/' }, { label: 'Sequence' }],
      actions: '<span class="chip chip-pos">Day ' + c.day + ' of 14</span>',
      html: html
    });

    UI.on(v, 'click', '[data-t]', function (e, el) {
      var t = c.touches[+el.dataset.t];
      if (t.status === 'due' || t.person === 'p3') { Router.go('/c/' + c.id + '/messages'); return; }
      UI.toast(t.status === 'replied' ? esc(t.who) + ' already wrote back on day 1.' : 'That one opens on day ' + t.day + '.');
    });
  };

  /* ======================================================================
     COMPOSER
     ====================================================================== */
  var TONES = ['Peer', 'Neutral', 'Formal'];
  var LENGTHS = ['Short', 'Standard'];
  var DRAFTS = {
    '0-0': "Marcus, you moved to seat pricing in the spring and the SMB floor is five seats now. Reps stop selling and start qualifying.\n\n@@Ran that exact change at Brightline. Lost 40% of the team. Rebuilt discovery and finished at 112%.@@\n\n##frontdoor.app/p/evan-acme##\n\n**Worth fifteen minutes, or should I stay in the queue?**",
    '0-1': "Marcus, you moved to seat pricing in the spring and the SMB tier starts at five seats now. That usually means reps stop selling and start qualifying, and anyone who cannot run a two call close gets found out fast.\n\n@@I ran that exact change at Brightline last year. We lost 40% of the team, rebuilt the discovery script, and still finished at 112%.@@\n\nI applied for the mid-market role. The 30-60-90 is here:\n##frontdoor.app/p/evan-acme##\n\n**Worth fifteen minutes, or should I stay in the queue?**",
    '1-0': "Marcus, I saw the move to seat pricing this spring, with the SMB tier starting at five seats. That tends to turn reps into qualifiers.\n\n@@I led the same change at Brightline and finished the year at 112%.@@\n\n##frontdoor.app/p/evan-acme##\n\n**Would fifteen minutes be useful, or should I stay in the queue?**",
    '1-1': "Marcus, I saw that Acme moved to seat pricing this spring, with the SMB tier starting at five seats. In my experience that turns reps from sellers into qualifiers, and it finds out anyone who cannot run a two call close.\n\n@@I led the same change at Brightline last year. We lost 40% of the team, rebuilt the discovery script around longer cycles, and finished at 112%.@@\n\nI applied for the mid-market role and put a 30-60-90 together here:\n##frontdoor.app/p/evan-acme##\n\n**Would fifteen minutes be useful, or should I stay in the queue?**",
    '2-0': "Marcus, I am writing about Acme's move to seat pricing and what it does to the mid-market motion.\n\n@@I managed a comparable change at Brightline and finished the year at 112% of quota.@@\n\n##frontdoor.app/p/evan-acme##\n\n**Would you be open to a short conversation?**",
    '2-1': "Marcus, I am writing about Acme's move to seat pricing and the effect a five seat minimum tends to have on a mid-market team.\n\n@@I managed a comparable change at Brightline last year. Attrition ran close to 40%, we rebuilt discovery around longer cycles, and the team finished at 112% of quota.@@\n\nI have applied for the mid-market role and prepared a 30-60-90 plan here:\n##frontdoor.app/p/evan-acme##\n\n**Would you be open to a short conversation, or should I remain in the queue?**"
  };
  var EDITS = [
    { k: ['short', 'tight', 'cut', 'trim', 'brief'], reply: 'Cut it to four lines and dropped the setup.',
      draft: "Marcus, a five seat SMB floor turns reps into qualifiers.\n\n@@Ran that at Brightline. 112%.@@\n\n##frontdoor.app/p/evan-acme##\n\n**Fifteen minutes?**" },
    { k: ['number', 'metric', 'specific', 'data', 'proof'], reply: 'Added two numbers and named the cycle change.',
      draft: "Marcus, you moved to seat pricing in the spring and the SMB floor is five seats now. Reps stop selling and start qualifying.\n\n@@Same change at Brightline. Cycles went 30 to 70 days, 40% of the team washed out, $1.2M quota, finished at 112%.@@\n\n##frontdoor.app/p/evan-acme##\n\n**Worth fifteen minutes, or should I stay in the queue?**" },
    { k: ['warm', 'friendly', 'human', 'casual', 'stiff', 'soft'], reply: 'Warmed the opening and softened the ask.',
      draft: "Marcus, saw the move to seat pricing this spring. A five seat floor on SMB is a real shift for a team.\n\n@@Been through it. At Brightline it cost us 40% of the roster before we rebuilt discovery. Finished at 112% anyway.@@\n\n##frontdoor.app/p/evan-acme##\n\n**Happy to trade fifteen minutes if it helps. No hard feelings if not.**" },
    { k: ['funding', 'series b', 'raise', 'investor', 'growth'], reply: 'Worked the Series B into the opening.',
      draft: "Marcus, Series B, 340 people, and a reprice in the same year. That combination lands hardest on the mid-market floor.\n\n@@I ran it at Brightline. Five seat minimum, cycles doubled, 40% attrition, 112% anyway.@@\n\n##frontdoor.app/p/evan-acme##\n\n**Worth fifteen minutes, or should I stay in the queue?**" },
    { k: ['ramp', 'hiring', 'reqs', 'onboard', 'headcount'], reply: 'Reframed it around ramp instead of pricing.',
      draft: "Marcus, six AE reqs open at once means ramp is the constraint, not headcount.\n\n@@I got four AEs to quota in two quarters at Northwind while the motion was changing underneath them.@@\n\n##frontdoor.app/p/evan-acme##\n\n**Worth fifteen minutes on how I would do it here?**" }
  ];
  var REASONS = [
    ['1', 'Opens on his business, not yours'],
    ['2', 'One number, tied to the problem you named'],
    ['3', 'The page does the work a résumé would'],
    ['4', 'One ask, and an easy way to say no']
  ];

  function strip(s) { return s.replace(/@@|##|\*\*/g, ''); }

  window.Views.messages = function (params) {
    var c = Store.campaign(params.id);
    if (!c) return Router.go('/', true);
    var override = null, showWhy = true;

    var html = tabs(c, 'messages') +
      '<div class="page-head"><h1>Day 3, to Marcus</h1>' +
      '<p>He decides. This is the one that has to be about his business before it is about you.</p></div>' +
      '<div class="composer">' +
        '<div>' +
          '<div class="letter" id="letter"></div>' +
          '<div class="reasons" id="reasons"></div>' +
          '<div class="assist">' +
            '<div class="assist-log" id="log"></div>' +
            '<div class="assist-sug" id="sug"></div>' +
            '<form class="assist-in" id="assist-form">' +
              '<input id="assist-q" placeholder="Ask for a change" autocomplete="off" aria-label="Ask for a change">' +
              '<button type="submit" aria-label="Send">↑</button>' +
            '</form>' +
          '</div>' +
        '</div>' +
        '<div class="card p5 col g5">' +
          '<label class="field"><span class="row between"><b style="font-size:var(--fs-base)">Tone</b>' +
            '<span class="cap" id="tone-v">Peer</span></span>' +
            '<input type="range" id="tone" min="0" max="2" step="1" value="' + c.tone + '" aria-label="Tone"></label>' +
          '<label class="field"><span class="row between"><b style="font-size:var(--fs-base)">Length</b>' +
            '<span class="cap" id="len-v">Short</span></span>' +
            '<input type="range" id="len" min="0" max="1" step="1" value="' + c.length + '" aria-label="Length"></label>' +
          '<div class="row between"><span style="font-size:var(--fs-base);font-weight:550">Show the reasoning</span>' +
            '<button class="switch" id="why-tog" role="switch" aria-checked="true" aria-label="Show the reasoning"></button></div>' +
          '<hr class="divider">' +
          '<div class="col g2"><p class="cap">How this one does</p>' +
            '<div class="row wrap g2"><span class="chip chip-accent"><b>34%</b> reply</span><span class="chip">812 sent</span></div></div>' +
          '<button class="btn btn-primary btn-block" id="copy">Copy to clipboard</button>' +
          '<button class="btn btn-ghost btn-block btn-sm" id="mark-sent">Mark as sent</button>' +
        '</div>' +
      '</div>';

    var v = Shell.mount({
      nav: 'messages',
      crumbs: [{ label: c.company, href: '/' }, { label: 'Messages' }],
      actions: '<span class="chip">S03 HM Cold Open</span>',
      html: html
    });

    var tone = v.querySelector('#tone'), len = v.querySelector('#len');

    function draw(flash) {
      var raw = override || DRAFTS[tone.value + '-' + len.value];
      v.querySelector('#tone-v').textContent = TONES[+tone.value];
      v.querySelector('#len-v').textContent = LENGTHS[+len.value];
      var out = esc(showWhy ? raw : strip(raw));
      if (showWhy) {
        out = out.replace(/@@([\s\S]*?)@@/g, '<mark>$1</mark>')
                 .replace(/##([\s\S]*?)##/g, '<mark>$1</mark>')
                 .replace(/\*\*([\s\S]*?)\*\*/g, '<mark>$1</mark>');
      }
      var L = v.querySelector('#letter');
      L.innerHTML = out;
      if (flash) { L.classList.remove('flash'); void L.offsetWidth; L.classList.add('flash'); }
      v.querySelector('#reasons').innerHTML = showWhy
        ? REASONS.map(function (r) { return '<div class="reason"><i>' + r[0] + '</i><span>' + esc(r[1]) + '</span></div>'; }).join('')
        : '';
    }

    tone.addEventListener('input', function () { override = null; c.tone = +this.value; Store.save(); draw(); });
    len.addEventListener('input', function () { override = null; c.length = +this.value; Store.save(); draw(); });
    v.querySelector('#why-tog').addEventListener('click', function () {
      showWhy = !showWhy; this.setAttribute('aria-checked', showWhy); draw();
    });

    v.querySelector('#sug').innerHTML = ['Shorter', 'Add a number', 'Warmer', 'Use the Series B']
      .map(function (s) { return '<button type="button" class="sug">' + s + '</button>'; }).join('');

    function say(cls, text) {
      var log = v.querySelector('#log');
      log.insertAdjacentHTML('beforeend', '<div class="bubble ' + cls + '">' + esc(text) + '</div>');
      log.scrollTop = log.scrollHeight;
    }
    function ask(text) {
      if (!text.trim()) return;
      say('me', text);
      var lc = text.toLowerCase();
      var hit = EDITS.filter(function (e) { return e.k.some(function (k) { return lc.indexOf(k) > -1; }); })[0] || EDITS[0];
      say('ai', 'Working on it');
      setTimeout(function () {
        v.querySelector('#log').lastElementChild.textContent = hit.reply;
        override = hit.draft;
        draw(true);
      }, 460);
    }
    UI.on(v, 'click', '.sug', function (e, el) { ask(el.textContent); });
    v.querySelector('#assist-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var i = v.querySelector('#assist-q');
      ask(i.value); i.value = '';
    });

    v.querySelector('#copy').addEventListener('click', function () {
      var b = this;
      UI.copy(strip(override || DRAFTS[tone.value + '-' + len.value]));
      b.textContent = 'Copied';
      UI.toast('Copied. Send it from your own inbox.');
      setTimeout(function () { b.textContent = 'Copy to clipboard'; }, 1700);
    });
    v.querySelector('#mark-sent').addEventListener('click', function () {
      c.touches[3].status = 'sent';
      Store.state.tasks[4].on = true;
      Store.save();
      UI.toast('Logged. Day 5 opens on Friday.');
      Router.go('/c/' + c.id + '/sequence');
    });

    draw();
  };

  /* ======================================================================
     PUBLIC PAGE
     ====================================================================== */
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

    var html = tabs(c, 'page') +
      '<div class="page-head"><h1>What Marcus sees</h1>' +
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
      s.on = !s.on;
      Store.save();
      paintToggles();
    });

    document.getElementById('copy-link').addEventListener('click', function () {
      UI.copy('https://frontdoor.app/p/' + c.slug);
      UI.toast('Link copied.');
    });
    document.getElementById('sim').addEventListener('click', function () {
      c.views += 1; c.lastView = 'just now'; Store.save();
      UI.toast('Marcus opened your page. Just now.');
      Router.go('/c/' + c.id + '/page');
    });
  };
})(window, document);

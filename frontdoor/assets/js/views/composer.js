/* ==========================================================================
   views/composer.js — write the message, and manage your own templates
   ========================================================================== */
(function (window, document) {
  'use strict';

  var esc = UI.esc;
  window.Views = window.Views || {};

  var EDITS = [
    { k: ['short', 'tight', 'cut', 'trim', 'brief'], reply: 'Cut the setup. Four lines.',
      run: function (t) { return t.split('\n\n').filter(function (p) { return p.trim(); }).slice(0, 2).join('\n\n') + '\n\nWorth fifteen minutes?'; } },
    { k: ['number', 'metric', 'specific', 'data', 'proof'], reply: 'Added the cycle change and the quota.',
      run: function (t) { return t.replace(/finished at 112%/i, 'finished at 112% on a $1.2M number, with cycles going 30 to 70 days'); } },
    { k: ['warm', 'friendly', 'human', 'casual', 'soft'], reply: 'Softened the ask at the end.',
      run: function (t) { return t.replace(/Worth fifteen minutes.*$/m, 'Happy to trade fifteen minutes if it helps. No hard feelings if not.'); } },
    { k: ['formal', 'stiff', 'professional'], reply: 'Made it more formal.',
      run: function (t) { return t.replace(/^(\w+), /m, 'Hello $1,\n\n').replace(/Worth fifteen minutes.*$/m, 'Would you be open to a short conversation?'); } }
  ];

  window.Views.messages = function (params) {
    var c = Store.campaign(params.id);
    if (!c) return Router.go('/', true);

    var step = c.steps.filter(function (s) { return s.id === c.activeStep; })[0] || c.steps[3] || c.steps[0];
    var contact = c.contacts.filter(function (x) { return x.id === step.contact; })[0] || null;
    var tpl = Store.template(step.template);
    var draft = Store.fill(tpl ? tpl.body : '', c, contact);

    if (c.pendingInsert) {
      draft = c.pendingInsert + '\n\n' + draft;
      c.pendingInsert = null;
      Store.save();
    }

    var v = Shell.mount({
      nav: 'messages',
      crumbs: [{ label: c.company, href: '/' }, { label: 'Messages' }],
      actions: '<button class="btn btn-secondary btn-sm" id="tpl-mgr">Templates</button>',
      html: Views.tabs(c, 'messages') +
        '<div class="page-head"><h1>Day ' + step.day + ', to ' + esc(contact ? contact.name.split(' ')[0] : 'whoever is left') + '</h1>' +
        '<p>' + esc(step.note) + '</p></div>' +
        '<div class="picker" id="picker"></div>' +
        '<div class="composer">' +
          '<div>' +
            '<textarea class="letter-edit" id="draft" spellcheck="false" aria-label="Your message"></textarea>' +
            '<div class="row between mt2"><span class="hint" id="count"></span>' +
            '<span class="hint">Merge fields: {first} {company} {role} {angle}</span></div>' +
            '<div class="assist">' +
              '<div class="assist-log" id="log"></div>' +
              '<div class="assist-sug" id="sug"></div>' +
              '<form class="assist-in" id="assist-form">' +
                '<input id="assist-q" placeholder="Ask for a change" autocomplete="off" aria-label="Ask for a change">' +
                '<button type="submit" aria-label="Send">↑</button></form>' +
            '</div>' +
          '</div>' +
          '<div class="col g4">' +
            '<div class="card p5 col g4" id="ctx"></div>' +
            '<div class="card p5 col g3">' +
              '<button class="btn btn-primary btn-block" id="copy">Copy to clipboard</button>' +
              '<button class="btn btn-secondary btn-block btn-sm" id="save-tpl">Save as a template</button>' +
              '<button class="btn btn-ghost btn-block btn-sm" id="sent">Mark as sent</button>' +
            '</div>' +
          '</div>' +
        '</div>'
    });

    var ta = v.querySelector('#draft');
    ta.value = draft;

    function count() {
      var w = ta.value.trim() ? ta.value.trim().split(/\s+/).length : 0;
      v.querySelector('#count').innerHTML = w + ' words' +
        (w > 130 ? ' <span style="color:var(--warn)">· long for a first touch</span>' : '');
    }
    function grow() { ta.style.height = 'auto'; ta.style.height = Math.max(260, ta.scrollHeight) + 'px'; }
    ta.addEventListener('input', function () { count(); grow(); });

    /* step picker */
    v.querySelector('#picker').innerHTML = c.steps.map(function (s) {
      var p = c.contacts.filter(function (x) { return x.id === s.contact; })[0];
      return '<button class="pick" data-step="' + s.id + '" aria-selected="' + (s.id === step.id) + '"' +
        ' style="--pc:var(' + (p ? p.colour : '--line-3') + ')">' +
        '<span class="pick-day">Day ' + s.day + '</span>' +
        '<span class="pick-who">' + esc(p ? p.name.split(' ')[0] : 'Anyone') + '</span></button>';
    }).join('');
    UI.on(v, 'click', '[data-step]', function (e, el) {
      c.activeStep = el.dataset.step; Store.save();
      Router.go('/c/' + c.id + '/messages');
      Views.messages(params);
    });

    /* context panel */
    function paintCtx() {
      var box = v.querySelector('#ctx');
      if (!contact) { box.innerHTML = '<p class="cap">No contact</p><p class="dim" style="font-size:var(--fs-sm)">This one goes to whoever went quiet.</p>'; return; }
      var acts = (contact.activity || []).slice(0, 2);
      box.innerHTML =
        '<div class="row g3"><span class="avatar avatar-md" style="background:var(' + contact.colour + ')">' +
          esc(Store.initials(contact.name)) + '</span>' +
          '<span class="grow"><b style="font-size:var(--fs-base)">' + esc(contact.name) + '</b>' +
          '<p class="dimmer" style="font-size:var(--fs-sm)">' + esc(contact.title) + '</p></span></div>' +
        (contact.ask ? '<div><p class="cap mb2">You want</p><p style="font-size:var(--fs-sm)">' + esc(contact.ask) + '</p></div>' : '') +
        (acts.length
          ? '<div><p class="cap mb2">Lately</p>' + acts.map(function (a) {
              return '<div class="mini-act"><p>' + esc(a.text) + '</p>' +
                '<button class="btn btn-ghost btn-sm" data-insert="' + esc(a.use) + '">Drop this in</button></div>';
            }).join('') + '</div>'
          : '<p class="hint">No recent public activity found.</p>') +
        '<a class="hint" href="#/c/' + c.id + '/research">All research →</a>';
    }
    paintCtx();
    UI.on(v, 'click', '[data-insert]', function (e, el) {
      ta.value = el.dataset.insert + '\n\n' + ta.value;
      count(); grow(); ta.focus();
      UI.toast('Added to the top. Edit it so it sounds like you.');
    });

    /* assistant */
    v.querySelector('#sug').innerHTML = ['Shorter', 'Add a number', 'Warmer', 'More formal']
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
        ta.value = hit.run(ta.value);
        count(); grow();
        ta.classList.remove('flash'); void ta.offsetWidth; ta.classList.add('flash');
      }, 440);
    }
    UI.on(v, 'click', '.sug', function (e, el) { ask(el.textContent); });
    v.querySelector('#assist-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var i = v.querySelector('#assist-q'); ask(i.value); i.value = '';
    });

    /* actions */
    v.querySelector('#copy').addEventListener('click', function () {
      var b = this; UI.copy(ta.value);
      b.textContent = 'Copied'; UI.toast('Copied. Send it from your own inbox.');
      setTimeout(function () { b.textContent = 'Copy to clipboard'; }, 1700);
    });
    v.querySelector('#sent').addEventListener('click', function () {
      Store.updateStep(c.id, step.id, { status: 'sent' });
      Store.completeTask('t6');
      UI.toast('Logged.');
      Router.go('/c/' + c.id + '/sequence');
    });
    v.querySelector('#save-tpl').addEventListener('click', function () {
      var t = Store.addTemplate({
        name: (contact ? contact.persona : 'Custom') + ', day ' + step.day,
        persona: contact ? contact.persona : 'Other',
        channel: step.channel,
        body: ta.value
      });
      Store.updateStep(c.id, step.id, { template: t.id });
      UI.toast('Saved as "' + t.name + '". It is in your template list now.');
    });
    document.getElementById('tpl-mgr').addEventListener('click', function () { Router.go('/templates'); });

    count(); grow();
  };

  /* ======================================================================
     TEMPLATE LIBRARY
     ====================================================================== */
  window.Views.templates = function () {
    var selected = Store.state.templates[0] ? Store.state.templates[0].id : null;

    var v = Shell.mount({
      nav: 'templates',
      crumbs: [{ label: 'Templates' }],
      actions: '<button class="btn btn-primary btn-sm" id="new-tpl">New template</button>',
      html: '<div class="page-head"><h1>Your messages</h1>' +
        '<p>Seven to start with. Edit any of them and the change sticks for every campaign after this. The ones you write yourself sit alongside them.</p></div>' +
        '<div class="split"><div id="tpl-list"></div><div id="tpl-edit"></div></div>'
    });

    function paintList() {
      v.querySelector('#tpl-list').innerHTML = Store.state.templates.map(function (t) {
        return '<button class="rankrow' + (t.id === selected ? ' on' : '') + '" data-tpl="' + t.id + '"' +
          ' style="--pc:var(' + Store.colourFor(t.persona) + ')">' +
          '<span class="rank" style="background:none;color:var(--ink-4)">' + (t.stock ? '' : '★') + '</span>' +
          '<span class="rr-main"><span class="rr-name">' + esc(t.name) + '</span>' +
          '<span class="rr-sub">' + esc(t.persona) + ' · ' + esc(t.channel) + '</span></span>' +
          '<span class="rr-tag">' + (t.stock ? 'Stock' : 'Yours') + '</span></button>';
      }).join('');
      paintEdit();
    }

    function paintEdit() {
      var t = Store.template(selected);
      var box = v.querySelector('#tpl-edit');
      if (!t) { box.innerHTML = '<div class="card p6"><p class="dim">Pick one on the left.</p></div>'; return; }
      box.innerHTML =
        '<div class="card p5 col g3">' +
          '<div class="field"><label for="t-name">Name</label><input class="input" id="t-name" value="' + esc(t.name) + '"></div>' +
          '<div class="grid cols-2">' +
            '<div class="field"><label for="t-persona">For</label><select class="input" id="t-persona">' +
              Store.PERSONAS.map(function (p) { return '<option' + (p.key === t.persona ? ' selected' : '') + '>' + esc(p.key) + '</option>'; }).join('') +
            '</select></div>' +
            '<div class="field"><label for="t-channel">Channel</label><select class="input" id="t-channel">' +
              Store.CHANNELS.map(function (ch) { return '<option' + (ch === t.channel ? ' selected' : '') + '>' + ch + '</option>'; }).join('') +
            '</select></div>' +
          '</div>' +
          '<div class="field"><label for="t-body">Message</label>' +
            '<textarea class="input" id="t-body" style="min-height:250px;font-family:var(--mono);font-size:13px;line-height:1.8">' + esc(t.body) + '</textarea>' +
            '<p class="hint">Merge fields: {first} {name} {title} {company} {role} {angle} {slug}</p></div>' +
          '<div class="row between">' +
            '<span class="hint" id="t-saved" style="opacity:0;transition:opacity var(--t-2)">Saved</span>' +
            '<button class="btn btn-danger btn-sm" id="t-del">Delete</button></div>' +
        '</div>';

      ['name', 'persona', 'channel', 'body'].forEach(function (k) {
        var el = box.querySelector('#t-' + k);
        el.addEventListener('change', function () {
          var o = {}; o[k] = this.value;
          Store.updateTemplate(t.id, o);
          var s = box.querySelector('#t-saved'); s.style.opacity = 1;
          setTimeout(function () { s.style.opacity = 0; }, 1400);
          if (k === 'name' || k === 'persona' || k === 'channel') setTimeout(paintList, 0);
        });
      });
      box.querySelector('#t-del').addEventListener('click', function () {
        UI.confirm({ title: 'Delete "' + t.name + '"?', body: 'Any step using it falls back to writing from scratch.', confirm: 'Delete', danger: true })
          .then(function (ok) {
            if (!ok) return;
            Store.removeTemplate(t.id);
            selected = Store.state.templates[0] ? Store.state.templates[0].id : null;
            paintList(); UI.toast('Deleted.');
          });
      });
    }

    UI.on(v, 'click', '[data-tpl]', function (e, el) { selected = el.dataset.tpl; paintList(); });
    document.getElementById('new-tpl').addEventListener('click', function () {
      var t = Store.addTemplate({ name: 'Untitled', persona: 'Peer', channel: 'Email',
        body: '{first}, \n\n\n\nWorth fifteen minutes?' });
      selected = t.id; paintList();
      UI.toast('New template. Give it a name.');
    });

    paintList();
  };
})(window, document);

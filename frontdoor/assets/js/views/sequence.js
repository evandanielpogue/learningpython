/* ==========================================================================
   views/sequence.js — the sequence builder
   Step rail on the left with wait-day connectors, editor on the right.
   Copy lives here, so this is the only place a message gets written.
   ========================================================================== */
(function (window, document) {
  'use strict';

  var esc = UI.esc;
  window.Views = window.Views || {};

  var CH_ICON = { Email: '✉', LinkedIn: 'in', Call: '☏', Reply: '↩', ATS: '▤', Text: '💬' };
  var FIELDS = ['{first}', '{name}', '{title}', '{company}', '{role}', '{angle}', '{slug}', '{me}'];

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

  window.Views.sequence = function (params) {
    var c = Store.campaign(params.id);
    if (!c) return Router.go('/', true);
    if (!c.steps.some(function (s) { return s.id === c.activeStep; })) {
      c.activeStep = c.steps[0] ? c.steps[0].id : null;
    }

    /* a line handed over from Research goes to the top of the open step */
    if (c.pendingInsert) {
      var target = c.steps.filter(function (s) { return s.id === c.activeStep; })[0];
      if (target) {
        var tv = target.variants[target.activeVariant] || target.variants[0];
        var current = Store.bodyFor(c, target);
        tv.body = c.pendingInsert + '\n\n' + current;
      }
      c.pendingInsert = null;
      Store.save();
    }

    var v = Shell.mount({
      nav: 'sequence',
      crumbs: [{ label: c.company, href: '/' }, { label: 'Sequence' }],
      actions: '<span class="chip" id="cap-chip"></span>' +
               '<button class="btn btn-secondary btn-sm" id="preview">Preview</button>',
      html: '<div class="page-head"><h1>Sequence</h1>' +
            '<p>Ten touches over two weeks. Change the order, the timing, who each one goes to, and what it says.</p></div>' +
            '<div class="builder"><div class="rail" id="rail"></div><div id="editor"></div></div>'
    });

    function step() { return c.steps.filter(function (s) { return s.id === c.activeStep; })[0] || c.steps[0]; }
    function contactOf(s) { return c.contacts.filter(function (x) { return x.id === s.contact; })[0] || null; }
    function variant(s) { return s.variants[s.activeVariant] || s.variants[0]; }
    function hasSubject(s) { return s.channel === 'Email'; }

    /* ---------------- rail ---------------- */
    function railHTML() {
      var out = '';
      c.steps.forEach(function (s, i) {
        if (i > 0) {
          var wait = Math.max(0, s.day - c.steps[i - 1].day);
          out += '<div class="wait"><span class="wait-line"></span>' +
            '<label class="wait-pill">Wait ' +
              '<input type="number" min="0" max="60" value="' + wait + '" data-wait="' + s.id + '" aria-label="Days to wait">' +
              ' day' + (wait === 1 ? '' : 's') + '</label><span class="wait-line"></span></div>';
        }
        var p = contactOf(s);
        var col = p ? p.colour : '--line-3';
        var dot = s.status === 'replied' ? 'ok' : s.status === 'sent' ? 'done' : s.status === 'due' ? 'due' : '';
        out += '<button class="stepcard' + (s.id === c.activeStep ? ' on' : '') + '" data-step="' + s.id + '"' +
          ' style="--pc:var(' + col + ')">' +
          '<span class="sc-top"><span class="sc-n">' + (i + 1) + '</span>' +
            '<span class="sc-ch">' + (CH_ICON[s.channel] || '•') + ' ' + esc(s.channel) + '</span>' +
            '<span class="sc-dot ' + dot + '"></span></span>' +
          '<span class="sc-who">' + esc(p ? p.name : 'No contact') + '</span>' +
          '<span class="sc-note">' + esc(s.note) + '</span>' +
          '<span class="sc-foot"><span class="sc-day">Day ' + s.day + '</span>' +
            (s.variants.length > 1 ? '<span class="sc-var">' + s.variants.length + ' variants</span>' : '') +
          '</span></button>';
      });
      out += '<button class="addrow mt3" id="add-step">+ Add a step</button>';
      return out;
    }

    /* ---------------- editor ---------------- */
    function editorHTML() {
      var s = step();
      if (!s) return '<div class="card p6"><p class="dim">No steps yet.</p></div>';
      var p = contactOf(s);
      var vr = variant(s);
      var body = Store.bodyFor(c, s);

      return '<div class="card editor">' +
        '<div class="ed-head">' +
          '<div class="row g3 grow" style="min-width:0">' +
            (p ? '<span class="avatar avatar-md" style="background:var(' + p.colour + ')">' + esc(Store.initials(p.name)) + '</span>' : '<span class="avatar avatar-md" style="background:var(--line-3)">—</span>') +
            '<span class="grow" style="min-width:0"><b style="font-size:var(--fs-md)">' + esc(p ? p.name : 'No contact yet') + '</b>' +
            '<p class="dimmer" style="font-size:var(--fs-sm)">' + esc(p ? p.title : 'Pick who this goes to') + '</p></span>' +
          '</div>' +
          '<div class="row g2">' +
            '<button class="icon-btn" id="dupe" title="Duplicate step" aria-label="Duplicate step">⧉</button>' +
            '<button class="icon-btn" id="drop" title="Delete step" aria-label="Delete step">✕</button>' +
          '</div>' +
        '</div>' +

        '<div class="ed-meta">' +
          '<label class="field"><span>Goes to</span><select class="input" data-f="contact">' +
            '<option value="">Nobody in particular</option>' +
            c.contacts.map(function (x) { return '<option value="' + x.id + '"' + (x.id === s.contact ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('') +
          '</select></label>' +
          '<label class="field"><span>Channel</span><select class="input" data-f="channel">' +
            Store.CHANNELS.map(function (ch) { return '<option' + (ch === s.channel ? ' selected' : '') + '>' + ch + '</option>'; }).join('') +
          '</select></label>' +
          '<label class="field"><span>Day</span><input class="input" type="number" min="0" max="120" value="' + s.day + '" data-f="day"></label>' +
          '<label class="field"><span>Start from</span><select class="input" data-f="template">' +
            '<option value="">Blank</option>' +
            Store.state.templates.map(function (t) { return '<option value="' + t.id + '"' + (t.id === s.template ? ' selected' : '') + '>' + esc(t.name) + '</option>'; }).join('') +
          '</select></label>' +
        '</div>' +

        '<div class="ed-tabs">' +
          s.variants.map(function (x, i) {
            return '<button class="vtab' + (i === s.activeVariant ? ' on' : '') + '" data-v="' + i + '">' + esc(x.label) +
              (s.variants.length > 1 && i === s.activeVariant ? '<span class="vx" data-vx="' + i + '" role="button" aria-label="Remove variant">✕</span>' : '') +
              '</button>';
          }).join('') +
          '<button class="vadd" id="add-variant" title="Add a variant to test">+</button>' +
          '<span class="grow"></span>' +
          '<span class="hint" id="words"></span>' +
        '</div>' +

        '<div class="ed-body">' +
          (hasSubject(s)
            ? '<input class="subject" id="subject" placeholder="Subject line, lowercase, about them" value="' + esc(vr.subject) + '">'
            : '') +
          '<textarea class="bodytext" id="body" spellcheck="false" aria-label="Message">' + esc(body) + '</textarea>' +
          '<div class="fieldbar">' + FIELDS.map(function (f) {
            return '<button class="fbtn" data-field="' + esc(f) + '">' + esc(f) + '</button>';
          }).join('') + '</div>' +
        '</div>' +

        '<div class="ed-foot">' +
          '<label class="field grow"><span>Note to yourself</span>' +
            '<input class="input" value="' + esc(s.note) + '" data-f="note"></label>' +
          '<button class="btn btn-secondary btn-sm" id="save-tpl">Save as template</button>' +
          '<button class="btn btn-primary btn-sm" id="mark">' + (s.status === 'sent' || s.status === 'replied' ? 'Sent' : 'Mark sent') + '</button>' +
        '</div>' +
      '</div>' +

      '<div class="grid cols-2 mt4">' +
        '<div class="card p5 col g3" id="ctx"></div>' +
        '<div class="card assist-card">' +
          '<div class="assist-log" id="log"></div>' +
          '<div class="assist-sug" id="sug"></div>' +
          '<form class="assist-in" id="assist-form">' +
            '<input id="assist-q" placeholder="Ask for a change" autocomplete="off" aria-label="Ask for a change">' +
            '<button type="submit" aria-label="Send">↑</button></form>' +
        '</div>' +
      '</div>';
    }

    function ctxHTML() {
      var s = step(), p = contactOf(s);
      if (!p) return '<p class="cap">Context</p><p class="dim" style="font-size:var(--fs-sm)">Pick a contact and anything they said recently shows up here.</p>';
      var acts = (p.activity || []).slice(0, 2);
      return '<p class="cap">What ' + esc(p.name.split(' ')[0]) + ' said lately</p>' +
        (acts.length
          ? acts.map(function (a) {
              return '<div class="mini-act"><p>' + esc(a.text) + '</p>' +
                '<button class="btn btn-ghost btn-sm" data-insert="' + esc(a.use) + '">Drop this in</button></div>';
            }).join('')
          : '<p class="hint">Nothing public found. Worth knowing on its own.</p>') +
        (p.ask ? '<p class="hint">You want: ' + esc(p.ask) + '</p>' : '') +
        '<a class="hint" href="#/c/' + c.id + '/research">All research →</a>';
    }

    /* ---------------- painting ---------------- */
    function paintRail() {
      v.querySelector('#rail').innerHTML = railHTML();
      var people = {};
      c.steps.forEach(function (s) { if (s.contact) people[s.contact] = (people[s.contact] || 0) + 1; });
      var over = Object.keys(people).filter(function (k) { return people[k] > 2; }).length;
      var chip = document.getElementById('cap-chip');
      if (chip) {
        chip.className = 'chip' + (over ? ' chip-warn' : '');
        chip.innerHTML = over
          ? '<b>' + over + '</b> over two touches'
          : '<b>' + c.steps.length + '</b> steps · <b>' + lastDay() + '</b> days';
      }
    }
    function lastDay() { return c.steps.length ? c.steps[c.steps.length - 1].day : 0; }

    function paintEditor() {
      v.querySelector('#editor').innerHTML = editorHTML();
      v.querySelector('#ctx').innerHTML = ctxHTML();
      wire();
      words();
      grow();
    }
    function paintAll() { paintRail(); paintEditor(); }

    function words() {
      var b = v.querySelector('#body'); if (!b) return;
      var n = b.value.trim() ? b.value.trim().split(/\s+/).length : 0;
      var el = v.querySelector('#words');
      if (el) el.innerHTML = n + ' words' + (n > 130 ? ' <span style="color:var(--warn)">· long</span>' : '');
    }
    function grow() {
      var b = v.querySelector('#body'); if (!b) return;
      b.style.height = 'auto'; b.style.height = Math.max(220, b.scrollHeight) + 'px';
    }

    /* ---------------- wiring ---------------- */
    function wire() {
      var s = step();
      var body = v.querySelector('#body');
      var subject = v.querySelector('#subject');

      function persist() {
        Store.updateVariant(c.id, s.id, s.activeVariant, {
          body: body ? body.value : '',
          subject: subject ? subject.value : (variant(s).subject || '')
        });
      }
      if (body) body.addEventListener('input', function () { words(); grow(); persist(); });
      if (subject) subject.addEventListener('input', persist);

      v.querySelectorAll('[data-f]').forEach(function (el) {
        el.addEventListener('change', function () {
          var k = el.dataset.f;
          var val = k === 'day' ? Math.max(0, parseInt(el.value, 10) || 0) : el.value;
          persist();
          Store.updateStep(c.id, s.id, (function () { var o = {}; o[k] = val; return o; })());
          setTimeout(paintAll, 0);
        });
      });

      v.querySelectorAll('[data-v]').forEach(function (el) {
        el.addEventListener('click', function (e) {
          if (e.target.closest('[data-vx]')) return;
          persist();
          s.activeVariant = +el.dataset.v; Store.save(); paintAll();
        });
      });
      v.querySelectorAll('[data-vx]').forEach(function (el) {
        el.addEventListener('click', function (e) {
          e.stopPropagation();
          Store.removeVariant(c.id, s.id, +el.dataset.vx);
          paintAll(); UI.toast('Variant removed.');
        });
      });
      var addv = v.querySelector('#add-variant');
      if (addv) addv.addEventListener('click', function () {
        persist();
        var nv = Store.addVariant(c.id, s.id);
        paintAll();
        UI.toast(nv ? 'Variant ' + nv.label + ' added. Change one thing, not five.' : 'Could not add.');
      });

      v.querySelectorAll('[data-field]').forEach(function (el) {
        el.addEventListener('click', function () {
          if (!body) return;
          var at = body.selectionStart || body.value.length;
          body.value = body.value.slice(0, at) + el.dataset.field + body.value.slice(at);
          body.focus();
          body.selectionStart = body.selectionEnd = at + el.dataset.field.length;
          words(); grow(); persist();
        });
      });

      v.querySelectorAll('[data-insert]').forEach(function (el) {
        el.addEventListener('click', function () {
          if (!body) return;
          body.value = el.dataset.insert + '\n\n' + body.value;
          words(); grow(); persist(); body.focus();
          UI.toast('Added to the top. Edit it so it sounds like you.');
        });
      });

      var dupe = v.querySelector('#dupe');
      if (dupe) dupe.addEventListener('click', function () {
        var copy = Store.duplicateStep(c.id, s.id);
        if (copy) { c.activeStep = copy.id; Store.save(); paintAll(); UI.toast('Step duplicated.'); }
      });
      var drop = v.querySelector('#drop');
      if (drop) drop.addEventListener('click', function () {
        UI.confirm({ title: 'Delete this step?', body: 'It comes out of the sequence. The contact stays.', confirm: 'Delete', danger: true })
          .then(function (ok) {
            if (!ok) return;
            Store.removeStep(c.id, s.id);
            c.activeStep = c.steps[0] ? c.steps[0].id : null; Store.save();
            paintAll(); UI.toast('Step deleted.');
          });
      });
      var mark = v.querySelector('#mark');
      if (mark) mark.addEventListener('click', function () {
        Store.updateStep(c.id, s.id, { status: 'sent' });
        Store.completeTask('t6');
        paintAll(); UI.toast('Logged.');
      });
      var savet = v.querySelector('#save-tpl');
      if (savet) savet.addEventListener('click', function () {
        persist();
        var p = contactOf(s);
        var t = Store.addTemplate({
          name: (p ? p.persona : 'Custom') + ', day ' + s.day,
          persona: p ? p.persona : 'Other', channel: s.channel, body: body ? body.value : ''
        });
        Store.updateStep(c.id, s.id, { template: t.id });
        paintAll(); UI.toast('Saved as "' + t.name + '".');
      });

      /* assistant */
      var sug = v.querySelector('#sug');
      if (sug) sug.innerHTML = ['Shorter', 'Add a number', 'Warmer', 'More formal']
        .map(function (x) { return '<button type="button" class="sug">' + x + '</button>'; }).join('');
      function say(cls, text) {
        var log = v.querySelector('#log');
        log.insertAdjacentHTML('beforeend', '<div class="bubble ' + cls + '">' + esc(text) + '</div>');
        log.scrollTop = log.scrollHeight;
      }
      function ask(text) {
        if (!text.trim() || !body) return;
        say('me', text);
        var lc = text.toLowerCase();
        var hit = EDITS.filter(function (e) { return e.k.some(function (k) { return lc.indexOf(k) > -1; }); })[0] || EDITS[0];
        say('ai', 'Working on it');
        setTimeout(function () {
          v.querySelector('#log').lastElementChild.textContent = hit.reply;
          body.value = hit.run(body.value);
          words(); grow(); persist();
          body.classList.remove('flash'); void body.offsetWidth; body.classList.add('flash');
        }, 440);
      }
      v.querySelectorAll('.sug').forEach(function (el) { el.addEventListener('click', function () { ask(el.textContent); }); });
      var form = v.querySelector('#assist-form');
      if (form) form.addEventListener('submit', function (e) {
        e.preventDefault();
        var i = v.querySelector('#assist-q'); ask(i.value); i.value = '';
      });
    }

    /* rail events (delegated, survives repaints) */
    UI.on(v, 'click', '[data-step]', function (e, el) {
      var b = v.querySelector('#body');
      if (b) Store.updateVariant(c.id, step().id, step().activeVariant, { body: b.value });
      c.activeStep = el.dataset.step; Store.save(); paintAll();
    });
    UI.on(v, 'change', '[data-wait]', function (e, el) {
      Store.setWait(c.id, el.dataset.wait, parseInt(el.value, 10) || 0);
      setTimeout(paintAll, 0);
    });
    UI.on(v, 'click', '#add-step', function () {
      var s = Store.addStep(c.id);
      c.activeStep = s.id; Store.save(); paintAll();
      UI.toast('Step added. Set the day and who it goes to.');
    });

    document.getElementById('preview').addEventListener('click', function () {
      var s = step(), p = contactOf(s), vr = variant(s);
      var b = v.querySelector('#body');
      var text = Store.fill(b ? b.value : Store.bodyFor(c, s), c, p);
      var subj = Store.fill(vr.subject || '', c, p);
      UI.sheet({
        title: 'How it lands',
        html: '<div class="mailprev">' +
          '<div class="mp-head"><span class="avatar avatar-md" style="background:var(' + (p ? p.colour : '--line-3') + ')">' +
            esc(p ? Store.initials(p.name) : '—') + '</span>' +
            '<div><b>' + esc(Store.state.profile.name) + '</b>' +
            '<p class="dimmer" style="font-size:var(--fs-sm)">to ' + esc(p ? p.name : 'nobody yet') + ' · ' + esc(s.channel) + '</p></div></div>' +
          (subj ? '<p class="mp-subject">' + esc(subj) + '</p>' : '') +
          '<pre class="mp-body">' + esc(text) + '</pre>' +
        '</div>'
      });
    });

    paintAll();
  };
})(window, document);

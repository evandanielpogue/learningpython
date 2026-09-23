/* ==========================================================================
   views/sequence.js — the sequence builder
   Step rail on the left with wait-day connectors, editor on the right.
   One message per step, written to one person. No variants, because you
   cannot A/B test a single email to a single human being.
   ========================================================================== */
(function (window, document) {
  'use strict';

  var esc = UI.esc;
  window.Views = window.Views || {};

  function chIcon(ch) {
    if (ch === 'LinkedIn') return UI.liMark(11);
    var name = { Email: 'email', Call: 'call', Reply: 'reply', ATS: 'ats', Text: 'text' }[ch];
    return name ? Icon.svg(name, 12) : '';
  }

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
    Store.touch(c.id);
    Store.materialise(c.id);
    if (!c.steps.some(function (s) { return s.id === c.activeStep; })) {
      c.activeStep = c.steps[0] ? c.steps[0].id : null;
    }

    /* a line handed over from Research goes to the top of the open step */
    if (c.pendingInsert) {
      var target = c.steps.filter(function (s) { return s.id === c.activeStep; })[0];
      if (target) target.body = c.pendingInsert + '\n\n' + Store.bodyFor(c, target);
      c.pendingInsert = null;
      Store.save();
    }

    var v = Shell.mount({
      nav: 'sequence',
      crumbs: [{ label: 'Overview', href: '/' }, { label: c.company, href: '/c/' + c.id }, { label: 'Sequence' }],
      actions: '<span class="chip" id="cap-chip"></span>' +
               '<button class="btn btn-secondary btn-sm" id="preview">Preview</button>',
      html: '<div class="page-head"><h1>Sequence</h1>' +
            '<p>Ten touches over two weeks. Change the order, the timing, who each one goes to, and what it says.</p></div>' +
            UI.tipHTML('sequence-touches') +
            '<div id="seq-mount"></div>'
    });

    /* nothing to edit until there is something to edit */
    function emptyHTML() {
      if (!c.contacts.length) {
        return '<div class="card" style="overflow:hidden"><div class="empty">' +
          '<span class="art">\u25ce</span><h2>Add someone first</h2>' +
          '<p>A sequence is who you are writing to and when. Add the people we found for ' +
          esc(c.company) + ' and the fourteen days build themselves around them.</p>' +
          '<a class="btn btn-primary btn-lg" href="#/c/' + c.id + '/people">Add contacts <span class="arr">\u2192</span></a>' +
          '</div></div>';
      }
      return '<div class="card" style="overflow:hidden"><div class="empty">' +
        '<span class="art">\u2261</span><h2>Build the fourteen days</h2>' +
        '<p>Ten touches across the ' + c.contacts.length + ' ' +
        (c.contacts.length === 1 ? 'person' : 'people') + ' on your list, each starting from the template you normally send ' +
        'them at that point. Change anything after.</p>' +
        '<button class="btn btn-primary btn-lg" id="build">Build it <span class="arr">\u2192</span></button>' +
        '</div></div>';
    }

    function step() { return c.steps.filter(function (s) { return s.id === c.activeStep; })[0] || c.steps[0]; }
    function contactOf(s) { return c.contacts.filter(function (x) { return x.id === s.contact; })[0] || null; }
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
        var t = Store.template(s.template);
        out += '<button class="stepcard' + (s.id === c.activeStep ? ' on' : '') + '" data-step="' + s.id + '"' +
          ' style="--pc:var(' + col + ')">' +
          '<span class="sc-top"><span class="sc-n">' + (i + 1) + '</span>' +
            '<span class="sc-ch">' + chIcon(s.channel) + ' ' + esc(s.channel) + '</span>' +
            '<span class="sc-dot ' + dot + '"></span></span>' +
          '<span class="sc-who">' + esc(p ? p.name : 'No contact') + '</span>' +
          '<span class="sc-note">' + esc(s.note) + '</span>' +
          '<span class="sc-foot"><span class="sc-day">Day ' + s.day + '</span>' +
            (t ? '<span class="sc-tpl">' + esc(t.stage) + '</span>' : '') +
          '</span></button>';
      });
      out += '<button class="addrow mt3" id="add-step">+ Add a step</button>';
      return out;
    }

    /* ---------------- editor ---------------- */
    function editorHTML() {
      var s = step();
      if (!s) return '<div class="card p6"><p class="dim">No steps yet. Add one on the left.</p></div>';
      var p = contactOf(s);
      var t = Store.template(s.template);
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
        '</div>' +

        '<div class="ed-tplbar">' +
          (t ? '<span class="tplmark"><b>' + esc(t.name) + '</b><em>' + esc(t.stage) + ' · ' + esc(t.persona) + '</em></span>'
             : '<span class="tplmark tplmark-off"><b>Written from scratch</b><em>Or start from something you already send</em></span>') +
          '<button class="btn btn-secondary btn-sm" id="pick-tpl">' + (t ? 'Use a different template' : 'Use a template') + '</button>' +
        '</div>' +

        '<div class="ed-body">' +
          (hasSubject(s)
            ? '<input class="subject" id="subject" placeholder="Subject line, lowercase, about them" value="' + esc(s.subject || '') + '">'
            : '') +
          '<textarea class="bodytext" id="body" spellcheck="false" aria-label="Message" placeholder="Write it, or pull in a template above.">' + esc(body) + '</textarea>' +
          '<div class="ed-count"><span class="hint" id="words"></span></div>' +
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
          '<div class="assist-head"><b>Change something</b><span class="hint">Edits the draft in place</span></div>' +
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
          : '<p class="hint">Nothing public found for them yet. Worth knowing on its own.</p>') +
        (p.ask ? '<p class="hint">You want: ' + esc(p.ask) + '</p>' : '') +
        '<a class="hint" href="#/c/' + c.id + '/research">All research →</a>';
    }

    /* ---------------- template picker ---------------- */
    function openPicker() {
      var s = step();
      var p = contactOf(s);
      var who = p ? p.persona.toLowerCase() : 'someone';
      var list = Store.templatesFor(p ? p.persona : null, s.channel);

      UI.sheet({
        title: 'What do you usually send ' + (p ? 'a ' + who : 'here') + '?',
        cls: 'modal-picker',
        onMount: function (node, close) {
          UI.on(node, 'click', '[data-use]', function (e, el) {
            var t = Store.template(el.dataset.use);
            if (!t) return;
            Store.updateStep(c.id, s.id, {
              template: t.id,
              body: Store.fill(t.body, c, p),
              channel: t.channel
            });
            close();
            paintAll();
            UI.toast('Pulled in "' + t.name + '". Names already filled in.');
          });
        },
        html: '<p class="dim mb4" style="font-size:var(--fs-sm)">Sorted by how well each one fits this step. Picking one fills in the names for you.</p>' +
          '<div class="tplpick">' + list.map(function (t) {
            var fit = (p && t.persona === p.persona ? 1 : 0) + (t.channel === s.channel ? 1 : 0);
            return '<button class="tplopt" data-use="' + t.id + '">' +
              '<span class="row between g2 wrap"><b>' + esc(t.name) + '</b>' +
              (fit === 2 ? '<span class="chip chip-pos">Best fit</span>' : fit === 1 ? '<span class="chip">Close</span>' : '') + '</span>' +
              '<span class="tplopt-meta">' + esc(t.stage) + ' · ' + esc(t.persona) + ' · ' + esc(t.channel) + '</span>' +
              '<span class="tplopt-body">' + esc(Store.fill(t.body, c, p).slice(0, 150)) + '…</span>' +
              '</button>';
          }).join('') + '</div>'
      });
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
      var ctx = v.querySelector('#ctx');
      if (ctx) ctx.innerHTML = ctxHTML();
      wire();
      words();
      grow();
    }
    function paintAll() {
      var mount = v.querySelector('#seq-mount');
      if (!c.steps.length) {
        mount.innerHTML = emptyHTML();
        var chip = document.getElementById('cap-chip');
        if (chip) chip.textContent = 'Nothing scheduled';
        var build = mount.querySelector('#build');
        if (build) build.addEventListener('click', function () {
          var made = Store.buildSequence(c.id);
          paintAll();
          UI.toast(made.length + ' touches over ' + made[made.length - 1].day + ' days. Edit any of them.');
        });
        return;
      }
      if (!mount.querySelector('#rail')) {
        mount.innerHTML = '<div class="builder"><div class="rail" id="rail"></div><div id="editor"></div></div>';
      }
      paintRail(); paintEditor();
    }

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
      if (!s) return;
      var body = v.querySelector('#body');
      var subject = v.querySelector('#subject');

      function persist() {
        Store.updateStep(c.id, s.id, {
          body: body ? body.value : s.body,
          subject: subject ? subject.value : (s.subject || '')
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

      var pick = v.querySelector('#pick-tpl');
      if (pick) pick.addEventListener('click', function () { persist(); openPicker(); });

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
        if (s.status !== 'sent' && s.status !== 'replied') c.sent += 1;
        Store.updateStep(c.id, s.id, { status: 'sent' });
        Store.completeTask(c.id, 't6');
        paintAll(); UI.toast('Logged.');
      });
      var savet = v.querySelector('#save-tpl');
      if (savet) savet.addEventListener('click', function () {
        persist();
        var p = contactOf(s);
        var t = Store.addTemplate({
          name: (p ? p.persona : 'Custom') + ', day ' + s.day,
          persona: p ? p.persona : 'Other', channel: s.channel,
          stage: s.day === 0 ? 'First touch' : s.day > 10 ? 'Breakup' : 'Follow up',
          body: body ? body.value : ''
        });
        Store.updateStep(c.id, s.id, { template: t.id });
        paintAll(); UI.toast('Saved to your library as "' + t.name + '".');
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
      function land(reply, text) {
        v.querySelector('#log').lastElementChild.textContent = reply;
        body.value = text;
        words(); grow(); persist();
        body.classList.remove('flash'); void body.offsetWidth; body.classList.add('flash');
      }
      function ask(text) {
        if (!text.trim() || !body) return;
        say('me', text);
        say('ai', 'Working on it');

        if (!AI.ready()) {
          var lc = text.toLowerCase();
          var hit = EDITS.filter(function (e) { return e.k.some(function (k) { return lc.indexOf(k) > -1; }); })[0] || EDITS[0];
          setTimeout(function () { land(hit.reply, hit.run(body.value)); }, 440);
          return;
        }

        AI.rewrite(text, body.value, c, contactOf(s)).then(function (out) {
          land(out.reply || 'Done.', out.body);
        }).catch(function (err) {
          v.querySelector('#log').lastElementChild.textContent = 'That did not go through: ' + err.message;
        });
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
      var cur = step();
      if (b && cur) Store.updateStep(c.id, cur.id, { body: b.value });
      c.activeStep = el.dataset.step; Store.save(); paintAll();
    });
    UI.on(v, 'change', '[data-wait]', function (e, el) {
      Store.setWait(c.id, el.dataset.wait, parseInt(el.value, 10) || 0);
      setTimeout(paintAll, 0);
    });
    UI.on(v, 'click', '#add-step', function () {
      var s = Store.addStep(c.id);
      c.activeStep = s.id; Store.save(); paintAll();
      Store.completeTask(c.id, 't5');
      UI.toast('Step added. Set the day and who it goes to.');
    });

    document.getElementById('preview').addEventListener('click', function () {
      var s = step();
      if (!s) { UI.toast('Build the sequence first.'); return; }
      var p = contactOf(s);
      var b = v.querySelector('#body');
      var text = Store.fill(b ? b.value : Store.bodyFor(c, s), c, p);
      var subj = Store.fill(s.subject || '', c, p);
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

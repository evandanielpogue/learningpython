/* ==========================================================================
   views/people.js — contacts: add, edit, rank, remove
   ========================================================================== */
(function (window, document) {
  'use strict';

  var esc = UI.esc;
  window.Views = window.Views || {};

  function personaOptions(sel) {
    return Store.PERSONAS.map(function (p) {
      return '<option value="' + esc(p.key) + '"' + (p.key === sel ? ' selected' : '') + '>' + esc(p.key) + '</option>';
    }).join('');
  }

  window.Views.people = function (params) {
    var c = Store.campaign(params.id);
    if (!c) return Router.go('/', true);
    Store.touch(c.id);
    var known = c.contacts.some(function (x) { return x.id === c.activeContact; });
    var selected = known ? c.activeContact : (c.contacts[0] ? c.contacts[0].id : null);
    var adding = false;
    var found = null;

    var v = Shell.mount({
      nav: 'people',
      crumbs: [{ label: 'Overview', href: '/' }, { label: c.company, href: '/c/' + c.id }, { label: 'Contacts' }],
      actions: '<button class="btn btn-primary btn-sm" id="add-top">Add contact</button>',
      html:
        '<div class="page-head"><h1>Contacts</h1></div>' +
        UI.tipHTML('find-contacts', { q: 'hiring ' + c.role + ' at ' + c.company }) +
        '<div id="found"></div>' +
        '<div class="split"><div id="list"></div><div id="detail"></div></div>'
    });

    /* people we went looking for on this req but have not added yet */
    function paintFound() {
      var box = v.querySelector('#found');
      var sug = c.suggested || [];
      if (!sug.length) { box.innerHTML = ''; return; }
      box.innerHTML =
        '<div class="card p5 mb4 found">' +
          '<div class="row between wrap g3 mb2"><h3>Suggested</h3>' +
          '<span class="cap">' + sug.length + ' to look at</span></div>' +
          '<div class="foundgrid">' + sug.map(function (g) {
            return '<div class="foundcard" style="--pc:var(' + Store.colourFor(g.persona) + ')">' +
              '<div class="row g3" style="align-items:flex-start">' +
                '<span class="avatar avatar-md" style="background:var(' + Store.colourFor(g.persona) + ')">' + esc(Store.initials(g.name)) + '</span>' +
                '<span class="grow" style="min-width:0"><b>' + esc(g.name) + '</b>' +
                '<em>' + esc(g.title) + '</em></span>' +
              '</div>' +
              '<p class="fc-why">' + esc(g.why) + '</p>' +
              '<p class="fc-found">' + esc(g.found) + '</p>' +
              (g.guessedEmail && g.email
                ? '<p class="fc-guess">' + esc(g.email) + ' is a guess from the company\u2019s usual pattern. ' +
                  'Check it before you send anything.</p>'
                : '') +
              '<div class="row g2 mt3">' +
                '<button class="btn btn-primary btn-sm" data-take="' + g.id + '">Add them</button>' +
                '<button class="btn btn-ghost btn-sm" data-skip="' + g.id + '">Not this one</button>' +
              '</div></div>';
          }).join('') + '</div></div>';
    }

    function paint() {
      c.activeContact = selected;
      Store.save();
      paintFound();
      var list = v.querySelector('#list');
      list.innerHTML =
        c.contacts.map(function (p, i) {
          return '<div class="rankrow' + (p.id === selected ? ' on' : '') + '" data-pick="' + p.id + '" style="--pc:var(' + p.colour + ')">' +
            '<span class="rank">' + (i + 1) + '</span>' +
            '<span class="avatar avatar-md" style="background:var(' + p.colour + ')">' + esc(Store.initials(p.name)) + '</span>' +
            '<button type="button" class="rr-main" data-pick="' + p.id + '"' +
              ' aria-pressed="' + (p.id === selected ? 'true' : 'false') + '">' +
              '<span class="rr-name">' + esc(p.name) + '</span>' +
              '<span class="rr-sub">' + esc(p.title || 'No title yet') + '</span></button>' +
            '<span class="rr-tag' + (p.placeholder ? ' rr-tag-warn' : '') + '">' +
              (p.placeholder ? 'Needs a name' : esc(p.persona)) + '</span>' +
            '<span class="rr-moves">' +
              '<button class="icon-btn" data-up="' + p.id + '" aria-label="Move up"' + (i === 0 ? ' disabled' : '') + '>↑</button>' +
              '<button class="icon-btn" data-down="' + p.id + '" aria-label="Move down"' + (i === c.contacts.length - 1 ? ' disabled' : '') + '>↓</button>' +
            '</span></div>';
        }).join('') +
        (adding ? addForm() : '<button class="addrow" id="add-inline">+ Add another contact</button>');

      if (adding) wireLookup();
      paintDetail();
    }

    function addForm() {
      return '<form class="card p5 mt3" id="new-form" style="display:grid;gap:var(--s-4)">' +
        '<div><h3>Add</h3>' +

        '<div class="lookup">' +
          UI.liMark(18) +
          '<input class="lookup-in" id="n-url" placeholder="linkedin.com/in/marcusreed" autocomplete="off" spellcheck="false">' +
          '<button class="btn btn-secondary btn-sm" type="button" id="n-find">Find them</button>' +
        '</div>' +
        '<p class="lookup-msg hide" id="n-msg"></p>' +

        '<details class="manual" id="n-manual">' +
          '<summary>Or fill it in by hand</summary>' +
          '<div class="manual-body">' +
            '<div class="grid cols-2">' +
              '<div class="field"><label for="n-name">Name</label><input class="input" id="n-name" placeholder="Jordan Rivera" autocomplete="off"></div>' +
              '<div class="field"><label for="n-title">Title</label><input class="input" id="n-title" placeholder="RevOps Manager" autocomplete="off"></div>' +
            '</div>' +
            '<div class="grid cols-2">' +
              '<div class="field"><label for="n-persona">How you know them</label>' +
                '<select class="input" id="n-persona">' + personaOptions('Peer') + '</select></div>' +
              '<div class="field"><label for="n-email">Email</label><input class="input" id="n-email" placeholder="jordan@acme.com" autocomplete="off"></div>' +
            '</div>' +
            '<div class="field"><label for="n-ask">What you want from them</label>' +
              '<input class="input" id="n-ask" placeholder="Fifteen minutes about the team" autocomplete="off"></div>' +
          '</div>' +
        '</details>' +

        '<div class="row g2 wrap"><button class="btn btn-primary btn-sm" type="submit">Add contact</button>' +
        '<button class="btn btn-ghost btn-sm" type="button" id="cancel-add">Cancel</button></div></form>';
    }

    /* fills the hand-written fields from whatever the lookup found */
    function wireLookup() {
      var find = v.querySelector('#n-find');
      if (!find) return;
      var url = v.querySelector('#n-url');
      var msg = v.querySelector('#n-msg');
      var manual = v.querySelector('#n-manual');

      function run() {
        var res = Store.lookupLinkedIn(url.value, c.id);
        msg.classList.remove('hide', 'ok');
        if (!res.ok) {
          msg.textContent = res.reason;
          url.classList.add('err');
          return;
        }
        url.classList.remove('err');
        var p = res.person;
        v.querySelector('#n-name').value = p.name;
        v.querySelector('#n-title').value = p.title;
        v.querySelector('#n-persona').value = p.persona;
        v.querySelector('#n-email').value = p.email;
        v.querySelector('#n-ask').value = p.ask;
        found = p;
        manual.open = true;
        msg.classList.add('ok');
        msg.textContent = res.exact
          ? 'Found ' + p.name + (p.title ? ', ' + p.title : '') + '. Check it over and add them.'
          : 'Only the name came back from that URL. Fill in the rest below.';
      }

      find.addEventListener('click', run);
      url.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); run(); }
      });
    }

    function paintDetail() {
      var p = c.contacts.filter(function (x) { return x.id === selected; })[0];
      var d = v.querySelector('#detail');
      if (!p) { d.innerHTML = '<div class="card p6"><p class="dim">Nobody selected.</p></div>'; return; }

      d.innerHTML =
        '<div class="card p5" style="position:sticky;top:calc(var(--topbar) + var(--s-4))">' +
          '<div class="row g3 mb4">' +
            '<span class="avatar avatar-lg" style="background:var(' + p.colour + ')">' + esc(Store.initials(p.name)) + '</span>' +
            '<span class="grow"><h3 style="line-height:1.25">' + esc(p.name) + '</h3>' +
            '<p class="dimmer" style="font-size:var(--fs-sm)">' + esc(p.title || 'No title') + '</p></span>' +
            '<button class="icon-btn" id="del" aria-label="Remove contact" title="Remove">✕</button>' +
          '</div>' +
          '<dl class="facts">' +
            (p.tenure ? '<div><dt>At ' + esc(c.company) + '</dt><dd>' + esc(p.tenure) + '</dd></div>' : '') +
            (p.prev ? '<div><dt>History</dt><dd>' + esc(p.prev) + '</dd></div>' : '') +
            '<div><dt>Mutuals</dt><dd>' + p.mutuals + '</dd></div>' +
            (p.email ? '<div><dt>Email</dt><dd class="mono" style="font-size:var(--fs-sm)">' + esc(p.email) +
              (p.guessedEmail ? '<em class="dd-guess">guessed from the company pattern, unverified</em>' : '') +
              '</dd></div>' : '') +
            (p.linkedin ? '<div><dt>' + UI.liMark(13) + ' LinkedIn</dt>' +
              '<dd class="mono" style="font-size:var(--fs-sm)">' + esc(p.linkedin) + '</dd></div>' : '') +
          '</dl>' +
          '<hr class="divider" style="margin:var(--s-4) 0">' +
          (p.placeholder
            ? '<p class="lookup-msg mb3">We know the seat, not the person. Paste their profile or type their name.</p>' +
              '<div class="lookup mb3">' + UI.liMark(18) +
                '<input class="lookup-in" id="d-url" placeholder="linkedin.com/in/..." autocomplete="off" spellcheck="false">' +
                '<button class="btn btn-secondary btn-sm" type="button" id="d-find">Find them</button></div>'
            : '') +
          '<div class="grid cols-2 mb3">' +
            '<div class="field"><label for="d-name">Name</label>' +
              '<input class="input" id="d-name" value="' + esc(p.placeholder ? '' : p.name) + '" placeholder="' + esc(p.placeholder ? p.name : '') + '"></div>' +
            '<div class="field"><label for="d-title">Title</label>' +
              '<input class="input" id="d-title" value="' + esc(p.title) + '" placeholder="Director, Mid-Market"></div>' +
          '</div>' +
          '<div class="field mb3"><label for="d-persona">How you know them</label>' +
            '<select class="input" id="d-persona">' + personaOptions(p.persona) + '</select></div>' +
          '<div class="field mb3"><label for="d-ask">What you want from them</label>' +
            '<input class="input" id="d-ask" value="' + esc(p.ask) + '" placeholder="Fifteen minutes"></div>' +
          '<div class="field"><label for="d-notes">Your notes</label>' +
            '<textarea class="input" id="d-notes" placeholder="Anything worth remembering before you write.">' + esc(p.notes) + '</textarea></div>' +
          '<div class="row between mt4"><span class="hint" id="saved" style="opacity:0;transition:opacity var(--t-2)">Saved</span>' +
          '<a class="btn btn-secondary btn-sm" href="#/c/' + c.id + '/research">See what they said <span class="arr">→</span></a></div>' +
        '</div>';

      function patch(k, el) {
        el.addEventListener('change', function () {
          var o = {}; o[k] = this.value;
          Store.updateContact(c.id, p.id, o);
          var flag = d.querySelector('#saved');
          if (flag) {
            flag.style.opacity = 1;
            setTimeout(function () { flag.style.opacity = 0; }, 1400);
          }
          if (k === 'persona' || k === 'title') setTimeout(paint, 0);
        });
      }
      patch('persona', d.querySelector('#d-persona'));
      patch('title', d.querySelector('#d-title'));
      patch('ask', d.querySelector('#d-ask'));
      patch('notes', d.querySelector('#d-notes'));

      /* naming someone clears the placeholder, in the list and everywhere a
         step already points at them */
      d.querySelector('#d-name').addEventListener('change', function () {
        var nm = this.value.trim();
        if (!nm) return;
        Store.updateContact(c.id, p.id, { name: nm, placeholder: false });
        /* repaint after the blur finishes, or the browser tears this input out
           from under the event that is still running */
        setTimeout(paint, 0);
        UI.toast('Now it says ' + nm + ' everywhere it said the job title.');
      });

      var find = d.querySelector('#d-find');
      if (find) find.addEventListener('click', function () {
        var res = Store.lookupLinkedIn(d.querySelector('#d-url').value, c.id);
        if (!res.ok) { UI.toast(res.reason); return; }
        Store.updateContact(c.id, p.id, {
          name: res.person.name, title: res.person.title || p.title,
          persona: res.person.persona !== 'Other' ? res.person.persona : p.persona,
          email: res.person.email || p.email, linkedin: res.person.linkedin,
          tenure: res.person.tenure || p.tenure, mutuals: res.person.mutuals || p.mutuals,
          activity: (res.person.activity && res.person.activity.length) ? res.person.activity : p.activity,
          placeholder: false
        });
        setTimeout(paint, 0);
        UI.toast('That is ' + res.person.name + '.');
      });

      d.querySelector('#del').addEventListener('click', function () {
        UI.confirm({ title: 'Remove ' + p.name + '?', body: 'Any step pointed at them loses its contact. You can add them back later.', confirm: 'Remove', danger: true })
          .then(function (ok) {
            if (!ok) return;
            Store.removeContact(c.id, p.id);
            selected = c.contacts[0] ? c.contacts[0].id : null;
            paint();
            UI.toast(p.name + ' removed.');
          });
      });
    }

    function startAdd() {
      adding = true; found = null; paint();
      setTimeout(function () { var n = v.querySelector('#n-url'); if (n) n.focus(); }, 40);
    }

    UI.on(v, 'click', '[data-pick]', function (e, el) {
      if (e.target.closest('button')) return;
      selected = el.dataset.pick; paint();
    });
    UI.on(v, 'click', '[data-take]', function (e, el) {
      var p = Store.acceptSuggestion(c.id, el.dataset.take);
      if (!p) return;
      Store.completeTask(c.id, 't3');
      selected = p.id; paint();
      UI.toast(p.name + ' added. Rank them where they belong.');
    });
    UI.on(v, 'click', '[data-skip]', function (e, el) {
      Store.dismissSuggestion(c.id, el.dataset.skip); paint();
    });
    UI.on(v, 'click', '[data-up]',   function (e, el) { Store.moveContact(c.id, el.dataset.up, -1); paint(); });
    UI.on(v, 'click', '[data-down]', function (e, el) { Store.moveContact(c.id, el.dataset.down, 1); paint(); });
    UI.on(v, 'click', '#add-inline', startAdd);
    document.getElementById('add-top').addEventListener('click', startAdd);

    UI.on(v, 'click', '#cancel-add', function () { adding = false; paint(); });
    UI.on(v, 'submit', '#new-form', function (e) {
      e.preventDefault();
      var name = v.querySelector('#n-name').value.trim();
      if (!name) {
        v.querySelector('#n-manual').open = true;
        v.querySelector('#n-name').classList.add('err');
        v.querySelector('#n-name').focus();
        return;
      }
      var p = Store.addContact(c.id, {
        name: name,
        title: v.querySelector('#n-title').value.trim(),
        persona: v.querySelector('#n-persona').value,
        email: v.querySelector('#n-email').value.trim(),
        ask: v.querySelector('#n-ask').value.trim(),
        linkedin: found ? found.linkedin : '',
        tenure: found ? found.tenure : '',
        prev: found ? found.prev : '',
        mutuals: found ? found.mutuals : 0,
        activity: found ? found.activity : []
      });
      found = null;
      Store.completeTask(c.id, 't3');
      adding = false; selected = p.id; paint();
      UI.toast(name + ' added. Drag them up if they matter more.');
    });

    paint();
  };
})(window, document);

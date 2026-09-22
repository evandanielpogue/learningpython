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
    var known = c.contacts.some(function (x) { return x.id === c.activeContact; });
    var selected = known ? c.activeContact : (c.contacts[0] ? c.contacts[0].id : null);
    var adding = false;

    var v = Shell.mount({
      nav: 'people',
      crumbs: [{ label: c.company, href: '/' }, { label: 'Contacts' }],
      actions: '<button class="btn btn-primary btn-sm" id="add-top">Add contact</button>',
      html:
        '<div class="page-head"><h1>Who you are working</h1>' +
        '<p>Ranked top to bottom. The order is the order you reach out in, so put the person with the least to lose from helping you at the top.</p></div>' +
        '<div class="split"><div id="list"></div><div id="detail"></div></div>'
    });

    function paint() {
      c.activeContact = selected;
      Store.save();
      var list = v.querySelector('#list');
      list.innerHTML =
        c.contacts.map(function (p, i) {
          return '<div class="rankrow' + (p.id === selected ? ' on' : '') + '" data-pick="' + p.id + '" style="--pc:var(' + p.colour + ')">' +
            '<span class="rank">' + (i + 1) + '</span>' +
            '<span class="avatar avatar-md" style="background:var(' + p.colour + ')">' + esc(Store.initials(p.name)) + '</span>' +
            '<span class="rr-main"><span class="rr-name">' + esc(p.name) + '</span>' +
            '<span class="rr-sub">' + esc(p.title || 'No title yet') + '</span></span>' +
            '<span class="rr-tag">' + esc(p.persona) + '</span>' +
            '<span class="rr-moves">' +
              '<button class="icon-btn" data-up="' + p.id + '" aria-label="Move up"' + (i === 0 ? ' disabled' : '') + '>↑</button>' +
              '<button class="icon-btn" data-down="' + p.id + '" aria-label="Move down"' + (i === c.contacts.length - 1 ? ' disabled' : '') + '>↓</button>' +
            '</span></div>';
        }).join('') +
        (adding ? addForm() : '<button class="addrow" id="add-inline">+ Add another contact</button>');

      paintDetail();
    }

    function addForm() {
      return '<form class="card p5 mt3" id="new-form" style="display:grid;gap:var(--s-3)">' +
        '<h3>New contact</h3>' +
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
        '<div class="row g2"><button class="btn btn-primary btn-sm" type="submit">Add contact</button>' +
        '<button class="btn btn-ghost btn-sm" type="button" id="cancel-add">Cancel</button></div></form>';
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
            (p.email ? '<div><dt>Email</dt><dd class="mono" style="font-size:var(--fs-sm)">' + esc(p.email) + '</dd></div>' : '') +
            (p.linkedin ? '<div><dt>LinkedIn</dt><dd class="mono" style="font-size:var(--fs-sm)">' + esc(p.linkedin) + '</dd></div>' : '') +
          '</dl>' +
          '<hr class="divider" style="margin:var(--s-4) 0">' +
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
          if (k === 'persona') setTimeout(paint, 0);
        });
      }
      patch('persona', d.querySelector('#d-persona'));
      patch('ask', d.querySelector('#d-ask'));
      patch('notes', d.querySelector('#d-notes'));

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

    function startAdd() { adding = true; paint(); setTimeout(function () { var n = v.querySelector('#n-name'); if (n) n.focus(); }, 40); }

    UI.on(v, 'click', '[data-pick]', function (e, el) {
      if (e.target.closest('button')) return;
      selected = el.dataset.pick; paint();
    });
    UI.on(v, 'click', '[data-up]',   function (e, el) { Store.moveContact(c.id, el.dataset.up, -1); paint(); });
    UI.on(v, 'click', '[data-down]', function (e, el) { Store.moveContact(c.id, el.dataset.down, 1); paint(); });
    UI.on(v, 'click', '#add-inline', startAdd);
    document.getElementById('add-top').addEventListener('click', startAdd);

    UI.on(v, 'click', '#cancel-add', function () { adding = false; paint(); });
    UI.on(v, 'submit', '#new-form', function (e) {
      e.preventDefault();
      var name = v.querySelector('#n-name').value.trim();
      if (!name) { v.querySelector('#n-name').classList.add('err'); return; }
      var p = Store.addContact(c.id, {
        name: name,
        title: v.querySelector('#n-title').value.trim(),
        persona: v.querySelector('#n-persona').value,
        email: v.querySelector('#n-email').value.trim(),
        ask: v.querySelector('#n-ask').value.trim()
      });
      Store.completeTask('t4');
      adding = false; selected = p.id; paint();
      UI.toast(name + ' added. Drag them up if they matter more.');
    });

    paint();
  };
})(window, document);

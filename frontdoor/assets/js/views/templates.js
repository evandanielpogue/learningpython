/* ==========================================================================
   views/templates.js — the message library
   ========================================================================== */
(function (window, document) {
  'use strict';

  var esc = UI.esc;
  window.Views = window.Views || {};

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

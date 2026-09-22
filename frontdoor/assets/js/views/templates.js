/* ==========================================================================
   views/templates.js — the message library. What you normally send to a
   given kind of person at a given point in the sequence.
   ========================================================================== */
(function (window, document) {
  'use strict';

  var esc = UI.esc;
  window.Views = window.Views || {};

  window.Views.templates = function () {
    var selected = Store.state.templates[0] ? Store.state.templates[0].id : null;
    var filter = 'All';

    var v = Shell.mount({
      nav: 'templates',
      crumbs: [{ label: 'Templates' }],
      actions: '<button class="btn btn-primary btn-sm" id="new-tpl">New template</button>',
      html: '<div class="page-head"><h1>Your messages</h1>' +
        '<p>Nine to start with, one for each kind of person at each point in the sequence. Pull any of them into a step and the names fill in.</p></div>' +
        '<div class="filterbar" id="filters"></div>' +
        '<div class="split"><div id="tpl-list"></div><div id="tpl-edit"></div></div>'
    });

    function paintFilters() {
      var tabs = ['All'].concat(Store.STAGES);
      v.querySelector('#filters').innerHTML = tabs.map(function (t) {
        var n = t === 'All' ? Store.state.templates.length
              : Store.state.templates.filter(function (x) { return x.stage === t; }).length;
        return '<button class="ftab' + (t === filter ? ' on' : '') + '" data-filter="' + esc(t) + '">' +
          esc(t) + '<span>' + n + '</span></button>';
      }).join('');
    }

    function paintList() {
      var rows = Store.state.templates.filter(function (t) { return filter === 'All' || t.stage === filter; });
      v.querySelector('#tpl-list').innerHTML = rows.length
        ? rows.map(function (t) {
            return '<button class="tplrow' + (t.id === selected ? ' on' : '') + '" data-tpl="' + t.id + '"' +
              ' style="--pc:var(' + Store.colourFor(t.persona) + ')">' +
              '<span class="tplrow-dot"></span>' +
              '<span class="tplrow-main"><span class="tplrow-name">' + esc(t.name) + '</span>' +
              '<span class="tplrow-sub">' + esc(t.persona) + ' · ' + esc(t.channel) + '</span></span>' +
              '<span class="tplrow-stage">' + esc(t.stage) + '</span>' +
              (t.stock ? '' : '<span class="tplrow-mine" title="You wrote this">★</span>') +
              '</button>';
          }).join('')
        : '<div class="card p5"><p class="dim">Nothing at this stage yet.</p></div>';
      paintEdit();
    }

    function paintEdit() {
      var t = Store.template(selected);
      var box = v.querySelector('#tpl-edit');
      if (!t) { box.innerHTML = '<div class="card p6"><p class="dim">Pick one on the left.</p></div>'; return; }
      box.innerHTML =
        '<div class="card p5 col g3" style="position:sticky;top:calc(var(--topbar) + var(--s-4))">' +
          '<div class="field"><label for="t-name">Name</label><input class="input" id="t-name" value="' + esc(t.name) + '"></div>' +
          '<div class="grid cols-3">' +
            '<div class="field"><label for="t-persona">For</label><select class="input" id="t-persona">' +
              Store.PERSONAS.map(function (p) { return '<option' + (p.key === t.persona ? ' selected' : '') + '>' + esc(p.key) + '</option>'; }).join('') +
            '</select></div>' +
            '<div class="field"><label for="t-stage">Stage</label><select class="input" id="t-stage">' +
              Store.STAGES.map(function (s) { return '<option' + (s === t.stage ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('') +
            '</select></div>' +
            '<div class="field"><label for="t-channel">Channel</label><select class="input" id="t-channel">' +
              Store.CHANNELS.map(function (ch) { return '<option' + (ch === t.channel ? ' selected' : '') + '>' + ch + '</option>'; }).join('') +
            '</select></div>' +
          '</div>' +
          '<div class="field"><label for="t-body">Message</label>' +
            '<textarea class="input" id="t-body" style="min-height:250px;font-family:var(--mono);font-size:13px;line-height:1.8">' + esc(t.body) + '</textarea>' +
            '<p class="hint">Anything in braces is filled in from the company and the person when you pull this into a step.</p></div>' +
          '<div class="row between">' +
            '<span class="hint" id="t-saved" style="opacity:0;transition:opacity var(--t-2)">Saved</span>' +
            '<button class="btn btn-danger btn-sm" id="t-del">Delete</button></div>' +
        '</div>';

      ['name', 'persona', 'stage', 'channel', 'body'].forEach(function (k) {
        var el = box.querySelector('#t-' + k);
        el.addEventListener('change', function () {
          var o = {}; o[k] = this.value;
          Store.updateTemplate(t.id, o);
          var s = box.querySelector('#t-saved'); s.style.opacity = 1;
          setTimeout(function () { s.style.opacity = 0; }, 1400);
          if (k !== 'body') setTimeout(function () { paintFilters(); paintList(); }, 0);
        });
      });
      box.querySelector('#t-del').addEventListener('click', function () {
        UI.confirm({ title: 'Delete "' + t.name + '"?', body: 'Any step using it keeps the words, it just loses the link back here.', confirm: 'Delete', danger: true })
          .then(function (ok) {
            if (!ok) return;
            Store.removeTemplate(t.id);
            selected = Store.state.templates[0] ? Store.state.templates[0].id : null;
            paintFilters(); paintList(); UI.toast('Deleted.');
          });
      });
    }

    UI.on(v, 'click', '[data-tpl]', function (e, el) { selected = el.dataset.tpl; paintList(); });
    UI.on(v, 'click', '[data-filter]', function (e, el) { filter = el.dataset.filter; paintFilters(); paintList(); });
    document.getElementById('new-tpl').addEventListener('click', function () {
      var t = Store.addTemplate({ name: 'Untitled', persona: 'Peer', stage: 'First touch', channel: 'Email',
        body: '{first}, \n\n\n\nWorth fifteen minutes?' });
      selected = t.id; filter = 'All';
      paintFilters(); paintList();
      UI.toast('New template. Give it a name.');
    });

    paintFilters();
    paintList();
  };
})(window, document);

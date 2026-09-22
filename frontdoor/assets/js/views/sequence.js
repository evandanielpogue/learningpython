/* ==========================================================================
   views/sequence.js — build your own sequence: add, edit, reorder, remove
   ========================================================================== */
(function (window, document) {
  'use strict';

  var esc = UI.esc;
  window.Views = window.Views || {};

  window.Views.sequence = function (params) {
    var c = Store.campaign(params.id);
    if (!c) return Router.go('/', true);
    var editing = null;

    var v = Shell.mount({
      nav: 'sequence',
      crumbs: [{ label: c.company, href: '/' }, { label: 'Sequence' }],
      actions: '<span class="chip chip-pos">Day ' + c.day + ' of ' + lastDay() + '</span>' +
               '<button class="btn btn-primary btn-sm" id="add-step">Add a step</button>',
      html: Views.tabs(c, 'sequence') +
        '<div class="page-head"><h1>Your sequence</h1>' +
        '<p>Built from the default: five people, two touches each. Change any of it. Steps sort themselves by day.</p></div>' +
        '<div id="steps"></div>' +
        '<div class="row wrap g2 mt5" id="summary"></div>' +
        '<div class="card p5 mt5"><h3 class="mb3">A rule worth keeping</h3>' +
        '<p class="dim measure" style="font-size:var(--fs-sm)">Two touches per person is the ceiling for a reason. Past that you are not persistent, you are a problem, and the person you most wanted to reach is the one who remembers it.</p></div>'
    });

    function lastDay() { return c.steps.length ? c.steps[c.steps.length - 1].day : 14; }

    function contactOptions(sel) {
      return '<option value=""' + (!sel ? ' selected' : '') + '>Nobody in particular</option>' +
        c.contacts.map(function (p) {
          return '<option value="' + p.id + '"' + (p.id === sel ? ' selected' : '') + '>' + esc(p.name) + '</option>';
        }).join('');
    }
    function templateOptions(sel) {
      return '<option value=""' + (!sel ? ' selected' : '') + '>Write it from scratch</option>' +
        Store.state.templates.map(function (t) {
          return '<option value="' + t.id + '"' + (t.id === sel ? ' selected' : '') + '>' + esc(t.name) + '</option>';
        }).join('');
    }
    function channelOptions(sel) {
      return Store.CHANNELS.map(function (ch) {
        return '<option value="' + ch + '"' + (ch === sel ? ' selected' : '') + '>' + ch + '</option>';
      }).join('');
    }

    function badge(s) {
      return s.status === 'replied' ? '<span class="chip chip-pos">Replied</span>'
           : s.status === 'due'     ? '<span class="chip chip-accent">Due today</span>'
           : s.status === 'sent'    ? '<span class="chip">Sent</span>'
           : '<span class="chip">Queued</span>';
    }

    function row(s) {
      var p = c.contacts.filter(function (x) { return x.id === s.contact; })[0];
      var colour = p ? p.colour : '--line-3';
      var tpl = Store.template(s.template);

      if (editing === s.id) {
        return '<div class="touch editing" style="--pc:var(' + colour + ')">' +
          '<div class="step-edit">' +
            '<div class="field"><label>Day</label><input class="input" type="number" min="0" max="120" value="' + s.day + '" data-f="day" data-id="' + s.id + '"></div>' +
            '<div class="field"><label>Who</label><select class="input" data-f="contact" data-id="' + s.id + '">' + contactOptions(s.contact) + '</select></div>' +
            '<div class="field"><label>Channel</label><select class="input" data-f="channel" data-id="' + s.id + '">' + channelOptions(s.channel) + '</select></div>' +
            '<div class="field"><label>Message</label><select class="input" data-f="template" data-id="' + s.id + '">' + templateOptions(s.template) + '</select></div>' +
            '<div class="field" style="grid-column:1/-1"><label>Note to yourself</label>' +
              '<input class="input" value="' + esc(s.note) + '" data-f="note" data-id="' + s.id + '"></div>' +
            '<div class="row g2" style="grid-column:1/-1">' +
              '<button class="btn btn-primary btn-sm" data-done="' + s.id + '">Done</button>' +
              '<button class="btn btn-danger btn-sm" data-del="' + s.id + '">Delete step</button></div>' +
          '</div></div>';
      }

      return '<div class="touch' + (s.status === 'sent' || s.status === 'replied' ? ' sent' : '') + '" style="--pc:var(' + colour + ')">' +
        '<span class="td">Day ' + s.day + '</span>' +
        '<span class="tw">' + esc(p ? p.name : 'No contact') +
          '<em>' + esc(s.note) + (tpl ? ' · ' + esc(tpl.name) : '') + '</em></span>' +
        badge(s) +
        '<span class="tc">' + esc(s.channel) + '</span>' +
        '<span class="rr-moves">' +
          '<button class="icon-btn" data-write="' + s.id + '" aria-label="Write this one" title="Write">✎</button>' +
          '<button class="icon-btn" data-edit="' + s.id + '" aria-label="Edit step" title="Edit">⚙</button>' +
        '</span></div>';
    }

    function paint() {
      v.querySelector('#steps').innerHTML = '<div class="seq">' + c.steps.map(row).join('') + '</div>';
      var people = {};
      c.steps.forEach(function (s) { if (s.contact) people[s.contact] = (people[s.contact] || 0) + 1; });
      var over = Object.keys(people).filter(function (k) { return people[k] > 2; });
      v.querySelector('#summary').innerHTML =
        '<span class="chip"><b>' + c.contacts.length + '</b> people</span>' +
        '<span class="chip"><b>' + c.steps.length + '</b> steps</span>' +
        '<span class="chip"><b>' + lastDay() + '</b> days</span>' +
        '<span class="chip"><b>0</b> sent for you</span>' +
        (over.length ? '<span class="chip chip-warn">' + over.length + ' person over two touches</span>' : '');
    }

    UI.on(v, 'click', '[data-edit]', function (e, el) { editing = el.dataset.edit; paint(); });
    UI.on(v, 'click', '[data-done]', function () { editing = null; paint(); UI.toast('Step updated.'); });
    UI.on(v, 'click', '[data-write]', function (e, el) {
      c.activeStep = el.dataset.write; Store.save();
      Router.go('/c/' + c.id + '/messages');
    });
    UI.on(v, 'click', '[data-del]', function (e, el) {
      var id = el.dataset.del;
      UI.confirm({ title: 'Delete this step?', body: 'It comes out of the sequence. The contact stays.', confirm: 'Delete', danger: true })
        .then(function (ok) { if (ok) { Store.removeStep(c.id, id); editing = null; paint(); UI.toast('Step deleted.'); } });
    });
    UI.on(v, 'change', '[data-f]', function (e, el) {
      var patch = {};
      patch[el.dataset.f] = el.dataset.f === 'day' ? Math.max(0, parseInt(el.value, 10) || 0) : el.value;
      Store.updateStep(c.id, el.dataset.id, patch);
      // change fires mid-blur; re-render on the next tick or the browser
      // is left holding a node we already removed
      setTimeout(paint, 0);
    });
    document.getElementById('add-step').addEventListener('click', function () {
      var s = Store.addStep(c.id);
      editing = s.id; paint();
      UI.toast('Step added. Set the day and who it goes to.');
    });

    paint();
  };
})(window, document);

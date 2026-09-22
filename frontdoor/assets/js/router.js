/* ==========================================================================
   router.js — hash router with an auth guard
   Routes are declared as patterns; ":id" captures a segment.
   ========================================================================== */
(function (window) {
  'use strict';

  var routes = [];
  var notFound = null;
  var Router = {};

  Router.add = function (pattern, handler, opts) {
    routes.push({
      parts: pattern.split('/').filter(Boolean),
      pattern: pattern,
      handler: handler,
      publicRoute: !!(opts && opts.public)
    });
    return Router;
  };

  Router.notFound = function (fn) { notFound = fn; return Router; };

  Router.path = function () {
    var h = window.location.hash.replace(/^#/, '');
    if (!h || h === '/') return '/';
    return h;
  };

  Router.go = function (path, replace) {
    var target = '#' + (path.charAt(0) === '/' ? path : '/' + path);
    if (replace) window.location.replace(target);
    else window.location.hash = target;
  };

  function match(path) {
    var segs = path.split('?')[0].split('/').filter(Boolean);
    for (var i = 0; i < routes.length; i++) {
      var r = routes[i];
      if (r.parts.length !== segs.length) continue;
      var params = {}, ok = true;
      for (var j = 0; j < r.parts.length; j++) {
        var p = r.parts[j];
        if (p.charAt(0) === ':') params[p.slice(1)] = decodeURIComponent(segs[j]);
        else if (p !== segs[j]) { ok = false; break; }
      }
      if (ok) return { route: r, params: params };
    }
    return null;
  }

  Router.resolve = function () {
    var path = Router.path();
    var m = match(path);

    var authed = window.Store.isAuthed();

    if (!m) {
      if (notFound) notFound(path);
      return;
    }
    if (!m.route.publicRoute && !authed) { Router.go('/login', true); return; }
    if (m.route.publicRoute && authed && (path === '/login' || path === '/signup')) { Router.go('/', true); return; }

    m.route.handler(m.params, path);
  };

  Router.start = function () {
    window.addEventListener('hashchange', Router.resolve);
    if (!window.location.hash) Router.go(window.Store.isAuthed() ? '/' : '/login', true);
    else Router.resolve();
  };

  window.Router = Router;
})(window);

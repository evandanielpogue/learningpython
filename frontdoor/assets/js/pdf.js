/* ==========================================================================
   pdf.js — pull the text out of a PDF resume.

   The parser ships with the app rather than coming from a CDN. It used to be
   fetched from cdnjs with no integrity check, which meant anything able to
   answer for that host — a compromised CDN, a corporate TLS-intercepting
   proxy, a captive portal — could run its own code on a page holding an API
   key at the exact moment a resume was in memory.

   It is still only loaded when a PDF actually turns up: in the bundled build
   the code sits inert in two text/plain blocks until the first PDF, then runs
   from a blob. Served from a directory, it loads the files beside it.
   ========================================================================== */
(function (window, document) {
  'use strict';

  var LOCAL = 'assets/vendor/';
  var loading = null;
  var workerUrl = null;

  function blobUrl(id, type) {
    var el = document.getElementById(id);
    if (!el || !el.textContent) return null;
    return URL.createObjectURL(new Blob([el.textContent], { type: type || 'text/javascript' }));
  }

  function base() { return window.PDFJS_BASE || LOCAL; }

  function load() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (loading) return loading;

    loading = new Promise(function (resolve, reject) {
      var done = false;
      var timer = setTimeout(function () {
        if (!done) { done = true; loading = null; reject(new Error('timeout')); }
      }, 15000);

      /* bundled: both scripts are inert text in the document already */
      var inline = blobUrl('pdf-lib');
      if (inline) workerUrl = blobUrl('pdf-worker');

      var s = document.createElement('script');
      s.src = inline || (base() + 'pdf.min.js');
      s.onload = function () {
        if (done) return;
        done = true;
        clearTimeout(timer);
        if (inline) URL.revokeObjectURL(inline);
        if (!window.pdfjsLib) { loading = null; return reject(new Error('no pdfjsLib')); }
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl || (base() + 'pdf.worker.min.js');
        resolve(window.pdfjsLib);
      };
      s.onerror = function () {
        if (done) return;
        done = true;
        clearTimeout(timer);
        loading = null;
        reject(new Error('offline'));
      };
      document.head.appendChild(s);
    });
    return loading;
  }

  /* PDFs have no idea what a line is. Items come back with a position, so
     group them by baseline and put the gaps back in by measuring them. */
  function pageLines(page) {
    return page.getTextContent().then(function (tc) {
      var lines = [];
      var cur = null;
      var lastY = null;

      tc.items.forEach(function (it) {
        if (typeof it.str !== 'string') return;
        var y = it.transform[5];
        var x = it.transform[4];

        if (cur === null || lastY === null || Math.abs(y - lastY) > 2.5) {
          cur = { y: y, parts: [] };
          lines.push(cur);
        }
        lastY = y;

        var prev = cur.parts[cur.parts.length - 1];
        if (prev && x - (prev.x + prev.w) > 1.2) cur.parts.push({ str: ' ', x: x, w: 0 });
        cur.parts.push({ str: it.str, x: x, w: it.width || 0 });

        if (it.hasEOL) { cur = null; lastY = null; }
      });

      return lines.map(function (l) {
        return l.parts.map(function (p) { return p.str; }).join('').replace(/\s+$/, '');
      });
    });
  }

  window.Doc = {
    ready: function () { return !!window.pdfjsLib; },

    readPdf: function (file) {
      return load().then(function (lib) {
        return file.arrayBuffer().then(function (buf) {
          return lib.getDocument({ data: new Uint8Array(buf), isEvalSupported: false }).promise;
        }).then(function (doc) {
          var pages = [];
          for (var i = 1; i <= doc.numPages; i++) pages.push(i);
          return pages.reduce(function (chain, n) {
            return chain.then(function (acc) {
              return doc.getPage(n).then(pageLines).then(function (lines) {
                return acc.concat(lines);
              });
            });
          }, Promise.resolve([]));
        }).then(function (lines) {
          return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
        });
      });
    }
  };
})(window, document);

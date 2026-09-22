/* ==========================================================================
   pdf.js — pull the text out of a PDF resume.

   The parser is fetched on demand from a CDN the first time someone hands us
   a PDF, so the app stays a small file that works offline for everything
   else. If the fetch fails, the caller falls back to asking for pasted text.
   ========================================================================== */
(function (window, document) {
  'use strict';

  var CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
  var loading = null;

  function base() { return window.PDFJS_BASE || CDN; }

  function load() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (loading) return loading;

    loading = new Promise(function (resolve, reject) {
      var done = false;
      var timer = setTimeout(function () {
        if (!done) { done = true; loading = null; reject(new Error('timeout')); }
      }, 12000);

      var s = document.createElement('script');
      s.src = base() + 'pdf.min.js';
      s.onload = function () {
        if (done) return;
        done = true;
        clearTimeout(timer);
        if (!window.pdfjsLib) { loading = null; return reject(new Error('no pdfjsLib')); }
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = base() + 'pdf.worker.min.js';
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
    /* true once the library is in memory */
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
          /* a resume laid out in columns leaves runs of blanks behind */
          return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
        });
      });
    }
  };
})(window, document);

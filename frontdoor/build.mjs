// Bundles the app into one file you can double-click. Reads index.html, inlines
// every local stylesheet and script in the order it already declares them, and
// writes a complete document that runs from file:// with no server.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(resolve(root, p), 'utf8');

const src = read('index.html');
const css = [...src.matchAll(/<link rel="stylesheet" href="(assets\/[^"]+)">/g)].map((m) => m[1]);
const js = [...src.matchAll(/<script src="(assets\/[^"]+)"><\/script>/g)].map((m) => m[1]);

/* Test seams. The suite overrides these to run without a key or a network;
   in a shipped file they are a hook any injected script can use to capture
   every key-bearing request, so they do not go in the build. */
const seams = (s) => s
  .replace(/window\.AI_FETCH \|\| /g, '')
  .replace(/window\.PDFJS_BASE \|\| /g, '');
if (!css.length || !js.length) throw new Error('index.html changed shape; nothing to inline');

// Everything between the boot frame and the script tags is the body as authored.
const body = src
  .replace(/<title>[\s\S]*?<\/title>\s*/, '')
  .replace(/<meta [^>]*>\s*/g, '')
  .replace(/<link [^>]*>\s*/g, '')
  .replace(/<script src="assets\/[^"]+"><\/script>\s*/g, '')
  .trim();

// A closing tag inside a string literal would end the script block early.
const guard = (s) => s.replace(/<\/script/gi, '<\\/script');

/* Fonts and the PDF parser ship inside the file. The app used to pull both
   from the network on open, which made "self-contained" untrue and put two
   third parties in the request path of a page that holds an API key. */
const fontDir = resolve(root, 'assets/fonts');
const inlineFonts = (css) => css.replace(/url\('\.\.\/fonts\/([^']+)'\)/g, (_, f) => {
  const b64 = readFileSync(resolve(fontDir, f)).toString('base64');
  return `url('data:font/woff2;base64,${b64}')`;
});

const pdfLib = read('assets/vendor/pdf.min.js');
const pdfWorker = read('assets/vendor/pdf.worker.min.js');

/* text/plain blocks are not parsed as script, but the browser still scans for
   the literal end tag, so neutralise it the same way. */
const inert = (s) => s.replace(/<\/script/gi, '<\\/script');

const out = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Frontdoor</title>
<meta name="description" content="Go in the front. One company at a time: the people, the research, the messages and the page you send them to.">
<meta name="theme-color" content="#F7F7F8">
<meta name="color-scheme" content="light">
<!-- Everything is inline in this build, so script-src has to allow inline.
     The served build in index.html has the stricter policy. -->
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' blob:; worker-src blob:; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src https:; form-action 'none'; base-uri 'none'">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect width='24' height='24' rx='5' fill='%2315181C'/%3E%3Cpath d='M5.5 6.2A1.9 1.9 0 0 1 7.4 4.3h5.3a1.9 1.9 0 0 1 1.9 1.9V20H5.5Z' fill='%23fff'/%3E%3Crect x='16.1' y='4.3' width='2.4' height='15.7' rx='1.2' fill='%23D98A18'/%3E%3Ccircle cx='11.9' cy='12.6' r='1.1' fill='%2315181C'/%3E%3C/svg%3E">
<style>
${css.map((f) => `/* ${f} */\n${f.endsWith('fonts.css') ? inlineFonts(read(f)) : read(f)}`).join('\n')}
</style>
</head>
<body>
${body}
<script type="text/plain" id="pdf-lib">${inert(pdfLib)}</${''}script>
<script type="text/plain" id="pdf-worker">${inert(pdfWorker)}</${''}script>
<script>
${js.map((f) => `/* ${f} */\n${guard(seams(read(f)))}`).join('\n;\n')}
</${''}script>
</body>
</html>
`;

mkdirSync(resolve(root, 'dist'), { recursive: true });
writeFileSync(resolve(root, 'dist/frontdoor.html'), out);
console.log(`dist/frontdoor.html  ${(out.length / 1024 / 1024).toFixed(2)} MB  ` +
  `(${css.length} css, ${js.length} js, fonts and the PDF parser inlined — no network on open)`);

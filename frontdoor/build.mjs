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

const out = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Frontdoor</title>
<meta name="description" content="Run your job search like a named account.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap">
<style>
${css.map((f) => `/* ${f} */\n${read(f)}`).join('\n')}
</style>
</head>
<body>
${body}
<script>
${js.map((f) => `/* ${f} */\n${guard(read(f))}`).join('\n;\n')}
</${''}script>
</body>
</html>
`;

mkdirSync(resolve(root, 'dist'), { recursive: true });
writeFileSync(resolve(root, 'dist/frontdoor.html'), out);
console.log(`dist/frontdoor.html  ${(out.length / 1024).toFixed(0)} KB  (${css.length} css, ${js.length} js)`);

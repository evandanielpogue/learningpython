/* ==========================================================================
   test/dist.mjs — the built single file, opened the way a person opens it
   Run:  node build.mjs && node test/dist.mjs
   The suite in e2e.mjs drives the source tree, where the test seams still
   exist. This one drives dist/frontdoor.html off the disk, over file://,
   with no server and no network, because that is the copy people are sent.
   ========================================================================== */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const FILE = resolve(process.cwd(), 'dist/frontdoor.html');
if (!existsSync(FILE)) {
  console.log('dist/frontdoor.html is not built. Run: node build.mjs');
  process.exit(1);
}
const URL_ = 'file://' + FILE;

const errs = [];
let pass = 0, fail = 0;
const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
const reached = [];

page.on('pageerror', e => errs.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
page.on('request', r => { if (!r.url().startsWith('file://')) reached.push(r.url()); });
await page.addInitScript(() => {
  window.__rejections = [];
  window.addEventListener('unhandledrejection', e =>
    window.__rejections.push(String((e.reason && e.reason.message) || e.reason)));
});

async function step(label, fn) {
  try { await fn(); pass++; console.log('  PASS  ' + label); }
  catch (e) { fail++; console.log('  FAIL  ' + label + '  ->  ' + String(e.message).split('\n')[0]); }
}

console.log('\nThe built file, opened from disk');

await step('it boots with no server behind it', async () => {
  await page.goto(URL_, { waitUntil: 'load' });
  await page.waitForSelector('#auth-form', { timeout: 8000 });
});

await step('it asks the network for nothing', async () => {
  if (reached.length) throw new Error('reached out to ' + [...new Set(reached)].join(', '));
});

await step('the typefaces came with it', async () => {
  /* @font-face is lazy, so ask for the faces rather than asking whether
     something already happened to need them */
  const got = await page.evaluate(async () => {
    const want = ['600 16px "Instrument Sans"', '400 12px "JetBrains Mono"'];
    const out = [];
    for (const f of want) {
      try { out.push({ f, n: (await document.fonts.load(f)).length }); }
      catch (e) { out.push({ f, n: 0, err: e.message }); }
    }
    return out;
  });
  const missing = got.filter(g => !g.n).map(g => g.f + (g.err ? ' (' + g.err + ')' : ''));
  if (missing.length) throw new Error('did not load: ' + missing.join(', '));
});

await step('you can sign in and reach the app', async () => {
  await page.fill('#f-pass', 'demo1234');
  await page.click('#f-submit');
  await page.waitForSelector('.shell', { timeout: 8000 });
});

await step('the example workspace renders', async () => {
  await page.evaluate(() => { Store.createSeedCampaign(); });
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.shell', { timeout: 8000 });
  if (!(await page.locator('.nav-item').count())) throw new Error('no navigation');
});

await step('the content sits in a main landmark behind a skip link', async () => {
  const shape = await page.evaluate(() => ({
    main: (document.getElementById('view') || {}).tagName,
    skip: !!document.getElementById('skip')
  }));
  if (shape.main !== 'MAIN') throw new Error('#view is a ' + shape.main);
  if (!shape.skip) throw new Error('no skip link');
});

await step('the ink still clears 4.5:1 in the built copy', async () => {
  const bad = await page.evaluate(() => {
    const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    const lum = s => {
      const m = s.match(/(\d+),\s*(\d+),\s*(\d+)/);
      return m ? 0.2126 * lin(+m[1]) + 0.7152 * lin(+m[2]) + 0.0722 * lin(+m[3]) : null;
    };
    const css = getComputedStyle(document.documentElement);
    const probe = document.createElement('span');
    document.body.appendChild(probe);
    const L = name => { probe.style.color = css.getPropertyValue(name).trim(); return lum(getComputedStyle(probe).color); };
    const out = [];
    ['--ink', '--ink-2', '--ink-3', '--ink-4'].forEach(i =>
      ['--panel', '--bg', '--sunk', '--sunk-2'].forEach(s => {
        const a = L(i), b = L(s);
        const r = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        if (r < 4.5) out.push(i + ' on ' + s + ' = ' + r.toFixed(2));
      }));
    probe.remove();
    return out;
  });
  if (bad.length) throw new Error(bad.join('; '));
});

await step('a PDF parser is inside the file, not on a CDN', async () => {
  const blocks = await page.evaluate(() => ({
    lib: (document.getElementById('pdf-lib') || {}).textContent ? true : false,
    worker: (document.getElementById('pdf-worker') || {}).textContent ? true : false,
    api: typeof (window.Doc && window.Doc.readPdf) === 'function'
  }));
  if (!blocks.lib || !blocks.worker) throw new Error('the parser is not inlined: ' + JSON.stringify(blocks));
  if (!blocks.api) throw new Error('the resume reader is not wired up');
});

await step('every screen opens without raising anything', async () => {
  const cid = await page.evaluate(() => Store.state.campaigns[0].id);
  for (const r of ['', 'settings', 'templates', 'brand',
                   'c/' + cid, 'c/' + cid + '/people', 'c/' + cid + '/prep',
                   'c/' + cid + '/research', 'c/' + cid + '/sequence',
                   'c/' + cid + '/page', 'c/' + cid + '/brief']) {
    await page.evaluate(h => { location.hash = '#/' + h; }, r);
    await page.waitForTimeout(220);
    const empty = await page.evaluate(() => !document.getElementById('view').children.length);
    if (empty) throw new Error('#/' + r + ' rendered nothing');
  }
});

await step('nothing was dropped on the floor', async () => {
  const r = await page.evaluate(() => window.__rejections || []);
  if (r.length) throw new Error(r.join(' | '));
});

await ctx.close();
await browser.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
console.log('errors: ' + (errs.length ? errs.join(' | ') : 'none'));
process.exit(fail || errs.length ? 1 : 0);

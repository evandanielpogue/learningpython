/* ==========================================================================
   test/e2e.mjs — end to end checks against a real browser
   Run:  npx http-server -p 8899 -s .   then   node test/e2e.mjs
   ========================================================================== */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const BASE = process.env.BASE || 'http://127.0.0.1:8899/index.html';
const errs = [];
let pass = 0, fail = 0;

const browser = await chromium.launch();

async function group(name, fn) {
  console.log('\n' + name);
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => {
    if (m.type() === 'error' && !m.text().includes('ERR_CERT')) errs.push('console: ' + m.text());
  });
  await fn(page);
  await ctx.close();
}

async function step(label, fn) {
  try { await fn(); pass++; console.log('  PASS  ' + label); }
  catch (e) { fail++; console.log('  FAIL  ' + label + '  ->  ' + String(e.message).split('\n')[0]); }
}

const signIn = async (page) => {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.fill('#f-pass', 'demo1234');
  await page.click('#f-submit');
  await page.waitForSelector('.shell', { timeout: 6000 });
};

/* ---------------------------------------------------------------- auth -- */
await group('Auth', async (page) => {
  await step('login renders with the aside', async () => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForSelector('#auth-form', { timeout: 5000 });
    if (!(await page.locator('.auth-aside blockquote').count())) throw new Error('no aside');
  });
  await step('short password is rejected', async () => {
    await page.fill('#f-pass', 'abc');
    await page.click('#f-submit');
    await page.waitForSelector('#f-err:not(.hide)', { timeout: 3000 });
  });
  await step('sign in reaches the app', async () => {
    await page.fill('#f-pass', 'demo1234');
    await page.click('#f-submit');
    await page.waitForSelector('.shell', { timeout: 6000 });
  });
  await step('state survives a reload', async () => {
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('.shell', { timeout: 6000 });
    if (await page.locator('#auth-form').count()) throw new Error('kicked to login');
  });
  await step('sign out returns to login', async () => {
    await page.evaluate(() => { Store.signOut(); Router.go('/login'); });
    await page.waitForSelector('#auth-form', { timeout: 4000 });
  });
});

await group('Route guard', async (page) => {
  await step('deep link while signed out lands on login', async () => {
    await page.goto(BASE + '#/c/c_acme/sequence', { waitUntil: 'networkidle' });
    await page.waitForSelector('#auth-form', { timeout: 5000 });
    const h = await page.evaluate(() => location.hash);
    if (h !== '#/login') throw new Error('hash=' + h);
  });
});

/* ------------------------------------------------------------ overview -- */
await group('Overview', async (page) => {
  await signIn(page);
  await step('checklist opens partly done', async () => {
    await page.waitForSelector('.ring .fill', { timeout: 4000 });
    const n = await page.locator('.task').count();
    if (n !== 6) throw new Error('tasks=' + n);
    const label = await page.locator('#ring-label').textContent();
    if (label.startsWith('6 of')) throw new Error('everything pre-ticked: ' + label);
  });
  await step('ticking a task moves the ring', async () => {
    const before = await page.locator('#ring-label').textContent();
    await page.locator('.task').nth(2).click();
    await page.waitForTimeout(200);
    const after = await page.locator('#ring-label').textContent();
    if (before === after) throw new Error('ring label unchanged');
  });
  await step('sidebar nav is grouped, no tab strip', async () => {
    if ((await page.locator('.nav-group').count()) < 3) throw new Error('missing groups');
    const labels = (await page.locator('.nav-group-label').allTextContents()).join(' ');
    if (!labels.includes('Campaign')) throw new Error('no Campaign group');
    await page.goto(BASE + '#/c/c_acme/people', { waitUntil: 'networkidle' });
    await page.waitForTimeout(250);
    if (await page.locator('.tabs').count()) throw new Error('tab strip still present');
  });
  await step('command palette opens, filters and navigates', async () => {
    await page.keyboard.press('Control+k');
    await page.waitForSelector('.scrim.open .palette', { timeout: 3000 });
    await page.fill('#pal-q', 'research');
    await page.waitForTimeout(150);
    if (!(await page.locator('.palette-item').count())) throw new Error('no results');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => location.hash.includes('/research'), null, { timeout: 4000 });
  });
});

/* ------------------------------------------------------------ contacts -- */
await group('Contacts', async (page) => {
  await signIn(page);
  await page.goto(BASE + '#/c/c_acme/people', { waitUntil: 'networkidle' });
  await page.waitForSelector('.rankrow', { timeout: 4000 });

  await step('detail shows facts, not commentary', async () => {
    const t = await page.locator('#detail').textContent();
    for (const bad of ['In sales terms', 'Why bother', 'What you ask for']) {
      if (t.includes(bad)) throw new Error('still says "' + bad + '"');
    }
    if (!t.includes('Mutuals')) throw new Error('no contact facts');
  });
  await step('ranking reorders', async () => {
    const first = await page.locator('.rankrow .rr-name').first().textContent();
    await page.locator('.rankrow [data-down]').first().click();
    await page.waitForTimeout(200);
    if (first === await page.locator('.rankrow .rr-name').first().textContent()) throw new Error('order unchanged');
  });
  await step('add a contact', async () => {
    const before = await page.locator('.rankrow').count();
    await page.click('#add-inline');
    await page.fill('#n-name', 'Jordan Rivera');
    await page.fill('#n-title', 'RevOps Manager');
    await page.click('#new-form button[type=submit]');
    await page.waitForTimeout(300);
    if (await page.locator('.rankrow').count() !== before + 1) throw new Error('not added');
  });
  await step('edits persist across a reload', async () => {
    const who = await page.locator('#detail h3').first().textContent();
    await page.fill('#d-ask', 'Twenty minutes on RevOps');
    await page.locator('#d-ask').dispatchEvent('change');
    await page.waitForTimeout(200);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('#d-ask', { timeout: 4000 });
    if (who !== await page.locator('#detail h3').first().textContent()) throw new Error('lost the selection');
    if (!(await page.locator('#d-ask').inputValue()).includes('Twenty minutes')) throw new Error('lost the edit');
  });
  await step('remove a contact', async () => {
    const before = await page.locator('.rankrow').count();
    await page.click('#del');
    await page.click('.modal [data-act="yes"]');
    await page.waitForTimeout(400);
    if (await page.locator('.rankrow').count() !== before - 1) throw new Error('not removed');
  });
});

/* ------------------------------------------------------------ research -- */
await group('Research', async (page) => {
  await signIn(page);
  await page.goto(BASE + '#/c/c_acme/research', { waitUntil: 'networkidle' });
  await page.waitForSelector('.feed-item', { timeout: 4000 });

  await step('company feed carries usable lines', async () => {
    if ((await page.locator('.feed-item').count()) < 4) throw new Error('too few items');
    if (!(await page.locator('[data-use]').count())) throw new Error('no use buttons');
  });
  await step('people tab shows per-person activity', async () => {
    await page.click('[data-sub="people"]');
    await page.waitForTimeout(250);
    const t = await page.locator('#feed').textContent();
    if (!t.includes('Marcus Reed') || !t.includes('Revenue Room')) throw new Error('missing activity');
  });
  await step('"Use this" lands in the builder draft', async () => {
    await page.locator('[data-use]').first().click();
    await page.waitForSelector('#body', { timeout: 5000 });
    await page.waitForTimeout(250);
    const v = await page.locator('#body').inputValue();
    if (!/Read|Saw|Heard|five seat|Six AE|Series B/.test(v.slice(0, 90))) throw new Error('line missing: ' + v.slice(0, 60));
  });
});

/* ------------------------------------------------------- sequence build -- */
await group('Sequence builder', async (page) => {
  await signIn(page);
  await page.goto(BASE + '#/c/c_acme/sequence', { waitUntil: 'networkidle' });
  await page.waitForSelector('.stepcard', { timeout: 4000 });

  await step('rail shows steps with wait connectors', async () => {
    const s = await page.locator('.stepcard').count();
    const w = await page.locator('.wait-pill').count();
    if (s !== 10) throw new Error('steps=' + s);
    if (w !== s - 1) throw new Error('waits=' + w);
  });
  await step('selecting a step loads its editor', async () => {
    await page.locator('.stepcard').nth(3).click();
    await page.waitForTimeout(300);
    if (!(await page.locator('.ed-head b').textContent()).includes('Marcus')) throw new Error('wrong contact');
    if ((await page.locator('#body').inputValue()).length < 40) throw new Error('empty body');
  });
  await step('wait control shifts later steps and keeps order', async () => {
    const before = await page.locator('.sc-day').allTextContents();
    await page.locator('[data-wait]').nth(1).fill('5');
    await page.locator('[data-wait]').nth(1).dispatchEvent('change');
    await page.waitForTimeout(350);
    const after = await page.locator('.sc-day').allTextContents();
    if (JSON.stringify(before) === JSON.stringify(after)) throw new Error('nothing moved');
    const nums = after.map(d => parseInt(d.replace('Day ', ''), 10));
    if (JSON.stringify(nums) !== JSON.stringify([...nums].sort((a, b) => a - b))) throw new Error('out of order');
  });
  await step('variants switch, add and remove', async () => {
    await page.locator('.stepcard').nth(3).click();
    await page.waitForTimeout(300);
    if (await page.locator('.vtab').count() !== 2) throw new Error('expected two seeded variants');
    const a = await page.locator('#body').inputValue();
    await page.locator('.vtab').nth(1).click();
    await page.waitForTimeout(300);
    if (a === await page.locator('#body').inputValue()) throw new Error('B matches A');
    await page.click('#add-variant');
    await page.waitForTimeout(300);
    if (await page.locator('.vtab').count() !== 3) throw new Error('add failed');
    await page.locator('.vtab.on .vx').click();
    await page.waitForTimeout(300);
    if (await page.locator('.vtab').count() !== 2) throw new Error('remove failed');
  });
  await step('subject appears for Email and hides for Call', async () => {
    await page.locator('.stepcard').nth(3).click();
    await page.waitForTimeout(250);
    if (!(await page.locator('#subject').count())) throw new Error('no subject on Email');
    await page.locator('[data-f="channel"]').selectOption('Call');
    await page.waitForTimeout(350);
    if (await page.locator('#subject').count()) throw new Error('subject shown on Call');
    await page.locator('[data-f="channel"]').selectOption('Email');
    await page.waitForTimeout(350);
  });
  await step('merge field inserts at the cursor', async () => {
    await page.fill('#body', 'Hello ');
    await page.locator('#body').click();
    await page.locator('[data-field="{company}"]').click();
    await page.waitForTimeout(200);
    if (!(await page.locator('#body').inputValue()).includes('{company}')) throw new Error('not inserted');
  });
  await step('body survives switching steps', async () => {
    await page.fill('#body', 'Persisted body check.');
    await page.waitForTimeout(200);
    await page.locator('.stepcard').nth(0).click();
    await page.waitForTimeout(300);
    await page.locator('.stepcard').nth(3).click();
    await page.waitForTimeout(300);
    if (!(await page.locator('#body').inputValue()).includes('Persisted body check')) throw new Error('lost the edit');
  });
  await step('preview resolves merge fields', async () => {
    await page.fill('#body', 'Hi {first}, about {company}.');
    await page.waitForTimeout(200);
    await page.click('#preview');
    await page.waitForSelector('.mailprev', { timeout: 4000 });
    const t = await page.locator('.mp-body').textContent();
    if (t.includes('{first}')) throw new Error('not filled');
    if (!t.includes('Marcus') || !t.includes('Acme')) throw new Error('wrong fill: ' + t);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });
  await step('assistant rewrites the body', async () => {
    const a = await page.locator('#body').inputValue();
    await page.locator('.sug', { hasText: 'Shorter' }).click();
    await page.waitForTimeout(800);
    if (a === await page.locator('#body').inputValue()) throw new Error('unchanged');
    if (!(await page.locator('.bubble.ai').count())) throw new Error('no reply');
  });
  await step('duplicate, delete and add a step', async () => {
    const n = await page.locator('.stepcard').count();
    await page.click('#dupe');
    await page.waitForTimeout(350);
    if (await page.locator('.stepcard').count() !== n + 1) throw new Error('duplicate failed');
    await page.click('#drop');
    await page.click('.modal [data-act="yes"]');
    await page.waitForTimeout(400);
    if (await page.locator('.stepcard').count() !== n) throw new Error('delete failed');
    await page.click('#add-step');
    await page.waitForTimeout(350);
    if (await page.locator('.stepcard').count() !== n + 1) throw new Error('add failed');
  });
});

/* ----------------------------------------------------------- templates -- */
await group('Templates', async (page) => {
  await signIn(page);
  await page.goto(BASE + '#/templates', { waitUntil: 'networkidle' });
  await page.waitForSelector('#t-body', { timeout: 4000 });

  await step('editing a stock template updates the list', async () => {
    await page.fill('#t-name', 'Peer opener v2');
    await page.locator('#t-name').dispatchEvent('change');
    await page.waitForTimeout(300);
    if (!(await page.locator('#tpl-list').textContent()).includes('Peer opener v2')) throw new Error('list stale');
  });
  await step('create your own', async () => {
    const n = await page.locator('[data-tpl]').count();
    await page.click('#new-tpl');
    await page.waitForTimeout(300);
    if (await page.locator('[data-tpl]').count() !== n + 1) throw new Error('not created');
  });
  await step('save a draft back as a template', async () => {
    await page.goto(BASE + '#/c/c_acme/sequence', { waitUntil: 'networkidle' });
    await page.waitForSelector('#body', { timeout: 4000 });
    const n = await page.evaluate(() => Store.state.templates.length);
    await page.click('#save-tpl');
    await page.waitForTimeout(350);
    if (await page.evaluate(() => Store.state.templates.length) !== n + 1) throw new Error('not saved');
  });
});

/* --------------------------------------------------- import + settings -- */
await group('Import and settings', async (page) => {
  await signIn(page);
  await step('import wizard runs end to end', async () => {
    await page.goto(BASE + '#/import', { waitUntil: 'networkidle' });
    await page.waitForSelector('.dropzone', { timeout: 4000 });
    await page.locator('.dropzone').first().click();
    await page.waitForSelector('#wins', { timeout: 8000 });
    if (await page.locator('#wins .opt').count() !== 7) throw new Error('wrong win count');
    if (await page.locator('#wins .opt.locked').count() !== 4) throw new Error('cap of three not enforced');
  });
  await step('settings save flows through to the public page', async () => {
    await page.goto(BASE + '#/settings', { waitUntil: 'networkidle' });
    await page.waitForSelector('#s-name', { timeout: 4000 });
    await page.fill('#s-name', 'Evan D. Pogue');
    await page.click('#s-save');
    await page.waitForTimeout(300);
    await page.goto(BASE + '#/c/c_acme/page', { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    if (!(await page.locator('.pub .hero h2').textContent()).includes('Evan D. Pogue')) throw new Error('page not updated');
  });
  await step('page sections toggle off', async () => {
    if (await page.locator('[data-sec="proof"].hide').count()) throw new Error('hidden at start');
    await page.locator('[data-sec-key="proof"]').click();
    await page.waitForTimeout(200);
    if (!(await page.locator('[data-sec="proof"].hide').count())) throw new Error('did not hide');
  });
});

/* -------------------------------------------------------------- mobile -- */
await group('Mobile, 390px', async (page) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await signIn(page);
  await step('no horizontal overflow on any screen', async () => {
    const routes = ['#/', '#/c/c_acme/people', '#/c/c_acme/research', '#/c/c_acme/sequence',
                    '#/c/c_acme/page', '#/templates', '#/settings', '#/import'];
    for (const r of routes) {
      await page.goto(BASE + r, { waitUntil: 'networkidle' });
      await page.waitForTimeout(280);
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (over > 1) throw new Error(r + ' overflows by ' + over + 'px');
    }
  });
  await step('the builder is usable narrow', async () => {
    await page.goto(BASE + '#/c/c_acme/sequence', { waitUntil: 'networkidle' });
    await page.waitForSelector('.stepcard', { timeout: 4000 });
    await page.locator('.stepcard').nth(2).click();
    await page.waitForTimeout(300);
    if (!(await page.locator('#body').count())) throw new Error('no editor');
  });
});

console.log('\n' + pass + ' passed, ' + fail + ' failed');
console.log('errors: ' + (errs.length ? [...new Set(errs)].join(' | ') : 'none'));
await browser.close();
process.exit(fail || errs.length ? 1 : 0);

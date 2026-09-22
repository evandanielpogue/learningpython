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
  await step('lists the companies, not one campaign', async () => {
    await page.waitForSelector('.opp', { timeout: 5000 });
    const n = await page.locator('.opp').count();
    if (n < 1) throw new Error('no opportunity rows');
    if (!(await page.locator('.opp-co').first().textContent()).includes('Acme')) throw new Error('Acme missing');
  });
  await step('each company shows its own progress', async () => {
    const t = await page.locator('.opp-pct').first().textContent();
    if (!/^\d+\/\d+$/.test(t.trim())) throw new Error('progress reads "' + t + '"');
  });
  await step('a company opens its own summary', async () => {
    await page.click('.opp');
    await page.waitForSelector('.task', { timeout: 5000 });
    if (!(await page.locator('h1').first().textContent()).includes('Acme')) throw new Error('not the Acme summary');
  });
  await step('the checklist belongs to that company', async () => {
    const before = await page.locator('#ring-label').textContent();
    await page.locator('.task[aria-pressed="false"]').first().click();
    await page.waitForTimeout(220);
    const after = await page.locator('#ring-label').textContent();
    if (before === after) throw new Error('ring did not move: ' + after);
    const saved = await page.evaluate(() => Store.campaign('c_acme').tasks.filter(t => t.on).length);
    if (!saved) throw new Error('not persisted on the campaign');
  });
  await step('suggested people can be added from the summary', async () => {
    const n0 = await page.evaluate(() => Store.campaign('c_acme').contacts.length);
    await page.locator('[data-take]').first().click();
    await page.waitForTimeout(320);
    const n1 = await page.evaluate(() => Store.campaign('c_acme').contacts.length);
    if (n1 !== n0 + 1) throw new Error(n0 + ' -> ' + n1);
  });
});

/* -------------------------------------------------------- add a company -- */
await group('Add a company from a listing', async (page) => {
  await signIn(page);
  await step('the flow opens', async () => {
    await page.goto(BASE + '#/new', { waitUntil: 'networkidle' });
    await page.waitForSelector('#listing', { timeout: 5000 });
    if (!(await page.locator('#read').isDisabled())) throw new Error('Read enabled on an empty box');
  });
  await step('a pasted listing is read', async () => {
    await page.click('#use-sample');
    await page.click('#read');
    await page.waitForSelector('#wins', { timeout: 8000 });
  });
  await step('role and company come out of the text', async () => {
    const txt = await page.locator('.card').first().textContent();
    if (!txt.includes('Acme')) throw new Error('company not parsed: ' + txt.slice(0, 80));
    if (!/Account Executive/i.test(txt)) throw new Error('role not parsed');
  });
  await step('three wins are picked for us, matched to the listing', async () => {
    const on = await page.locator('.opt[aria-pressed="true"]').count();
    if (on !== 3) throw new Error(on + ' picked');
    const why = await page.locator('.opt[aria-pressed="true"] em').first().textContent();
    if (!/Matches the listing/.test(why)) throw new Error('no match reason: ' + why);
  });
  await step('a win can be swapped', async () => {
    await page.locator('.opt[aria-pressed="true"]').first().click();
    await page.waitForTimeout(160);
    if ((await page.locator('.opt[aria-pressed="true"]').count()) !== 2) throw new Error('did not deselect');
    await page.locator('.opt[aria-pressed="false"]:not(.locked)').first().click();
    await page.waitForTimeout(160);
    if ((await page.locator('.opt[aria-pressed="true"]').count()) !== 3) throw new Error('did not reselect');
  });
  await step('the chat collects the story', async () => {
    if (!(await page.locator('.bubble.ai').count())) throw new Error('assistant did not open');
    await page.fill('#story-q', 'Forty per cent of the team quit inside two quarters.');
    await page.press('#story-q', 'Enter');
    await page.waitForTimeout(500);
    if (!(await page.locator('.bubble.me').count())) throw new Error('answer not recorded');
  });
  await step('creating it lands on the new company', async () => {
    await page.click('#create');
    await page.waitForSelector('.task', { timeout: 6000 });
    const n = await page.evaluate(() => Store.campaigns().length);
    if (n !== 2) throw new Error(n + ' campaigns');
    const story = await page.evaluate(() => Store.campaigns()[0].story);
    if (!story.includes('Forty per cent')) throw new Error('story lost');
  });
  await step('the new company suggests three people to find', async () => {
    const s = await page.evaluate(() => Store.campaigns()[0].suggested.map(x => x.persona));
    if (s.length !== 3) throw new Error(s.length + ' suggested');
    if (!s.includes('Hiring manager') || !s.includes('Recruiter') || !s.includes('Shared tie'))
      throw new Error('missing a role: ' + s.join(', '));
  });
  await step('both companies show on the overview', async () => {
    await page.goto(BASE + '#/', { waitUntil: 'networkidle' });
    await page.waitForSelector('.opp', { timeout: 5000 });
    if ((await page.locator('.opp').count()) !== 2) throw new Error('overview did not update');
  });
});

/* ------------------------------------------------------------ contacts -- */
await group('Contacts', async (page) => {
  await signIn(page);
  await page.goto(BASE + '#/c/c_acme/people', { waitUntil: 'networkidle' });
  await step('found people show before the ranked list', async () => {
    await page.waitForSelector('.foundcard', { timeout: 5000 });
    if (!(await page.locator('.fc-why').count())) throw new Error('no reason given');
  });
  await step('adding one moves it into the ranking', async () => {
    const rows0 = await page.locator('.rankrow').count();
    await page.locator('[data-take]').first().click();
    await page.waitForTimeout(300);
    if ((await page.locator('.rankrow').count()) !== rows0 + 1) throw new Error('not ranked');
  });
  await step('dismissing one drops it', async () => {
    const f0 = await page.locator('.foundcard').count();
    await page.locator('[data-skip]').first().click();
    await page.waitForTimeout(280);
    if ((await page.locator('.foundcard').count()) !== f0 - 1) throw new Error('still there');
  });
  await step('ranking moves a person', async () => {
    const first = await page.locator('.rr-name').first().textContent();
    await page.locator('[data-down]').first().click();
    await page.waitForTimeout(240);
    if ((await page.locator('.rr-name').first().textContent()) === first) throw new Error('order held');
  });
  await step('adding a contact by hand works', async () => {
    await page.click('#add-top');
    await page.fill('#n-name', 'Jordan Rivera');
    await page.fill('#n-title', 'RevOps Manager');
    await page.click('#new-form button[type=submit]');
    await page.waitForTimeout(300);
    if (!(await page.locator('.rankrow', { hasText: 'Jordan Rivera' }).count())) throw new Error('not added');
  });
});

/* ------------------------------------------------------------ research -- */
await group('Research', async (page) => {
  await signIn(page);
  await page.goto(BASE + '#/c/c_acme/research', { waitUntil: 'networkidle' });
  await step('the feed renders', async () => {
    await page.waitForSelector('[data-use]', { timeout: 5000 });
  });
  await step('"use this" lands in the builder draft', async () => {
    const line = await page.locator('[data-use]').first().getAttribute('data-use');
    await page.locator('[data-use]').first().click();
    await page.waitForSelector('#body', { timeout: 6000 });
    const body = await page.inputValue('#body');
    if (!body.startsWith(line.slice(0, 24))) throw new Error('draft does not lead with it');
  });
});

/* ------------------------------------------------------------ sequence -- */
await group('Sequence builder', async (page) => {
  await signIn(page);
  await page.goto(BASE + '#/c/c_acme/sequence', { waitUntil: 'networkidle' });
  await step('rail shows steps with wait connectors', async () => {
    await page.waitForSelector('.stepcard', { timeout: 5000 });
    if ((await page.locator('.stepcard').count()) !== 10) throw new Error('not ten steps');
    if (!(await page.locator('.wait-pill').count())) throw new Error('no wait pills');
  });
  await step('no A/B variants anywhere', async () => {
    if (await page.locator('.vtab, #add-variant, .ed-tabs').count()) throw new Error('variant UI still present');
  });
  await step('no merge field buttons in the editor', async () => {
    if (await page.locator('.fbtn, .fieldbar').count()) throw new Error('merge field bar still present');
  });
  await step('wait control shifts later steps', async () => {
    const before = await page.evaluate(() => Store.campaign('c_acme').steps.map(s => s.day).join(','));
    await page.locator('[data-wait]').first().fill('4');
    await page.locator('[data-wait]').first().dispatchEvent('change');
    await page.waitForTimeout(280);
    const after = await page.evaluate(() => Store.campaign('c_acme').steps.map(s => s.day).join(','));
    if (before === after) throw new Error('days unchanged');
    const days = after.split(',').map(Number);
    for (let i = 1; i < days.length; i++) if (days[i] < days[i - 1]) throw new Error('out of order: ' + after);
  });
  await step('a step says which template it came from', async () => {
    await page.locator('.stepcard').nth(3).click();
    await page.waitForTimeout(260);
    if (!(await page.locator('.tplmark b').count())) throw new Error('no template mark');
  });
  await step('the picker offers templates ranked by fit', async () => {
    await page.click('#pick-tpl');
    await page.waitForSelector('.tplopt', { timeout: 4000 });
    const first = await page.locator('.tplopt').first().textContent();
    if (!/Best fit|Close/.test(first)) throw new Error('nothing marked as a fit');
  });
  await step('picking one fills the names in', async () => {
    await page.locator('.tplopt').first().click();
    await page.waitForTimeout(400);
    const body = await page.inputValue('#body');
    if (/[{}]/.test(body)) throw new Error('placeholders left in the draft');
    if (!body.length) throw new Error('empty draft');
  });
  await step('the draft survives switching steps', async () => {
    await page.fill('#body', 'A line I typed myself.');
    await page.locator('.stepcard').nth(1).click();
    await page.waitForTimeout(240);
    await page.locator('.stepcard').nth(3).click();
    await page.waitForTimeout(240);
    if (!(await page.inputValue('#body')).includes('A line I typed myself')) throw new Error('lost the draft');
  });
  await step('subject appears for Email and hides for Call', async () => {
    if (!(await page.locator('#subject').count())) throw new Error('no subject on an email step');
    await page.selectOption('[data-f="channel"]', 'Call');
    await page.waitForTimeout(300);
    if (await page.locator('#subject').count()) throw new Error('subject still there on a call');
  });
  await step('preview resolves what is left', async () => {
    await page.click('#preview');
    await page.waitForSelector('.mp-body', { timeout: 4000 });
    const t = await page.locator('.mp-body').textContent();
    if (/\{\w+\}/.test(t)) throw new Error('unresolved placeholder in preview');
    await page.keyboard.press('Escape');
  });
  await step('assistant rewrites the body', async () => {
    await page.waitForTimeout(300);
    const before = await page.inputValue('#body');
    await page.locator('.sug', { hasText: 'Shorter' }).click();
    await page.waitForTimeout(700);
    if ((await page.inputValue('#body')) === before) throw new Error('no edit applied');
  });
  await step('add, duplicate and delete a step', async () => {
    const n0 = await page.evaluate(() => Store.campaign('c_acme').steps.length);
    await page.click('#add-step');
    await page.waitForTimeout(280);
    await page.click('#dupe');
    await page.waitForTimeout(280);
    const n1 = await page.evaluate(() => Store.campaign('c_acme').steps.length);
    if (n1 !== n0 + 2) throw new Error(n0 + ' -> ' + n1);
    await page.click('#drop');
    await page.waitForSelector('.modal', { timeout: 3000 });
    await page.click('[data-act="yes"]');
    await page.waitForTimeout(320);
    const n2 = await page.evaluate(() => Store.campaign('c_acme').steps.length);
    if (n2 !== n1 - 1) throw new Error('delete did nothing');
  });
  await step('a draft can be saved back to the library', async () => {
    const t0 = await page.evaluate(() => Store.state.templates.length);
    await page.click('#save-tpl');
    await page.waitForTimeout(300);
    const t1 = await page.evaluate(() => Store.state.templates.length);
    if (t1 !== t0 + 1) throw new Error('not saved');
  });
});

/* ----------------------------------------------------------- templates -- */
await group('Templates', async (page) => {
  await signIn(page);
  await page.goto(BASE + '#/templates', { waitUntil: 'networkidle' });
  await step('rows render without a stretched badge', async () => {
    await page.waitForSelector('.tplrow', { timeout: 5000 });
    const box = await page.locator('.tplrow-stage').first().boundingBox();
    const row = await page.locator('.tplrow').first().boundingBox();
    if (box.width > row.width * 0.45) throw new Error('stage badge is ' + Math.round(box.width) + 'px wide');
  });
  await step('every template declares a stage', async () => {
    const stages = await page.evaluate(() => Store.state.templates.map(t => t.stage));
    if (stages.some(s => !s)) throw new Error('a template has no stage');
  });
  await step('the stage filter narrows the list', async () => {
    const all = await page.locator('.tplrow').count();
    await page.locator('.ftab', { hasText: 'First touch' }).click();
    await page.waitForTimeout(240);
    const some = await page.locator('.tplrow').count();
    if (some >= all || some === 0) throw new Error(all + ' -> ' + some);
  });
  await step('editing a template sticks', async () => {
    await page.locator('.ftab', { hasText: 'All' }).click();
    await page.waitForTimeout(200);
    await page.locator('.tplrow').first().click();
    await page.fill('#t-name', 'Renamed by the test');
    await page.locator('#t-name').dispatchEvent('change');
    await page.waitForTimeout(300);
    if (!(await page.locator('.tplrow', { hasText: 'Renamed by the test' }).count())) throw new Error('list did not update');
  });
  await step('creating one of your own works', async () => {
    const t0 = await page.evaluate(() => Store.state.templates.length);
    await page.click('#new-tpl');
    await page.waitForTimeout(300);
    if ((await page.evaluate(() => Store.state.templates.length)) !== t0 + 1) throw new Error('not created');
  });
});

/* ---------------------------------------------------------------- page -- */
await group('Public page', async (page) => {
  await signIn(page);
  await page.goto(BASE + '#/c/c_acme/page', { waitUntil: 'networkidle' });
  await step('the case layout renders', async () => {
    await page.waitForSelector('.pub-case', { timeout: 5000 });
    if (!(await page.locator('.pg-stats div').count())) throw new Error('no numbers');
    if (!(await page.locator('.portrait').count())) throw new Error('no portrait');
  });
  await step('switching to the brief changes the shape', async () => {
    await page.locator('[data-lay="brief"]').click();
    await page.waitForTimeout(340);
    if (!(await page.locator('.pb-cols').count())) throw new Error('brief did not render');
  });
  await step('the letter addresses a person by name', async () => {
    await page.locator('[data-lay="letter"]').click();
    await page.waitForTimeout(340);
    const h = await page.locator('.pub-letter h1').textContent();
    if (!h.trim().endsWith(',')) throw new Error('not addressed: ' + h);
  });
  await step('the layout choice is remembered', async () => {
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('.pub-letter', { timeout: 5000 });
  });
  await step('turning a section off removes it', async () => {
    await page.locator('[data-lay="case"]').click();
    await page.waitForTimeout(300);
    const n0 = await page.locator('.pub section').count();
    await page.locator('[data-sec-key="stack"]').click();
    await page.waitForTimeout(300);
    if ((await page.locator('.pub section').count()) !== n0 - 1) throw new Error('section still showing');
  });
  await step('the page carries the wins picked for this company', async () => {
    const metrics = await page.locator('.pg-stats b').allTextContents();
    const want = await page.evaluate(() => Store.campaignWins(Store.campaign('c_acme')).map(w => w.metric));
    if (metrics.join('|') !== want.join('|')) throw new Error(metrics.join('|') + ' vs ' + want.join('|'));
  });
});

/* ------------------------------------------------- import and settings -- */
await group('Import and settings', async (page) => {
  await signIn(page);
  await step('import no longer asks you to pick wins', async () => {
    await page.goto(BASE + '#/import', { waitUntil: 'networkidle' });
    await page.waitForSelector('#roles', { timeout: 5000 });
    if (await page.locator('[data-win]').count()) throw new Error('still picking wins at import');
  });
  await step('settings saves a name change', async () => {
    await page.goto(BASE + '#/settings', { waitUntil: 'networkidle' });
    await page.fill('#s-name', 'Evan D. Pogue');
    await page.click('#s-save');
    await page.waitForTimeout(300);
    if ((await page.evaluate(() => Store.state.profile.name)) !== 'Evan D. Pogue') throw new Error('not saved');
  });
  await step('a missing photo falls back to a monogram', async () => {
    if (!(await page.locator('.portrait-mono').count())) throw new Error('no monogram');
  });
});

/* -------------------------------------------------------------- mobile -- */
await group('Mobile, 390px', async (page) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await signIn(page);
  await step('no horizontal overflow on any screen', async () => {
    const routes = ['#/', '#/new', '#/c/c_acme', '#/c/c_acme/people', '#/c/c_acme/research',
                    '#/c/c_acme/sequence', '#/c/c_acme/page', '#/templates', '#/settings', '#/import'];
    for (const r of routes) {
      await page.goto(BASE + r, { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (over > 1) throw new Error(r + ' overflows by ' + over + 'px');
    }
  });
  await step('the collapsed rail stays left and every icon is labelled', async () => {
    await page.goto(BASE + '#/c/c_acme/sequence', { waitUntil: 'networkidle' });
    await page.waitForSelector('.nav-item', { timeout: 4000 });
    const m = await page.evaluate(() => {
      const s = document.querySelector('.sidebar').getBoundingClientRect();
      return { x: s.x, w: s.width, h: s.height,
               labelled: [...document.querySelectorAll('.nav-item')].every((a) => (a.title || '').length > 6),
               n: document.querySelectorAll('.nav-item').length,
               hidden: getComputedStyle(document.querySelector('.nav-label')).display };
    });
    if (m.x !== 0) throw new Error('rail is not flush left (x=' + m.x + ')');
    if (m.w > 70) throw new Error('rail did not collapse (w=' + m.w + ')');
    if (m.h < 600) throw new Error('rail is not full height (h=' + m.h + ')');
    if (m.hidden !== 'none') throw new Error('labels still showing on the rail');
    if (m.n < 8) throw new Error('only ' + m.n + ' nav items');
    if (!m.labelled) throw new Error('a rail icon has no tooltip');
  });
  await step('the builder is usable narrow', async () => {
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

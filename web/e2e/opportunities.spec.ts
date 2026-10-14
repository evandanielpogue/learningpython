import { expect, test } from '@playwright/test';
import { withExample } from './helpers';

async function addCompany(page: import('@playwright/test').Page, name: string) {
  await page.goto('/new');
  await page.getByLabel('Listing').fill(`${name} is hiring an Enterprise Account Executive in Boston, MA.\n\nRequirements:\n- 5+ years SaaS sales\n- Carry a $1M quota`);
  await page.getByRole('button', { name: /^Read$/ }).click();
  await page.getByRole('button', { name: `Add ${name}` }).click();
  await page.waitForURL(/\/o\//);
}

test.describe('Opportunities', () => {
  test('a table of every company with step, next action and sorting', async ({ page }) => {
    await withExample(page);
    await addCompany(page, 'Zephyr');
    await page.goto('/opportunities');
    const rows = page.locator('table tbody tr');
    await expect(rows).toHaveCount(2);
    await expect(rows.first()).toContainText(/Tailor/);
    await expect(rows.first()).toContainText(/stories to tell|Review the match/);

    await page.getByRole('button', { name: 'Company' }).click();
    await expect(rows.first()).toContainText('Acme');
    await page.getByRole('button', { name: 'Company' }).click();
    await expect(rows.first()).toContainText('Zephyr');
  });

  test('filter by step and search', async ({ page }) => {
    await withExample(page);
    await addCompany(page, 'Zephyr');
    await page.goto('/opportunities');
    await page.getByLabel('Search').fill('zeph');
    await expect(page.locator('table tbody tr')).toHaveCount(1);
    await page.getByLabel('Search').fill('');
    await page.getByRole('button', { name: /^People/ }).click();
    await expect(page.getByText('No matches')).toBeVisible();
  });

  test('a board grouped by step; a card opens the company', async ({ page }) => {
    await withExample(page);
    await page.goto('/opportunities');
    await page.getByRole('tab', { name: 'Board' }).click();
    const tailor = page.getByRole('region', { name: 'Tailor' });
    await expect(tailor).toContainText('Acme');
    await tailor.getByRole('link', { name: /Acme/ }).click();
    await expect(page.getByRole('heading', { name: 'Tailor', level: 2 })).toBeVisible();
  });

  test('remove sits behind a confirm', async ({ page }) => {
    await withExample(page);
    await page.goto('/opportunities');
    await page.getByRole('button', { name: 'More for Acme' }).first().click();
    await page.getByRole('menuitem', { name: /Remove/ }).click();
    await expect(page.getByRole('alertdialog')).toContainText('Remove Acme?');
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.locator('table tbody tr')).toHaveCount(1);

    await page.getByRole('button', { name: 'More for Acme' }).first().click();
    await page.getByRole('menuitem', { name: /Remove/ }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Remove' }).click();
    await expect(page.getByRole('heading', { name: 'No companies yet' })).toBeVisible();
  });
});

test.describe('without a model', () => {
  test('the server says Claude is off and Settings says so in one line', async ({ page, request }) => {
    const res = await request.get('/api/ai/status');
    expect(await res.json()).toEqual({ enabled: false });
    await withExample(page);
    await page.goto('/settings');
    await expect(page.getByText(/Pattern matching\. Set ANTHROPIC_API_KEY/)).toBeVisible();
  });

  test('model routes refuse cleanly instead of crashing', async ({ request }) => {
    const res = await request.post('/api/ai/match', { data: { listing: 'x'.repeat(40), proof: [], roles: [] } });
    expect(res.status()).toBe(503);
    const bad = await request.post('/api/ai/rewrite', { data: 'not json', headers: { 'content-type': 'application/json' } });
    expect([400, 503]).toContain(bad.status());
  });
});

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('a bottom tab bar replaces the rail, and nothing scrolls sideways', async ({ page }) => {
    await withExample(page);
    await expect(page.locator('aside')).toBeHidden();
    const bar = page.getByRole('navigation', { name: 'Sections' }).last();
    await expect(bar).toBeVisible();
    for (const path of ['/opportunities', '/settings', '/new']) {
      await page.goto(path);
      await page.waitForTimeout(300);
      const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(over, `horizontal overflow on ${path}`).toBeLessThanOrEqual(1);
    }
    await page.goto('/opportunities');
    await bar.getByRole('link', { name: 'Acme' }).click();
    await expect(page.getByRole('heading', { name: 'Tailor', level: 2 })).toBeVisible();
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(over).toBeLessThanOrEqual(1);
  });
});

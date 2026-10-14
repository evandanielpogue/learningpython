import { expect, test } from '@playwright/test';
import { continueTo, withExample } from './helpers';

test.describe('the six steps', () => {
  test('Tailor: requirements open to their full text and proof', async ({ page }) => {
    await withExample(page);
    const row = page.getByRole('button', { name: /rebuild the discovery script/ }).first();
    await row.click();
    await expect(row).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByText('Carried $1.2M and finished at 112%').first()).toBeVisible();
  });

  test('Tailor: the coach opens, answers back, and a story can be saved', async ({ page }) => {
    await withExample(page);
    const bubbles = page.locator('[aria-live="polite"] > div');
    await expect(bubbles.first()).toBeVisible();
    const before = await bubbles.count();
    await page.getByLabel('Your answer').fill('We were short on pipeline after the reprice, so I rebuilt discovery and we won more deals.');
    await page.getByRole('button', { name: 'Send' }).click();
    await expect.poll(() => bubbles.count()).toBeGreaterThan(before + 1);
    await page.getByRole('button', { name: 'Save story' }).click();
    await expect(page.getByText('1 of 6 told')).toBeVisible();
  });

  test('Tailor: proof can be added past the three suggested', async ({ page }) => {
    await withExample(page);
    await expect(page.getByText('3 leading')).toBeVisible();
    await page.getByRole('button', { name: /Grew territory ARR 41%/ }).click();
    await expect(page.getByText('4 leading')).toBeVisible();
  });

  test('finishing a step celebrates and opens the next one', async ({ page }) => {
    await withExample(page);
    await continueTo(page, 'People');
    await expect(page.getByText('Proof tailored')).toBeVisible();
    await expect(page.getByRole('button', { name: /Tailor, done/ })).toBeVisible();
  });

  test('People: the LinkedIn search tip, a pasted profile, and ranking', async ({ page }) => {
    await withExample(page);
    await continueTo(page, 'People');
    const search = page.getByRole('link', { name: /Search/ });
    await expect(search).toHaveAttribute('href', /linkedin\.com\/search\/results\/content\/\?keywords=hiring/);
    const before = await page.locator('ol > li').filter({ has: page.getByRole('button', { name: /Move .* up/ }) }).count();

    await page.getByRole('button', { name: 'Add a person' }).click();
    await page.getByLabel('LinkedIn link or profile').fill('Jordan Rivera\n· 2nd\nTalent Partner @ Acme\nChicago, Illinois');
    await page.getByRole('button', { name: 'Find' }).click();
    await expect(page.locator('#p-name')).toHaveValue('Jordan Rivera');
    await expect(page.locator('#p-persona')).toHaveValue('Recruiter');
    await page.getByRole('button', { name: /^Add$/ }).last().click();

    const rows = page.locator('ol > li').filter({ has: page.getByRole('button', { name: /Move .* up/ }) });
    await expect(rows).toHaveCount(before + 1);
    await page.getByRole('button', { name: 'Move Jordan Rivera up' }).click();
    await expect(rows.nth(before - 1)).toContainText('Jordan Rivera');
  });

  test('Messaging: placeholders block Mark sent, sending and a reply work', async ({ page }) => {
    await withExample(page);
    await continueTo(page, 'People');
    await continueTo(page, 'Messaging');
    /* the example has a sequence already; find a touch with a bracket to fill */
    const msg = page.getByLabel('Message');
    const touches = page.locator('ol button[aria-current], ol li > button').filter({ hasText: /Day/ });
    const n = await touches.count();
    let blocked = false;
    for (let i = 0; i < n && !blocked; i++) {
      await touches.nth(i).click();
      const markSent = page.getByRole('button', { name: 'Mark sent' });
      if (!(await markSent.count())) continue;
      if (/\[[^\]]+\]/.test(await msg.inputValue())) {
        await expect(markSent).toBeDisabled();
        await msg.fill('Marcus, short note. Worth fifteen minutes?');
        await expect(markSent).toBeEnabled();
        await markSent.click();
        blocked = true;
      }
    }
    expect(blocked).toBe(true);
    await expect(page.getByText(/^\d+ sent/)).toBeVisible();

    const sent = page.locator('ol li > button').filter({ hasText: 'Sent' }).first();
    await sent.click();
    await page.getByRole('button', { name: 'They replied' }).click();
    await expect(page.locator('ol li > button').filter({ hasText: 'Replied' }).first()).toBeVisible();
  });

  test('Messaging: a quick rewrite changes the draft without a model', async ({ page }) => {
    await withExample(page);
    await continueTo(page, 'People');
    await continueTo(page, 'Messaging');
    const msg = page.getByLabel('Message');
    await msg.fill("I'm writing because it's the right time. Don't worry about it.");
    await page.getByRole('button', { name: 'More formal' }).click();
    await expect(msg).toHaveValue(/I am writing because it is the right time\. do not worry|Do not worry/i);
  });

  test('Interview: questions, local practice feedback, booking', async ({ page }) => {
    await withExample(page);
    await continueTo(page, 'People');
    await continueTo(page, 'Messaging');
    await continueTo(page, 'Interview');
    const first = page.locator('li > button[aria-expanded]').first();
    await expect(first).toBeVisible();
    await first.click();
    await page.getByRole('button', { name: 'Practice' }).first().click();
    await page.getByLabel('Your answer').fill('We grew a lot.');
    await page.getByRole('button', { name: 'Get feedback' }).click();
    await expect(page.getByText(/no number in it yet/)).toBeVisible();
    await page.getByRole('button', { name: 'Mark interview booked' }).click();
    await expect(page.getByText('Interview booked').first()).toBeVisible();
  });

  test('Track: the outcome and the timeline', async ({ page }) => {
    await withExample(page);
    for (const next of ['People', 'Messaging', 'Interview', 'Track']) await continueTo(page, next);
    await page.getByRole('radio', { name: 'Hired' }).click();
    await expect(page.getByRole('radio', { name: 'Hired' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByText('Interview done')).toBeVisible();
  });
});

test.describe('going back', () => {
  test('a finished step reopens from its card, and is never the primary action', async ({ page }) => {
    await withExample(page);
    await continueTo(page, 'People');
    const card = page.getByRole('button', { name: /Tailor, done/ });
    /* a done card is a quiet card, not the bright primary button */
    await expect(card).not.toHaveClass(/bg-sea-bright/);
    await card.click();
    await expect(page.getByRole('heading', { name: 'Tailor', level: 2 })).toBeVisible();
    /* finishing it again moves forward past what is already done */
    await page.getByRole('button', { name: 'Continue to People' }).click();
    await expect(page.getByRole('heading', { name: 'People', level: 2 })).toBeVisible();
  });
});

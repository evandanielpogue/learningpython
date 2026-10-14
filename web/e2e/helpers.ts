import { expect, type Page } from '@playwright/test';

/* Every test starts from an empty browser. */
export async function fresh(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/start');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/start');
  return errors;
}

/* Onboard with the built-in example and land on its opportunity page. */
export async function withExample(page: Page) {
  const errors = await fresh(page);
  await page.getByRole('button', { name: 'Try the example' }).click();
  await page.waitForURL(/\/o\//);
  await expect(page.getByRole('heading', { name: 'Tailor', level: 2 })).toBeVisible();
  return errors;
}

export async function continueTo(page: Page, next: string) {
  await page.getByRole('button', { name: `Continue to ${next}` }).click();
  await expect(page.getByRole('heading', { name: next, level: 2 })).toBeVisible();
}

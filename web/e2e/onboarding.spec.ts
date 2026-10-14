import { expect, test } from '@playwright/test';
import { fresh } from './helpers';

test.describe('first login', () => {
  test('a new visitor is sent to the journey, not an empty app', async ({ page }) => {
    await fresh(page);
    await page.goto('/opportunities');
    await page.waitForURL(/\/start/);
    await expect(page.getByRole('heading', { name: 'Welcome' })).toBeVisible();
  });

  test('the journey shows all six steps in order and the résumé they come from', async ({ page }) => {
    await fresh(page);
    const steps = page.locator('ol li b');
    await expect(steps).toHaveText(['Upload', 'Tailor', 'People', 'Messaging', 'Interview', 'Track']);
    await expect(page.getByText('Résumé', { exact: true })).toBeVisible();
    /* the résumé's numbers land under the steps they feed */
    await expect(page.locator('ol li').nth(1)).toContainText('$1.2M');
    await expect(page.locator('ol li').nth(1)).toContainText('Story');
    await expect(page.locator('ol li').nth(4)).toContainText('Answer');
    await expect(page.getByRole('button', { name: /Upload your résumé/ })).toBeVisible();
  });

  test('résumé, headshot, first listing, then straight into Tailor', async ({ page }) => {
    const errors = await fresh(page);
    await page.getByRole('button', { name: /Upload your résumé/ }).click();
    await expect(page.getByRole('heading', { name: 'Résumé' })).toBeVisible();

    await page.getByRole('button', { name: 'Use an example' }).click();
    await page.getByRole('button', { name: /^Read$/ }).click();
    await expect(page.getByText('Read by pattern matching')).toBeVisible();
    await expect(page.getByText('$1.2M').first()).toBeVisible();
    await page.getByRole('button', { name: /^Continue/ }).click();

    await expect(page.getByRole('heading', { name: 'Headshot' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add a headshot' })).toBeVisible();
    await page.getByRole('button', { name: 'Later' }).click();

    await expect(page.getByRole('heading', { name: 'Company' })).toBeVisible();
    await page.getByRole('button', { name: 'Use an example' }).click();
    await page.getByRole('button', { name: /^Read$/ }).click();
    await expect(page.locator('#f-company')).toHaveValue('Acme');
    await expect(page.locator('#f-role')).toHaveValue('Mid-Market Account Executive');
    await expect(page.locator('#f-location')).toHaveValue('Chicago, hybrid');
    /* three suggested, none forced */
    await expect(page.getByText('3 picked')).toBeVisible();
    await page.getByRole('button', { name: 'Add Acme' }).click();

    await page.waitForURL(/\/o\//);
    await expect(page.getByRole('button', { name: /Upload, done/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Tailor', level: 2 })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('a company name is required before it is added', async ({ page }) => {
    await fresh(page);
    await page.getByRole('button', { name: 'Try the example' }).click();
    await page.waitForURL(/\/o\//);
    await page.goto('/new');
    await page.getByLabel('Listing').fill('We are hiring an Account Executive.\n- 3+ years of SaaS sales\n- Carry a quota');
    await page.getByRole('button', { name: /^Read$/ }).click();
    await page.locator('#f-company').fill('');
    await page.getByRole('button', { name: /^Add/ }).last().click();
    await expect(page.getByText('Add the company name')).toBeVisible();
  });

  test('work survives a reload', async ({ page }) => {
    await fresh(page);
    await page.getByRole('button', { name: 'Try the example' }).click();
    await page.waitForURL(/\/o\//);
    await page.waitForTimeout(600);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Tailor', level: 2 })).toBeVisible();
  });
});

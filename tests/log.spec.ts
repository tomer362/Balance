import { test, expect } from '@playwright/test';
import { setOnboardedState } from './helpers';

test.describe('Log page', () => {
  test.beforeEach(async ({ page }) => {
    await setOnboardedState(page);
    await page.goto('/log');
  });

  test('shows search input on ingredients tab', async ({ page }) => {
    // Ingredients tab should be active by default
    await expect(page.getByPlaceholder(/search/i)).toBeVisible();
  });

  test('searching for an ingredient shows results', async ({ page }) => {
    await page.getByPlaceholder(/search/i).fill('chicken');
    // Wait for local results to appear (no debounce needed for local db)
    await expect(page.getByText(/chicken/i).first()).toBeVisible({ timeout: 3000 });
  });

  test('clicking ingredient + button opens serving picker', async ({ page }) => {
    await page.getByPlaceholder(/search/i).fill('egg');
    await page.getByTestId('ingredient-add-btn').first().click();
    await expect(page.getByTestId('serving-picker')).toBeVisible();
  });

  test('serving picker: minus/plus buttons work', async ({ page }) => {
    await page.getByPlaceholder(/search/i).fill('egg');
    await page.getByTestId('ingredient-add-btn').first().click();
    const input = page.getByTestId('serving-input');
    const initial = Number(await input.inputValue());
    await page.getByTestId('serving-minus').click();
    expect(Number(await input.inputValue())).toBeLessThanOrEqual(initial);
    await page.getByTestId('serving-plus').click();
    await page.getByTestId('serving-plus').click();
    expect(Number(await input.inputValue())).toBeGreaterThan(initial - 10);
  });

  test('serving picker: confirm button closes sheet', async ({ page }) => {
    await page.getByPlaceholder(/search/i).fill('egg');
    await page.getByTestId('ingredient-add-btn').first().click();
    // The scanner FAB floats above the nav; force the click to avoid intercept
    await page.getByTestId('serving-confirm').click({ force: true });
    await expect(page.getByTestId('serving-picker')).not.toBeVisible();
  });

  test('serving picker: backdrop click closes sheet', async ({ page }) => {
    await page.getByPlaceholder(/search/i).fill('egg');
    await page.getByTestId('ingredient-add-btn').first().click();
    await expect(page.getByTestId('serving-picker')).toBeVisible();
    await page.getByTestId('bottomsheet-backdrop').click();
    await expect(page.getByTestId('serving-picker')).not.toBeVisible();
  });
});

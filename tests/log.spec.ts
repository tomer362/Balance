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

  test('searching cooked ingredients includes cooked chicken breast', async ({ page }) => {
    await page.getByPlaceholder(/search/i).fill('cooked');
    await expect(page.getByText('Chicken breast (cooked, roasted/grilled)')).toBeVisible({ timeout: 3000 });
  });

  test('yogurt search shows explicit Israeli fat percentages instead of vague full fat', async ({ page }) => {
    await page.getByPlaceholder(/search/i).fill('yogurt');

    await expect(page.getByText(/Greek yogurt 10% fat/i)).toBeVisible({ timeout: 3000 });
    await expect(page.getByText(/Yogurt 5% fat/i)).toBeVisible();
    await expect(page.getByText(/BIO white yogurt 2\.8% fat/i)).toBeVisible();
    await expect(page.getByText('Greek yogurt, full fat')).not.toBeVisible();
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

  test('ingredient detail sheet shows per-100g and per-serving micronutrients', async ({ page }) => {
    await page.getByPlaceholder(/search/i).fill('spinach');
    await page.getByTestId('ingredient-detail-btn-spinach').click();

    await expect(page.getByTestId('nutrition-detail-sheet')).toBeVisible();
    await expect(page.getByTestId('nutrition-detail-per-100g')).toContainText('Iron');
    await expect(page.getByTestId('nutrition-detail-per-100g')).toContainText('2.7 mg');
    await expect(page.getByTestId('nutrition-detail-per-100g')).toContainText('Folate');
    await expect(page.getByTestId('nutrition-detail-per-100g')).toContainText('194 mcg');
    await expect(page.getByTestId('nutrition-detail-per-serving')).toContainText('2 cups baby spinach (80 g)');
    await expect(page.getByTestId('nutrition-detail-per-serving')).toContainText('2.2 mg');
    await expect(page.getByTestId('nutrition-detail-per-serving')).toContainText('155 mcg');
  });

  test('recipe meal detail sheet opens from meals tab', async ({ page }) => {
    await page.getByRole('button', { name: 'Meals' }).click();
    await page.getByTestId(/meal-detail-btn-/).first().click();

    await expect(page.getByTestId('nutrition-detail-sheet')).toBeVisible();
    await expect(page.getByTestId('nutrition-detail-per-100g')).toContainText('Calories');
    await expect(page.getByTestId('nutrition-detail-per-serving')).toContainText('Default serving');
  });

  test('build meal totals can open full nutrition details', async ({ page }) => {
    await page.getByRole('button', { name: 'Build meal' }).click();
    await page.getByPlaceholder(/search ingredients/i).fill('egg');
    await page.getByTestId('ingredient-add-btn').first().click();
    await page.getByTestId('serving-confirm').click({ force: true });
    await page.getByTestId('build-meal-detail-btn').click();

    await expect(page.getByTestId('nutrition-detail-sheet')).toBeVisible();
    await expect(page.getByTestId('nutrition-detail-per-serving')).toContainText('55 g total');
  });
});

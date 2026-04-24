import { test, expect } from '@playwright/test';
import { setOnboardedState } from './helpers';

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await setOnboardedState(page);
    await page.goto('/');
  });

  test('bottom nav is visible on dashboard', async ({ page }) => {
    await expect(page.getByTestId('bottom-nav')).toBeVisible();
  });

  test('nav-log navigates to Log page', async ({ page }) => {
    await page.getByTestId('nav-log').click();
    await expect(page).toHaveURL(/\/log/);
  });

  test('nav-groceries navigates to Groceries page', async ({ page }) => {
    await page.getByTestId('nav-groceries').click();
    await expect(page).toHaveURL(/\/groceries/);
  });

  test('nav-profile navigates to Profile page', async ({ page }) => {
    await page.getByTestId('nav-profile').click();
    await expect(page).toHaveURL(/\/profile/);
  });

  test('nav-home navigates back to dashboard', async ({ page }) => {
    await page.getByTestId('nav-log').click();
    await page.getByTestId('nav-home').click();
    await expect(page).toHaveURL('/');
  });
});

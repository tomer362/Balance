import { test, expect } from '@playwright/test';
import { setOnboardedState } from './helpers';

test.describe('Profile page', () => {
  test.beforeEach(async ({ page }) => {
    await setOnboardedState(page);
    await page.goto('/profile');
  });

  test('shows profile card', async ({ page }) => {
    await expect(page.getByTestId('profile-card')).toBeVisible();
  });

  test('shows PCOS section for PCOS profile', async ({ page }) => {
    await expect(page.getByText('PCOS Profile')).toBeVisible();
  });

  test('shows pcos goal selector buttons', async ({ page }) => {
    await expect(page.getByTestId('pcos-goal-lose_weight')).toBeVisible();
    await expect(page.getByTestId('pcos-goal-manage_symptoms')).toBeVisible();
  });

  test('pcos goal buttons are interactive', async ({ page }) => {
    const manageBtn = page.getByTestId('pcos-goal-manage_symptoms');
    await manageBtn.click();
    // After clicking, the button should be active (has bg-sage-deep class)
    await expect(manageBtn).toHaveClass(/bg-sage-deep/);
  });

  test('shows TDEE breakdown card', async ({ page }) => {
    await expect(page.getByText('TDEE (maintenance)')).toBeVisible();
    // Use exact match to avoid collision with section heading 'Daily targets (auto-computed)'
    await expect(page.getByText('Daily target', { exact: true })).toBeVisible();
  });

  test('phase-aware toggle is visible with 44px hit area', async ({ page }) => {
    const toggles = page.getByTestId('toggle');
    await expect(toggles.first()).toBeVisible();
    const box = await toggles.first().boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });

  test('mode selector: switching away from pcos hides PCOS section', async ({ page }) => {
    // The PCOS section is visible for the test profile
    await expect(page.getByText('PCOS Profile')).toBeVisible();
    // Switch to maintain — PCOS section should disappear
    await page.getByTestId('mode-maintain').click();
    await expect(page.getByText('PCOS Profile')).not.toBeVisible();
  });
});

import { test, expect } from '@playwright/test';
import { clearState } from './helpers';

test.describe('Onboarding flow', () => {
  test.beforeEach(async ({ page }) => {
    await clearState(page);
    await page.goto('/');
  });

  test('shows onboarding on first visit', async ({ page }) => {
    await expect(page.getByText('Welcome to')).toBeVisible();
    await expect(page.getByText('Balance')).toBeVisible();
  });

  test('can type name and continue to step 2', async ({ page }) => {
    await page.getByTestId('onboarding-name-input').fill('Alice');
    await page.getByTestId('onboarding-step1-continue').click();
    await expect(page.getByText("What's your goal?")).toBeVisible();
  });

  test('step 2: selecting PCOS shows goal sub-question', async ({ page }) => {
    await page.getByTestId('onboarding-step1-continue').click();
    await page.getByTestId('mode-card-pcos').click();
    await expect(page.getByTestId('pcos-goal-section')).toBeVisible();
    await expect(page.getByTestId('pcos-goal-lose_weight')).toBeVisible();
    await expect(page.getByTestId('pcos-goal-manage_symptoms')).toBeVisible();
  });

  test('step 2: PCOS goal sub-question hidden for non-PCOS modes', async ({ page }) => {
    await page.getByTestId('onboarding-step1-continue').click();
    await page.getByTestId('mode-card-bulk').click();
    await expect(page.getByTestId('pcos-goal-section')).not.toBeVisible();
  });

  test('step 2: continue disabled until mode selected', async ({ page }) => {
    await page.getByTestId('onboarding-step1-continue').click();
    const btn = page.getByTestId('onboarding-step2-continue');
    await expect(btn).toBeDisabled();
    await page.getByTestId('mode-card-maintain').click();
    await expect(btn).not.toBeDisabled();
  });

  test('completes onboarding and shows dashboard', async ({ page }) => {
    await page.getByTestId('onboarding-step1-continue').click();
    await page.getByTestId('mode-card-pcos').click();
    await page.getByTestId('onboarding-step2-continue').click();
    await page.getByTestId('onboarding-finish').click();
    // After onboarding, the bottom nav should appear
    await expect(page.getByTestId('bottom-nav')).toBeVisible();
  });

  test('skip button bypasses onboarding', async ({ page }) => {
    await page.getByText('Skip').click();
    await expect(page.getByTestId('bottom-nav')).toBeVisible();
  });
});

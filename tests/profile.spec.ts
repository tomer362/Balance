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

  test('TDEE is computed live from demographics (not stale stored value)', async ({ page }) => {
    // Test profile: female, 30yo, 168cm, 75kg, moderate
    // BMR = 10*75 + 6.25*168 - 5*30 - 161 = 1489  →  TDEE = round(1489 * 1.55) = 2308
    await expect(page.getByText('2308 kcal')).toBeVisible();
  });

  test('phase-aware toggle is visible with 44px hit area', async ({ page }) => {
    const toggles = page.getByTestId('toggle');
    await expect(toggles.first()).toBeVisible();
    const box = await toggles.first().boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });

  test('mode selector: switching away from pcos hides PCOS section', async ({ page }) => {
    await expect(page.getByText('PCOS Profile')).toBeVisible();
    await page.getByTestId('mode-maintain').click();
    await expect(page.getByText('PCOS Profile')).not.toBeVisible();
  });

  test('mode selector: switching to bulk seeds training schedule section', async ({ page }) => {
    // The test profile has no bulk sub-object — switchMode() should seed one
    await page.getByTestId('mode-bulk').click();
    await expect(page.getByText('Training schedule')).toBeVisible();
  });

  test('mode selector: switching back to pcos restores PCOS section', async ({ page }) => {
    await page.getByTestId('mode-bulk').click();
    await expect(page.getByText('PCOS Profile')).not.toBeVisible();
    await page.getByTestId('mode-pcos').click();
    await expect(page.getByText('PCOS Profile')).toBeVisible();
  });

  // ── Body metrics ────────────────────────────────────────────────────────────

  test('body metrics section is visible with editable fields', async ({ page }) => {
    await expect(page.getByText('Body metrics')).toBeVisible();
    await expect(page.getByTestId('metrics-weight')).toBeVisible();
    await expect(page.getByTestId('metrics-height')).toBeVisible();
    await expect(page.getByTestId('metrics-age')).toBeVisible();
    await expect(page.getByTestId('metrics-activity')).toBeVisible();
  });

  test('body metrics weight input shows current weight', async ({ page }) => {
    const input = page.getByTestId('metrics-weight');
    await expect(input).toHaveValue('75');
  });

  test('changing weight immediately updates TDEE in breakdown', async ({ page }) => {
    // female, 30yo, 168cm, moderate:  new BMR = 10*80 + 6.25*168 - 5*30 - 161 = 1539
    // TDEE = round(1539 * 1.55) = 2385
    const weightInput = page.getByTestId('metrics-weight');
    await weightInput.fill('80');
    await weightInput.dispatchEvent('change');
    await expect(page.getByText('2385 kcal')).toBeVisible({ timeout: 3000 });
  });

  test('changing activity level updates TDEE', async ({ page }) => {
    // female, 30yo, 168cm, 75kg, active: BMR=1489, TDEE = round(1489 * 1.725) = 2569
    await page.getByTestId('metrics-activity').selectOption('active');
    await expect(page.getByText('2569 kcal')).toBeVisible({ timeout: 3000 });
  });

  // ── Plan info popup ─────────────────────────────────────────────────────────

  test('info buttons are visible next to each mode', async ({ page }) => {
    // 3 info buttons — one per mode
    const infoBtns = page.getByRole('button', { name: /About .* mode/i });
    await expect(infoBtns).toHaveCount(3);
  });

  test('clicking pcos info button shows plan explanation modal', async ({ page }) => {
    await page.getByRole('button', { name: /About pcos mode/i }).click();
    await expect(page.getByRole('heading', { name: 'PCOS Mode' })).toBeVisible();
    await expect(page.getByText(/insulin sensitivity/i)).toBeVisible();
  });

  test('clicking maintain info button shows maintain explanation', async ({ page }) => {
    await page.getByRole('button', { name: /About maintain mode/i }).click();
    await expect(page.getByText('Maintain Mode')).toBeVisible();
    await expect(page.getByText(/weight stable/i)).toBeVisible();
  });

  test('plan info modal closes on backdrop click', async ({ page }) => {
    await page.getByRole('button', { name: /About maintain mode/i }).click();
    await expect(page.getByText('Maintain Mode')).toBeVisible();
    // Click the backdrop (the overlay behind the modal)
    await page.mouse.click(10, 10);
    await expect(page.getByText(/weight stable/i)).not.toBeVisible({ timeout: 2000 });
  });

  // ── Maintain mode targets ───────────────────────────────────────────────────

  test('maintain mode shows fiber in daily targets', async ({ page }) => {
    await page.getByTestId('mode-maintain').click();
    // Fiber row should appear in Daily targets section for maintain mode
    await expect(page.getByText('Fiber')).toBeVisible();
  });

  // ── Science modal ────────────────────────────────────────────────────────────

  test('science modal trigger button is visible on profile page', async ({ page }) => {
    await expect(page.getByTestId('open-science-modal')).toBeVisible();
  });

  test('clicking science modal button opens the modal', async ({ page }) => {
    await page.getByTestId('open-science-modal').click();
    await expect(page.getByTestId('science-modal')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'How targets are calculated' })).toBeVisible();
  });

  test('science modal shows BMR formula section', async ({ page }) => {
    await page.getByTestId('open-science-modal').click();
    await expect(page.getByText(/Basal Metabolic Rate/i)).toBeVisible();
    // Test profile: female, 75kg, 168cm, 30yo — BMR = 1489 kcal/day
    await expect(page.getByText('= 1489 kcal/day')).toBeVisible();
  });

  test('science modal shows activity multiplier table with current level highlighted', async ({ page }) => {
    await page.getByTestId('open-science-modal').click();
    await expect(page.getByTestId('activity-table')).toBeVisible();
    // Test profile uses 'moderate' activity — should show "(you)" indicator
    await expect(page.getByText('Moderately active (you)')).toBeVisible();
  });

  test('science modal shows TDEE value', async ({ page }) => {
    await page.getByTestId('open-science-modal').click();
    // TDEE = round(1489 * 1.55) = 2308
    await expect(page.getByText('= 2308 kcal/day')).toBeVisible();
  });

  test('science modal shows mode-specific macro section', async ({ page }) => {
    await page.getByTestId('open-science-modal').click();
    // Test profile is in PCOS mode — step 3 heading is unique to the science modal
    await expect(page.getByText('Step 3 — Macro targets (PCOS Mode)')).toBeVisible();
    await expect(page.getByText(/insulin sensitivity/i)).toBeVisible();
  });

  test('science modal shows references section with validated links', async ({ page }) => {
    await page.getByTestId('open-science-modal').click();
    await expect(page.getByText('Mifflin et al. (1990)')).toBeVisible();
    await expect(page.getByText('WHO Healthy Diet')).toBeVisible();
  });

  test('science modal closes on backdrop click', async ({ page }) => {
    await page.getByTestId('open-science-modal').click();
    await expect(page.getByTestId('science-modal')).toBeVisible();
    // Click top-left corner (backdrop)
    await page.mouse.click(10, 10);
    await expect(page.getByTestId('science-modal')).not.toBeVisible({ timeout: 2000 });
  });

  test('science modal closes via X button', async ({ page }) => {
    await page.getByTestId('open-science-modal').click();
    await expect(page.getByTestId('science-modal')).toBeVisible();
    // The X close button is inside the modal content (stops propagation)
    await page.getByTestId('science-modal').locator('button').last().click();
    await expect(page.getByTestId('science-modal')).not.toBeVisible({ timeout: 2000 });
  });
});

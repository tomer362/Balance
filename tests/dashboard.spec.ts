import { test, expect } from '@playwright/test';
import { setOnboardedStateWithMeal } from './helpers';

test.describe('Dashboard EditMealSheet', () => {
  test.beforeEach(async ({ page }) => {
    await setOnboardedStateWithMeal(page);
    await page.goto('/');
  });

  test('meal card edit button opens EditMealSheet', async ({ page }) => {
    const editBtn = page.getByTestId('meal-card-edit');
    await expect(editBtn).toBeVisible();
    await editBtn.click();
    await expect(page.getByTestId('edit-meal-sheet')).toBeVisible();
  });

  test('edit sheet shows meal name and serving inputs', async ({ page }) => {
    await page.getByTestId('meal-card-edit').click();
    await expect(page.getByTestId('edit-meal-name')).toBeVisible();
    await expect(page.getByTestId('edit-meal-serving')).toBeVisible();
  });

  test('edit sheet Save button is visible and clickable (not obscured by bottom nav)', async ({ page }) => {
    await page.getByTestId('meal-card-edit').click();
    const saveBtn = page.getByTestId('edit-meal-save');
    await expect(saveBtn).toBeVisible();
    // Playwright's click() fails if the element is z-blocked by an overlay.
    // This verifies the createPortal fix: BottomSheet renders at z-[60] above BottomNav z-50.
    await saveBtn.click();
    await expect(page.getByTestId('edit-meal-sheet')).not.toBeVisible({ timeout: 2000 });
  });

  test('saving edits closes the sheet and updates the meal name', async ({ page }) => {
    await page.getByTestId('meal-card-edit').click();
    const nameInput = page.getByTestId('edit-meal-name');
    await nameInput.fill('Updated Breakfast');
    await page.getByTestId('edit-meal-save').click();
    await expect(page.getByTestId('edit-meal-sheet')).not.toBeVisible({ timeout: 2000 });
    await expect(page.getByText('Updated Breakfast')).toBeVisible();
  });

  test('meal card nutrition button opens nutrition detail sheet with micronutrients', async ({ page }) => {
    await page.getByTestId('meal-card-nutrition').click();

    await expect(page.getByTestId('nutrition-detail-sheet')).toBeVisible();
    await expect(page.getByTestId('nutrition-detail-per-serving')).toContainText('300 g');
    await expect(page.getByTestId('nutrition-detail-per-serving')).toContainText('Calcium');
    await expect(page.getByTestId('nutrition-detail-per-serving')).toContainText('180 mg');
    await expect(page.getByTestId('nutrition-detail-per-serving')).toContainText('Vitamin B12');
    await expect(page.getByTestId('nutrition-detail-per-serving')).toContainText('0.9 mcg');
  });

  test('editing serving preserves meal micronutrients after rescaling', async ({ page }) => {
    await page.getByTestId('meal-card-edit').click();
    await page.getByTestId('edit-meal-serving').fill('600');
    await page.getByTestId('edit-meal-save').click();
    await expect(page.getByTestId('edit-meal-sheet')).not.toBeVisible({ timeout: 2000 });

    await page.getByTestId('meal-card-nutrition').click();
    await expect(page.getByTestId('nutrition-detail-per-serving')).toContainText('600 g');
    await expect(page.getByTestId('nutrition-detail-per-serving')).toContainText('Calcium');
    await expect(page.getByTestId('nutrition-detail-per-serving')).toContainText('360 mg');
    await expect(page.getByTestId('nutrition-detail-per-serving')).toContainText('Vitamin C');
    await expect(page.getByTestId('nutrition-detail-per-serving')).toContainText('24 mg');
  });

  test('dashboard weight check-in updates weight and derived goal', async ({ page }) => {
    await page.getByTestId('dashboard-weight-update').click();
    await expect(page.getByTestId('weight-update-sheet')).toBeVisible();
    await page.getByTestId('dashboard-weight-input').fill('80');
    await page.getByTestId('dashboard-weight-save').click();
    await expect(page.getByTestId('weight-update-sheet')).not.toBeVisible({ timeout: 2000 });
    await expect(page.getByTestId('dashboard-weight-update')).toContainText('80 kg');
    await expect(page.getByTestId('dashboard-weight-update')).toContainText('72 kg');
  });
});

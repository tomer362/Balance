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

  test('dashboard weight check-in updates weight and derived goal', async ({ page }) => {
    await page.getByTestId('dashboard-weight-update').click();
    await expect(page.getByTestId('weight-update-sheet')).toBeVisible();
    await page.getByTestId('dashboard-weight-input').fill('80');
    await page.getByTestId('dashboard-weight-save').click();
    await expect(page.getByTestId('weight-update-sheet')).not.toBeVisible({ timeout: 2000 });
    await expect(page.getByText('80 kg')).toBeVisible();
    await expect(page.getByText('72 kg goal')).toBeVisible();
  });
});

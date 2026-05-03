import { test, expect } from '@playwright/test';
import { setOnboardedState } from './helpers';

test.describe('Wellness page', () => {
  test.beforeEach(async ({ page }) => {
    await setOnboardedState(page);
    await page.goto('/wellness');
  });

  test('logs steps and updates daily alerts/history area', async ({ page }) => {
    await expect(page.getByTestId('wellness-alerts')).toContainText('steps left');
    await page.getByTestId('steps-input').fill('10000');
    await page.getByTestId('steps-save').click();

    await expect(page.getByTestId('steps-section')).toContainText('10,000');
    await expect(page.getByTestId('wellness-alerts')).not.toContainText('steps left');
  });

  test('logs water with quick add and logs workout progress', async ({ page }) => {
    await page.getByTestId('water-add-500').click();
    await expect(page.getByTestId('water-section')).toContainText('500 ml');

    await page.getByTestId('workout-goal-input').fill('2');
    await page.getByTestId('workout-toggle').click();
    await expect(page.getByTestId('workouts-section')).toContainText('1/2');
  });
});

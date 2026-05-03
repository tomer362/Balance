import { test, expect } from '@playwright/test';
import { setOnboardedState } from './helpers';

test.describe('Cheat meals page', () => {
  test.beforeEach(async ({ page }) => {
    await setOnboardedState(page);
    await page.goto('/cheat-meals');
  });

  test('logs cheat meals and rebalance overage into next week', async ({ page }) => {
    for (const meal of ['Pizza', 'Burger', 'Cake']) {
      await page.getByTestId('cheat-name-input').fill(meal);
      await page.getByTestId('cheat-save').click();
    }

    await expect(page.getByTestId('cheat-meal-stats')).toContainText('Used');
    await expect(page.getByTestId('cheat-meal-stats')).toContainText('3');
    await expect(page.getByTestId('cheat-meal-stats')).toContainText('next week starts with 1 allowed');
    await expect(page.getByTestId('cheat-current-week')).toContainText('Pizza');
  });
});

import { test, expect } from '@playwright/test';

async function setProgressState(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript(() => {
    const today = new Date();
    const iso = (daysAgo: number) => {
      const d = new Date(today);
      d.setDate(d.getDate() - daysAgo);
      return d.toISOString().split('T')[0];
    };

    const state = {
      state: {
        activeProfileId: 'test-pcos',
        hasOnboarded: true,
        appSettings: { units: 'metric', theme: 'auto', language: 'en' },
        profiles: [
          {
            id: 'test-pcos',
            name: 'Test User',
            mode: 'pcos',
            demographics: {
              sex: 'female',
              age: 30,
              height_cm: 168,
              weight_kg: 75.4,
              goal_weight_kg: 65,
              activity_level: 'moderate',
            },
            targets: {
              calories: 1710,
              protein_g: 113,
              fat_g: 57,
              carbs_g: 171,
              fiber_g: 30,
              omega3_g: 3.0,
              max_glycemic_load: 100,
              meals_per_day_target: 4,
              protein_per_meal_min: 20,
              tdee: 2010,
            },
            foodLog: [],
            mealPlan: {},
            weightHistory: [
              { date: iso(28), kg: 78.0 },
              { date: iso(21), kg: 77.2 },
              { date: iso(14), kg: 76.4 },
              { date: iso(7), kg: 75.9 },
              { date: iso(3), kg: 75.6 },
              { date: iso(0), kg: 75.4 },
            ],
            customRecipes: [],
            preferences: { dietary_flags: [], dislikes: [] },
            pcos: {
              concerns: ['insulin-resistance'],
              goal: 'lose_weight',
              cycle: { avgCycleLength: 28, avgPeriodLength: 5, history: [] },
              symptomLog: [],
              seedCyclingEnabled: false,
            },
          },
        ],
      },
      version: 4,
    };
    localStorage.setItem('balance-storage', JSON.stringify(state));
  });
}

test.describe('Progress page', () => {
  test.beforeEach(async ({ page }) => {
    await setProgressState(page);
    await page.goto('/progress');
  });

  test('shows weight analysis cards and history list', async ({ page }) => {
    await expect(page.getByTestId('weight-analysis-cards')).toBeVisible();
    await expect(page.getByTestId('weight-analysis-cards')).toContainText('Weekly average');
    await expect(page.getByTestId('weight-analysis-cards')).toContainText('Avg weekly rate');
    await expect(page.getByTestId('weight-history-list')).toBeVisible();
  });

  test('can log a weight from progress', async ({ page }) => {
    await page.getByTestId('progress-weight-toggle').click();
    await page.getByTestId('progress-weight-input').fill('74.9');
    await page.getByTestId('progress-weight-save').click();
    await expect(page.getByTestId('progress-weight-input')).not.toBeVisible();
    await expect(page.getByTestId('weight-history-list')).toContainText('74.9 kg');
  });
});

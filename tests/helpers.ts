import type { Page } from '@playwright/test';

/**
 * Inject a fully-onboarded PCOS profile into localStorage so tests can skip
 * the onboarding wizard.
 */
export async function setOnboardedState(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const today = new Date().toISOString().split('T')[0];
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
              weight_kg: 75,
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
            weightHistory: [{ date: today, kg: 75 }],
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
      version: 3,
    };
    localStorage.setItem('balance-storage', JSON.stringify(state));
  });
}

/**
 * Clear localStorage so the onboarding wizard is shown.
 */
export async function clearState(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.removeItem('balance-storage');
  });
}

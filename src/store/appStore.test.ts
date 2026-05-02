import { describe, expect, it } from 'vitest';
import { migratePersistedAppState } from './appStore';

describe('migratePersistedAppState', () => {
  it('hydrates persisted nutrition containers without dropping existing nutrition fields', () => {
    const migrated = migratePersistedAppState(
      {
        activeProfileId: 'profile-1',
        hasOnboarded: true,
        profiles: [
          {
            id: 'profile-1',
            name: 'Test',
            mode: 'pcos',
            demographics: {
              sex: 'female',
              age: 30,
              height_cm: 168,
              weight_kg: 70,
              goal_weight_kg: 65,
              activity_level: 'moderate',
            },
            targets: { calories: 1800, protein_g: 110, fat_g: 60, carbs_g: 170 },
            foodLog: [
              {
                id: 'meal-1',
                timestamp: '2026-05-02T08:00:00.000Z',
                meal_type: 'breakfast',
                name: 'Eggs',
                serving_g: 100,
                score: 8.5,
                nutrition: {
                  calories: 155,
                  protein_g: 13,
                  carbs_g: 1.1,
                  fiber_g: 0,
                  sugar_g: 1.1,
                  fat_g: 11,
                  saturated_fat_g: 3,
                  sodium_mg: 124,
                  glycemic_index: 0,
                  glycemic_load: 0,
                  omega3_g: 0.1,
                },
              },
            ],
            mealPlan: {},
            weightHistory: [],
            customRecipes: [
              {
                id: 'recipe-1',
                name: 'Imported Meal',
                prep_time_min: 10,
                meal_types: ['lunch'],
                tags: [],
                dietary: [],
                pcos_score: 8,
                gap_coverage: ['protein'],
                nutrition: {
                  calories: 320,
                  protein_g: 24,
                  carbs_g: 30,
                  fiber_g: 6,
                  sugar_g: 5,
                  fat_g: 9,
                  saturated_fat_g: 2,
                  sodium_mg: 210,
                },
              },
            ],
            preferences: { dietary_flags: [], dislikes: [] },
            pcos: {
              concerns: [],
              cycle: { avgCycleLength: 28, avgPeriodLength: 5, history: [] },
              symptomLog: [],
              seedCyclingEnabled: false,
            },
          },
        ],
      },
      3,
    );

    const profile = migrated.profiles?.[0];
    expect(profile?.foodLog[0].nutrition).toMatchObject({
      calories: 155,
      glycemic_index: 0,
      glycemic_load: 0,
      omega3_g: 0.1,
      micronutrients: undefined,
    });
    expect(profile?.customRecipes[0].nutrition).toMatchObject({
      calories: 320,
      protein_g: 24,
      micronutrients: undefined,
    });
  });
});

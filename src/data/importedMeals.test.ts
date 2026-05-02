import { describe, expect, it } from 'vitest';
import { normalizeImportedMealRecord } from './importedMeals';

describe('normalizeImportedMealRecord', () => {
  it('normalizes imported micronutrients and ingredients into meal nutrition', () => {
    const meal = normalizeImportedMealRecord({
      id: 'mfp-1',
      name: 'Protein Yogurt Bowl',
      brand: 'My Brand',
      source: 'myfitnesspal',
      serving_g: 250,
      nutrition: {
        calories: 260,
        protein_g: 25.2,
        carbs_g: 18.4,
        fiber_g: 4.1,
        sugar_g: 9.3,
        fat_g: 7.2,
        saturated_fat_g: 1.4,
        sodium_mg: 140,
        micronutrients: {
          calcium_mg: 220,
          iron_mg: 1.6,
          vitamin_b12_mcg: 1.2,
        },
        ingredients: ['yogurt', 'berries'],
      },
    });

    expect(meal.nutrition).toEqual({
      calories: 260,
      protein_g: 25.2,
      carbs_g: 18.4,
      fiber_g: 4.1,
      sugar_g: 9.3,
      fat_g: 7.2,
      saturated_fat_g: 1.4,
      sodium_mg: 140,
      glycemic_index: undefined,
      glycemic_load: undefined,
      omega3_g: undefined,
      micronutrients: {
        calcium_mg: 220,
        iron_mg: 1.6,
        vitamin_b12_mcg: 1.2,
      },
      ingredients: ['yogurt', 'berries'],
    });
    expect(meal.name).toBe('Protein Yogurt Bowl (My Brand)');
    expect(meal.tags).toContain('source-myfitnesspal');
    expect(meal.tags).toContain('brand-my-brand');
  });
});

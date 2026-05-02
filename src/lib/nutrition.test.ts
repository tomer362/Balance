import { describe, expect, it } from 'vitest';
import { scaleNutrition, sumNutrition } from './nutrition';

describe('nutrition helpers', () => {
  it('scales macros, glycemic load, omega-3, micronutrients, and ingredients', () => {
    const scaled = scaleNutrition(
      {
        calories: 200,
        protein_g: 10,
        carbs_g: 20,
        fiber_g: 5,
        sugar_g: 4,
        fat_g: 8,
        saturated_fat_g: 2,
        sodium_mg: 300,
        glycemic_index: 40,
        glycemic_load: 12,
        omega3_g: 1.25,
        micronutrients: {
          iron_mg: 2.4,
          calcium_mg: 150,
          vitamin_b12_mcg: 0.8,
        },
        ingredients: ['salmon', 'rice'],
      },
      1.5,
    );

    expect(scaled).toEqual({
      calories: 300,
      protein_g: 15,
      carbs_g: 30,
      fiber_g: 7.5,
      sugar_g: 6,
      fat_g: 12,
      saturated_fat_g: 3,
      sodium_mg: 450,
      glycemic_index: 40,
      glycemic_load: 18,
      omega3_g: 1.88,
      micronutrients: {
        iron_mg: 3.6,
        calcium_mg: 225,
        vitamin_b12_mcg: 1.2,
      },
      ingredients: ['salmon', 'rice'],
    });
  });

  it('sums nutrition and merges optional micronutrients', () => {
    const summed = sumNutrition([
      {
        calories: 120,
        protein_g: 12,
        carbs_g: 10,
        fiber_g: 3,
        sugar_g: 2,
        fat_g: 4,
        saturated_fat_g: 1,
        sodium_mg: 80,
        glycemic_load: 4,
        omega3_g: 0.5,
        micronutrients: {
          iron_mg: 1.2,
          calcium_mg: 80,
        },
      },
      {
        calories: 90,
        protein_g: 8,
        carbs_g: 5,
        fiber_g: 2,
        sugar_g: 1,
        fat_g: 3,
        saturated_fat_g: 0.5,
        sodium_mg: 40,
        glycemic_load: 2.5,
        omega3_g: 1.1,
        micronutrients: {
          iron_mg: 0.8,
          potassium_mg: 220,
        },
      },
    ]);

    expect(summed).toEqual({
      calories: 210,
      protein_g: 20,
      carbs_g: 15,
      fiber_g: 5,
      sugar_g: 3,
      fat_g: 7,
      saturated_fat_g: 1.5,
      sodium_mg: 120,
      glycemic_index: undefined,
      glycemic_load: 6.5,
      omega3_g: 1.6,
      micronutrients: {
        iron_mg: 2,
        calcium_mg: 80,
        potassium_mg: 220,
      },
      ingredients: undefined,
    });
  });
});

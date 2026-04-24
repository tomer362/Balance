import type { Profile, Targets } from '../store/appStore';

/**
 * Mifflin-St Jeor BMR
 */
function calculateBMR(profile: Profile): number {
  const { sex, age, height_cm, weight_kg } = profile.demographics;
  if (sex === 'male') {
    return 10 * weight_kg + 6.25 * height_cm - 5 * age + 5;
  } else {
    return 10 * weight_kg + 6.25 * height_cm - 5 * age - 161;
  }
}

const activityMultipliers: Record<string, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

function calculateTDEE(profile: Profile): number {
  const bmr = calculateBMR(profile);
  const multiplier = activityMultipliers[profile.demographics.activity_level] ?? 1.55;
  return Math.round(bmr * multiplier);
}

/**
 * Compute PCOS targets: TDEE - 500 kcal deficit
 * High protein, high fiber, low GL, good omega-3
 */
export function computePCOSTargets(profile: Profile): Targets {
  const tdee = calculateTDEE(profile);
  const calories = Math.max(1200, tdee - 500);
  const protein_g = Math.round(profile.demographics.weight_kg * 1.3);
  const fat_g = Math.round(calories * 0.3 / 9);
  const carbs_g = Math.round((calories - protein_g * 4 - fat_g * 9) / 4);

  return {
    calories,
    protein_g,
    fat_g,
    carbs_g: Math.max(100, carbs_g),
    fiber_g: 30,
    omega3_g: 3.0,
    max_glycemic_load: 100,
    meals_per_day_target: 4,
    protein_per_meal_min: 20,
  };
}

/**
 * Compute Bulk targets: TDEE + surplus
 * High protein (2g/kg), higher carbs on training days
 */
export function computeBulkTargets(profile: Profile): Targets {
  const tdee = calculateTDEE(profile);
  const surplus = profile.bulk?.surplus_kcal ?? 300;
  const proteinPerKg = profile.bulk?.protein_g_per_kg ?? 2.0;
  const calories = tdee + surplus;

  const protein_g = Math.round(profile.demographics.weight_kg * proteinPerKg);
  const fat_g = Math.round(calories * 0.25 / 9);
  const carbs_g = Math.round((calories - protein_g * 4 - fat_g * 9) / 4);

  const caloriesTraining = calories + 150;
  const caloriesRest = calories - 150;
  const carbsTraining = Math.round(carbs_g * 1.15);
  const carbsRest = Math.round(carbs_g * 0.85);

  return {
    calories,
    protein_g,
    fat_g,
    carbs_g: Math.max(200, carbs_g),
    fiber_g: 35,
    omega3_g: 2.0,
    calories_training_day: caloriesTraining,
    calories_rest_day: caloriesRest,
    carbs_training_day: carbsTraining,
    carbs_rest_day: carbsRest,
    meals_per_day_target: 5,
    protein_per_meal_min: 30,
  };
}

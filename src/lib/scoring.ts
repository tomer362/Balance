import type { NutritionData, Phase } from '../store/appStore';

/**
 * PCOS Score (0-10): section 8.1
 * Rewards high protein, high fiber, high omega-3, low glycemic load, low saturated fat
 */
export function pcosScore(nutrition: NutritionData, servingG: number): number {
  let score = 5.0;

  // Protein quality (0-2 pts): target 20-40g per meal
  const proteinScore = Math.min(nutrition.protein_g / 25, 1) * 2;
  score += proteinScore;

  // Fiber bonus (0-1.5 pts): target 8+g
  const fiberScore = Math.min(nutrition.fiber_g / 8, 1) * 1.5;
  score += fiberScore;

  // Omega-3 bonus (0-1.5 pts): target 1.5g+
  const omega3 = nutrition.omega3_g ?? 0;
  const omega3Score = Math.min(omega3 / 1.5, 1) * 1.5;
  score += omega3Score;

  // Glycemic load penalty (-2 pts max): GL > 20 = penalize
  const gl = nutrition.glycemic_load ?? (nutrition.glycemic_index ? (nutrition.glycemic_index * nutrition.carbs_g) / 100 : 10);
  if (gl > 20) {
    score -= Math.min((gl - 20) / 15, 1) * 2;
  } else if (gl < 10) {
    // Low GL bonus
    score += 0.5;
  }

  // Saturated fat penalty (-1 pt max): > 5g
  if (nutrition.saturated_fat_g > 5) {
    score -= Math.min((nutrition.saturated_fat_g - 5) / 5, 1);
  }

  // Sugar penalty (-1 pt max): > 15g added sugar
  if (nutrition.sugar_g > 15) {
    score -= Math.min((nutrition.sugar_g - 15) / 20, 1);
  }

  // Serving size normalization bonus: reasonable serving (200-500g)
  if (servingG >= 200 && servingG <= 500) {
    score += 0.3;
  }

  return Math.max(0, Math.min(10, score));
}

/**
 * Bulk Score (0-10): section 8.2
 * Rewards high protein, high calories, good carb:protein ratio
 */
export function bulkScore(nutrition: NutritionData, servingG: number): number {
  let score = 4.0;

  // Protein density (0-3 pts): target 30-50g per meal
  const proteinScore = Math.min(nutrition.protein_g / 35, 1) * 3;
  score += proteinScore;

  // Calorie density (0-2 pts): 400-700 kcal per meal is ideal for bulking
  const calScore = nutrition.calories >= 400
    ? Math.min((nutrition.calories - 400) / 400 + 0.5, 1) * 2
    : Math.max(0, nutrition.calories / 400) * 2;
  score += calScore * 0.5;

  // Carb:Protein ratio bonus (0-1 pt): 2:1 to 4:1 ideal
  const ratio = nutrition.carbs_g / Math.max(nutrition.protein_g, 1);
  if (ratio >= 2 && ratio <= 4) {
    score += 1;
  } else if (ratio >= 1 && ratio < 2) {
    score += 0.5;
  }

  // Low saturated fat relative to total fat (0-1 pt)
  const satRatio = nutrition.saturated_fat_g / Math.max(nutrition.fat_g, 1);
  if (satRatio < 0.3) {
    score += 1;
  } else if (satRatio < 0.5) {
    score += 0.5;
  }

  // Fiber bonus (0-0.5 pts)
  score += Math.min(nutrition.fiber_g / 12, 1) * 0.5;

  // Low sugar penalty
  if (nutrition.sugar_g > 30) {
    score -= Math.min((nutrition.sugar_g - 30) / 20, 1) * 0.5;
  }

  // Serving normalization
  if (servingG >= 300 && servingG <= 700) {
    score += 0.5;
  }

  return Math.max(0, Math.min(10, score));
}

/**
 * Cycle phase bonus: section 8.3
 * Returns additive score bonus/penalty based on meal nutrition fit for the phase
 */
export function cyclePhaseBonus(nutrition: NutritionData, phase: Phase): number {
  switch (phase) {
    case 'menstrual':
      // High iron-supporting foods, anti-inflammatory
      return (nutrition.omega3_g ?? 0) > 1.0 ? 0.5 : 0;

    case 'follicular':
      // High protein for building, moderate carbs
      return nutrition.protein_g > 20 && nutrition.carbs_g < 50 ? 0.4 : 0;

    case 'ovulatory':
      // Antioxidant-rich, cruciferous vegetables (high fiber signal)
      return nutrition.fiber_g > 6 ? 0.4 : 0;

    case 'luteal':
      // Complex carbs, magnesium (high fiber, moderate sugar), reduce bloating
      const gl = nutrition.glycemic_load ?? 15;
      if (nutrition.fiber_g > 5 && gl < 15) return 0.6;
      if (gl < 20 && nutrition.protein_g > 15) return 0.3;
      return 0;

    default:
      return 0;
  }
}

/**
 * Main scorer: section 19.3
 * Returns a 0-10 score combining mode-specific scoring + cycle bonus
 */
export function scoreFood(
  nutrition: NutritionData,
  servingG: number,
  mode: 'pcos' | 'bulk' | 'maintain',
  cyclePhase?: Phase
): number {
  let base: number;

  if (mode === 'pcos') {
    base = pcosScore(nutrition, servingG);
    if (cyclePhase) {
      base += cyclePhaseBonus(nutrition, cyclePhase);
    }
  } else if (mode === 'bulk') {
    base = bulkScore(nutrition, servingG);
  } else {
    // Maintain: balanced average
    base = (pcosScore(nutrition, servingG) + bulkScore(nutrition, servingG)) / 2;
  }

  return Math.max(0, Math.min(10, base));
}

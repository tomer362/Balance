import type { NutritionData, Targets } from '../store/appStore';

export interface Gap {
  nutrient: string;
  severity: 'high' | 'medium' | 'warning' | 'low';
  deficit_g?: number;
  remaining?: number;
  label: string;
}

export function sumNutrients(meals: NutritionData[]): NutritionData {
  return meals.reduce(
    (acc, n) => ({
      calories: acc.calories + n.calories,
      protein_g: acc.protein_g + n.protein_g,
      carbs_g: acc.carbs_g + n.carbs_g,
      fiber_g: acc.fiber_g + n.fiber_g,
      sugar_g: acc.sugar_g + n.sugar_g,
      fat_g: acc.fat_g + n.fat_g,
      saturated_fat_g: acc.saturated_fat_g + n.saturated_fat_g,
      sodium_mg: acc.sodium_mg + n.sodium_mg,
      glycemic_index: undefined,
      glycemic_load: (acc.glycemic_load ?? 0) + (n.glycemic_load ?? 0),
      omega3_g: (acc.omega3_g ?? 0) + (n.omega3_g ?? 0),
    }),
    {
      calories: 0,
      protein_g: 0,
      carbs_g: 0,
      fiber_g: 0,
      sugar_g: 0,
      fat_g: 0,
      saturated_fat_g: 0,
      sodium_mg: 0,
      glycemic_load: 0,
      omega3_g: 0,
    } as NutritionData
  );
}

/**
 * Analyze nutritional gaps relative to targets.
 * Uses time-adjusted targets: (hoursElapsed/24) * dailyTarget * 1.1
 * to allow gaps only if you're meaningfully behind for the time of day.
 */
export function analyzeGaps(logged: NutritionData[], targets: Targets): Gap[] {
  const totals = sumNutrients(logged);
  const gaps: Gap[] = [];

  const now = new Date();
  const hoursElapsed = now.getHours() + now.getMinutes() / 60;
  const timeFactor = Math.max(hoursElapsed / 24, 0.1);
  const timeAdjustedFactor = timeFactor * 1.1;

  function check(
    nutrient: string,
    actual: number,
    target: number | undefined,
    unit: string,
    label: string
  ) {
    if (!target) return;
    const timeTarget = target * timeAdjustedFactor;
    const pct = actual / target;
    const remaining = Math.max(0, target - actual);

    if (pct < 0.5 && actual < timeTarget * 0.7) {
      gaps.push({
        nutrient,
        severity: 'high',
        deficit_g: remaining,
        remaining: Math.round(remaining),
        label: `${label} ${Math.round(remaining)}${unit} needed`,
      });
    } else if (pct < 0.7 && actual < timeTarget * 0.8) {
      gaps.push({
        nutrient,
        severity: 'medium',
        deficit_g: remaining,
        remaining: Math.round(remaining),
        label: `${label} ${Math.round(remaining)}${unit} low`,
      });
    } else if (pct < 0.85 && actual < timeTarget) {
      gaps.push({
        nutrient,
        severity: 'warning',
        deficit_g: remaining,
        remaining: Math.round(remaining),
        label: `${label} ${Math.round(remaining)}${unit} remaining`,
      });
    }
  }

  check('calories', totals.calories, targets.calories, ' kcal', 'Calories');
  check('protein', totals.protein_g, targets.protein_g, 'g', 'Protein');
  check('fiber', totals.fiber_g, targets.fiber_g, 'g', 'Fiber');
  check('omega3', totals.omega3_g ?? 0, targets.omega3_g, 'g', 'Omega-3');
  check('carbs', totals.carbs_g, targets.carbs_g, 'g', 'Carbs');
  check('fat', totals.fat_g, targets.fat_g, 'g', 'Fat');

  // Glycemic load: flag if OVER target (it's a cap, not a minimum)
  if (targets.max_glycemic_load) {
    const totalGL = totals.glycemic_load ?? 0;
    const pctUsed = totalGL / targets.max_glycemic_load;
    if (pctUsed > 0.85) {
      gaps.push({
        nutrient: 'glycemic_load',
        severity: pctUsed > 1.0 ? 'high' : 'warning',
        remaining: Math.round(Math.max(0, targets.max_glycemic_load - totalGL)),
        label: `GL ${Math.round(totalGL)} / ${targets.max_glycemic_load} used`,
      });
    }
  }

  // Sort by severity
  const severityOrder = { high: 0, medium: 1, warning: 2, low: 3 };
  gaps.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return gaps;
}

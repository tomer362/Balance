import type { NutritionData, Targets } from '../store/appStore';
import { sumNutrition } from './nutrition';

export interface Gap {
  nutrient: string;
  severity: 'high' | 'medium' | 'warning' | 'low';
  deficit_g?: number;
  remaining?: number;
  unit?: string;
  status: 'needed' | 'low' | 'remaining' | 'used';
  actual?: number;
  target?: number;
}

export function sumNutrients(meals: NutritionData[]): NutritionData {
  return sumNutrition(meals);
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
    unit: string
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
        unit,
        status: 'needed',
      });
    } else if (pct < 0.7 && actual < timeTarget * 0.8) {
      gaps.push({
        nutrient,
        severity: 'medium',
        deficit_g: remaining,
        remaining: Math.round(remaining),
        unit,
        status: 'low',
      });
    } else if (pct < 0.85 && actual < timeTarget) {
      gaps.push({
        nutrient,
        severity: 'warning',
        deficit_g: remaining,
        remaining: Math.round(remaining),
        unit,
        status: 'remaining',
      });
    }
  }

  check('calories', totals.calories, targets.calories, ' kcal');
  check('protein', totals.protein_g, targets.protein_g, 'g');
  check('fiber', totals.fiber_g, targets.fiber_g, 'g');
  check('omega3', totals.omega3_g ?? 0, targets.omega3_g, 'g');
  check('carbs', totals.carbs_g, targets.carbs_g, 'g');
  check('fat', totals.fat_g, targets.fat_g, 'g');

  // Glycemic load: flag if OVER target (it's a cap, not a minimum)
  if (targets.max_glycemic_load) {
    const totalGL = totals.glycemic_load ?? 0;
    const pctUsed = totalGL / targets.max_glycemic_load;
    if (pctUsed > 0.85) {
      gaps.push({
        nutrient: 'glycemic_load',
        severity: pctUsed > 1.0 ? 'high' : 'warning',
        remaining: Math.round(Math.max(0, targets.max_glycemic_load - totalGL)),
        actual: Math.round(totalGL),
        target: targets.max_glycemic_load,
        status: 'used',
      });
    }
  }

  // Sort by severity
  const severityOrder = { high: 0, medium: 1, warning: 2, low: 3 };
  gaps.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return gaps;
}

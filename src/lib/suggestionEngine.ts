import type { Profile, MealItem, LoggedMeal } from '../store/appStore';
import { analyzeGaps, sumNutrients } from './gapAnalysis';
import { mealDatabase } from '../data/mealDatabase';
import { getCurrentPhase } from './cyclePhase';

function isTrainingDay(profile: Profile): boolean {
  if (!profile.bulk?.trainingSchedule) return false;
  const dayOfWeek = new Date().getDay(); // 0=Sun, 1=Mon,...
  // weekPattern is Mon-Sun: index 0=Mon ... 6=Sun
  const idx = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  return profile.bulk.trainingSchedule.weekPattern[idx] === 'training';
}

function calorieFit(mealKcal: number, remainingKcal: number, mode: string): number {
  if (remainingKcal <= 0) return 0;
  const diff = Math.abs(mealKcal - remainingKcal);
  const fit = Math.max(0, 1 - diff / remainingKcal);
  if (mode === 'bulk' && mealKcal < remainingKcal * 0.15) return fit * 0.5;
  return fit;
}

function gapClosureCoverage(meal: MealItem, gaps: ReturnType<typeof analyzeGaps>): number {
  if (gaps.length === 0) return 0.5;
  const highPriorityGaps = gaps.filter((g) => g.severity === 'high' || g.severity === 'medium');
  if (highPriorityGaps.length === 0) return 0.3;
  const closed = highPriorityGaps.filter((g) => meal.gap_coverage.includes(g.nutrient)).length;
  return closed / highPriorityGaps.length;
}

function preferenceMatch(meal: MealItem, profile: Profile): number {
  const dislikes = profile.preferences.dislikes.map((d) => d.toLowerCase());
  const mealName = meal.name.toLowerCase();
  const hasDislikes = dislikes.some((d) => mealName.includes(d) || meal.tags.some((t) => t.includes(d)));
  if (hasDislikes) return 0;

  const flags = profile.preferences.dietary_flags;
  let score = 0.5;
  if (flags.includes('vegetarian') && !meal.dietary.includes('vegetarian') && !meal.dietary.includes('vegan')) {
    return 0.1;
  }
  if (flags.includes('vegan') && !meal.dietary.includes('vegan')) {
    return 0.1;
  }
  if (flags.includes('gluten-free') && !meal.dietary.includes('gluten-free')) {
    score -= 0.2;
  }
  return score;
}

export interface ScoredMeal extends MealItem {
  suggestionScore: number;
  closedGaps: string[];
}

export function getSuggestions(profile: Profile, count = 5): ScoredMeal[] {
  const today = new Date().toISOString().split('T')[0];
  const todayMeals = profile.foodLog.filter((m) => m.timestamp.startsWith(today));
  const totals = sumNutrients(todayMeals.map((m) => m.nutrition));

  const effectiveTargets = { ...profile.targets };
  if (profile.mode === 'bulk' && isTrainingDay(profile)) {
    effectiveTargets.calories = profile.targets.calories_training_day ?? profile.targets.calories;
    effectiveTargets.carbs_g = profile.targets.carbs_training_day ?? profile.targets.carbs_g;
  } else if (profile.mode === 'bulk') {
    effectiveTargets.calories = profile.targets.calories_rest_day ?? profile.targets.calories;
    effectiveTargets.carbs_g = profile.targets.carbs_rest_day ?? profile.targets.carbs_g;
  }

  const gaps = analyzeGaps(todayMeals.map((m) => m.nutrition), effectiveTargets);
  const remainingKcal = Math.max(0, effectiveTargets.calories - totals.calories);

  const cyclePhase = profile.mode === 'pcos' ? getCurrentPhase(profile).phase : undefined;

  const scored: ScoredMeal[] = mealDatabase.map((meal) => {
    const baseScore = profile.mode === 'pcos'
      ? (meal.pcos_score ?? 5)
      : (meal.bulk_score ?? meal.pcos_score ?? 5);

    const gapScore = gapClosureCoverage(meal, gaps);
    const calScore = calorieFit(meal.nutrition.calories, remainingKcal, profile.mode);
    const prefScore = preferenceMatch(meal, profile);

    // Phase bonus for PCOS
    let phaseBonus = 0;
    if (cyclePhase === 'luteal') {
      if (meal.tags.includes('luteal-phase') || meal.tags.includes('magnesium')) phaseBonus = 0.5;
    } else if (cyclePhase === 'follicular') {
      if (meal.tags.includes('high-fiber') || meal.tags.includes('fermented')) phaseBonus = 0.3;
    }

    let suggestionScore: number;
    if (profile.mode === 'pcos') {
      suggestionScore =
        0.35 * (baseScore / 10) +
        0.30 * gapScore +
        0.15 * calScore +
        0.10 * prefScore +
        0.10 * phaseBonus;
    } else {
      suggestionScore =
        0.30 * (baseScore / 10) +
        0.25 * gapScore +
        0.15 * calScore +
        0.10 * prefScore +
        0.10 * (meal.nutrition.protein_g / 50);
    }

    const closedGaps = gaps
      .filter((g) => meal.gap_coverage.includes(g.nutrient))
      .map((g) => g.nutrient);

    return { ...meal, suggestionScore, closedGaps };
  });

  return scored
    .sort((a, b) => b.suggestionScore - a.suggestionScore)
    .slice(0, count);
}

export function getTodayNutritionTotals(meals: LoggedMeal[]) {
  const today = new Date().toISOString().split('T')[0];
  const todayMeals = meals.filter((m) => m.timestamp.startsWith(today));
  return sumNutrients(todayMeals.map((m) => m.nutrition));
}

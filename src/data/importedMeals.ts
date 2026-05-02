import type { MealItem, NutritionData } from '../store/appStore';
import importedMealRows from './importedMealDatabase.json';
import { scoreFood } from '../lib/scoring';

export interface ImportedMealRecord {
  id: string;
  name: string;
  source?: string;
  brand?: string;
  serving_g?: number;
  prep_time_min?: number;
  meal_types?: MealItem['meal_types'];
  tags?: string[];
  dietary?: string[];
  nutrition: NutritionData;
  instructions?: string[];
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function normalizeImportedMeal(row: ImportedMealRecord): MealItem {
  const sourceTag = row.source ? `source-${slugify(row.source)}` : 'source-import';
  const brandTag = row.brand ? `brand-${slugify(row.brand)}` : null;
  const baseTags = row.tags ?? [];
  const tags = Array.from(new Set([...baseTags, sourceTag, ...(brandTag ? [brandTag] : [])]));
  const servingG = row.serving_g ?? 300;

  return {
    id: `import-${row.id || slugify(row.name)}`,
    name: row.brand ? `${row.name} (${row.brand})` : row.name,
    prep_time_min: row.prep_time_min ?? 10,
    meal_types: row.meal_types?.length ? row.meal_types : ['lunch', 'dinner', 'snack'],
    tags,
    dietary: row.dietary ?? [],
    nutrition: row.nutrition,
    pcos_score: Number(scoreFood(row.nutrition, servingG, 'pcos').toFixed(1)),
    bulk_score: Number(scoreFood(row.nutrition, servingG, 'bulk').toFixed(1)),
    gap_coverage: inferGapCoverage(row.nutrition),
    instructions: row.instructions,
  };
}

function inferGapCoverage(nutrition: NutritionData): string[] {
  const coverage: string[] = [];
  if (nutrition.calories >= 350) coverage.push('calories');
  if (nutrition.protein_g >= 20) coverage.push('protein');
  if (nutrition.carbs_g >= 35) coverage.push('carbs');
  if (nutrition.fat_g >= 12) coverage.push('fat');
  if (nutrition.fiber_g >= 6) coverage.push('fiber');
  if ((nutrition.omega3_g ?? 0) >= 1) coverage.push('omega3');
  return coverage.length > 0 ? coverage : ['calories'];
}

export const importedMealDatabase: MealItem[] = (importedMealRows as ImportedMealRecord[])
  .filter((row) => row.id && row.name && row.nutrition)
  .map(normalizeImportedMeal);

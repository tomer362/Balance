import type { MicronutrientData, NutritionData } from '../store/appStore';

export const MICRONUTRIENT_FIELDS = [
  { key: 'iron_mg', label: 'Iron', unit: 'mg', decimals: 1 },
  { key: 'calcium_mg', label: 'Calcium', unit: 'mg', decimals: 0 },
  { key: 'magnesium_mg', label: 'Magnesium', unit: 'mg', decimals: 0 },
  { key: 'potassium_mg', label: 'Potassium', unit: 'mg', decimals: 0 },
  { key: 'zinc_mg', label: 'Zinc', unit: 'mg', decimals: 1 },
  { key: 'vitamin_d_mcg', label: 'Vitamin D', unit: 'mcg', decimals: 1 },
  { key: 'vitamin_b12_mcg', label: 'Vitamin B12', unit: 'mcg', decimals: 1 },
  { key: 'folate_mcg', label: 'Folate', unit: 'mcg', decimals: 0 },
  { key: 'vitamin_c_mg', label: 'Vitamin C', unit: 'mg', decimals: 1 },
] as const;

export type MicronutrientKey = (typeof MICRONUTRIENT_FIELDS)[number]['key'];

function round(value: number, decimals: number): number {
  const precision = 10 ** decimals;
  return Math.round(value * precision) / precision;
}

export function cloneMicronutrients(micronutrients?: MicronutrientData): MicronutrientData | undefined {
  if (!micronutrients) return undefined;

  const next: Partial<MicronutrientData> = {};
  let hasValues = false;

  MICRONUTRIENT_FIELDS.forEach(({ key, decimals }) => {
    const value = micronutrients[key];
    if (value === undefined) return;
    next[key] = round(value, decimals);
    hasValues = true;
  });

  return hasValues ? (next as MicronutrientData) : undefined;
}

export function scaleMicronutrients(micronutrients: MicronutrientData | undefined, factor: number): MicronutrientData | undefined {
  if (!micronutrients) return undefined;

  const next: Partial<MicronutrientData> = {};
  let hasValues = false;

  MICRONUTRIENT_FIELDS.forEach(({ key, decimals }) => {
    const value = micronutrients[key];
    if (value === undefined) return;
    next[key] = round(value * factor, decimals);
    hasValues = true;
  });

  return hasValues ? (next as MicronutrientData) : undefined;
}

export function normalizeNutrition(nutrition?: Partial<NutritionData>): NutritionData {
  return {
    calories: Math.round(nutrition?.calories ?? 0),
    protein_g: round(nutrition?.protein_g ?? 0, 1),
    carbs_g: round(nutrition?.carbs_g ?? 0, 1),
    fiber_g: round(nutrition?.fiber_g ?? 0, 1),
    sugar_g: round(nutrition?.sugar_g ?? 0, 1),
    fat_g: round(nutrition?.fat_g ?? 0, 1),
    saturated_fat_g: round(nutrition?.saturated_fat_g ?? 0, 1),
    sodium_mg: Math.round(nutrition?.sodium_mg ?? 0),
    glycemic_index: nutrition?.glycemic_index !== undefined ? round(nutrition.glycemic_index, 1) : undefined,
    glycemic_load: nutrition?.glycemic_load !== undefined ? round(nutrition.glycemic_load, 1) : undefined,
    omega3_g: nutrition?.omega3_g !== undefined ? round(nutrition.omega3_g, 2) : undefined,
    micronutrients: cloneMicronutrients(nutrition?.micronutrients),
    ingredients: nutrition?.ingredients,
  };
}

export function scaleNutrition(nutrition: NutritionData, factor: number): NutritionData {
  return normalizeNutrition({
    calories: nutrition.calories * factor,
    protein_g: nutrition.protein_g * factor,
    carbs_g: nutrition.carbs_g * factor,
    fiber_g: nutrition.fiber_g * factor,
    sugar_g: nutrition.sugar_g * factor,
    fat_g: nutrition.fat_g * factor,
    saturated_fat_g: nutrition.saturated_fat_g * factor,
    sodium_mg: nutrition.sodium_mg * factor,
    glycemic_index: nutrition.glycemic_index,
    glycemic_load: nutrition.glycemic_load !== undefined ? nutrition.glycemic_load * factor : undefined,
    omega3_g: nutrition.omega3_g !== undefined ? nutrition.omega3_g * factor : undefined,
    micronutrients: scaleMicronutrients(nutrition.micronutrients, factor),
    ingredients: nutrition.ingredients,
  });
}

function sumOptional(values: Array<number | undefined>, decimals: number): number | undefined {
  const present = values.filter((value): value is number => value !== undefined);
  if (present.length === 0) return undefined;
  return round(present.reduce((sum, value) => sum + value, 0), decimals);
}

export function sumMicronutrients(items: Array<MicronutrientData | undefined>): MicronutrientData | undefined {
  const next: Partial<MicronutrientData> = {};
  let hasValues = false;

  MICRONUTRIENT_FIELDS.forEach(({ key, decimals }) => {
    const total = sumOptional(items.map((item) => item?.[key]), decimals);
    if (total === undefined) return;
    next[key] = total;
    hasValues = true;
  });

  return hasValues ? (next as MicronutrientData) : undefined;
}

export function sumNutrition(items: NutritionData[]): NutritionData {
  return normalizeNutrition({
    calories: items.reduce((sum, item) => sum + item.calories, 0),
    protein_g: items.reduce((sum, item) => sum + item.protein_g, 0),
    carbs_g: items.reduce((sum, item) => sum + item.carbs_g, 0),
    fiber_g: items.reduce((sum, item) => sum + item.fiber_g, 0),
    sugar_g: items.reduce((sum, item) => sum + item.sugar_g, 0),
    fat_g: items.reduce((sum, item) => sum + item.fat_g, 0),
    saturated_fat_g: items.reduce((sum, item) => sum + item.saturated_fat_g, 0),
    sodium_mg: items.reduce((sum, item) => sum + item.sodium_mg, 0),
    glycemic_index: undefined,
    glycemic_load: sumOptional(items.map((item) => item.glycemic_load), 1),
    omega3_g: sumOptional(items.map((item) => item.omega3_g), 2),
    micronutrients: sumMicronutrients(items.map((item) => item.micronutrients)),
  });
}

export function hasMicronutrientData(micronutrients?: MicronutrientData): boolean {
  return MICRONUTRIENT_FIELDS.some(({ key }) => micronutrients?.[key] !== undefined);
}

export function countMicronutrients(micronutrients?: MicronutrientData): number {
  return MICRONUTRIENT_FIELDS.filter(({ key }) => micronutrients?.[key] !== undefined).length;
}

export function formatNutrientValue(value: number | undefined, unit: string, decimals = 1): string {
  if (value === undefined) return '—';
  return `${round(value, decimals).toFixed(decimals)} ${unit}`;
}

export function formatCompactValue(value: number | undefined, decimals = 1): string {
  if (value === undefined) return '—';
  const rounded = round(value, decimals);
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(decimals);
}

import type { NutritionData } from '../store/appStore';
import { normalizeNutrition } from './nutrition';

const BASE_URL = 'https://world.openfoodfacts.org';

interface OFFProduct {
  product_name?: string;
  image_url?: string;
  nutriments?: {
    'energy-kcal_100g'?: number;
    'energy-kcal'?: number;
    proteins_100g?: number;
    carbohydrates_100g?: number;
    fiber_100g?: number;
    sugars_100g?: number;
    fat_100g?: number;
    'saturated-fat_100g'?: number;
    sodium_100g?: number;
    'omega-3-fat_100g'?: number;
    'docosahexaenoic-acid_100g'?: number;
    calcium_100g?: number;
    iron_100g?: number;
    magnesium_100g?: number;
    potassium_100g?: number;
    zinc_100g?: number;
    'vitamin-d_100g'?: number;
    'vitamin-b12_100g'?: number;
    'vitamin-b9_100g'?: number;
    'vitamin-c_100g'?: number;
  };
  ingredients_text?: string;
  ingredients?: Array<{ text: string }>;
}

function parseNutrition(nutriments: OFFProduct['nutriments'], per100g = true): NutritionData {
  const n = nutriments ?? {};
  const factor = per100g ? 1 : 1;
  return normalizeNutrition({
    calories: Math.round((n['energy-kcal_100g'] ?? n['energy-kcal'] ?? 0) * factor),
    protein_g: Math.round((n.proteins_100g ?? 0) * factor * 10) / 10,
    carbs_g: Math.round((n.carbohydrates_100g ?? 0) * factor * 10) / 10,
    fiber_g: Math.round((n.fiber_100g ?? 0) * factor * 10) / 10,
    sugar_g: Math.round((n.sugars_100g ?? 0) * factor * 10) / 10,
    fat_g: Math.round((n.fat_100g ?? 0) * factor * 10) / 10,
    saturated_fat_g: Math.round((n['saturated-fat_100g'] ?? 0) * factor * 10) / 10,
    sodium_mg: Math.round((n.sodium_100g ?? 0) * 1000 * factor),
    omega3_g: n['omega-3-fat_100g'] ?? n['docosahexaenoic-acid_100g'],
    micronutrients: {
      calcium_mg: n.calcium_100g,
      iron_mg: n.iron_100g,
      magnesium_mg: n.magnesium_100g,
      potassium_mg: n.potassium_100g,
      zinc_mg: n.zinc_100g,
      vitamin_d_mcg: n['vitamin-d_100g'],
      vitamin_b12_mcg: n['vitamin-b12_100g'],
      folate_mcg: n['vitamin-b9_100g'],
      vitamin_c_mg: n['vitamin-c_100g'],
    },
  });
}

export async function searchFood(query: string): Promise<
  Array<{ id: string; name: string; nutrition: NutritionData }>
> {
  try {
    const params = new URLSearchParams({
      search_terms: query,
      search_simple: '1',
      action: 'process',
      json: '1',
      page_size: '10',
      fields: 'id,product_name,nutriments',
    });

    const res = await fetch(`${BASE_URL}/cgi/search.pl?${params.toString()}`);
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.products) return [];

    return data.products
      .filter((p: OFFProduct & { id?: string }) => p.product_name)
      .slice(0, 10)
      .map((p: OFFProduct & { id?: string }) => ({
        id: p.id ?? String(Math.random()),
        name: p.product_name ?? 'Unknown',
        nutrition: parseNutrition(p.nutriments),
      }));
  } catch {
    return [];
  }
}

/**
 * Search the Open Food Facts Israel product database.
 * Returns packaged products sold in Israel (Hebrew and international brands).
 */
export async function searchFoodIsrael(query: string): Promise<
  Array<{ id: string; name: string; nutrition: NutritionData }>
> {
  try {
    const params = new URLSearchParams({
      search_terms: query,
      search_simple: '1',
      action: 'process',
      json: '1',
      page_size: '10',
      fields: 'id,product_name,nutriments',
      // Restrict to products tagged with Israel country
      tagtype_0: 'countries',
      tag_contains_0: 'contains',
      tag_0: 'israel',
    });

    const res = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?${params.toString()}`);
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.products) return [];

    return (data.products as Array<OFFProduct & { id?: string }>)
      .filter((p) => p.product_name)
      .slice(0, 10)
      .map((p) => ({
        id: p.id ?? String(Math.random()),
        name: p.product_name ?? 'Unknown',
        nutrition: parseNutrition(p.nutriments),
      }));
  } catch {
    return [];
  }
}

import type { NutritionData } from '../store/appStore';

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
  };
  ingredients_text?: string;
  ingredients?: Array<{ text: string }>;
}

function parseNutrition(nutriments: OFFProduct['nutriments'], per100g = true): NutritionData {
  const n = nutriments ?? {};
  const factor = per100g ? 1 : 1;
  return {
    calories: Math.round((n['energy-kcal_100g'] ?? n['energy-kcal'] ?? 0) * factor),
    protein_g: Math.round((n.proteins_100g ?? 0) * factor * 10) / 10,
    carbs_g: Math.round((n.carbohydrates_100g ?? 0) * factor * 10) / 10,
    fiber_g: Math.round((n.fiber_100g ?? 0) * factor * 10) / 10,
    sugar_g: Math.round((n.sugars_100g ?? 0) * factor * 10) / 10,
    fat_g: Math.round((n.fat_100g ?? 0) * factor * 10) / 10,
    saturated_fat_g: Math.round((n['saturated-fat_100g'] ?? 0) * factor * 10) / 10,
    sodium_mg: Math.round((n.sodium_100g ?? 0) * 1000 * factor),
  };
}

export async function fetchByBarcode(barcode: string): Promise<{
  name: string;
  image?: string;
  nutrition: NutritionData;
  ingredients?: string[];
} | null> {
  try {
    const res = await fetch(`${BASE_URL}/api/v0/product/${barcode}.json`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== 1 || !data.product) return null;

    const product: OFFProduct = data.product;
    const name = product.product_name ?? 'Unknown Product';
    const image = product.image_url;
    const nutrition = parseNutrition(product.nutriments);

    const ingredients: string[] = [];
    if (product.ingredients_text) {
      ingredients.push(product.ingredients_text);
    } else if (product.ingredients) {
      product.ingredients.forEach((i) => ingredients.push(i.text));
    }

    return { name, image, nutrition, ingredients };
  } catch {
    return null;
  }
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

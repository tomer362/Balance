# Data Layer Architecture

---

## Intent

All nutrition reference data is **static, build-time JSON/TS**. There is no runtime database or API. The build bundles the data directly into the JS output.

---

## Files

### `src/data/mealDatabase.ts`

Curated array of `MealItem[]` — healthy, goal-aware meals used by the suggestion engine and the Log page search.

Each entry has:
- `id`, `name`, `prep_time_min`, `meal_types`, `tags`, `dietary`
- Full `NutritionData` including glycemic index, omega-3, and optional micronutrients
- `pcos_score` and `bulk_score` (0–10) — used for sorting suggestions per profile mode
- `gap_coverage` — which nutrient gaps this meal addresses
- `instructions[]` — step-by-step prep guide

### `src/data/importedMealDatabase.json`

External meal/product rows merged at build time. Populated by running:

```bash
python3 scripts/myfitnesspal_to_balance.py path/to/input.csv
```

Rows are merged with `mealDatabase` in `src/data/allMeals.ts` and exposed as a single combined catalog.

### `src/data/allMeals.ts`

Re-exports the combined `mealDatabase + importedMealDatabase` array. All feature code imports from here rather than the individual sources.

### `src/data/ingredientDatabase.ts`

Israeli/Mediterranean ingredient reference. Used for ingredient-level search and micronutrient lookup.

### `src/data/usdaFoundationIngredients.json`

USDA FoodData Central Foundation Foods rows converted via:

```bash
python3 scripts/usda_foundation_to_balance_ingredients.py \
  path/to/FoodData_Central_foundation_food_json.json \
  src/data/usdaFoundationIngredients.json
```

### `src/data/ingredientMicronutrients.json`

Per-ingredient micronutrient values (iron, calcium, magnesium, etc.) that supplement the macro data.

### `src/data/cheatMealDatabase.ts`

Curated catalogue of ~25 realistic outside/indulgence meals people commonly eat. Used by the CheatMeal feature's "Add nutrition details" accordion.

Each entry (`CheatMealCatalogueItem`) has:
- `id`, `name`, `category` (`fast-food` | `pizza` | `pasta` | `asian` | `mexican` | `dessert` | `drinks` | `other`)
- `servingDescription` — human-readable portion info
- Full `NutritionData` (calories, protein, carbs, fat, saturated fat, fiber, sugar, sodium)

---

## Data Flow

```
Build time
  mealDatabase.ts  ─┐
  importedMeals.ts  ├──▶  allMeals.ts  ──▶  Suggestions, Log, Groceries
  ingredientDB.ts   ─┘

  cheatMealDatabase.ts  ──▶  CheatMeals feature

Runtime (user actions)
  appStore.ts (Zustand persist)  ──▶  foodLog, cheatMeals, weightHistory, etc.
```

---

## Adding New Meals

1. **Curated healthy meals** → add entries to `src/data/mealDatabase.ts`
2. **Bulk import from CSV/JSON** → run the Python converter, commit the updated `importedMealDatabase.json`
3. **Cheat meal catalogue** → add entries to `src/data/cheatMealDatabase.ts`

Do not scrape private food databases or store API credentials in the codebase. Use authorized exports, public datasets (Open Food Facts, USDA), or approved API integrations.

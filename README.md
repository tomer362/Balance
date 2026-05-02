# Balance

Goal-aware nutrition tracking for PCOS, bulking, and maintenance.

## Imported nutrition data

### Ingredient data

The app now combines the curated Israeli ingredient database with generated
USDA FoodData Central Foundation Foods rows:

```text
src/data/usdaFoundationIngredients.json
```

Regenerate the USDA JSON from a public FoodData Central Foundation Foods JSON
download with:

```bash
python3 scripts/usda_foundation_to_balance_ingredients.py \
  path/to/FoodData_Central_foundation_food_json_YYYY-MM-DD.json \
  src/data/usdaFoundationIngredients.json
```

USDA FoodData Central publishes Foundation Foods as downloadable JSON. This is
the supported bulk-data path for ingredients; do not scrape private food
databases or bypass authentication.

### Meal/product imports

The app can merge external meal/product nutrition rows into the existing meal idea
catalog. Imported rows live in:

```text
src/data/importedMealDatabase.json
```

The website imports that JSON at build time, combines it with the curated
`mealDatabase`, and uses the combined catalog for:

- meal ideas and suggestions
- meal search on the Log page
- grocery/meal-plan meal lookup

Convert a permitted CSV or JSON export into the Balance format with:

```bash
python3 scripts/myfitnesspal_to_balance.py path/to/input.csv
```

or:

```bash
python3 scripts/myfitnesspal_to_balance.py path/to/input.json src/data/importedMealDatabase.json
```

The converter accepts common nutrition headers such as `food`, `brand`,
`calories`, `protein`, `carbs`, `fat`, `fiber`, `sugar`, `sodium`, and serving
grams. It also handles MyFitnessPal API diary JSON with `items[]` containing
`type: "diary_meal"` and `nutritional_contents`. It merges by generated stable
IDs unless `--replace` is passed.

For Vercel, this is currently a build-time/static-data pipeline: run the
converter locally or in a controlled data job, commit or otherwise provide the
generated JSON, and deploy the Vite app. Avoid browser-session scraping or
credential-based crawling from Vercel functions; use authorized exports, public
datasets, Open Food Facts, or an approved API integration.

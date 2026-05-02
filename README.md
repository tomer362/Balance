# Balance

Goal-aware nutrition tracking for PCOS, bulking, and maintenance.

## Imported nutrition data

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

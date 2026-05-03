# Utility Libraries Architecture

**Directory:** `src/lib/`

---

## Files

### `i18n.ts`

**Intent:** All user-visible copy in one place, with full English and Hebrew (RTL) support. Layout direction (`ltr`/`rtl`) is set on `<html dir>` at the `App` level.

Key exports:
- `useI18n()` — hook returning `{ copy, language }`. `copy` is the full typed copy tree for the active language.
- `formatDateValue(date, language, options)` — locale-aware date formatting
- `formatAmountWithUnit(value, unit, language)` — unit formatting respecting locale
- `directionalIconClass(language)` — returns `'scale-x-[-1]'` for Hebrew to flip directional icons
- `mealTypeLabel`, `phaseName`, `mealDisplayName` — label helpers

Copy structure mirrors the route/feature hierarchy (e.g. `copy.cheatMeals`, `copy.dashboard`, `copy.wellness`). Adding a new string requires entries in both the `en` and `he` objects.

---

### `scoring.ts`

**Intent:** Compute a 0–10 wellness score for any logged meal given the active user profile.

- `scoreFood(meal, profile)` → `number`
- Considers: protein density, fiber, glycemic load, omega-3, anti-inflammatory tags, cycle phase boosts (PCOS), training-day adjustments (bulk)

---

### `nutrition.ts`

**Intent:** Math helpers for nutrition arithmetic.

- `scaleNutrition(nutrition, scaleFactor)` — scale all fields proportionally
- `countMicronutrients(nutrition)` — count how many micronutrient fields are non-zero
- `hasMicronutrientData(nutrition)` — boolean check
- Summation utilities used in gap analysis

---

### `gapAnalysis.ts`

**Intent:** Identify nutrient gaps between today's logged intake and profile targets.

- `sumNutrients(meals)` → aggregated `NutritionData` for a set of meals
- Returns gap objects (e.g. `{ nutrient: 'omega3', shortfall: 1.2 }`) consumed by the suggestion engine and the BalanceWheel

---

### `suggestionEngine.ts`

**Intent:** Rank meals from `allMeals` based on gap coverage and profile mode.

- `getSuggestions(profile, gaps, todayMeals)` → ranked `MealItem[]`
- Filters by dietary preferences and dislikes
- Prioritises meals that cover the largest identified gaps

---

### `cyclePhase.ts`

**Intent:** Determine the current menstrual cycle phase for PCOS profiles.

- `getCurrentPhase(cycleData)` → `Phase` (`'menstrual' | 'follicular' | 'ovulatory' | 'luteal'`)
- `getPhaseColor(phase)` → Tailwind color token
- Respects manual phase override stored in `profile.pcos.currentPhaseOverride`

---

### `targetComputation.ts`

**Intent:** Compute daily calorie and macro targets from profile demographics.

- `computePCOSTargets(profile)` → `Targets`
- `computeBulkTargets(profile)` → `Targets`
- `computeMaintainTargets(profile)` → `Targets`
- Uses Mifflin-St Jeor TDEE formula, adjusts for activity level and goal (lose weight / manage symptoms / bulk surplus)

---

### `openFoodFacts.ts`

**Intent:** Wrapper for fetching product data from the Open Food Facts public API (barcode scanning flow).

- `fetchByBarcode(barcode)` → `NutritionData | null`
- Used by the Log page scanner integration

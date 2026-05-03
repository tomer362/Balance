# Food Log Feature

**Route:** `/log`  
**File:** `src/routes/Log.tsx`

---

## Intent

Allow the user to search for and log any meal or ingredient, view the full day's nutrition breakdown, and edit or remove entries. The log is the primary data input that drives all other features (suggestions, gap analysis, progress).

---

## Architecture

### Logging flow

1. User searches by name (fuzzy match over `allMeals`)
2. Optionally scans a barcode → `openFoodFacts.fetchByBarcode()` → resolves to a `NutritionData`
3. User selects serving size; `scaleNutrition()` scales macros proportionally
4. `scoreFood(meal, profile)` computes the 0–10 wellness score
5. `logMeal(profileId, meal)` persists to `profile.foodLog`

### Meal types

`breakfast` | `lunch` | `dinner` | `snack` | `pre_workout` | `post_workout`

### Edit / delete

Existing entries can be removed with `removeMeal` or updated with `updateMeal`.

### NutritionDetailSheet

Tapping any logged meal opens a full-screen bottom sheet with complete nutritional breakdown, instructions (if available), and the wellness score explanation.

---

## Scoring (`src/lib/scoring.ts`)

`scoreFood(meal, profile)` produces a 0–10 score based on:
- Protein density relative to targets
- Fiber content
- Glycemic load (lower = better)
- Omega-3 presence
- Anti-inflammatory tag bonus (PCOS mode)
- Training-day carb needs (bulk mode)
- Cycle phase modifier (PCOS mode)

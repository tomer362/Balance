# Groceries Feature

**Route:** `/groceries`  
**File:** `src/routes/Groceries.tsx`

---

## Intent

Help the user plan their meals for the week and generate a shopping list from those planned meals. Bridges the gap between the food log (what you ate) and proactive meal planning (what you'll eat).

---

## Architecture

### Meal plan

- Stored on `profile.mealPlan` as `Record<dateString, { breakfast?, lunch?, dinner?, snacks? }>`
- Each slot holds a meal name or id referencing `allMeals`
- Users can assign meals to any day and slot via the grocery UI

### Grocery list

- Derived from the planned meals' `ingredients[]` fields (from `NutritionData`)
- Deduplicates ingredients across multiple meals
- Users can check off items as they shop (local UI state, not persisted)

---

## Data flow

```
profile.mealPlan  ──▶  resolve meal ids from allMeals
                  ──▶  collect ingredients[]
                  ──▶  deduplicate & render grocery list
```

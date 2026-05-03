# Dashboard Feature

**Route:** `/`  
**File:** `src/routes/Dashboard.tsx`

---

## Intent

The central hub of the app. Gives the user an at-a-glance view of today's nutrition, quick access to all other features, and contextual suggestions based on their current nutrient gaps and cycle phase (PCOS mode).

---

## Architecture

### Data sources

- `selectActiveProfile` — active profile with targets and today's food log
- `selectTodayMeals` — filtered `LoggedMeal[]` for today
- `getSuggestions(profile, gaps, todayMeals)` — top meal recommendations
- `sumNutrients(meals)` — today's aggregate `NutritionData`
- `getCurrentPhase(cycleData)` — PCOS cycle phase

### Key sections

| Section | Description |
|---|---|
| Greeting + mode badge | Time-aware greeting; shows cycle phase (PCOS) or training day (bulk) |
| **BalanceWheel** | Radial nutrient wheel; tapping a segment opens the NutritionDetailSheet |
| Macro summary | Calories, protein, carbs, fat — today vs targets |
| Shortcuts grid | Quick-nav tiles to all features (Log, Suggestions, Cheat Meals, Wellness, etc.) |
| Suggestions strip | Top 3 recommended meals; tapping opens the full Suggestions page |
| Today's log | Recent logged meals with score badges |

### Search overlay

A command-palette style search (⌘K equivalent) that surfaces any route or feature by name. Built as a full-screen overlay with fuzzy string matching over the route list.

---

## PCOS-specific behaviour

- Cycle phase banner shown at top (colour from `getPhaseColor`)
- BalanceWheel weights anti-inflammatory and hormone-supporting nutrients higher
- Suggestion strip prioritises PCOS-scored meals

## Bulk-specific behaviour

- Training day badge shown when today is a training day per `trainingSchedule.weekPattern`
- Split name displayed (e.g. "Push day")
- Macro targets shown as training-day or rest-day values

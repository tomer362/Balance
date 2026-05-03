# Cheat Meals Feature

**Route:** `/cheat-meals`  
**File:** `src/routes/CheatMeals.tsx`  
**Data:** `src/data/cheatMealDatabase.ts`  
**Store actions:** `logCheatMeal`, `deleteCheatMeal`  

---

## Intent

Give users a guilt-free, structured way to track indulgent meals. The feature enforces a weekly allowance system that rolls over excess to the next week, keeping the user accountable without being punitive. It also supports detailed nutrition logging for users who want to understand the full macronutrient impact of their cheat meals.

---

## Weekly Allowance Logic

Base allowance is **2 cheat meals per week** (Mon–Sun).

```
allowance(week) = max(0, 2 − overage_from_previous_week)
overage(week)   = max(0, used − allowance)
```

- If you log 3 meals in week A (1 over), week B starts with allowance = 1
- Unused allowance does **not** carry forward (use-it-or-lose-it)
- The `buildWeekStats()` function walks from the earliest recorded week to the target week, accumulating debt

---

## `CheatMeal` Data Model

```ts
interface CheatMeal {
  id: string;
  date: string;              // "YYYY-MM-DD"
  name: string;
  notes?: string;
  isQuickTick?: boolean;     // from one-tap toggle (no name required)
  nutrition?: NutritionData; // attached when a catalogue item is selected
  selectedCheatId?: string;  // reference to cheatMealCatalogue item id
}
```

---

## UI Structure

### 1. Quick Tick (top of page)

A prominent toggle button. One tap marks "I had a cheat meal today" — creates an entry with `isQuickTick: true` and the generic name `"Cheat meal"`. Tapping again removes it (toggle behaviour). Only one quick-tick entry per day.

States:
- **Unchecked:** grey circle + prompt text
- **Checked:** green circle with checkmark + "Cheat meal logged today ✓" + "Tap to remove" hint

### 2. Stats Card

Three metric tiles: Allowed this week / Used / Next week allowance.  
Status message: green when under limit, terracotta when over.

### 3. Detailed Log Form

- Date picker + meal name input
- Optional notes textarea
- **"Add nutrition details" accordion** (collapsed by default):
  - Searchable scrollable list of the cheat meal catalogue
  - Selecting a catalogue item pre-fills the name field and attaches `NutritionData`
  - Selected item shows a full macro breakdown (kcal, protein, carbs, fat, sat fat, fiber, sugar, sodium)
  - "Custom / type your own" link exits catalogue mode
- Add button (enabled when name is non-empty, or a catalogue item is selected)

### 4. This Week / History Lists

`MealRow` component shows:
- Meal name + date (+ notes if present)
- If `nutrition` is attached: `"800 kcal · 34g protein"` line in sage green

---

## Cheat Meal Catalogue

`src/data/cheatMealDatabase.ts` — ~25 entries covering:

| Category | Examples |
|---|---|
| Fast food | Big Mac + fries, double cheeseburger, fried chicken sandwich, nuggets, fish & chips, doner kebab |
| Pizza | NY slice, personal cheese pizza |
| Pasta | Carbonara, arrabbiata |
| Asian | Pad Thai, tonkotsu ramen, sushi rolls |
| Mexican | Beef burrito, street tacos |
| Dessert | Ice cream pint, chocolate lava cake, cheesecake slice |
| Drinks | IPA pint, margarita |
| Other | Pancakes with syrup, cheese & charcuterie board |

Macros are general real-world estimates for restaurant portions, not brand-specific values.

---

## i18n Keys (`copy.cheatMeals`)

| Key | Purpose |
|---|---|
| `quickTickPrompt` | Unchecked button label |
| `quickTickDone` | Checked button label |
| `quickTickRemove` | Sub-label hint when checked |
| `addNutritionDetails` | Accordion toggle label |
| `catalogueTitle` | Heading inside the accordion |
| `catalogueSearch` | Search input placeholder |
| `customEntry` | Link to exit catalogue mode |
| `nutritionSummary(kcal, protein)` | Formatted summary string in meal rows |

# Store Architecture

**File:** `src/store/appStore.ts`

---

## Intent

Single source of truth for all application state. Uses Zustand with the `persist` middleware so the entire state tree is serialised to `localStorage` under the key `balance-store`.

---

## Key Types

### `Profile`

Central entity. One app instance can have multiple profiles (e.g. a demo PCOS profile and a demo Bulk profile ship by default; the user creates their own during onboarding).

```ts
interface Profile {
  id: string;
  name: string;
  mode: 'pcos' | 'bulk' | 'maintain';
  demographics: { sex, age, height_cm, weight_kg, goal_weight_kg, activity_level };
  targets: Targets;          // computed daily macro/calorie targets
  foodLog: LoggedMeal[];     // all-time log
  weightHistory: DatedEntry[];
  cheatMeals?: CheatMeal[];
  stepHistory?: DatedNumberLog[];
  workoutHistory?: WorkoutLog[];
  waterHistory?: DatedNumberLog[];
  habitSettings?: HabitSettings;
  customRecipes: MealItem[];
  preferences: { dietary_flags, dislikes };
  pcos?: { concerns, goal, cycle, symptomLog, seedCyclingEnabled };
  bulk?: { surplus_kcal, protein_g_per_kg, trainingSchedule, supplements };
}
```

### `CheatMeal`

```ts
interface CheatMeal {
  id: string;
  date: string;              // ISO date "YYYY-MM-DD"
  name: string;
  notes?: string;
  isQuickTick?: boolean;     // created from one-tap today toggle
  nutrition?: NutritionData; // populated from catalogue or manual entry
  selectedCheatId?: string;  // reference to cheatMealCatalogue item id
}
```

### `NutritionData`

```ts
interface NutritionData {
  calories: number;
  protein_g: number; carbs_g: number; fiber_g: number; sugar_g: number;
  fat_g: number; saturated_fat_g: number; sodium_mg: number;
  glycemic_index?: number; glycemic_load?: number; omega3_g?: number;
  micronutrients?: MicronutrientData;
  ingredients?: string[];
}
```

### `LoggedMeal`

Each diary entry with a timestamp (not just date), meal type, and a computed `score` (0–10).

### `Targets`

Computed once during onboarding / profile update via `lib/targetComputation.ts`. Stored on the profile so the UI never recomputes targets on every render.

---

## Actions

| Action | What it does |
|---|---|
| `logMeal` | Appends a `LoggedMeal` to `profile.foodLog` |
| `removeMeal` / `updateMeal` | Mutate `foodLog` by id |
| `logWeight` | Appends to `profile.weightHistory` |
| `logCheatMeal` | Appends to `profile.cheatMeals` |
| `deleteCheatMeal` | Removes from `profile.cheatMeals` by id |
| `logSteps` / `logWater` / `toggleWorkoutLog` | Update daily habit logs |
| `setHabitSettings` | Updates step/water/workout goals |
| `updateTargets` | Replaces `profile.targets` |
| `completeOnboarding` | Replaces demo profiles with the real user profile; sets `hasOnboarded: true` |

---

## Selectors

| Selector | Returns |
|---|---|
| `selectActiveProfile` | The `Profile` matching `activeProfileId` |
| `selectTodayMeals` | `LoggedMeal[]` for today (date-only match) |

---

## Persistence

Zustand `persist` with `localStorage`. The store version is managed by Zustand's `version` field — if breaking schema changes are needed, increment the version and provide a `migrate` function.

Demo profiles are seeded in the initial state and replaced by `completeOnboarding`.

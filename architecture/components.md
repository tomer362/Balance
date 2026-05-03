# Shared Components Architecture

**Directory:** `src/components/`

---

## `BalanceWheel.tsx`

**Intent:** Visual radial chart showing today's macro/micronutrient balance relative to targets. Used on the Dashboard as the primary at-a-glance health indicator.

- Renders a segmented wheel where each arc represents a nutrient category
- Arc length = percentage of daily target achieved (capped at 100%)
- Color-codes segments: green (on track), amber (partial), red (gap)
- Accepts `gaps[]` from `gapAnalysis` and `targets` from the active profile

---

## `BottomNav.tsx`

**Intent:** Persistent tab bar at the bottom of the screen for primary navigation.

- Five tabs: Dashboard, Log, Suggestions, Groceries, Progress
- Active state derived from `useLocation()`
- Hides on the Onboarding screen (rendered only inside `AppLayout`)

---

## `BottomSheet.tsx`

**Intent:** Generic slide-up modal sheet. Used by the Dashboard for the NutritionDetailSheet and other overlays.

- Accepts `isOpen`, `onClose`, `children`
- Traps scroll inside the sheet; closes on backdrop tap or swipe-down gesture
- Animated with Framer Motion

---

## `MealCard.tsx`

**Intent:** Reusable card for displaying a `MealItem` (from the database or custom recipe).

- Shows name, prep time, dietary flags, macros summary, and `pcos_score` / `bulk_score` badge
- Tappable — triggers a callback to open the NutritionDetailSheet or log the meal
- Used on the Suggestions page and the meal search results in Log

---

## `NutritionDetailSheet.tsx`

**Intent:** Full-detail overlay for a single meal or logged food item.

- Displays complete `NutritionData`: macros, fiber, sugar, sodium, glycemic load, omega-3, micronutrients
- Also shows prep instructions when present
- Rendered inside `BottomSheet`

---

## `ScoreBadge.tsx`

**Intent:** Small visual badge rendering a 0–10 wellness score with a colour gradient (red → amber → green).

- Used in `MealCard` and in the Log history list
- Accepts `score: number` and optional `size` prop

---

## `GapIndicator.tsx`

**Intent:** Inline chip/pill showing a specific nutrient gap (e.g. "Low omega-3").

- Used in Suggestions and Dashboard gap summaries
- Color reflects severity of the shortfall

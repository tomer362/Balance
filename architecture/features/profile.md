# Profile Feature

**Route:** `/profile`  
**File:** `src/routes/Profile.tsx`

---

## Intent

Let the user view and edit all aspects of their profile after onboarding — demographics, targets, dietary preferences, mode-specific settings, and app-level settings (language, theme, units).

---

## Architecture

### Sections

| Section | What the user can change |
|---|---|
| Personal info | Name, avatar, age, height, current weight, goal weight, activity level |
| Mode settings | PCOS: concerns, cycle data, seed cycling. Bulk: surplus, protein goal, training schedule |
| Targets | Manual override of computed macro/calorie targets |
| Dietary preferences | Add/remove dietary flags and dislikes |
| App settings | Language (EN / HE), theme (auto / light / dark), units (metric / imperial) |
| Custom recipes | Create and manage personal `MealItem` entries (stored as `profile.customRecipes`) |

### Store interactions

- `updateProfile(id, updates)` — partial update for any profile field
- `updateTargets(id, targets)` — specifically for targets (triggers re-render of dashboard macros)
- `setAppSettings(updates)` — updates language, theme, units globally

### Target recalculation

When demographics change, the profile page offers to recompute targets using `computePCOSTargets` / `computeBulkTargets` / `computeMaintainTargets`. The user can accept the suggestion or keep their manual values.

### Language / RTL

Changing language via `setAppSettings` immediately updates `<html lang>` and `<html dir>` (handled in `App.tsx` via `useEffect` on `settings.language`). No page reload required.

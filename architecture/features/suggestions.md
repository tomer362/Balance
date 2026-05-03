# Suggestions Feature

**Route:** `/suggestions`  
**File:** `src/routes/Suggestions.tsx`  
**Engine:** `src/lib/suggestionEngine.ts`  
**Gap analysis:** `src/lib/gapAnalysis.ts`

---

## Intent

Surface the most relevant meals for the user right now — based on what they've already eaten today, which nutrients they're lacking, their dietary preferences, and their profile mode (PCOS / bulk / maintain).

---

## Architecture

### Gap analysis (`gapAnalysis.ts`)

1. Sum today's logged meals → `sumNutrients(todayMeals)`
2. Compare each macro/micronutrient to `profile.targets`
3. Produce a ranked list of gaps sorted by severity (largest shortfall first)

### Suggestion engine (`suggestionEngine.ts`)

1. Start from `allMeals` (combined curated + imported catalogue)
2. Filter by `profile.preferences.dietary_flags` (e.g. vegan, gluten-free) and `dislikes`
3. Score each candidate by how well its `gap_coverage[]` addresses the identified gaps
4. Further rank by `pcos_score` (PCOS mode) or `bulk_score` (bulk mode)
5. Return top N meals

### UI

- Grouped by gap category (e.g. "Low on omega-3", "Need more fiber")
- Each suggestion shows a `MealCard` with score badge
- Tapping opens `NutritionDetailSheet`; a "Log this meal" button logs it directly

---

## Mode differences

| Mode | Sorting signal |
|---|---|
| PCOS | `pcos_score` + anti-inflammatory and hormone-support tags |
| Bulk | `bulk_score` + protein density + training-day carb needs |
| Maintain | Balanced score; no mode-specific weighting |

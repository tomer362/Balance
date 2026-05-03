# Onboarding Feature

**File:** `src/routes/Onboarding.tsx`  
**Guard:** `App.tsx` renders `<Onboarding />` when `!hasOnboarded`

---

## Intent

Walk a new user through creating their first profile in a guided, multi-step flow. Collect enough information to compute personalised macro targets before the user sees any data.

---

## Architecture

### Steps (multi-step wizard)

1. **Mode selection** — PCOS / Bulk / Maintain
2. **Demographics** — name, age, sex, height, current weight, goal weight, activity level
3. **Mode-specific settings:**
   - PCOS: concerns, goal (lose weight / manage symptoms), cycle length
   - Bulk: weekly surplus target, protein per kg, training schedule
4. **Dietary preferences** — flags (vegan, gluten-free, etc.) and food dislikes
5. **Review + confirm**

### Target computation

After step 2, `computePCOSTargets` / `computeBulkTargets` / `computeMaintainTargets` are called to produce `Targets`. These are displayed as a preview in step 5 and stored on the profile.

### Completion

`completeOnboarding(profile)` is called on confirm:
- Replaces `profiles` array with just the new user profile (removes demo profiles)
- Sets `hasOnboarded: true`
- App re-renders with `<AppLayout />`

---

## State

Onboarding state is local to the component (not persisted until completion). Only the finished `Profile` object is written to the store.

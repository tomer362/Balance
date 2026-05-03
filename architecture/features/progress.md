# Progress Feature

**Route:** `/progress`  
**File:** `src/routes/Progress.tsx`

---

## Intent

Visualise the user's weight history over time and track progress toward their goal weight. Provides editing tools for correcting or backfilling entries.

---

## Architecture

### Data model

`profile.weightHistory: Array<{ date: string; kg: number }>`

Entries are stored in chronological order and deduplicated by date (latest entry per date wins).

### Store actions

| Action | Behaviour |
|---|---|
| `logWeight(profileId, kg)` | Appends entry for today |
| `updateWeightEntry(profileId, originalDate, entry)` | Replaces a specific entry (allows date correction) |
| `deleteWeightEntry(profileId, date)` | Removes an entry |

### Charts

Built with **Recharts**. Displays:
- Line chart of weight over time (configurable to 1 month / 3 months / all time)
- Goal weight reference line
- Starting weight reference line

### Goal weight display

`profile.demographics.goal_weight_kg` is shown as a target line on the chart and as a "X kg to go" summary.

### `deriveGoalWeight` helper (`lib/targetComputation.ts`)

Computes an intermediate goal weight suggestion during onboarding based on BMI and the selected mode.

# Wellness Feature

**Route:** `/wellness`  
**File:** `src/routes/Wellness.tsx`

---

## Intent

Track the three core daily habits that complement nutrition: **steps**, **water intake**, and **workouts**. Surfaces daily alerts on the Dashboard when goals are not yet met.

---

## Architecture

### Habit settings (`HabitSettings`)

Stored on `profile.habitSettings`:

```ts
interface HabitSettings {
  stepGoal: number;           // default 10,000
  workoutGoalPerWeek: number; // e.g. 4
  waterGoalMl: number;        // e.g. 2500
  reminders: { steps, workouts, water }; // alert flags
}
```

### Data logs

| Store field | Type | Description |
|---|---|---|
| `stepHistory` | `DatedNumberLog[]` | One entry per day with step count |
| `waterHistory` | `DatedNumberLog[]` | One entry per day with ml consumed |
| `workoutHistory` | `WorkoutLog[]` | One entry per day, `completed: boolean` |

### Step tracking

- "I did 10k today" button sets today's entry to the `stepGoal` value (fast one-tap UX)
- Users can also type an exact step count
- History displayed with a search filter

### Water tracking

- Quick-add buttons (250ml, 500ml) or free-text ml input
- Consistency chart: shows goal-hit rate over the last 7/30 days
- Average daily intake calculated from history

### Workout tracking

- "Mark today as workout" toggle
- Weekly goal progress (e.g. 3 of 4 workouts this week)
- Daily alert shown until weekly goal is reached

### Dashboard alerts

Alerts appear on the Dashboard (`copy.wellness.alerts.*`) when:
- Steps for today are below `stepGoal`
- Weekly workouts < `workoutGoalPerWeek`
- Today's water < `waterGoalMl`

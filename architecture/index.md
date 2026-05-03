# Architecture Index

> This folder is the living technical documentation for **Balance**.  
> Update the relevant file whenever a feature or structure changes.

---

## Table of Contents

| Document | What it covers |
|---|---|
| [store.md](./store.md) | Zustand global state, `AppState`, `Profile` model, persistence |
| [data.md](./data.md) | Meal / ingredient databases, USDA import pipeline, cheat meal catalogue |
| [lib.md](./lib.md) | Utility libraries — i18n, scoring, nutrition helpers, suggestion engine, cycle phase |
| [components.md](./components.md) | Shared UI components (BalanceWheel, MealCard, BottomNav, etc.) |
| [features/dashboard.md](./features/dashboard.md) | Today summary, shortcuts, quick-log, balance wheel |
| [features/food-log.md](./features/food-log.md) | Meal logging, nutrition detail sheet, meal scoring |
| [features/cheat-meals.md](./features/cheat-meals.md) | Quick tick, weekly allowance logic, cheat meal catalogue |
| [features/suggestions.md](./features/suggestions.md) | Suggestion engine, gap analysis, meal recommendations |
| [features/groceries.md](./features/groceries.md) | Grocery list and weekly meal plan |
| [features/wellness.md](./features/wellness.md) | Steps, water, workouts, daily habit goals |
| [features/progress.md](./features/progress.md) | Weight history, charts, body-composition trend |
| [features/onboarding.md](./features/onboarding.md) | Profile creation, mode selection, initial targets |
| [features/profile.md](./features/profile.md) | Profile settings, targets, dietary preferences |

---

## Project Overview

**Balance** is a goal-aware nutrition tracking PWA built with:

| Layer | Technology |
|---|---|
| Framework | React 18 + TypeScript |
| Routing | React Router v6 |
| State | Zustand with `persist` middleware (localStorage) |
| Styling | Tailwind CSS v3 |
| Animation | Framer Motion |
| Charts | Recharts |
| Build | Vite |
| Lint / types | ESLint + TypeScript strict |

### Supported user modes

| Mode | Who it's for | Key differences |
|---|---|---|
| `pcos` | Women managing PCOS | Cycle-phase–aware macros, anti-inflammatory scoring, seed cycling |
| `bulk` | Athletes building muscle | Training/rest day carb cycling, surplus tracking |
| `maintain` | General health | Balanced targets, flexible tracking |

### App entry point

`src/App.tsx` — mounts `BrowserRouter`, checks `hasOnboarded`, and renders either `<Onboarding />` or `<AppLayout />` (routes + `<BottomNav />`). Page transitions are handled by Framer Motion `<AnimatePresence>`.

### Route map

| Path | Component |
|---|---|
| `/` | Dashboard |
| `/log` | Log (food diary) |
| `/suggestions` | Suggestions |
| `/groceries` | Groceries |
| `/progress` | Progress |
| `/cheat-meals` | CheatMeals |
| `/wellness` | Wellness |
| `/profile` | Profile |

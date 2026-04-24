import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Phase = 'menstrual' | 'follicular' | 'ovulatory' | 'luteal';

export interface NutritionData {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fiber_g: number;
  sugar_g: number;
  fat_g: number;
  saturated_fat_g: number;
  sodium_mg: number;
  glycemic_index?: number;
  glycemic_load?: number;
  omega3_g?: number;
  ingredients?: string[];
}

export interface LoggedMeal {
  id: string;
  timestamp: string;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'pre_workout' | 'post_workout';
  food_id?: string;
  name: string;
  serving_g: number;
  nutrition: NutritionData;
  score: number;
  cyclePhase?: Phase;
  isTrainingDay?: boolean;
}

export interface Targets {
  calories: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  fiber_g?: number;
  omega3_g?: number;
  max_glycemic_load?: number;
  calories_training_day?: number;
  calories_rest_day?: number;
  carbs_training_day?: number;
  carbs_rest_day?: number;
  meals_per_day_target?: number;
  protein_per_meal_min?: number;
}

export interface CycleData {
  avgCycleLength: number;
  avgPeriodLength: number;
  history: Array<{ start: string; end?: string; flow?: 'light' | 'medium' | 'heavy'; symptoms?: string[] }>;
  currentPhaseOverride?: Phase;
}

export interface TrainingSchedule {
  weekPattern: Array<'training' | 'rest'>;
  split?: string[];
  typicalStartTime?: string;
  typicalDurationMin?: number;
}

export interface Profile {
  id: string;
  name: string;
  avatar?: string;
  mode: 'pcos' | 'bulk' | 'maintain';
  demographics: {
    sex: 'female' | 'male' | 'other';
    age: number;
    height_cm: number;
    weight_kg: number;
    goal_weight_kg: number;
    activity_level: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
  };
  targets: Targets;
  foodLog: LoggedMeal[];
  mealPlan: Record<string, { breakfast?: string; lunch?: string; dinner?: string; snacks?: string[] }>;
  weightHistory: Array<{ date: string; kg: number }>;
  customRecipes: MealItem[];
  preferences: { dietary_flags: string[]; dislikes: string[] };
  pcos?: {
    concerns: string[];
    cycle: CycleData;
    symptomLog: Array<{ date: string; mood?: 'good' | 'ok' | 'low'; symptoms: string[]; notes?: string }>;
    seedCyclingEnabled: boolean;
  };
  bulk?: {
    surplus_kcal: number;
    protein_g_per_kg: number;
    trainingSchedule: TrainingSchedule;
    supplements: string[];
  };
}

export interface MealItem {
  id: string;
  name: string;
  prep_time_min: number;
  meal_types: Array<'breakfast' | 'lunch' | 'dinner' | 'snack'>;
  tags: string[];
  dietary: string[];
  nutrition: NutritionData;
  pcos_score: number;
  bulk_score?: number;
  gap_coverage: string[];
  instructions?: string[];
  image?: string;
}

export interface AppState {
  activeProfileId: string;
  profiles: Profile[];
  appSettings: { units: 'metric' | 'imperial'; theme: 'auto' | 'light' | 'dark'; language: string };
  hasOnboarded: boolean;
  // Actions
  setActiveProfile: (id: string) => void;
  addProfile: (profile: Profile) => void;
  updateProfile: (id: string, updates: Partial<Profile>) => void;
  deleteProfile: (profileId: string) => void;
  logMeal: (profileId: string, meal: LoggedMeal) => void;
  removeMeal: (profileId: string, mealId: string) => void;
  updateMeal: (profileId: string, mealId: string, updates: Partial<LoggedMeal>) => void;
  logWeight: (profileId: string, kg: number) => void;
  updateTargets: (profileId: string, targets: Targets) => void;
  /** Called when the user finishes onboarding. Replaces demo profiles with the real one. */
  completeOnboarding: (profile: Profile) => void;
}

// Helper: today timestamps
function todayAt(hour: number, minute = 0): string {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

// Seed meals for PCOS demo profile
const pcosMeals: LoggedMeal[] = [
  {
    id: 'pcos-meal-1',
    timestamp: todayAt(8, 15),
    meal_type: 'breakfast',
    name: 'Greek Yogurt + Berries + Chia',
    serving_g: 350,
    nutrition: {
      calories: 312,
      protein_g: 22,
      carbs_g: 32,
      fiber_g: 8,
      sugar_g: 18,
      fat_g: 8,
      saturated_fat_g: 2,
      sodium_mg: 95,
      glycemic_index: 35,
      glycemic_load: 8,
      omega3_g: 1.8,
    },
    score: 8.9,
    cyclePhase: 'luteal',
  },
  {
    id: 'pcos-meal-2',
    timestamp: todayAt(13, 0),
    meal_type: 'lunch',
    name: 'Quinoa Salmon Bowl',
    serving_g: 450,
    nutrition: {
      calories: 521,
      protein_g: 38,
      carbs_g: 42,
      fiber_g: 6,
      sugar_g: 4,
      fat_g: 18,
      saturated_fat_g: 3,
      sodium_mg: 320,
      glycemic_index: 53,
      glycemic_load: 16,
      omega3_g: 2.4,
    },
    score: 9.2,
    cyclePhase: 'luteal',
  },
  {
    id: 'pcos-meal-3',
    timestamp: todayAt(16, 30),
    meal_type: 'snack',
    name: 'Chia Pudding + Berries + Walnuts',
    serving_g: 220,
    nutrition: {
      calories: 248,
      protein_g: 9,
      carbs_g: 22,
      fiber_g: 10,
      sugar_g: 12,
      fat_g: 14,
      saturated_fat_g: 2,
      sodium_mg: 55,
      glycemic_index: 30,
      glycemic_load: 5,
      omega3_g: 2.1,
    },
    score: 8.5,
    cyclePhase: 'luteal',
  },
];

// Seed meals for Bulk demo profile
const bulkMeals: LoggedMeal[] = [
  {
    id: 'bulk-meal-1',
    timestamp: todayAt(7, 30),
    meal_type: 'breakfast',
    name: 'Oats + Whey + Banana',
    serving_g: 400,
    nutrition: {
      calories: 548,
      protein_g: 38,
      carbs_g: 75,
      fiber_g: 7,
      sugar_g: 22,
      fat_g: 8,
      saturated_fat_g: 2,
      sodium_mg: 180,
      glycemic_index: 60,
      glycemic_load: 28,
      omega3_g: 0.2,
    },
    score: 8.2,
    isTrainingDay: true,
  },
  {
    id: 'bulk-meal-2',
    timestamp: todayAt(12, 30),
    meal_type: 'lunch',
    name: 'Chicken Rice Bowl',
    serving_g: 550,
    nutrition: {
      calories: 682,
      protein_g: 52,
      carbs_g: 68,
      fiber_g: 4,
      sugar_g: 5,
      fat_g: 16,
      saturated_fat_g: 3,
      sodium_mg: 420,
      glycemic_index: 64,
      glycemic_load: 30,
      omega3_g: 0.1,
    },
    score: 8.7,
    isTrainingDay: true,
  },
  {
    id: 'bulk-meal-3',
    timestamp: todayAt(15, 45),
    meal_type: 'pre_workout',
    name: 'Sweet Potato + Salmon + Greens',
    serving_g: 420,
    nutrition: {
      calories: 495,
      protein_g: 35,
      carbs_g: 48,
      fiber_g: 6,
      sugar_g: 10,
      fat_g: 14,
      saturated_fat_g: 3,
      sodium_mg: 290,
      glycemic_index: 61,
      glycemic_load: 20,
      omega3_g: 1.9,
    },
    score: 8.4,
    isTrainingDay: true,
  },
  {
    id: 'bulk-meal-4',
    timestamp: todayAt(19, 0),
    meal_type: 'post_workout',
    name: 'Ground Beef + Rice + Vegetables',
    serving_g: 500,
    nutrition: {
      calories: 620,
      protein_g: 45,
      carbs_g: 58,
      fiber_g: 5,
      sugar_g: 6,
      fat_g: 18,
      saturated_fat_g: 6,
      sodium_mg: 380,
      glycemic_index: 60,
      glycemic_load: 24,
      omega3_g: 0.2,
    },
    score: 7.8,
    isTrainingDay: true,
  },
];

const defaultProfiles: Profile[] = [
  {
    id: 'pcos-demo',
    name: 'PCOS Profile',
    mode: 'pcos',
    demographics: {
      sex: 'female',
      age: 32,
      height_cm: 170,
      weight_kg: 82,
      goal_weight_kg: 70,
      activity_level: 'moderate',
    },
    targets: {
      calories: 1680,
      protein_g: 105,
      fat_g: 56,
      carbs_g: 168,
      fiber_g: 30,
      omega3_g: 3.0,
      max_glycemic_load: 100,
      meals_per_day_target: 4,
      protein_per_meal_min: 20,
    },
    foodLog: pcosMeals,
    mealPlan: {
      [todayStr()]: {
        breakfast: 'greek-yogurt-berries-chia',
        lunch: 'quinoa-salmon-bowl',
        dinner: 'grilled-mackerel-lentils',
        snacks: ['chia-pudding-berries'],
      },
    },
    weightHistory: [
      { date: daysAgo(30), kg: 84.0 },
      { date: daysAgo(23), kg: 83.2 },
      { date: daysAgo(16), kg: 82.8 },
      { date: daysAgo(9), kg: 82.3 },
      { date: daysAgo(2), kg: 82.0 },
      { date: todayStr(), kg: 82.0 },
    ],
    customRecipes: [],
    preferences: {
      dietary_flags: ['gluten-free-preferred'],
      dislikes: ['shellfish'],
    },
    pcos: {
      concerns: ['insulin-resistance', 'inflammation', 'hormonal-balance'],
      cycle: {
        avgCycleLength: 38,
        avgPeriodLength: 5,
        history: [
          {
            start: daysAgo(22),
            flow: 'medium',
            symptoms: ['cramps', 'fatigue'],
          },
          {
            start: daysAgo(60),
            end: daysAgo(55),
            flow: 'light',
            symptoms: ['bloating'],
          },
          {
            start: daysAgo(98),
            end: daysAgo(93),
            flow: 'medium',
            symptoms: ['cramps'],
          },
        ],
      },
      symptomLog: [
        {
          date: daysAgo(1),
          mood: 'ok',
          symptoms: ['fatigue'],
          notes: 'Bit tired in the afternoon',
        },
        {
          date: daysAgo(3),
          mood: 'good',
          symptoms: [],
          notes: 'Feeling good!',
        },
      ],
      seedCyclingEnabled: true,
    },
  },
  {
    id: 'bulk-demo',
    name: 'Bulk Profile',
    mode: 'bulk',
    demographics: {
      sex: 'male',
      age: 27,
      height_cm: 178,
      weight_kg: 78,
      goal_weight_kg: 84,
      activity_level: 'moderate',
    },
    targets: {
      calories: 2900,
      protein_g: 156,
      fat_g: 80,
      carbs_g: 350,
      fiber_g: 35,
      omega3_g: 2.0,
      calories_training_day: 3100,
      calories_rest_day: 2700,
      carbs_training_day: 380,
      carbs_rest_day: 280,
      meals_per_day_target: 5,
      protein_per_meal_min: 30,
    },
    foodLog: bulkMeals,
    mealPlan: {
      [todayStr()]: {
        breakfast: 'oats-whey-banana',
        lunch: 'chicken-rice-bowl',
        dinner: 'ground-beef-rice-veg',
        snacks: ['cottage-cheese-berries'],
      },
    },
    weightHistory: [
      { date: daysAgo(30), kg: 76.5 },
      { date: daysAgo(23), kg: 77.0 },
      { date: daysAgo(16), kg: 77.4 },
      { date: daysAgo(9), kg: 77.8 },
      { date: daysAgo(2), kg: 78.0 },
      { date: todayStr(), kg: 78.0 },
    ],
    customRecipes: [],
    preferences: {
      dietary_flags: [],
      dislikes: ['olives'],
    },
    bulk: {
      surplus_kcal: 300,
      protein_g_per_kg: 2.0,
      trainingSchedule: {
        weekPattern: ['training', 'rest', 'training', 'rest', 'training', 'training', 'rest'],
        split: ['Push', 'Rest', 'Pull', 'Rest', 'Legs', 'Upper', 'Rest'],
        typicalStartTime: '08:00',
        typicalDurationMin: 75,
      },
      supplements: ['creatine', 'vitamin-d', 'omega3'],
    },
  },
];

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      activeProfileId: 'pcos-demo',
      profiles: defaultProfiles,
      appSettings: { units: 'metric', theme: 'auto', language: 'en' },
      hasOnboarded: false,

      setActiveProfile: (id) => set({ activeProfileId: id }),

      addProfile: (profile) =>
        set((state) => ({ profiles: [...state.profiles, profile] })),

      updateProfile: (id, updates) =>
        set((state) => ({
          profiles: state.profiles.map((p) =>
            p.id === id ? { ...p, ...updates } : p
          ),
        })),

      deleteProfile: (profileId) =>
        set((state) => {
          const remaining = state.profiles.filter((p) => p.id !== profileId);
          return {
            profiles: remaining,
            activeProfileId:
              state.activeProfileId === profileId
                ? (remaining[0]?.id ?? '')
                : state.activeProfileId,
          };
        }),

      completeOnboarding: (profile) =>
        set({
          profiles: [profile],
          activeProfileId: profile.id,
          hasOnboarded: true,
        }),

      logMeal: (profileId, meal) =>
        set((state) => ({
          profiles: state.profiles.map((p) =>
            p.id === profileId
              ? { ...p, foodLog: [...p.foodLog, meal] }
              : p
          ),
        })),

      removeMeal: (profileId, mealId) =>
        set((state) => ({
          profiles: state.profiles.map((p) =>
            p.id === profileId
              ? { ...p, foodLog: p.foodLog.filter((m) => m.id !== mealId) }
              : p
          ),
        })),

      updateMeal: (profileId, mealId, updates) =>
        set((state) => ({
          profiles: state.profiles.map((p) =>
            p.id === profileId
              ? {
                  ...p,
                  foodLog: p.foodLog.map((m) =>
                    m.id === mealId ? { ...m, ...updates } : m
                  ),
                }
              : p
          ),
        })),

      logWeight: (profileId, kg) =>
        set((state) => ({
          profiles: state.profiles.map((p) =>
            p.id === profileId
              ? {
                  ...p,
                  demographics: { ...p.demographics, weight_kg: kg },
                  weightHistory: [
                    ...p.weightHistory,
                    { date: new Date().toISOString().split('T')[0], kg },
                  ],
                }
              : p
          ),
        })),

      updateTargets: (profileId, targets) =>
        set((state) => ({
          profiles: state.profiles.map((p) =>
            p.id === profileId ? { ...p, targets } : p
          ),
        })),
    }),
    {
      name: 'balance-storage',
      version: 2,
      // Migrate v1 → v2: existing users keep their data and skip onboarding
      migrate: (persistedState: unknown, version: number) => {
        const s = persistedState as Partial<AppState>;
        if (version === 1) {
          return { ...s, hasOnboarded: true };
        }
        return s;
      },
    }
  )
);

// Selector helpers
export const selectActiveProfile = (state: AppState): Profile | undefined =>
  state.profiles.find((p) => p.id === state.activeProfileId);

export const selectTodayMeals = (state: AppState): LoggedMeal[] => {
  const profile = selectActiveProfile(state);
  if (!profile) return [];
  const today = new Date().toISOString().split('T')[0];
  return profile.foodLog.filter((m) => m.timestamp.startsWith(today));
};

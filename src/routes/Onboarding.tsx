import { useState } from 'react';
import { ArrowRight, ChevronLeft } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import type { Profile } from '../store/appStore';
import { computePCOSTargets, computeBulkTargets } from '../lib/targetComputation';

type AppMode = 'pcos' | 'bulk' | 'maintain';

const MODE_CARDS: Array<{
  mode: AppMode;
  title: string;
  subtitle: string;
  emoji: string;
  accent: string;
  bullets: string[];
}> = [
  {
    mode: 'pcos',
    title: 'PCOS',
    subtitle: 'Hormone & cycle support',
    emoji: '🌸',
    accent: '#8FA989',
    bullets: ['Cycle-phase nutrition', 'Low-glycaemic focus', 'Anti-inflammatory meals', 'Omega-3 & fiber tracking'],
  },
  {
    mode: 'bulk',
    title: 'Bulk',
    subtitle: 'Muscle & performance',
    emoji: '💪',
    accent: '#E8876A',
    bullets: ['High-protein targets', 'Training vs rest calories', 'Progressive surplus', 'Supplement tracking'],
  },
  {
    mode: 'maintain',
    title: 'Maintain',
    subtitle: 'Balanced & sustainable',
    emoji: '⚖️',
    accent: '#5C7A58',
    bullets: ['Balanced macros', 'Weight stability', 'Flexible goals', 'General wellness'],
  },
];

function buildProfile(
  name: string,
  mode: AppMode,
  sex: 'female' | 'male' | 'other',
  age: number,
  weight: number,
  height: number
): Profile {
  const demo: Profile = {
    id: `user-${Date.now()}`,
    name: name.trim() || 'Me',
    mode,
    demographics: {
      sex,
      age,
      height_cm: height,
      weight_kg: weight,
      goal_weight_kg: mode === 'bulk' ? weight + 6 : mode === 'pcos' ? Math.max(50, weight - 8) : weight,
      activity_level: 'moderate',
    },
    targets: { calories: 2000, protein_g: 100, fat_g: 65, carbs_g: 250 }, // placeholder, overwritten below
    foodLog: [],
    mealPlan: {},
    weightHistory: [{ date: new Date().toISOString().split('T')[0], kg: weight }],
    customRecipes: [],
    preferences: { dietary_flags: [], dislikes: [] },
    ...(mode === 'pcos'
      ? {
          pcos: {
            concerns: [],
            cycle: { avgCycleLength: 28, avgPeriodLength: 5, history: [] },
            symptomLog: [],
            seedCyclingEnabled: false,
          },
        }
      : mode === 'bulk'
      ? {
          bulk: {
            surplus_kcal: 300,
            protein_g_per_kg: 2.0,
            trainingSchedule: {
              weekPattern: ['training', 'rest', 'training', 'rest', 'training', 'training', 'rest'],
              split: ['Push', 'Rest', 'Pull', 'Rest', 'Legs', 'Upper', 'Rest'],
              typicalStartTime: '08:00',
              typicalDurationMin: 60,
            },
            supplements: [],
          },
        }
      : {}),
  };

  demo.targets =
    mode === 'pcos'
      ? computePCOSTargets(demo)
      : mode === 'bulk'
      ? computeBulkTargets(demo)
      : { calories: 2000, protein_g: 100, fat_g: 65, carbs_g: 250, fiber_g: 30, omega3_g: 2.0, meals_per_day_target: 4 };

  return demo;
}

export default function Onboarding() {
  const completeOnboarding = useAppStore((s) => s.completeOnboarding);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState('');
  const [selectedMode, setSelectedMode] = useState<AppMode | null>(null);
  const [sex, setSex] = useState<'female' | 'male' | 'other'>('female');
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');

  function skipAll() {
    const mode: AppMode = 'maintain';
    const profile = buildProfile('', mode, 'other', 25, 70, 170);
    completeOnboarding(profile);
  }

  function finish() {
    const mode = selectedMode ?? 'maintain';
    const profile = buildProfile(
      name,
      mode,
      sex,
      Number(age) || 25,
      Number(weight) || 70,
      Number(height) || 170
    );
    completeOnboarding(profile);
  }

  return (
    <div className="min-h-screen bg-cream-bg flex flex-col pt-safe pb-safe">
      {/* Progress bar */}
      <div className="px-6 pt-4 pb-2 flex items-center gap-3">
        {step > 1 && (
          <button onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)} className="tap-target flex items-center justify-center">
            <ChevronLeft size={22} className="text-ink-60" />
          </button>
        )}
        <div className="flex-1 flex gap-1.5">
          {([1, 2, 3] as const).map((s) => (
            <div
              key={s}
              className={`h-1 rounded-full flex-1 transition-colors ${s <= step ? 'bg-sage-deep' : 'bg-sand'}`}
            />
          ))}
        </div>
        <button onClick={skipAll} className="text-xs text-ink-40 font-medium px-2 py-1">
          Skip
        </button>
      </div>

      {/* Step 1 — Name */}
      {step === 1 && (
        <div className="flex-1 flex flex-col px-6 pt-8">
          <div className="font-display text-3xl text-plum-dark mb-2 leading-tight">
            Welcome to<br />Balance
          </div>
          <p className="text-ink-60 text-sm mb-8">
            Goal-aware nutrition tracking that adapts to your body and goals.
          </p>

          <label className="text-xs font-semibold text-ink-40 uppercase tracking-wide mb-2">
            Your name (optional)
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            data-testid="onboarding-name-input"
            className="w-full px-4 py-3.5 rounded-2xl border border-sand bg-cream-card text-plum-dark placeholder-ink-40 focus:outline-none focus:border-sage-primary"
          />

          <button
            onClick={() => setStep(2)}
            data-testid="onboarding-step1-continue"
            className="mt-auto mb-4 w-full bg-sage-deep text-white py-4 rounded-2xl font-semibold flex items-center justify-center gap-2"
          >
            Continue <ArrowRight size={18} />
          </button>
        </div>
      )}

      {/* Step 2 — Mode */}
      {step === 2 && (
        <div className="flex-1 flex flex-col px-6 pt-6">
          <h2 className="font-display text-2xl text-plum-dark mb-1">What's your goal?</h2>
          <p className="text-ink-60 text-sm mb-6">Balance will personalise everything to your mode. You can change this anytime.</p>

          <div className="space-y-3 flex-1">
            {MODE_CARDS.map((card) => {
              const active = selectedMode === card.mode;
              return (
                <button
                  key={card.mode}
                  onClick={() => setSelectedMode(card.mode)}
                  data-testid={`mode-card-${card.mode}`}
                  className={`w-full rounded-2xl border-2 p-4 text-left transition-all ${
                    active ? 'bg-cream-card shadow-md' : 'bg-cream-card/60 border-sand'
                  }`}
                  style={{ borderColor: active ? card.accent : undefined }}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">{card.emoji}</span>
                    <div>
                      <p className="font-semibold text-plum-dark text-base">{card.title}</p>
                      <p className="text-xs text-ink-60">{card.subtitle}</p>
                    </div>
                    {active && (
                      <div
                        className="ml-auto w-5 h-5 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: card.accent }}
                      >
                        <span className="text-white text-[10px] font-bold">✓</span>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                    {card.bullets.map((b) => (
                      <p key={b} className="text-xs text-ink-60">· {b}</p>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>

          <button
            disabled={!selectedMode}
            onClick={() => setStep(3)}
            data-testid="onboarding-step2-continue"
            className={`mt-4 mb-4 w-full py-4 rounded-2xl font-semibold flex items-center justify-center gap-2 transition-opacity ${
              selectedMode ? 'bg-sage-deep text-white' : 'bg-sand text-ink-40 opacity-50'
            }`}
          >
            Continue <ArrowRight size={18} />
          </button>
        </div>
      )}

      {/* Step 3 — Stats */}
      {step === 3 && (
        <div className="flex-1 flex flex-col px-6 pt-6">
          <h2 className="font-display text-2xl text-plum-dark mb-1">Quick stats</h2>
          <p className="text-ink-60 text-sm mb-6">
            Used to calculate your daily targets. You can update these anytime in Profile.
          </p>

          {/* Sex */}
          <label className="text-xs font-semibold text-ink-40 uppercase tracking-wide mb-2">Sex</label>
          <div className="flex gap-2 mb-4">
            {(['female', 'male', 'other'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSex(s)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium capitalize transition-all border ${
                  sex === s ? 'bg-sage-deep text-white border-sage-deep' : 'bg-cream-card border-sand text-ink-60'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <div>
              <label className="text-xs text-ink-40 block mb-1.5">Age</label>
              <input
                type="number"
                inputMode="numeric"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="25"
                className="w-full px-3 py-3 rounded-xl border border-sand bg-cream-card text-plum-dark focus:outline-none focus:border-sage-primary"
              />
            </div>
            <div>
              <label className="text-xs text-ink-40 block mb-1.5">Weight (kg)</label>
              <input
                type="number"
                inputMode="decimal"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="70"
                className="w-full px-3 py-3 rounded-xl border border-sand bg-cream-card text-plum-dark focus:outline-none focus:border-sage-primary"
              />
            </div>
            <div>
              <label className="text-xs text-ink-40 block mb-1.5">Height (cm)</label>
              <input
                type="number"
                inputMode="numeric"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                placeholder="170"
                className="w-full px-3 py-3 rounded-xl border border-sand bg-cream-card text-plum-dark focus:outline-none focus:border-sage-primary"
              />
            </div>
          </div>

          <p className="text-xs text-ink-40 mb-auto">All fields are optional — you can skip and set them later.</p>

          <button
            onClick={finish}
            data-testid="onboarding-finish"
            className="mb-4 w-full bg-sage-deep text-white py-4 rounded-2xl font-semibold flex items-center justify-center gap-2"
          >
            Start using Balance <ArrowRight size={18} />
          </button>
          <button onClick={finish} className="mb-2 text-center text-sm text-ink-40">
            Skip for now
          </button>
        </div>
      )}
    </div>
  );
}

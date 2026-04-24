import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, ChevronRight, X } from 'lucide-react';
import { useAppStore, selectActiveProfile, selectTodayMeals } from '../store/appStore';
import type { LoggedMeal, Phase } from '../store/appStore';
import BalanceWheel from '../components/BalanceWheel';
import MealCard from '../components/MealCard';
import ScoreBadge from '../components/ScoreBadge';
import { sumNutrients } from '../lib/gapAnalysis';
import { getSuggestions } from '../lib/suggestionEngine';
import { getCurrentPhase, getPhaseName, getPhaseColor } from '../lib/cyclePhase';
import { scoreFood } from '../lib/scoring';

function greetingByHour(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatDate(): string {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

function isTrainingDay(profile: ReturnType<typeof selectActiveProfile>): boolean {
  if (!profile?.bulk?.trainingSchedule) return false;
  const dayOfWeek = new Date().getDay();
  const idx = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  return profile.bulk.trainingSchedule.weekPattern[idx] === 'training';
}

function getTodaySplit(profile: ReturnType<typeof selectActiveProfile>): string | null {
  if (!profile?.bulk?.trainingSchedule?.split) return null;
  const dayOfWeek = new Date().getDay();
  const idx = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  return profile.bulk.trainingSchedule.split[idx] ?? null;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const profile = useAppStore(selectActiveProfile);
  const todayMeals = useAppStore(selectTodayMeals);
  const removeMeal = useAppStore((s) => s.removeMeal);
  const updateMeal = useAppStore((s) => s.updateMeal);

  const [editingMeal, setEditingMeal] = useState<LoggedMeal | null>(null);

  if (!profile) return null;

  const totals = sumNutrients(todayMeals.map((m) => m.nutrition));
  const targets = profile.targets;
  const suggestions = getSuggestions(profile, 1);
  const topSuggestion = suggestions[0];

  const isTraining = isTrainingDay(profile);
  const todaySplit = getTodaySplit(profile);
  const phaseInfo = profile.mode === 'pcos' ? getCurrentPhase(profile) : null;

  const calTarget = profile.mode === 'pcos'
    ? (targets.calories + (phaseInfo ? (phaseInfo.phase === 'luteal' ? 150 : phaseInfo.phase === 'ovulatory' ? -50 : 0) : 0))
    : (isTraining ? (targets.calories_training_day ?? targets.calories) : (targets.calories_rest_day ?? targets.calories));

  return (
    <div className="main-content overflow-y-auto min-h-screen">
      {/* PCOS Phase strip */}
      {profile.mode === 'pcos' && phaseInfo && (
        <div
          className="px-5 py-2 text-xs font-medium text-center cursor-pointer"
          style={{ backgroundColor: getPhaseColor(phaseInfo.phase) + '25', color: getPhaseColor(phaseInfo.phase) }}
          onClick={() => navigate('/progress')}
        >
          {getPhaseName(phaseInfo.phase).toUpperCase()} · Day {phaseInfo.cycleDay}
          {phaseInfo.phase === 'luteal' && ' · +150 kcal today'}
          {phaseInfo.phase === 'ovulatory' && ' · −50 kcal today'}
          {phaseInfo.confidence !== 'high' && (
            <span className="ml-1 opacity-60">(estimate)</span>
          )}
        </div>
      )}

      <div className="px-5 pt-4 pb-3 flex items-center justify-between">
        <div>
          <p className="text-xs text-ink-40">{formatDate()}</p>
          <h1 className="text-lg font-semibold text-plum-dark mt-0.5">
            {greetingByHour()}, {profile.name}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {/* Bulk: training day badge */}
          {profile.mode === 'bulk' && (
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
              isTraining ? 'bg-coral-accent/15 text-coral-accent' : 'bg-sand text-ink-60'
            }`}>
              {isTraining ? `Training · ${todaySplit ?? 'Day'}` : 'Rest Day'}
            </span>
          )}
          <button
            onClick={() => navigate('/profile')}
            className="w-9 h-9 rounded-full bg-sand flex items-center justify-center text-ink-60 hover:bg-sand/80 transition-colors"
          >
            <Settings size={17} />
          </button>
        </div>
      </div>

      {/* Balance Wheel */}
      <div
        className="mx-5 bg-cream-card rounded-3xl p-5 shadow-sm border border-sand/40 cursor-pointer"
        onClick={() => navigate('/suggestions')}
      >
        <BalanceWheel profile={profile} size={240} />
      </div>

      {/* Mini stat chips */}
      <div className="px-5 mt-3 grid grid-cols-4 gap-2">
        {profile.mode === 'pcos' ? (
          <>
            <StatChip label="Protein" value={`${Math.round(totals.protein_g)}/${Math.round(targets.protein_g)}g`} emoji="🥩" />
            <StatChip label="Fiber" value={`${Math.round(totals.fiber_g)}/${targets.fiber_g ?? 30}g`} emoji="🌾" />
            <StatChip label="Omega-3" value={`${((totals.omega3_g ?? 0)).toFixed(1)}g`} emoji="🐟" />
            <StatChip label="GL" value={String(Math.round(totals.glycemic_load ?? 0))} emoji="📊" sublabel={`/ ${targets.max_glycemic_load ?? 100}`} />
          </>
        ) : (
          <>
            <StatChip label="Protein" value={`${Math.round(totals.protein_g)}/${Math.round(targets.protein_g)}g`} emoji="🥩" />
            <StatChip label="Carbs" value={`${Math.round(totals.carbs_g)}g`} emoji="🍚" />
            <StatChip label="Fat" value={`${Math.round(totals.fat_g)}g`} emoji="🥑" />
            <StatChip label="Meals" value={`${todayMeals.length}/${targets.meals_per_day_target ?? 5}`} emoji="🍽️" />
          </>
        )}
      </div>

      {/* Today's meals */}
      <div className="px-5 mt-5">
        <h2 className="text-sm font-semibold text-ink-60 uppercase tracking-wide mb-3">Today's meals</h2>
        {todayMeals.length === 0 ? (
          <div className="bg-cream-card rounded-2xl p-6 text-center border border-sand/40">
            <p className="text-ink-40 text-sm">No meals logged yet.</p>
            <button
              onClick={() => navigate('/log')}
              className="mt-3 text-sm font-medium text-coral-accent"
            >
              Log your first meal →
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {[...todayMeals]
              .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
              .map((meal) => (
                <MealCard
                  key={meal.id}
                  meal={meal}
                  onDelete={() => removeMeal(profile.id, meal.id)}
                  onEdit={() => setEditingMeal(meal)}
                />
              ))}
          </div>
        )}
      </div>

      {/* Next meal insight */}
      {topSuggestion && (
        <div className="mx-5 mt-5 rounded-2xl border-2 border-coral-accent/40 bg-cream-card overflow-hidden">
          <div className="px-4 py-3 bg-coral-accent/8">
            <div className="flex items-center gap-2">
              <span>{profile.mode === 'bulk' && isTraining ? '💪' : '💡'}</span>
              <span className="text-xs font-bold text-coral-accent uppercase tracking-wide">
                {profile.mode === 'bulk' && isTraining ? 'Training-day suggestion' : 'Next meal insight'}
              </span>
            </div>
          </div>
          <div className="px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <p className="font-medium text-plum-dark text-sm leading-snug">{topSuggestion.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <ScoreBadge score={topSuggestion.pcos_score} size="sm" />
                  <span className="text-xs text-ink-40">{topSuggestion.nutrition.calories} kcal</span>
                  <span className="text-xs text-ink-40">·</span>
                  <span className="text-xs text-ink-40">{topSuggestion.prep_time_min} min</span>
                </div>
                {topSuggestion.closedGaps.length > 0 && (
                  <p className="text-xs text-moss mt-1.5">
                    Closes: {topSuggestion.closedGaps.map((g) => `✓ ${g}`).join('  ')}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={() => navigate('/suggestions')}
              className="w-full mt-3 flex items-center justify-center gap-1 text-sm font-medium text-coral-accent"
            >
              See more options <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Remaining needs */}
      {profile.mode === 'bulk' && (
        <div className="mx-5 mt-3 mb-2 bg-sand/60 rounded-2xl px-4 py-3">
          <p className="text-xs text-ink-60">
            Still need today:{' '}
            <span className="font-semibold text-plum-dark">
              {Math.round(Math.max(0, targets.protein_g - totals.protein_g))}g protein
            </span>
            {', '}
            <span className="font-semibold text-plum-dark">
              {Math.round(Math.max(0, (targets.carbs_training_day ?? targets.carbs_g) - totals.carbs_g))}g carbs
            </span>
          </p>
        </div>
      )}

      <div className="h-4" />
    </div>

    {/* Edit meal bottom-sheet */}
    {editingMeal && (
      <EditMealSheet
        meal={editingMeal}
        profileId={profile.id}
        mode={profile.mode}
        phase={phaseInfo?.phase}
        onClose={() => setEditingMeal(null)}
      />
    )}
  );
}

// ── Edit meal sheet ──────────────────────────────────────────────────────────

const MEAL_TYPES: LoggedMeal['meal_type'][] = [
  'breakfast', 'lunch', 'dinner', 'snack', 'pre_workout', 'post_workout',
];

function EditMealSheet({
  meal,
  profileId,
  mode,
  phase,
  onClose,
}: {
  meal: LoggedMeal;
  profileId: string;
  mode: 'pcos' | 'bulk' | 'maintain';
  phase?: Phase;
  onClose: () => void;
}) {
  const updateMeal = useAppStore((s) => s.updateMeal);

  const [name, setName] = useState(meal.name);
  const [mealType, setMealType] = useState<LoggedMeal['meal_type']>(meal.meal_type);
  const [servingText, setServingText] = useState(String(meal.serving_g));

  const newServing = Math.max(1, Number(servingText) || meal.serving_g);
  const scale = newServing / meal.serving_g;

  function save() {
    const scaledNutrition = {
      calories: Math.round(meal.nutrition.calories * scale),
      protein_g: Math.round(meal.nutrition.protein_g * scale * 10) / 10,
      carbs_g: Math.round(meal.nutrition.carbs_g * scale * 10) / 10,
      fiber_g: Math.round(meal.nutrition.fiber_g * scale * 10) / 10,
      sugar_g: Math.round(meal.nutrition.sugar_g * scale * 10) / 10,
      fat_g: Math.round(meal.nutrition.fat_g * scale * 10) / 10,
      saturated_fat_g: Math.round(meal.nutrition.saturated_fat_g * scale * 10) / 10,
      sodium_mg: Math.round(meal.nutrition.sodium_mg * scale),
      omega3_g: meal.nutrition.omega3_g !== undefined
        ? Math.round(meal.nutrition.omega3_g * scale * 100) / 100
        : undefined,
    };
    const newScore = scoreFood(scaledNutrition, newServing, mode, phase);
    updateMeal(profileId, meal.id, {
      name: name.trim() || meal.name,
      meal_type: mealType,
      serving_g: newServing,
      nutrition: scaledNutrition,
      score: newScore,
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-md bg-cream-bg rounded-t-3xl p-5 pb-safe space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-plum-dark">Edit meal</h3>
          <button onClick={onClose} className="tap-target flex items-center justify-center">
            <X size={20} className="text-ink-40" />
          </button>
        </div>

        {/* Name */}
        <div>
          <label className="text-xs text-ink-40 block mb-1.5">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-sand bg-cream-card text-plum-dark focus:outline-none focus:border-sage-primary"
          />
        </div>

        {/* Meal type */}
        <div>
          <label className="text-xs text-ink-40 block mb-1.5">Meal type</label>
          <div className="flex gap-2 flex-wrap">
            {MEAL_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => setMealType(t)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-all ${
                  mealType === t ? 'bg-sage-deep text-white' : 'bg-sand text-ink-60'
                }`}
              >
                {t.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Serving */}
        <div>
          <label className="text-xs text-ink-40 block mb-1.5">Serving (g)</label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              inputMode="decimal"
              value={servingText}
              onChange={(e) => setServingText(e.target.value)}
              className="flex-1 px-4 py-3 rounded-xl border border-sand bg-cream-card text-plum-dark text-center focus:outline-none focus:border-sage-primary"
            />
          </div>
          {scale !== 1 && (
            <p className="text-xs text-ink-40 mt-1 text-center">
              → {Math.round(meal.nutrition.calories * scale)} kcal · {Math.round(meal.nutrition.protein_g * scale * 10) / 10}g P
            </p>
          )}
        </div>

        <button
          onClick={save}
          className="w-full bg-sage-deep text-white py-3.5 rounded-2xl font-semibold"
        >
          Save
        </button>
      </div>
    </div>
  );
}

function StatChip({ label, value, emoji, sublabel }: { label: string; value: string; emoji: string; sublabel?: string }) {
  return (
    <div className="bg-cream-card rounded-xl p-2.5 text-center border border-sand/40 shadow-sm">
      <div className="text-base mb-0.5">{emoji}</div>
      <div className="font-mono-num text-xs font-semibold text-plum-dark leading-tight">
        {value}
        {sublabel && <span className="text-ink-40 font-normal">{sublabel}</span>}
      </div>
      <div className="text-[9px] text-ink-40 mt-0.5 uppercase tracking-wide">{label}</div>
    </div>
  );
}

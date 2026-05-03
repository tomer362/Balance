import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, ChevronRight, X, Scale, UtensilsCrossed, Carrot, LineChart, Cookie, Footprints, Dumbbell, Droplets, Search, Check } from 'lucide-react';
import { defaultHabitSettings, useAppStore, selectActiveProfile, selectTodayMeals } from '../store/appStore';
import type { LoggedMeal, Phase } from '../store/appStore';
import BalanceWheel from '../components/BalanceWheel';
import MealCard from '../components/MealCard';
import ScoreBadge from '../components/ScoreBadge';
import NutritionDetailSheet from '../components/NutritionDetailSheet';
import { sumNutrients } from '../lib/gapAnalysis';
import { getSuggestions } from '../lib/suggestionEngine';
import { getCurrentPhase, getPhaseColor } from '../lib/cyclePhase';
import { scoreFood } from '../lib/scoring';
import BottomSheet from '../components/BottomSheet';
import { computePCOSTargets, computeBulkTargets, computeMaintainTargets } from '../lib/targetComputation';
import { countMicronutrients, hasMicronutrientData, scaleNutrition } from '../lib/nutrition';
import { directionalArrow, directionalIconClass, formatAmountWithUnit, formatCompactAmount, formatDateValue, formatWeightGoal, mealDisplayName, mealTypeLabel, phaseName, useI18n } from '../lib/i18n';

function greetingByHour(language: 'en' | 'he', greetings: { morning: string; afternoon: string; evening: string }): string {
  const h = new Date().getHours();
  if (h < 12) return greetings.morning;
  if (h < 17) return greetings.afternoon;
  return greetings.evening;
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

function startOfWeekKey(date: Date): string {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy.toISOString().split('T')[0];
}

export default function Dashboard() {
  const { copy, language } = useI18n();
  const navigate = useNavigate();
  const profile = useAppStore(selectActiveProfile);
  const todayMeals = useAppStore(selectTodayMeals);
  const removeMeal = useAppStore((s) => s.removeMeal);
  const logSteps = useAppStore((s) => s.logSteps);
  const toggleWorkoutLog = useAppStore((s) => s.toggleWorkoutLog);

  const [editingMeal, setEditingMeal] = useState<LoggedMeal | null>(null);
  const [showWeightSheet, setShowWeightSheet] = useState(false);
  const [nutritionMeal, setNutritionMeal] = useState<LoggedMeal | null>(null);
  const [globalSearch, setGlobalSearch] = useState('');

  if (!profile) return null;

  const totals = sumNutrients(todayMeals.map((m) => m.nutrition));
  // Always compute targets live so changes to weight/height/mode in Profile
  // are immediately reflected on the Dashboard without requiring a page reload.
  const targets =
    profile.mode === 'pcos'
      ? computePCOSTargets(profile)
      : profile.mode === 'bulk'
      ? computeBulkTargets(profile)
      : computeMaintainTargets(profile);
  const suggestions = getSuggestions(profile, 1);
  const topSuggestion = suggestions[0];

  const isTraining = isTrainingDay(profile);
  const todaySplit = getTodaySplit(profile);
  const phaseInfo = profile.mode === 'pcos' ? getCurrentPhase(profile) : null;
  const todayKey = new Date().toISOString().split('T')[0];
  const weekKey = startOfWeekKey(new Date());
  const habitSettings = {
    ...defaultHabitSettings(),
    ...(profile.habitSettings ?? {}),
    reminders: {
      ...defaultHabitSettings().reminders,
      ...(profile.habitSettings?.reminders ?? {}),
    },
  };
  const todaySteps = profile.stepHistory?.find((entry) => entry.date === todayKey)?.value ?? 0;
  const stepsDoneToday = todaySteps >= habitSettings.stepGoal;
  const todayWater = profile.waterHistory?.find((entry) => entry.date === todayKey)?.value ?? 0;
  const workoutsThisWeek = (profile.workoutHistory ?? []).filter(
    (entry) => entry.completed && startOfWeekKey(new Date(entry.date)) === weekKey
  ).length;
  const workoutDoneToday = (profile.workoutHistory ?? []).some((entry) => entry.date === todayKey && entry.completed);
  const cheatMealsThisWeek = (profile.cheatMeals ?? []).filter((meal) => startOfWeekKey(new Date(meal.date)) === weekKey).length;
  const searchItems = [
    { label: copy.dashboard.search.items.meals, detail: copy.dashboard.shortcutDetails.meals(todayMeals.length), path: '/log?tab=meals' },
    { label: copy.dashboard.search.items.ingredients, detail: copy.dashboard.shortcutDetails.ingredients, path: '/log?tab=ingredients' },
    { label: copy.dashboard.search.items.weight, detail: copy.dashboard.shortcutDetails.weightHistory, path: '/progress?section=weight' },
    { label: copy.dashboard.search.items.period, detail: copy.progress.cycleTracking, path: '/progress?section=cycle' },
    { label: copy.dashboard.search.items.symptoms, detail: copy.progress.symptomCheckin, path: '/progress?section=symptoms' },
    { label: copy.dashboard.search.items.cheatMeals, detail: copy.cheatMeals.title, path: '/cheat-meals' },
    { label: copy.dashboard.search.items.steps, detail: copy.wellness.steps.title, path: '/wellness?section=steps' },
    { label: copy.dashboard.search.items.workouts, detail: copy.wellness.workouts.title, path: '/wellness?section=workouts' },
    { label: copy.dashboard.search.items.water, detail: copy.wellness.water.title, path: '/wellness?section=water' },
  ];
  const normalizedSearch = globalSearch.trim().toLowerCase();
  const searchResults = normalizedSearch
    ? searchItems.filter((item) => `${item.label} ${item.detail}`.toLowerCase().includes(normalizedSearch)).slice(0, 5)
    : [];

  return (
    <>
      <div className="main-content overflow-y-auto min-h-screen">
      {/* PCOS Phase strip */}
      {profile.mode === 'pcos' && phaseInfo && (
        <div
          className="px-5 py-2 text-xs font-medium text-center cursor-pointer"
          style={{ backgroundColor: getPhaseColor(phaseInfo.phase) + '25', color: getPhaseColor(phaseInfo.phase) }}
          onClick={() => navigate('/progress')}
        >
          {phaseName(phaseInfo.phase, language)} · {copy.dashboard.day} {phaseInfo.cycleDay}
          {phaseInfo.phase === 'luteal' && ` · +150 ${copy.common.kcal}`}
          {phaseInfo.phase === 'ovulatory' && ` · −50 ${copy.common.kcal}`}
          {phaseInfo.confidence !== 'high' && (
            <span className="ml-1 opacity-60">({copy.dashboard.estimate})</span>
          )}
        </div>
      )}

      <div className="px-5 pt-4 pb-3 flex items-center justify-between">
        <div>
          <p className="text-xs text-ink-40">{formatDateValue(new Date(), language, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          <h1 className="text-lg font-semibold text-plum-dark mt-0.5">
            {greetingByHour(language, copy.dashboard.greetings)}, {profile.name}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {/* Bulk: training day badge */}
          {profile.mode === 'bulk' && (
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
              isTraining ? 'bg-coral-accent/15 text-coral-accent' : 'bg-sand text-ink-60'
            }`}>
              {isTraining ? `${copy.dashboard.training} · ${todaySplit ?? copy.dashboard.day}` : copy.dashboard.restDay}
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
            <StatChip label={copy.common.fiber} value={`${Math.round(totals.fiber_g)}/${targets.fiber_g ?? 30}g`} emoji="🌾" />
            <StatChip label={copy.common.omega3} value={`${((totals.omega3_g ?? 0)).toFixed(1)}g`} emoji="🐟" />
            <StatChip label="GL" value={String(Math.round(totals.glycemic_load ?? 0))} emoji="📊" sublabel={`/ ${targets.max_glycemic_load ?? 100}`} />
          </>
        ) : (
          <>
            <StatChip label={copy.common.protein} value={`${Math.round(totals.protein_g)}/${Math.round(targets.protein_g)}g`} emoji="🥩" />
            <StatChip label={copy.common.carbs} value={`${Math.round(totals.carbs_g)}g`} emoji="🍚" />
            <StatChip label={copy.common.fat} value={`${Math.round(totals.fat_g)}g`} emoji="🥑" />
            <StatChip label={copy.common.meals} value={`${todayMeals.length}/${targets.meals_per_day_target ?? 5}`} emoji="🍽️" />
          </>
        )}
      </div>

      <button
        onClick={() => navigate('/progress?section=weight')}
        data-testid="dashboard-weight-update"
        className="mx-5 mt-3 w-[calc(100%-2.5rem)] bg-cream-card rounded-2xl border border-sand/60 px-4 py-3 flex items-center gap-3 text-left shadow-sm"
      >
        <div className="w-9 h-9 rounded-full bg-sage-primary/15 flex items-center justify-center text-sage-deep">
          <Scale size={17} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-ink-40 uppercase tracking-wide">{copy.dashboard.weightCheckIn}</p>
          <p className="text-sm text-plum-dark">
            {formatWeightGoal(profile.demographics.weight_kg, profile.demographics.goal_weight_kg, language, copy.dashboard.goal)}
          </p>
        </div>
        <ChevronRight size={16} className={`text-ink-40 ${directionalIconClass(language)}`} />
      </button>

      <div className="mx-5 mt-3 rounded-2xl border border-sand/60 bg-cream-card p-3 shadow-sm" data-testid="dashboard-global-search">
        <label className="flex items-center gap-2 rounded-xl border border-sand bg-cream-bg px-3 py-2">
          <Search size={15} className="text-ink-40" />
          <input
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
            placeholder={copy.dashboard.search.placeholder}
            className="min-w-0 flex-1 bg-transparent text-sm text-plum-dark outline-none placeholder:text-ink-40"
            data-testid="dashboard-global-search-input"
          />
        </label>
        {searchResults.length > 0 && (
          <div className="mt-2 space-y-1" data-testid="dashboard-global-search-results">
            {searchResults.map((item) => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className="flex w-full items-center justify-between gap-3 rounded-xl bg-sand/35 px-3 py-2 text-left"
              >
                <span>
                  <span className="block text-xs font-semibold text-plum-dark">{item.label}</span>
                  <span className="block text-[10px] text-ink-40">{item.detail}</span>
                </span>
                <ChevronRight size={14} className={`text-ink-40 ${directionalIconClass(language)}`} />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mx-5 mt-3 bg-cream-card rounded-2xl border border-sand/60 p-3 shadow-sm" data-testid="dashboard-quick-log">
        <p className="text-xs font-semibold text-ink-40 uppercase tracking-wide">{copy.dashboard.quickLogTitle}</p>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <ShortcutButton
            testId="dashboard-shortcut-meals"
            icon={<UtensilsCrossed size={15} />}
            label={copy.dashboard.shortcuts.meals}
            detail={copy.dashboard.shortcutDetails.meals(todayMeals.length)}
            onClick={() => navigate('/log?tab=meals')}
          />
          <ShortcutButton
            testId="dashboard-shortcut-ingredients"
            icon={<Carrot size={15} />}
            label={copy.dashboard.shortcuts.ingredients}
            detail={copy.dashboard.shortcutDetails.ingredients}
            onClick={() => navigate('/log?tab=ingredients')}
          />
          <ShortcutButton
            testId="dashboard-shortcut-weight-log"
            icon={<Scale size={15} />}
            label={copy.dashboard.shortcuts.logWeight}
            detail={formatAmountWithUnit(profile.demographics.weight_kg, 'kg', language, 1)}
            onClick={() => setShowWeightSheet(true)}
          />
          <ShortcutButton
            testId="dashboard-shortcut-weight-history"
            icon={<LineChart size={15} />}
            label={copy.dashboard.shortcuts.weightHistory}
            detail={copy.dashboard.shortcutDetails.weightHistory}
            onClick={() => navigate('/progress?section=weight')}
          />
          <ShortcutButton
            testId="dashboard-shortcut-cheat-meals"
            icon={<Cookie size={15} />}
            label={copy.dashboard.shortcuts.cheatMeals}
            detail={copy.dashboard.shortcutDetails.cheatMeals(cheatMealsThisWeek)}
            onClick={() => navigate('/cheat-meals')}
          />
          <FastHabitShortcutButton
            testId="dashboard-shortcut-steps"
            toggleTestId="dashboard-steps-toggle"
            historyTestId="dashboard-steps-open-history"
            icon={<Footprints size={15} />}
            label={copy.dashboard.shortcuts.steps}
            detail={stepsDoneToday ? copy.dashboard.stepDone : copy.dashboard.stepTapToComplete}
            done={stepsDoneToday}
            onToggle={() => logSteps(profile.id, todayKey, stepsDoneToday ? 0 : habitSettings.stepGoal)}
            onOpen={() => navigate('/wellness?section=steps')}
          />
          <FastHabitShortcutButton
            testId="dashboard-shortcut-workouts"
            toggleTestId="dashboard-workout-toggle"
            historyTestId="dashboard-workout-open-history"
            icon={<Dumbbell size={15} />}
            label={copy.dashboard.shortcuts.workouts}
            detail={workoutDoneToday ? copy.dashboard.workoutDone : copy.dashboard.workoutTapToComplete(workoutsThisWeek, habitSettings.workoutGoalPerWeek)}
            done={workoutDoneToday}
            onToggle={() => toggleWorkoutLog(profile.id, todayKey)}
            onOpen={() => navigate('/wellness?section=workouts')}
          />
          <ShortcutButton
            testId="dashboard-shortcut-water"
            icon={<Droplets size={15} />}
            label={copy.dashboard.shortcuts.water}
            detail={`${todayWater}/${habitSettings.waterGoalMl} ml`}
            onClick={() => navigate('/wellness?section=water')}
          />
        </div>
      </div>

      {/* Today's meals */}
      <div className="px-5 mt-5">
        <h2 className="text-sm font-semibold text-ink-60 uppercase tracking-wide mb-3">{copy.dashboard.todaysMeals}</h2>
        {todayMeals.length === 0 ? (
          <div className="bg-cream-card rounded-2xl p-6 text-center border border-sand/40">
            <p className="text-ink-40 text-sm">{copy.dashboard.noMeals}</p>
            <button
              onClick={() => navigate('/log')}
              className="mt-3 text-sm font-medium text-coral-accent"
            >
              {copy.dashboard.logFirstMeal} {directionalArrow(language)}
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
                  onViewNutrition={() => setNutritionMeal(meal)}
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
                {profile.mode === 'bulk' && isTraining ? copy.dashboard.trainingSuggestion : copy.dashboard.nextMealInsight}
              </span>
            </div>
          </div>
          <div className="px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <p className="font-medium text-plum-dark text-sm leading-snug">{mealDisplayName(topSuggestion, language)}</p>
                <div className="flex items-center gap-2 mt-1">
                  <ScoreBadge score={topSuggestion.pcos_score} size="sm" />
                  <span className="text-xs text-ink-40">{formatAmountWithUnit(topSuggestion.nutrition.calories, copy.common.kcal, language)}</span>
                  <span className="text-xs text-ink-40">·</span>
                  <span className="text-xs text-ink-40">{formatAmountWithUnit(topSuggestion.prep_time_min, language === 'he' ? 'דק׳' : 'min', language)}</span>
                </div>
                {topSuggestion.closedGaps.length > 0 && (
                  <p className="text-xs text-moss mt-1.5">
                    {copy.dashboard.closes}: {topSuggestion.closedGaps.map((g) => `✓ ${g}`).join('  ')}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={() => navigate('/suggestions')}
              className="w-full mt-3 flex items-center justify-center gap-1 text-sm font-medium text-coral-accent"
            >
              {copy.dashboard.seeMoreOptions} <ChevronRight size={15} className={directionalIconClass(language)} />
            </button>
          </div>
        </div>
      )}

      {/* Remaining needs */}
      {profile.mode === 'bulk' && (
        <div className="mx-5 mt-3 mb-2 bg-sand/60 rounded-2xl px-4 py-3">
          <p className="text-xs text-ink-60">
            {copy.dashboard.stillNeedToday}{' '}
            <span className="font-semibold text-plum-dark">
              {formatCompactAmount(Math.round(Math.max(0, targets.protein_g - totals.protein_g)), `g ${copy.common.protein}`, language, 0)}
            </span>
            {', '}
            <span className="font-semibold text-plum-dark">
              {formatCompactAmount(Math.round(Math.max(0, (targets.carbs_training_day ?? targets.carbs_g) - totals.carbs_g)), `g ${copy.common.carbs}`, language, 0)}
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

      {showWeightSheet && (
        <WeightUpdateSheet
          profileId={profile.id}
          currentWeight={profile.demographics.weight_kg}
          goalWeight={profile.demographics.goal_weight_kg}
          onClose={() => setShowWeightSheet(false)}
        />
      )}

      {nutritionMeal && (
        <NutritionDetailSheet
          title={nutritionMeal.name}
          subtitle={hasMicronutrientData(nutritionMeal.nutrition.micronutrients)
            ? `${countMicronutrients(nutritionMeal.nutrition.micronutrients)} micronutrients logged`
            : 'Micronutrients were not available for this meal'}
          nutritionPer100g={scaleNutrition(nutritionMeal.nutrition, 100 / nutritionMeal.serving_g)}
          servingG={nutritionMeal.serving_g}
          servingLabel={`${nutritionMeal.serving_g} g`}
          onClose={() => setNutritionMeal(null)}
        />
      )}
    </>
  );
}

function WeightUpdateSheet({
  profileId,
  currentWeight,
  goalWeight,
  onClose,
}: {
  profileId: string;
  currentWeight: number;
  goalWeight: number;
  onClose: () => void;
}) {
  const { copy, language } = useI18n();
  const logWeight = useAppStore((s) => s.logWeight);
  const [weightText, setWeightText] = useState(String(currentWeight));
  const parsed = Number(weightText);
  const canSave = Number.isFinite(parsed) && parsed >= 20 && parsed <= 300;

  function save() {
    if (!canSave) return;
    logWeight(profileId, Math.round(parsed * 10) / 10);
    onClose();
  }

  return (
    <BottomSheet onClose={onClose}>
      <div className="p-5 pb-safe space-y-4" data-testid="weight-update-sheet">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-plum-dark">{copy.dashboard.updateWeight}</h3>
          <button onClick={onClose} className="tap-target flex items-center justify-center">
            <X size={20} className="text-ink-40" />
          </button>
        </div>

        <div>
          <label className="text-xs text-ink-40 block mb-1.5">{copy.dashboard.currentWeightKg}</label>
          <input
            autoFocus
            type="number"
            inputMode="decimal"
            min="20"
            max="300"
            step="0.1"
            value={weightText}
            onChange={(e) => setWeightText(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-sand bg-cream-card text-plum-dark text-center font-mono-num focus:outline-none focus:border-sage-primary"
            data-testid="dashboard-weight-input"
          />
          <p className="text-xs text-ink-40 mt-2 text-center">
            {copy.dashboard.currentGoal}: {formatAmountWithUnit(goalWeight, 'kg', language)}. {copy.dashboard.goalAuto}
          </p>
        </div>

        <button
          onClick={save}
          disabled={!canSave}
          className={`w-full py-3.5 rounded-2xl font-semibold ${
            canSave ? 'bg-sage-deep text-white' : 'bg-sand text-ink-40'
          }`}
          data-testid="dashboard-weight-save"
        >
          {copy.dashboard.saveWeight}
        </button>
      </div>
    </BottomSheet>
  );
}

function ShortcutButton({
  icon,
  label,
  detail,
  onClick,
  testId,
}: {
  icon: ReactNode;
  label: string;
  detail?: string;
  onClick: () => void;
  testId: string;
}) {
  return (
    <button
      onClick={onClick}
      data-testid={testId}
      className="rounded-xl border border-sand bg-cream-bg px-3 py-2.5 text-left flex items-center gap-2.5 hover:bg-sand/40 transition-colors"
    >
      <span className="w-7 h-7 rounded-lg bg-sage-primary/15 text-sage-deep flex items-center justify-center flex-shrink-0">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-semibold text-plum-dark leading-tight">{label}</span>
        {detail && <span className="block text-[10px] text-ink-40 mt-0.5 truncate">{detail}</span>}
      </span>
    </button>
  );
}

function FastHabitShortcutButton({
  icon,
  label,
  detail,
  done,
  onToggle,
  onOpen,
  testId,
  toggleTestId,
  historyTestId,
}: {
  icon: ReactNode;
  label: string;
  detail: string;
  done: boolean;
  onToggle: () => void;
  onOpen: () => void;
  testId: string;
  toggleTestId: string;
  historyTestId: string;
}) {
  return (
    <div
      data-testid={testId}
      className={`rounded-xl border px-3 py-2.5 flex items-center gap-2.5 transition-colors ${
        done ? 'border-sage-primary bg-sage-primary/10' : 'border-sand bg-cream-bg'
      }`}
    >
      <button
        onClick={onToggle}
        className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg ${
          done ? 'bg-sage-deep text-white' : 'bg-sage-primary/15 text-sage-deep'
        }`}
        aria-label={detail}
        data-testid={toggleTestId}
      >
        {done ? <Check size={15} /> : icon}
      </button>
      <button onClick={onOpen} className="min-w-0 flex-1 text-left" data-testid={historyTestId}>
        <span className="block text-xs font-semibold text-plum-dark leading-tight">{label}</span>
        <span className="block truncate text-[10px] text-ink-40 mt-0.5">{detail}</span>
      </button>
    </div>
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
  const { copy, language } = useI18n();
  const updateMeal = useAppStore((s) => s.updateMeal);

  const [name, setName] = useState(meal.name);
  const [mealType, setMealType] = useState<LoggedMeal['meal_type']>(meal.meal_type);
  const [servingText, setServingText] = useState(String(meal.serving_g));

  const newServing = Math.max(1, Number(servingText) || meal.serving_g);
  const scale = newServing / meal.serving_g;

  function save() {
    const scaledNutrition = scaleNutrition(meal.nutrition, scale);
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
    <BottomSheet onClose={onClose}>
      <div className="p-5 pb-safe space-y-4" data-testid="edit-meal-sheet">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-plum-dark">{copy.dashboard.editMeal}</h3>
          <button onClick={onClose} className="tap-target flex items-center justify-center">
            <X size={20} className="text-ink-40" />
          </button>
        </div>

        {/* Name */}
        <div>
          <label className="text-xs text-ink-40 block mb-1.5">{copy.dashboard.mealName}</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-sand bg-cream-card text-plum-dark focus:outline-none focus:border-sage-primary"
            data-testid="edit-meal-name"
          />
        </div>

        {/* Meal type */}
        <div>
          <label className="text-xs text-ink-40 block mb-1.5">{copy.dashboard.mealType}</label>
          <div className="flex gap-2 flex-wrap">
            {MEAL_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => setMealType(t)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-all ${
                  mealType === t ? 'bg-sage-deep text-white' : 'bg-sand text-ink-60'
                }`}
              >
                {mealTypeLabel(t, language)}
              </button>
            ))}
          </div>
        </div>

        {/* Serving */}
        <div>
          <label className="text-xs text-ink-40 block mb-1.5">{copy.dashboard.servingG}</label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              inputMode="decimal"
              value={servingText}
              onChange={(e) => setServingText(e.target.value)}
              className="flex-1 px-4 py-3 rounded-xl border border-sand bg-cream-card text-plum-dark text-center focus:outline-none focus:border-sage-primary"
              data-testid="edit-meal-serving"
            />
          </div>
          {scale !== 1 && (
            <p className="text-xs text-ink-40 mt-1 text-center">
              {directionalArrow(language)} {formatAmountWithUnit(Math.round(meal.nutrition.calories * scale), copy.common.kcal, language)} · {formatCompactAmount(Math.round(meal.nutrition.protein_g * scale * 10) / 10, `g ${copy.common.protein}`, language)}
            </p>
          )}
        </div>

        <button
          onClick={save}
          className="w-full bg-sage-deep text-white py-3.5 rounded-2xl font-semibold"
          data-testid="edit-meal-save"
        >
          {copy.common.save}
        </button>
      </div>
    </BottomSheet>
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

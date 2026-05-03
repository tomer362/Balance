import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, ChevronDown, ChevronUp, Plus, Search, Trash2 } from 'lucide-react';
import { selectActiveProfile, useAppStore } from '../store/appStore';
import type { CheatMeal, NutritionData } from '../store/appStore';
import { directionalIconClass, formatDateValue, useI18n } from '../lib/i18n';
import { cheatMealCatalogue, cheatMealCategories } from '../data/cheatMealDatabase';
import type { CheatMealCatalogueItem } from '../data/cheatMealDatabase';

const BASE_WEEKLY_ALLOWANCE = 2;

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function startOfWeek(date: Date): Date {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function isoDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function weekKey(date: string): string {
  return isoDate(startOfWeek(new Date(date)));
}

function countMealsInWeek(meals: CheatMeal[], weekStart: string): number {
  return meals.filter((meal) => weekKey(meal.date) === weekStart).length;
}

function buildWeekStats(meals: CheatMeal[], targetWeekStart: string) {
  const mealWeeks = meals.map((meal) => weekKey(meal.date));
  const earliestWeek = [...mealWeeks, targetWeekStart].sort()[0];
  let cursor = new Date(earliestWeek);
  const target = new Date(targetWeekStart);
  let debt = 0;
  let result = {
    weekStart: targetWeekStart,
    allowance: BASE_WEEKLY_ALLOWANCE,
    used: 0,
    remaining: BASE_WEEKLY_ALLOWANCE,
    overage: 0,
    nextWeekAllowance: BASE_WEEKLY_ALLOWANCE,
  };

  while (cursor <= target) {
    const currentWeek = isoDate(cursor);
    const allowance = Math.max(0, BASE_WEEKLY_ALLOWANCE - debt);
    const used = countMealsInWeek(meals, currentWeek);
    const overage = Math.max(0, used - allowance);
    const remaining = Math.max(0, allowance - used);
    debt = overage;

    if (currentWeek === targetWeekStart) {
      result = {
        weekStart: currentWeek,
        allowance,
        used,
        remaining,
        overage,
        nextWeekAllowance: Math.max(0, BASE_WEEKLY_ALLOWANCE - debt),
      };
    }

    cursor = addDays(cursor, 7);
  }

  return result;
}

export default function CheatMeals() {
  const { copy, language } = useI18n();
  const navigate = useNavigate();
  const profile = useAppStore(selectActiveProfile);
  const logCheatMeal = useAppStore((s) => s.logCheatMeal);
  const deleteCheatMeal = useAppStore((s) => s.deleteCheatMeal);

  // Detailed-form state
  const [date, setDate] = useState(todayStr());
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [showNutritionSection, setShowNutritionSection] = useState(false);
  const [catalogueSearch, setCatalogueSearch] = useState('');
  const [selectedCatalogueItem, setSelectedCatalogueItem] = useState<CheatMealCatalogueItem | null>(null);
  const [useCustomName, setUseCustomName] = useState(false);

  const meals = useMemo(() => [...(profile?.cheatMeals ?? [])].sort((a, b) => b.date.localeCompare(a.date)), [profile]);
  const currentWeekStart = weekKey(todayStr());
  const nextWeekStart = isoDate(addDays(new Date(currentWeekStart), 7));
  const currentStats = buildWeekStats(meals, currentWeekStart);
  const nextStats = buildWeekStats(meals, nextWeekStart);
  const currentWeekMeals = meals.filter((meal) => weekKey(meal.date) === currentWeekStart);

  // Quick tick: find if a isQuickTick entry already exists for today
  const todayQuickTick = meals.find((m) => m.isQuickTick && m.date === todayStr());

  // Catalogue search filtering
  const filteredCatalogue = useMemo(() => {
    const q = catalogueSearch.toLowerCase().trim();
    if (!q) return cheatMealCatalogue;
    return cheatMealCatalogue.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        cheatMealCategories[item.category].toLowerCase().includes(q),
    );
  }, [catalogueSearch]);

  if (!profile) return null;

  function handleQuickTick() {
    if (todayQuickTick) {
      deleteCheatMeal(profile!.id, todayQuickTick.id);
    } else {
      logCheatMeal(profile!.id, {
        id: `cheat-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        date: todayStr(),
        name: 'Cheat meal',
        isQuickTick: true,
      });
    }
  }

  function handleSelectCatalogueItem(item: CheatMealCatalogueItem) {
    setSelectedCatalogueItem(item);
    setUseCustomName(false);
    if (!useCustomName) setName(item.name);
    setCatalogueSearch('');
  }

  function addMeal() {
    const resolvedName = selectedCatalogueItem && !useCustomName ? selectedCatalogueItem.name : name.trim();
    if (!resolvedName) return;

    const nutrition: NutritionData | undefined =
      selectedCatalogueItem && !useCustomName ? selectedCatalogueItem.nutrition : undefined;

    logCheatMeal(profile!.id, {
      id: `cheat-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      date,
      name: resolvedName,
      notes: notes.trim() || undefined,
      nutrition,
      selectedCheatId: selectedCatalogueItem && !useCustomName ? selectedCatalogueItem.id : undefined,
    });

    // Reset form
    setName('');
    setNotes('');
    setSelectedCatalogueItem(null);
    setUseCustomName(false);
    setShowNutritionSection(false);
    setCatalogueSearch('');
  }

  const canAdd = selectedCatalogueItem && !useCustomName ? true : name.trim().length > 0;

  return (
    <div className="main-content min-h-screen bg-cream-bg">
      <div className="sticky top-0 z-10 bg-cream-bg px-4 pt-4 pb-3 border-b border-sand/50">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="tap-target flex items-center justify-center rounded-full hover:bg-sand transition-colors">
            <ArrowLeft size={20} className={`text-plum-dark ${directionalIconClass(language)}`} />
          </button>
          <div>
            <h1 className="font-semibold text-plum-dark">{copy.cheatMeals.title}</h1>
            <p className="text-xs text-ink-40">{copy.cheatMeals.subtitle}</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* ── Quick tick ───────────────────────────────────────────────── */}
        <button
          onClick={handleQuickTick}
          data-testid="cheat-quick-tick"
          className={`w-full rounded-3xl border p-4 flex items-center gap-3 transition-colors ${
            todayQuickTick
              ? 'border-sage-deep bg-sage-primary/10'
              : 'border-sand bg-cream-card hover:bg-sand/30'
          }`}
        >
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
            todayQuickTick ? 'border-sage-deep bg-sage-deep text-white' : 'border-sand bg-cream-bg text-ink-40'
          }`}>
            <Check size={18} strokeWidth={3} />
          </div>
          <div className="text-left flex-1">
            <p className={`text-sm font-semibold ${todayQuickTick ? 'text-sage-deep' : 'text-plum-dark'}`}>
              {todayQuickTick ? copy.cheatMeals.quickTickDone : copy.cheatMeals.quickTickPrompt}
            </p>
            {todayQuickTick && (
              <p className="text-xs text-ink-40">{copy.cheatMeals.quickTickRemove}</p>
            )}
          </div>
        </button>

        {/* ── Stats ────────────────────────────────────────────────────── */}
        <div className="rounded-3xl border border-sand bg-cream-card p-4" data-testid="cheat-meal-stats">
          <div className="grid grid-cols-3 gap-2">
            <Metric label={copy.cheatMeals.allowedThisWeek} value={String(currentStats.allowance)} />
            <Metric label={copy.cheatMeals.usedThisWeek} value={String(currentStats.used)} />
            <Metric label={copy.cheatMeals.nextWeek} value={String(nextStats.allowance)} />
          </div>
          <p className={`mt-3 rounded-2xl px-3 py-2 text-xs ${currentStats.overage > 0 ? 'bg-terracotta/10 text-terracotta' : 'bg-sage-primary/10 text-sage-deep'}`}>
            {currentStats.overage > 0
              ? copy.cheatMeals.overLimit(currentStats.overage, currentStats.nextWeekAllowance)
              : copy.cheatMeals.remaining(currentStats.remaining)}
          </p>
          <p className="mt-2 text-xs text-ink-40">{copy.cheatMeals.rule}</p>
        </div>

        {/* ── Detailed log form ─────────────────────────────────────────── */}
        <div className="rounded-3xl border border-sand bg-cream-card p-4 space-y-3" data-testid="cheat-meal-form">
          <h2 className="text-sm font-semibold text-plum-dark">{copy.cheatMeals.logTitle}</h2>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[0.9fr_1.1fr] sm:items-end">
            <label className="flex flex-col text-xs text-ink-60">
              {copy.cheatMeals.date}
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 h-10 w-full rounded-xl border border-sand bg-cream-bg px-3 py-2 text-sm text-plum-dark"
                data-testid="cheat-date-input"
              />
            </label>
            <label className="flex flex-col text-xs text-ink-60">
              {copy.cheatMeals.name}
              <input
                value={selectedCatalogueItem && !useCustomName ? selectedCatalogueItem.name : name}
                onChange={(e) => {
                  setName(e.target.value);
                  setUseCustomName(true);
                  setSelectedCatalogueItem(null);
                }}
                placeholder={copy.cheatMeals.namePlaceholder}
                className="mt-1 h-10 w-full rounded-xl border border-sand bg-cream-bg px-3 py-2 text-sm text-plum-dark"
                data-testid="cheat-name-input"
              />
            </label>
          </div>

          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={copy.cheatMeals.notesPlaceholder}
            className="min-h-16 w-full rounded-xl border border-sand bg-cream-bg px-3 py-2 text-sm text-plum-dark"
            data-testid="cheat-notes-input"
          />

          {/* Nutrition details accordion */}
          <button
            type="button"
            onClick={() => setShowNutritionSection((v) => !v)}
            className="flex w-full items-center justify-between rounded-xl border border-sand bg-cream-bg px-3 py-2 text-xs text-ink-60 hover:bg-sand/30 transition-colors"
            data-testid="cheat-nutrition-toggle"
          >
            <span className="font-medium text-plum-dark">{copy.cheatMeals.addNutritionDetails}</span>
            {showNutritionSection ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>

          {showNutritionSection && (
            <div className="space-y-3 rounded-2xl border border-sand bg-cream-bg p-3">
              <p className="text-xs font-semibold text-plum-dark">{copy.cheatMeals.catalogueTitle}</p>

              {/* Search */}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-40" />
                <input
                  value={catalogueSearch}
                  onChange={(e) => setCatalogueSearch(e.target.value)}
                  placeholder={copy.cheatMeals.catalogueSearch}
                  className="h-9 w-full rounded-xl border border-sand bg-cream-card pl-8 pr-3 text-sm text-plum-dark"
                  data-testid="cheat-catalogue-search"
                />
              </div>

              {/* Selected item preview */}
              {selectedCatalogueItem && !useCustomName && (
                <div className="rounded-xl bg-sage-primary/10 border border-sage-primary/30 px-3 py-2">
                  <p className="text-xs font-semibold text-sage-deep">{selectedCatalogueItem.name}</p>
                  <p className="text-[11px] text-ink-60 mt-0.5">
                    {copy.cheatMeals.nutritionSummary(
                      selectedCatalogueItem.nutrition.calories,
                      selectedCatalogueItem.nutrition.protein_g,
                    )}
                    {' · '}
                    {selectedCatalogueItem.servingDescription}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-ink-40">
                    <span>Carbs {selectedCatalogueItem.nutrition.carbs_g}g</span>
                    <span>Fat {selectedCatalogueItem.nutrition.fat_g}g</span>
                    <span>Sat.fat {selectedCatalogueItem.nutrition.saturated_fat_g}g</span>
                    <span>Fiber {selectedCatalogueItem.nutrition.fiber_g}g</span>
                    <span>Sugar {selectedCatalogueItem.nutrition.sugar_g}g</span>
                    <span>Sodium {selectedCatalogueItem.nutrition.sodium_mg}mg</span>
                  </div>
                </div>
              )}

              {/* Catalogue list */}
              <div className="max-h-56 overflow-y-auto space-y-1 pr-0.5" data-testid="cheat-catalogue-list">
                {filteredCatalogue.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectCatalogueItem(item)}
                    className={`w-full rounded-xl border px-3 py-2 text-left transition-colors ${
                      selectedCatalogueItem?.id === item.id && !useCustomName
                        ? 'border-sage-deep bg-sage-primary/10'
                        : 'border-sand bg-cream-card hover:bg-sand/30'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-plum-dark leading-snug">{item.name}</p>
                      <span className="shrink-0 rounded-full bg-sand px-2 py-0.5 text-[9px] uppercase tracking-wide text-ink-40">
                        {cheatMealCategories[item.category]}
                      </span>
                    </div>
                    <p className="text-[10px] text-ink-40 mt-0.5">
                      {item.nutrition.calories} kcal · {item.nutrition.protein_g}g protein · {item.servingDescription}
                    </p>
                  </button>
                ))}
              </div>

              {/* Custom mode link */}
              <button
                type="button"
                onClick={() => {
                  setUseCustomName(true);
                  setSelectedCatalogueItem(null);
                  setShowNutritionSection(false);
                }}
                className="text-xs text-ink-40 hover:text-plum-dark underline underline-offset-2"
              >
                {copy.cheatMeals.customEntry}
              </button>
            </div>
          )}

          <button
            onClick={addMeal}
            disabled={!canAdd}
            className={`w-full rounded-2xl py-3 text-sm font-semibold ${canAdd ? 'bg-sage-deep text-white' : 'bg-sand text-ink-40'}`}
            data-testid="cheat-save"
          >
            <Plus size={16} className="inline-block" /> {copy.cheatMeals.add}
          </button>
        </div>

        {/* ── This week ────────────────────────────────────────────────── */}
        <div className="rounded-3xl border border-sand bg-cream-card p-4" data-testid="cheat-current-week">
          <h2 className="text-sm font-semibold text-plum-dark mb-3">{copy.cheatMeals.currentWeek}</h2>
          {currentWeekMeals.length === 0 ? (
            <p className="text-sm text-ink-40">{copy.cheatMeals.emptyWeek}</p>
          ) : (
            <div className="space-y-2">
              {currentWeekMeals.map((meal) => (
                <MealRow
                  key={meal.id}
                  meal={meal}
                  language={language}
                  nutritionSummaryLabel={copy.cheatMeals.nutritionSummary}
                  onDelete={() => deleteCheatMeal(profile.id, meal.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── History ───────────────────────────────────────────────────── */}
        <div className="rounded-3xl border border-sand bg-cream-card p-4" data-testid="cheat-history">
          <h2 className="text-sm font-semibold text-plum-dark mb-3">{copy.cheatMeals.history}</h2>
          {meals.length === 0 ? (
            <p className="text-sm text-ink-40">{copy.cheatMeals.emptyHistory}</p>
          ) : (
            <div className="space-y-2">
              {meals.slice(0, 12).map((meal) => (
                <MealRow
                  key={meal.id}
                  meal={meal}
                  language={language}
                  nutritionSummaryLabel={copy.cheatMeals.nutritionSummary}
                  onDelete={() => deleteCheatMeal(profile.id, meal.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-sand/40 px-3 py-3 text-center">
      <p className="text-xl font-semibold text-plum-dark font-mono-num">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-ink-40">{label}</p>
    </div>
  );
}

function MealRow({
  meal,
  language,
  nutritionSummaryLabel,
  onDelete,
}: {
  meal: CheatMeal;
  language: 'en' | 'he';
  nutritionSummaryLabel: (kcal: number, protein: number) => string;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-sand bg-cream-bg px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-plum-dark truncate">{meal.name}</p>
        <p className="text-xs text-ink-40">
          {formatDateValue(new Date(meal.date), language, { month: 'short', day: 'numeric' })}
          {meal.notes ? ` · ${meal.notes}` : ''}
        </p>
        {meal.nutrition && (
          <p className="text-[11px] text-sage-deep mt-0.5">
            {nutritionSummaryLabel(meal.nutrition.calories, meal.nutrition.protein_g)}
          </p>
        )}
      </div>
      <button onClick={onDelete} className="tap-target flex items-center justify-center text-terracotta">
        <Trash2 size={15} />
      </button>
    </div>
  );
}

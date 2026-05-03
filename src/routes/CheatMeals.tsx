import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { selectActiveProfile, useAppStore } from '../store/appStore';
import type { CheatMeal } from '../store/appStore';
import { directionalIconClass, formatDateValue, useI18n } from '../lib/i18n';

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

  const [date, setDate] = useState(todayStr());
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');

  const meals = useMemo(() => [...(profile?.cheatMeals ?? [])].sort((a, b) => b.date.localeCompare(a.date)), [profile]);
  const currentWeekStart = weekKey(todayStr());
  const nextWeekStart = isoDate(addDays(new Date(currentWeekStart), 7));
  const currentStats = buildWeekStats(meals, currentWeekStart);
  const nextStats = buildWeekStats(meals, nextWeekStart);
  const currentWeekMeals = meals.filter((meal) => weekKey(meal.date) === currentWeekStart);

  if (!profile) return null;

  function addMeal() {
    const trimmed = name.trim();
    if (!trimmed) return;
    logCheatMeal(profile!.id, {
      id: `cheat-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      date,
      name: trimmed,
      notes: notes.trim() || undefined,
    });
    setName('');
    setNotes('');
  }

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

        <div className="rounded-3xl border border-sand bg-cream-card p-4 space-y-3" data-testid="cheat-meal-form">
          <h2 className="text-sm font-semibold text-plum-dark">{copy.cheatMeals.logTitle}</h2>
          <div className="grid grid-cols-[0.9fr_1.1fr] gap-2">
            <label className="text-xs text-ink-60">
              {copy.cheatMeals.date}
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 w-full rounded-xl border border-sand bg-cream-bg px-3 py-2 text-sm text-plum-dark"
                data-testid="cheat-date-input"
              />
            </label>
            <label className="text-xs text-ink-60">
              {copy.cheatMeals.name}
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={copy.cheatMeals.namePlaceholder}
                className="mt-1 w-full rounded-xl border border-sand bg-cream-bg px-3 py-2 text-sm text-plum-dark"
                data-testid="cheat-name-input"
              />
            </label>
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={copy.cheatMeals.notesPlaceholder}
            className="min-h-20 w-full rounded-xl border border-sand bg-cream-bg px-3 py-2 text-sm text-plum-dark"
            data-testid="cheat-notes-input"
          />
          <button
            onClick={addMeal}
            disabled={!name.trim()}
            className={`w-full rounded-2xl py-3 text-sm font-semibold ${name.trim() ? 'bg-sage-deep text-white' : 'bg-sand text-ink-40'}`}
            data-testid="cheat-save"
          >
            <Plus size={16} className="inline-block" /> {copy.cheatMeals.add}
          </button>
        </div>

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
                  onDelete={() => deleteCheatMeal(profile.id, meal.id)}
                />
              ))}
            </div>
          )}
        </div>

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
  onDelete,
}: {
  meal: CheatMeal;
  language: 'en' | 'he';
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
      </div>
      <button onClick={onDelete} className="tap-target flex items-center justify-center text-terracotta">
        <Trash2 size={15} />
      </button>
    </div>
  );
}

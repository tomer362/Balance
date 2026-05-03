import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ShoppingCart, Check, ChevronLeft, ChevronRight, X, Sparkles } from 'lucide-react';
import { useAppStore, selectActiveProfile } from '../store/appStore';
import type { MealItem } from '../store/appStore';
import { allMeals } from '../data/allMeals';
import { getSuggestions } from '../lib/suggestionEngine';
import ScoreBadge from '../components/ScoreBadge';
import { directionalIconClass, formatAmountWithUnit, formatDateValue, localizeFoodName, mealDisplayName, useI18n } from '../lib/i18n';

type Tab = 'plan' | 'list';
type SlotKey = 'breakfast' | 'lunch' | 'dinner';

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dateKey(date: Date): string {
  return date.toISOString().split('T')[0];
}

interface GroceryItem {
  id: string;
  name: string;
  amountG: number;
  category: 'produce' | 'fish_meat' | 'grains' | 'dairy' | 'pantry';
  checked: boolean;
}

const MEAL_GROCERY_ITEMS: Record<string, Array<Omit<GroceryItem, 'id' | 'checked'>>> = {
  'grilled-mackerel-lentils': [
    { name: 'Mackerel fillet', amountG: 150, category: 'fish_meat' },
    { name: 'Lentils', amountG: 80, category: 'grains' },
    { name: 'Kale', amountG: 80, category: 'produce' },
    { name: 'Lemon', amountG: 40, category: 'produce' },
  ],
  'greek-yogurt-berries-chia': [
    { name: 'Greek yogurt', amountG: 220, category: 'dairy' },
    { name: 'Mixed berries', amountG: 100, category: 'produce' },
    { name: 'Chia seeds', amountG: 20, category: 'pantry' },
  ],
  'quinoa-salmon-bowl': [
    { name: 'Salmon fillet', amountG: 150, category: 'fish_meat' },
    { name: 'Quinoa', amountG: 75, category: 'grains' },
    { name: 'Cucumber', amountG: 80, category: 'produce' },
    { name: 'Avocado', amountG: 70, category: 'produce' },
  ],
  'sardines-on-rye': [
    { name: 'Sardines', amountG: 90, category: 'fish_meat' },
    { name: 'Rye bread', amountG: 70, category: 'grains' },
    { name: 'Tomato', amountG: 80, category: 'produce' },
  ],
  'lentil-feta-salad': [
    { name: 'Lentils', amountG: 100, category: 'grains' },
    { name: 'Feta cheese', amountG: 50, category: 'dairy' },
    { name: 'Cherry tomatoes', amountG: 120, category: 'produce' },
    { name: 'Cucumber', amountG: 100, category: 'produce' },
  ],
  'chicken-rice-bowl': [
    { name: 'Chicken breast', amountG: 180, category: 'fish_meat' },
    { name: 'Rice', amountG: 100, category: 'grains' },
    { name: 'Broccoli', amountG: 120, category: 'produce' },
  ],
  'ground-beef-rice-veg': [
    { name: 'Ground beef', amountG: 170, category: 'fish_meat' },
    { name: 'Rice', amountG: 100, category: 'grains' },
    { name: 'Bell peppers', amountG: 100, category: 'produce' },
    { name: 'Zucchini', amountG: 100, category: 'produce' },
  ],
  'oats-whey-banana': [
    { name: 'Rolled oats', amountG: 80, category: 'grains' },
    { name: 'Whey protein', amountG: 30, category: 'pantry' },
    { name: 'Banana', amountG: 120, category: 'produce' },
  ],
  'chia-pudding-berries': [
    { name: 'Chia seeds', amountG: 35, category: 'pantry' },
    { name: 'Mixed berries', amountG: 120, category: 'produce' },
    { name: 'Walnuts', amountG: 25, category: 'pantry' },
  ],
  'cottage-cheese-berries': [
    { name: 'Cottage cheese', amountG: 220, category: 'dairy' },
    { name: 'Mixed berries', amountG: 100, category: 'produce' },
  ],
};

const CATEGORY_META = {
  produce: { label: '🥬 Produce', order: 0 },
  fish_meat: { label: '🐟 Fish & Meat', order: 1 },
  grains: { label: '🌾 Grains & Legumes', order: 2 },
  dairy: { label: '🥛 Dairy & Eggs', order: 3 },
  pantry: { label: '🥜 Pantry', order: 4 },
};

const SLOT_LABELS: Record<SlotKey, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
};

function formatAmount(g: number): string {
  if (g >= 1000) return `${Math.round((g / 1000) * 10) / 10} kg`;
  return `${Math.round(g)}g`;
}

function fallbackItemsForMeal(meal: MealItem): Array<Omit<GroceryItem, 'id' | 'checked'>> {
  return meal.name
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 4)
    .map((name) => ({ name, amountG: 150, category: 'pantry' as const }));
}

function getSwapSuggestionsForSlot(profile: NonNullable<ReturnType<typeof selectActiveProfile>>, slot: SlotKey, currentMealId?: string) {
  const topMatches = getSuggestions(profile, 24).filter(
    (meal) => meal.id !== currentMealId && meal.meal_types.includes(slot),
  );

  if (topMatches.length >= 3) return topMatches.slice(0, 3);

  const fallbackMatches: ReturnType<typeof getSuggestions> = allMeals
    .filter((meal) => meal.id !== currentMealId && meal.meal_types.includes(slot) && !topMatches.some((item) => item.id === meal.id))
    .map((meal) => ({
      ...meal,
      suggestionScore: 0,
      closedGaps: [],
    }));

  return [...topMatches, ...fallbackMatches].slice(0, 3);
}

export default function Groceries() {
  const { copy, language } = useI18n();
  const navigate = useNavigate();
  const profile = useAppStore(selectActiveProfile);
  const updateProfile = useAppStore((s) => s.updateProfile);

  const [tab, setTab] = useState<Tab>('plan');
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDayIdx, setSelectedDayIdx] = useState(() => {
    const d = new Date().getDay();
    return d === 0 ? 6 : d - 1;
  });
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [swapTarget, setSwapTarget] = useState<{ dateKey: string; slot: SlotKey } | null>(null);

  if (!profile) return null;

  const monday = getMondayOfWeek(new Date());
  monday.setDate(monday.getDate() + weekOffset * 7);

  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });

  const selectedDate = weekDates[selectedDayIdx];
  const selectedKey = dateKey(selectedDate);
  const dayPlan = profile.mealPlan[selectedKey];

  const todayKey = dateKey(new Date());
  const isToday = (d: Date) => dateKey(d) === todayKey;

  function getMealById(id?: string) {
    if (!id) return null;
    return allMeals.find((m) => m.id === id) ?? null;
  }

  const SLOTS: { label: string; slot: SlotKey; meal: ReturnType<typeof getMealById> }[] = [
    { label: SLOT_LABELS.breakfast, slot: 'breakfast', meal: getMealById(dayPlan?.breakfast) },
    { label: SLOT_LABELS.lunch,     slot: 'lunch',     meal: getMealById(dayPlan?.lunch) },
    { label: SLOT_LABELS.dinner,    slot: 'dinner',    meal: getMealById(dayPlan?.dinner) },
  ];

  const plannedMealsForWeek = weekDates.flatMap((d) => {
    const plan = profile.mealPlan[dateKey(d)];
    const ids = [plan?.breakfast, plan?.lunch, plan?.dinner, ...(plan?.snacks ?? [])].filter(Boolean) as string[];
      return ids.map(getMealById).filter(Boolean) as MealItem[];
  });

  const groceries = plannedMealsForWeek.reduce<GroceryItem[]>((items, meal) => {
    const recipeItems = MEAL_GROCERY_ITEMS[meal.id] ?? fallbackItemsForMeal(meal);
    recipeItems.forEach((item) => {
      const id = `${item.category}-${item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      const existing = items.find((g) => g.id === id);
      if (existing) {
        existing.amountG += item.amountG;
      } else {
        items.push({ ...item, name: localizeFoodName(item.name, language), id, checked: Boolean(checkedItems[id]) });
      }
    });
    return items;
  }, []);

  function toggleGrocery(id: string) {
    setCheckedItems((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function autoPlanWeek() {
    if (!profile) return;
    const suggestions = getSuggestions(profile, 9);
    if (suggestions.length === 0) return;
    const nextPlan = { ...profile.mealPlan };
    weekDates.forEach((d, dayIndex) => {
      const key = dateKey(d);
      nextPlan[key] = {
        ...nextPlan[key],
        breakfast: nextPlan[key]?.breakfast ?? suggestions[(dayIndex * 3) % suggestions.length]?.id,
        lunch: nextPlan[key]?.lunch ?? suggestions[(dayIndex * 3 + 1) % suggestions.length]?.id,
        dinner: nextPlan[key]?.dinner ?? suggestions[(dayIndex * 3 + 2) % suggestions.length]?.id,
      };
    });
    updateProfile(profile.id, { mealPlan: nextPlan });
  }

  function applySwap(mealId: string) {
    if (!swapTarget || !profile) return;
    updateProfile(profile.id, {
      mealPlan: {
        ...profile.mealPlan,
        [swapTarget.dateKey]: {
          ...profile.mealPlan[swapTarget.dateKey],
          [swapTarget.slot]: mealId,
        },
      },
    });
    setSwapTarget(null);
  }

  const currentSwapMealId = swapTarget ? profile.mealPlan[swapTarget.dateKey]?.[swapTarget.slot] : undefined;
  const swapSuggestions = swapTarget ? getSwapSuggestionsForSlot(profile, swapTarget.slot, currentSwapMealId) : [];

  const checkedCount = groceries.filter((g) => g.checked).length;
  const plannedMealCount = plannedMealsForWeek.length;
  const categories = Object.entries(CATEGORY_META).sort((a, b) => a[1].order - b[1].order);

  return (
    <div className="main-content min-h-screen bg-cream-bg">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-sand">
          <ArrowLeft size={20} className={`text-plum-dark ${directionalIconClass(language)}`} />
        </button>
        <h1 className="font-semibold text-plum-dark flex-1">
          {tab === 'plan' ? copy.groceries.thisWeek : copy.groceries.shoppingList}
        </h1>
        <div className="flex gap-1 bg-sand rounded-xl p-1">
          <button
            onClick={() => setTab('plan')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${tab === 'plan' ? 'bg-white text-plum-dark shadow-sm' : 'text-ink-60'}`}
          >
            {copy.groceries.plan}
          </button>
          <button
            onClick={() => setTab('list')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${tab === 'list' ? 'bg-white text-plum-dark shadow-sm' : 'text-ink-60'}`}
          >
            {copy.groceries.list}
          </button>
        </div>
      </div>

      {tab === 'plan' && (
        <>
          {/* Week nav */}
          <div className="px-4 flex items-center gap-2 mb-3">
            <button onClick={() => setWeekOffset(weekOffset - 1)} className="p-1.5 rounded-lg hover:bg-sand">
              <ChevronLeft size={18} className={`text-ink-60 ${directionalIconClass(language)}`} />
            </button>
            <div className="flex-1 flex gap-1">
              {weekDates.map((d, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedDayIdx(i)}
                  className={`flex-1 flex flex-col items-center py-1.5 rounded-xl text-center transition-all ${
                    selectedDayIdx === i
                      ? 'bg-sage-deep text-white'
                      : isToday(d)
                      ? 'bg-coral-accent/15 text-coral-accent'
                      : 'text-ink-60'
                  }`}
                >
                  <span className="text-[9px] font-medium">{copy.groceries.days[i]}</span>
                  <span className="text-xs font-semibold">{d.getDate()}</span>
                  {profile.mealPlan[dateKey(d)] && (
                    <span className={`w-1 h-1 rounded-full mt-0.5 ${selectedDayIdx === i ? 'bg-white' : 'bg-sage-primary'}`} />
                  )}
                </button>
              ))}
            </div>
            <button onClick={() => setWeekOffset(weekOffset + 1)} className="p-1.5 rounded-lg hover:bg-sand">
              <ChevronRight size={18} className={`text-ink-60 ${directionalIconClass(language)}`} />
            </button>
          </div>

          <div className="px-4 space-y-3 pb-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-ink-60">
                  {formatDateValue(selectedDate, language, { weekday: 'long', month: 'long', day: 'numeric' })}
                </p>
                <p className="text-xs text-ink-40">
                  {copy.groceries.planHelper}
                </p>
              </div>
              <button
                onClick={autoPlanWeek}
                className="flex items-center gap-1.5 rounded-xl bg-sage-deep text-white px-3 py-2 text-xs font-semibold"
              >
                <Sparkles size={14} />
                {copy.groceries.autoPlan}
              </button>
            </div>

            {SLOTS.map(({ label, slot, meal }) => (
              <MealPlanSlotCard
                key={slot}
                label={label}
                slot={slot}
                meal={meal}
                language={language}
                profileMode={profile.mode}
                copy={copy}
                onSwap={() => setSwapTarget({ dateKey: selectedKey, slot })}
                onAdd={() => navigate(`/log?mealType=${slot}`)}
              />
            ))}

            {/* Shopping list CTA */}
            <button
              onClick={() => setTab('list')}
              className="w-full flex items-center justify-between bg-sage-deep text-white rounded-2xl px-4 py-3.5 font-medium"
            >
              <div className="flex items-center gap-2">
                <ShoppingCart size={18} />
                <span>{copy.groceries.shoppingList}</span>
              </div>
              <span className="text-sage-primary text-sm">{copy.groceries.itemsFromMeals(groceries.length, plannedMealCount)}</span>
            </button>
          </div>
        </>
      )}

      {tab === 'list' && (
        <div className="px-4 pb-4">
          {/* Progress */}
          <div className="flex items-center justify-between mb-4">
            <div>
                <p className="text-sm text-ink-60">
                  <span className="font-semibold text-plum-dark">{checkedCount}</span> / {groceries.length} {copy.groceries.checkedProgress}
                </p>
                <p className="text-xs text-ink-40">{copy.groceries.generatedFromMeals(plannedMealCount)}</p>
              </div>
            <button
              onClick={autoPlanWeek}
              className="rounded-xl bg-sand text-ink-60 px-3 py-2 text-xs font-semibold"
            >
               {copy.groceries.fillWeek}
            </button>
          </div>

          {groceries.length > 0 && (
            <div className="h-1.5 bg-sand rounded-full overflow-hidden mb-4">
              <div className="h-full bg-sage-primary rounded-full transition-all" style={{ width: `${(checkedCount / groceries.length) * 100}%` }} />
            </div>
          )}

          {groceries.length === 0 && (
            <div className="bg-cream-card border border-sand rounded-3xl p-5 text-center">
              <ShoppingCart size={28} className="text-sage-deep mx-auto mb-3" />
              <h2 className="font-semibold text-plum-dark">{copy.groceries.emptyTitle}</h2>
              <p className="text-sm text-ink-60 mt-1">
                {copy.groceries.emptyBody}
              </p>
              <button
                onClick={autoPlanWeek}
                className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-sage-deep text-white px-4 py-3 text-sm font-semibold"
              >
                <Sparkles size={16} />
                {copy.groceries.autoPlanWeek}
              </button>
            </div>
          )}

          <div className="space-y-4">
            {categories.map(([catKey]) => {
              const items = groceries.filter((g) => g.category === catKey);
              if (items.length === 0) return null;
              return (
                <div key={catKey}>
                  <h3 className="text-xs font-semibold text-ink-60 mb-2">
                     {copy.groceries.categories[catKey as keyof typeof copy.groceries.categories]} ({items.filter((i) => !i.checked).length})
                  </h3>
                  <div className="space-y-1.5">
                    {items.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => toggleGrocery(item.id)}
                        className={`w-full flex items-center gap-3 bg-cream-card rounded-xl px-3 py-2.5 border border-sand transition-all text-left ${
                          item.checked ? 'opacity-50' : ''
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                          item.checked ? 'border-moss bg-moss' : 'border-sand'
                        }`}>
                          {item.checked && <Check size={11} className="text-white" />}
                        </div>
                        <span className={`flex-1 text-sm ${item.checked ? 'line-through text-ink-40' : 'text-plum-dark'}`}>
                          {item.name}
                        </span>
                         <span className="text-xs text-ink-40">{formatAmount(item.amountG)}</span>
                       </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Swap bottom-sheet */}
      {swapTarget && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40" onClick={() => setSwapTarget(null)} />

          <div className="relative bg-cream-bg rounded-t-3xl px-4 pt-4 pb-6 pb-safe z-10">
            {/* Handle */}
            <div className="w-10 h-1 bg-sand rounded-full mx-auto mb-4" />

            <div className="flex items-center justify-between mb-4">
              <div>
                 <h2 className="font-semibold text-plum-dark">{copy.groceries.swapTitle(copy.groceries.slots[swapTarget.slot])}</h2>
                 <p className="text-xs text-ink-60 mt-0.5">{copy.groceries.topSuggestions}</p>
              </div>
              <button onClick={() => setSwapTarget(null)} className="p-2 rounded-full hover:bg-sand">
                <X size={18} className="text-ink-60" />
              </button>
            </div>

            <div className="space-y-2">
              {swapSuggestions.map((suggestion) => (
                <button
                  key={suggestion.id}
                  onClick={() => applySwap(suggestion.id)}
                  className="w-full flex items-center gap-3 bg-cream-card rounded-2xl border border-sand px-4 py-3 text-left hover:border-sage-primary transition-colors"
                >
                  <div className="flex-1 min-w-0">
                     <p className="text-sm font-medium text-plum-dark truncate">{mealDisplayName(suggestion, language)}</p>
                     <p className="text-xs text-ink-40 mt-0.5">
                       {formatAmountWithUnit(suggestion.nutrition.calories, copy.common.kcal, language)} · {formatAmountWithUnit(suggestion.nutrition.protein_g, `g ${copy.common.protein}`, language, 1)}
                     </p>
                     {suggestion.closedGaps.length > 0 && (
                       <p className="text-xs text-sage-primary mt-0.5">
                         {copy.groceries.covers}: {suggestion.closedGaps.slice(0, 2).join(', ')}
                       </p>
                     )}
                  </div>
                  <ScoreBadge
                    score={profile.mode === 'pcos' ? suggestion.pcos_score : (suggestion.bulk_score ?? suggestion.pcos_score)}
                    size="sm"
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MealPlanSlotCard({
  label,
  slot,
  meal,
  language,
  profileMode,
  copy,
  onSwap,
  onAdd,
}: {
  label: string;
  slot: SlotKey;
  meal: MealItem | null;
  language: 'en' | 'he';
  profileMode: 'pcos' | 'bulk' | 'maintain';
  copy: ReturnType<typeof useI18n>['copy'];
  onSwap: () => void;
  onAdd: () => void;
}) {
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);

  function resetSwipe() {
    setTouchStartX(null);
    setSwipeOffset(0);
  }

  function handleTouchStart(event: React.TouchEvent<HTMLDivElement>) {
    if (!meal) return;
    setTouchStartX(event.touches[0]?.clientX ?? null);
  }

  function handleTouchMove(event: React.TouchEvent<HTMLDivElement>) {
    if (!meal || touchStartX === null) return;
    const delta = (event.touches[0]?.clientX ?? touchStartX) - touchStartX;
    setSwipeOffset(delta < 0 ? Math.max(delta, -72) : 0);
  }

  function handleTouchEnd() {
    if (!meal) return;
    const shouldOpenSwap = swipeOffset <= -56;
    resetSwipe();
    if (shouldOpenSwap) onSwap();
  }

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {meal && (
        <div className="absolute inset-y-0 right-0 flex w-20 items-center justify-center rounded-2xl bg-sage-deep text-xs font-semibold text-white">
          {copy.groceries.swap}
        </div>
      )}

      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        className="relative bg-cream-card rounded-2xl border border-sand p-4 transition-transform"
        style={{
          transform: meal ? `translateX(${swipeOffset}px)` : undefined,
          touchAction: 'pan-y',
        }}
        data-testid={`meal-slot-${slot}`}
      >
        <p className="text-xs font-semibold text-ink-40 uppercase tracking-wide mb-2">{label}</p>
        {meal ? (
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 text-sm font-medium text-plum-dark">{mealDisplayName(meal, language)}</span>
              <ScoreBadge score={profileMode === 'pcos' ? meal.pcos_score : (meal.bulk_score ?? meal.pcos_score)} size="sm" />
            </div>
            <p className="text-xs text-ink-40 mt-1">
              {formatAmountWithUnit(meal.nutrition.calories, copy.common.kcal, language)} · {formatAmountWithUnit(meal.nutrition.protein_g, `g ${copy.common.protein}`, language, 1)}
            </p>
            <div className="flex gap-2 mt-2">
              <button
                onClick={onSwap}
                className="text-xs text-ink-60 border border-sand rounded-lg px-2.5 py-1 hover:bg-sand transition-colors"
              >
                {copy.groceries.swap}
              </button>
            </div>
          </div>
        ) : (
          <button onClick={onAdd} className="text-xs text-coral-accent font-medium">
            + {copy.groceries.addMeal}
          </button>
        )}
      </div>
    </div>
  );
}

import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ShoppingCart, Check, Share2, Edit3, ChevronLeft, ChevronRight, X, Search, Trash2 } from 'lucide-react';
import { useAppStore, selectActiveProfile } from '../store/appStore';
import type { LoggedMeal } from '../store/appStore';
import { mealDatabase } from '../data/mealDatabase';
import { scoreFood } from '../lib/scoring';
import { getCurrentPhase } from '../lib/cyclePhase';
import ScoreBadge from '../components/ScoreBadge';

type Tab = 'plan' | 'list';
type MealSlot = 'breakfast' | 'lunch' | 'dinner';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

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
  amount: string;
  category: 'produce' | 'fish_meat' | 'grains' | 'dairy' | 'pantry';
  checked: boolean;
}

const SAMPLE_GROCERY_LIST: GroceryItem[] = [
  { id: 'g1', name: 'Salmon fillet', amount: '400g', category: 'fish_meat', checked: false },
  { id: 'g2', name: 'Mackerel fillet', amount: '300g', category: 'fish_meat', checked: false },
  { id: 'g3', name: 'Chicken breast', amount: '500g', category: 'fish_meat', checked: false },
  { id: 'g4', name: 'Spinach', amount: '200g', category: 'produce', checked: false },
  { id: 'g5', name: 'Kale', amount: '1 bunch', category: 'produce', checked: false },
  { id: 'g6', name: 'Blueberries', amount: '250g', category: 'produce', checked: false },
  { id: 'g7', name: 'Avocado', amount: '3', category: 'produce', checked: false },
  { id: 'g8', name: 'Lemon', amount: '4', category: 'produce', checked: false },
  { id: 'g9', name: 'Cherry tomatoes', amount: '300g', category: 'produce', checked: false },
  { id: 'g10', name: 'Sweet potato', amount: '500g', category: 'produce', checked: false },
  { id: 'g11', name: 'Quinoa', amount: '500g', category: 'grains', checked: false },
  { id: 'g12', name: 'Red lentils', amount: '500g', category: 'grains', checked: false },
  { id: 'g13', name: 'Rolled oats', amount: '500g', category: 'grains', checked: false },
  { id: 'g14', name: 'Brown rice', amount: '1 kg', category: 'grains', checked: false },
  { id: 'g15', name: 'Rye bread', amount: '1 loaf', category: 'grains', checked: false },
  { id: 'g16', name: 'Greek yogurt 0%', amount: '500g', category: 'dairy', checked: false },
  { id: 'g17', name: 'Eggs', amount: '12', category: 'dairy', checked: false },
  { id: 'g18', name: 'Feta cheese', amount: '200g', category: 'dairy', checked: false },
  { id: 'g19', name: 'Cottage cheese', amount: '400g', category: 'dairy', checked: false },
  { id: 'g20', name: 'Chia seeds', amount: '200g', category: 'pantry', checked: false },
  { id: 'g21', name: 'Walnuts', amount: '200g', category: 'pantry', checked: false },
  { id: 'g22', name: 'Almonds', amount: '200g', category: 'pantry', checked: false },
  { id: 'g23', name: 'Extra-virgin olive oil', amount: '500ml', category: 'pantry', checked: false },
];

const CATEGORY_META = {
  produce: { label: '🥬 Produce', order: 0 },
  fish_meat: { label: '🐟 Fish & Meat', order: 1 },
  grains: { label: '🌾 Grains & Legumes', order: 2 },
  dairy: { label: '🥛 Dairy & Eggs', order: 3 },
  pantry: { label: '🥜 Pantry', order: 4 },
};

export default function Groceries() {
  const navigate = useNavigate();
  const profile = useAppStore(selectActiveProfile);
  const updateProfile = useAppStore((s) => s.updateProfile);
  const logMeal = useAppStore((s) => s.logMeal);

  const [tab, setTab] = useState<Tab>('plan');
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDayIdx, setSelectedDayIdx] = useState(() => {
    const d = new Date().getDay();
    return d === 0 ? 6 : d - 1;
  });
  const [groceries, setGroceries] = useState<GroceryItem[]>(SAMPLE_GROCERY_LIST);
  const [editMode, setEditMode] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemAmount, setNewItemAmount] = useState('');
  const [activeMealSlot, setActiveMealSlot] = useState<{ dayKey: string; slot: MealSlot } | null>(null);
  const [mealPickerQuery, setMealPickerQuery] = useState('');
  const [shareToast, setShareToast] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    return mealDatabase.find((m) => m.id === id) ?? null;
  }

  const breakfastMeal = getMealById(dayPlan?.breakfast);
  const lunchMeal = getMealById(dayPlan?.lunch);
  const dinnerMeal = getMealById(dayPlan?.dinner);

  function toggleGrocery(id: string) {
    setGroceries((prev) => prev.map((g) => g.id === id ? { ...g, checked: !g.checked } : g));
  }

  function addGroceryItem() {
    if (!newItemName.trim()) return;
    setGroceries((prev) => [
      ...prev,
      {
        id: `custom-${Date.now()}`,
        name: newItemName.trim(),
        amount: newItemAmount.trim() || '—',
        category: 'pantry' as const,
        checked: false,
      },
    ]);
    setNewItemName('');
    setNewItemAmount('');
  }

  function removeGroceryItem(id: string) {
    setGroceries((prev) => prev.filter((g) => g.id !== id));
  }

  function openMealPicker(dayKey: string, slot: MealSlot) {
    setActiveMealSlot({ dayKey, slot });
    setMealPickerQuery('');
  }

  function assignMeal(mealId: string) {
    if (!activeMealSlot || !profile) return;
    const { dayKey, slot } = activeMealSlot;
    const existing = profile.mealPlan[dayKey] ?? {};
    updateProfile(profile.id, {
      mealPlan: { ...profile.mealPlan, [dayKey]: { ...existing, [slot]: mealId } },
    });
    setActiveMealSlot(null);
  }

  function removePlannedMeal(dayKey: string, slot: MealSlot) {
    if (!profile) return;
    const existing = { ...(profile.mealPlan[dayKey] ?? {}) };
    delete (existing as Record<string, unknown>)[slot];
    updateProfile(profile.id, {
      mealPlan: { ...profile.mealPlan, [dayKey]: existing },
    });
  }

  function logPlannedMeal(mealId: string) {
    if (!profile) return;
    const meal = getMealById(mealId);
    if (!meal) return;
    const phaseInfo = profile.mode === 'pcos' ? getCurrentPhase(profile) : null;
    const score = scoreFood(meal.nutrition, 300, profile.mode, phaseInfo?.phase);
    const now = new Date();
    const logged: LoggedMeal = {
      id: `plan-${Date.now()}`,
      timestamp: now.toISOString(),
      meal_type: now.getHours() < 10 ? 'breakfast' : now.getHours() < 14 ? 'lunch' : now.getHours() < 17 ? 'snack' : 'dinner',
      name: meal.name,
      serving_g: 300,
      nutrition: meal.nutrition,
      score,
      cyclePhase: phaseInfo?.phase,
    };
    logMeal(profile.id, logged);
  }

  function shareGroceries() {
    const lines: string[] = ['Shopping List', ''];
    Object.entries(CATEGORY_META)
      .sort((a, b) => a[1].order - b[1].order)
      .forEach(([catKey, catMeta]) => {
        const items = groceries.filter((g) => g.category === catKey && !g.checked);
        if (items.length === 0) return;
        lines.push(catMeta.label);
        items.forEach((i) => lines.push(`• ${i.name} — ${i.amount}`));
        lines.push('');
      });
    const text = lines.join('\n').trim();
    if (navigator.share) {
      navigator.share({ title: 'Shopping List', text }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text).then(() => {
        setShareToast(true);
        setTimeout(() => setShareToast(false), 2000);
      });
    }
  }

  const pickerResults = mealPickerQuery.length > 1
    ? mealDatabase.filter((m) =>
        m.name.toLowerCase().includes(mealPickerQuery.toLowerCase()) ||
        m.tags.some((t) => t.includes(mealPickerQuery.toLowerCase()))
      ).slice(0, 8)
    : mealDatabase
        .filter((m) => profile.mode === 'pcos' ? m.pcos_score >= 8.5 : (m.bulk_score ?? 0) >= 8.5)
        .sort((a, b) =>
          profile.mode === 'pcos'
            ? b.pcos_score - a.pcos_score
            : (b.bulk_score ?? 0) - (a.bulk_score ?? 0)
        )
        .slice(0, 8);

  const checkedCount = groceries.filter((g) => g.checked).length;
  const categories = Object.entries(CATEGORY_META).sort((a, b) => a[1].order - b[1].order);

  const SLOT_LABELS: Record<MealSlot, string> = { breakfast: '🌅 Breakfast', lunch: '🌞 Lunch', dinner: '🌙 Dinner' };

  return (
    <div className="main-content min-h-screen bg-cream-bg">
      {/* Share toast */}
      {shareToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-plum-dark text-white text-xs font-medium px-4 py-2 rounded-full shadow-lg">
          Copied to clipboard!
        </div>
      )}

      {/* Meal Picker Modal */}
      {activeMealSlot && (
        <div className="fixed inset-0 z-50 bg-black/50 flex flex-col justify-end">
          <div className="bg-cream-bg rounded-t-3xl max-h-[80vh] flex flex-col">
            <div className="px-4 pt-4 pb-3 flex items-center gap-3 border-b border-sand">
              <button onClick={() => setActiveMealSlot(null)} className="p-2 rounded-full hover:bg-sand">
                <X size={18} className="text-plum-dark" />
              </button>
              <span className="font-semibold text-plum-dark text-sm flex-1">
                {SLOT_LABELS[activeMealSlot.slot]}
              </span>
            </div>
            <div className="px-4 pt-3 pb-2">
              <div className="flex items-center gap-2 bg-cream-card border border-sand rounded-2xl px-3 py-2.5">
                <Search size={14} className="text-ink-40" />
                <input
                  autoFocus
                  value={mealPickerQuery}
                  onChange={(e) => setMealPickerQuery(e.target.value)}
                  placeholder="Search meals…"
                  className="flex-1 bg-transparent text-sm text-plum-dark placeholder-ink-40 focus:outline-none"
                />
              </div>
            </div>
            <div className="overflow-y-auto px-4 pb-6 space-y-2">
              {pickerResults.map((meal) => {
                const score = profile.mode === 'pcos' ? meal.pcos_score : (meal.bulk_score ?? meal.pcos_score);
                return (
                  <button
                    key={meal.id}
                    onClick={() => assignMeal(meal.id)}
                    className="w-full bg-cream-card border border-sand rounded-2xl p-3 flex items-center gap-3 text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-plum-dark">{meal.name}</span>
                        <ScoreBadge score={score} size="sm" />
                      </div>
                      <p className="text-xs text-ink-40 mt-0.5">{meal.nutrition.calories} kcal · {meal.nutrition.protein_g}g P · {meal.prep_time_min} min</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-sand">
          <ArrowLeft size={20} className="text-plum-dark" />
        </button>
        <h1 className="font-semibold text-plum-dark flex-1">
          {tab === 'plan' ? 'This week' : 'Shopping list'}
        </h1>
        <div className="flex gap-1 bg-sand rounded-xl p-1">
          <button
            onClick={() => setTab('plan')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${tab === 'plan' ? 'bg-white text-plum-dark shadow-sm' : 'text-ink-60'}`}
          >
            Plan
          </button>
          <button
            onClick={() => setTab('list')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${tab === 'list' ? 'bg-white text-plum-dark shadow-sm' : 'text-ink-60'}`}
          >
            List
          </button>
        </div>
      </div>

      {tab === 'plan' && (
        <>
          {/* Week nav */}
          <div className="px-4 flex items-center gap-2 mb-3">
            <button onClick={() => setWeekOffset(weekOffset - 1)} className="p-1.5 rounded-lg hover:bg-sand">
              <ChevronLeft size={18} className="text-ink-60" />
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
                  <span className="text-[9px] font-medium">{DAYS[i]}</span>
                  <span className="text-xs font-semibold">{d.getDate()}</span>
                  {profile.mealPlan[dateKey(d)] && (
                    <span className={`w-1 h-1 rounded-full mt-0.5 ${selectedDayIdx === i ? 'bg-white' : 'bg-sage-primary'}`} />
                  )}
                </button>
              ))}
            </div>
            <button onClick={() => setWeekOffset(weekOffset + 1)} className="p-1.5 rounded-lg hover:bg-sand">
              <ChevronRight size={18} className="text-ink-60" />
            </button>
          </div>

          <div className="px-4 space-y-3 pb-4">
            <p className="text-sm font-medium text-ink-60">
              {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>

            {([
              { slot: 'breakfast' as MealSlot, meal: breakfastMeal, label: '🌅 Breakfast' },
              { slot: 'lunch' as MealSlot, meal: lunchMeal, label: '🌞 Lunch' },
              { slot: 'dinner' as MealSlot, meal: dinnerMeal, label: '🌙 Dinner' },
            ]).map(({ slot, meal, label }) => (
              <div key={slot} className="bg-cream-card rounded-2xl border border-sand p-4">
                <p className="text-xs font-semibold text-ink-40 uppercase tracking-wide mb-2">{label}</p>
                {meal ? (
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-plum-dark">{meal.name}</span>
                      <ScoreBadge score={profile.mode === 'pcos' ? meal.pcos_score : (meal.bulk_score ?? meal.pcos_score)} size="sm" />
                    </div>
                    <p className="text-xs text-ink-40 mt-1">{meal.nutrition.calories} kcal · {meal.nutrition.protein_g}g P</p>
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => openMealPicker(selectedKey, slot)}
                        className="text-xs text-ink-60 border border-sand rounded-lg px-2.5 py-1"
                      >
                        Swap
                      </button>
                      <button
                        onClick={() => {
                          logPlannedMeal(dayPlan![slot]!);
                          navigate('/');
                        }}
                        className="text-xs text-moss bg-moss/10 rounded-lg px-2.5 py-1 font-medium"
                      >
                        Done ✓
                      </button>
                      <button
                        onClick={() => removePlannedMeal(selectedKey, slot)}
                        className="text-xs text-terracotta/70 border border-terracotta/20 rounded-lg px-2.5 py-1 ml-auto"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => openMealPicker(selectedKey, slot)}
                    className="text-xs text-coral-accent font-medium"
                  >
                    + Add meal
                  </button>
                )}
              </div>
            ))}

            {/* Shopping list CTA */}
            <button
              onClick={() => setTab('list')}
              className="w-full flex items-center justify-between bg-sage-deep text-white rounded-2xl px-4 py-3.5 font-medium"
            >
              <div className="flex items-center gap-2">
                <ShoppingCart size={18} />
                <span>Shopping list</span>
              </div>
              <span className="text-sage-primary text-sm">{groceries.length} items</span>
            </button>
          </div>
        </>
      )}

      {tab === 'list' && (
        <div className="px-4 pb-4">
          {/* Progress */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-ink-60">
              <span className="font-semibold text-plum-dark">{checkedCount}</span> / {groceries.length} checked
            </p>
            <div className="flex gap-2">
              <button onClick={shareGroceries} className="p-2 rounded-xl bg-sand text-ink-60">
                <Share2 size={15} />
              </button>
              <button
                onClick={() => setEditMode((v) => !v)}
                className={`p-2 rounded-xl transition-colors ${editMode ? 'bg-coral-accent text-white' : 'bg-sand text-ink-60'}`}
              >
                <Edit3 size={15} />
              </button>
            </div>
          </div>

          {checkedCount > 0 && (
            <div className="h-1.5 bg-sand rounded-full overflow-hidden mb-4">
              <div className="h-full bg-sage-primary rounded-full transition-all" style={{ width: `${(checkedCount / groceries.length) * 100}%` }} />
            </div>
          )}

          <div className="space-y-4">
            {categories.map(([catKey, catMeta]) => {
              const items = groceries.filter((g) => g.category === catKey);
              if (items.length === 0) return null;
              return (
                <div key={catKey}>
                  <h3 className="text-xs font-semibold text-ink-60 mb-2">
                    {catMeta.label} ({items.filter((i) => !i.checked).length})
                  </h3>
                  <div className="space-y-1.5">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className={`flex items-center gap-3 bg-cream-card rounded-xl px-3 py-2.5 border border-sand transition-all ${
                          item.checked && !editMode ? 'opacity-50' : ''
                        }`}
                      >
                        {editMode ? (
                          <button onClick={() => removeGroceryItem(item.id)} className="flex-shrink-0">
                            <Trash2 size={16} className="text-terracotta" />
                          </button>
                        ) : (
                          <button
                            onClick={() => toggleGrocery(item.id)}
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                              item.checked ? 'border-moss bg-moss' : 'border-sand'
                            }`}
                          >
                            {item.checked && <Check size={11} className="text-white" />}
                          </button>
                        )}
                        <button
                          onClick={() => !editMode && toggleGrocery(item.id)}
                          className={`flex-1 text-sm text-left ${item.checked && !editMode ? 'line-through text-ink-40' : 'text-plum-dark'}`}
                        >
                          {item.name}
                        </button>
                        <span className="text-xs text-ink-40">{item.amount}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add item form in edit mode */}
          {editMode && (
            <div className="mt-4 bg-cream-card rounded-2xl border border-coral-accent/30 p-4 space-y-3">
              <p className="text-xs font-semibold text-ink-60 uppercase tracking-wide">Add item</p>
              <input
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addGroceryItem()}
                placeholder="Item name"
                className="w-full px-3 py-2 rounded-xl border border-sand text-sm bg-cream-bg focus:outline-none"
              />
              <input
                value={newItemAmount}
                onChange={(e) => setNewItemAmount(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addGroceryItem()}
                placeholder="Amount (e.g. 500g)"
                className="w-full px-3 py-2 rounded-xl border border-sand text-sm bg-cream-bg focus:outline-none"
              />
              <button
                onClick={addGroceryItem}
                disabled={!newItemName.trim()}
                className="w-full bg-coral-accent text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-40"
              >
                Add to list
              </button>
            </div>
          )}
        </div>
      )}

      {/* Hidden file input for CSV import */}
      <input ref={fileInputRef} type="file" accept=".csv" className="hidden" />
    </div>
  );
}

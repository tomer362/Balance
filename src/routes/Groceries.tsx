import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ShoppingCart, Check, Share2, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useAppStore, selectActiveProfile } from '../store/appStore';
import { mealDatabase } from '../data/mealDatabase';
import { getSuggestions } from '../lib/suggestionEngine';
import ScoreBadge from '../components/ScoreBadge';

type Tab = 'plan' | 'list';
type SlotKey = 'breakfast' | 'lunch' | 'dinner';

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

const SLOT_LABELS: Record<SlotKey, string> = {
  breakfast: '🌅 Breakfast',
  lunch: '🌞 Lunch',
  dinner: '🌙 Dinner',
};

export default function Groceries() {
  const navigate = useNavigate();
  const profile = useAppStore(selectActiveProfile);
  const updateProfile = useAppStore((s) => s.updateProfile);

  const [tab, setTab] = useState<Tab>('plan');
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDayIdx, setSelectedDayIdx] = useState(() => {
    const d = new Date().getDay();
    return d === 0 ? 6 : d - 1;
  });
  const [groceries, setGroceries] = useState<GroceryItem[]>(SAMPLE_GROCERY_LIST);
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
    return mealDatabase.find((m) => m.id === id) ?? null;
  }

  const SLOTS: { label: string; slot: SlotKey; meal: ReturnType<typeof getMealById> }[] = [
    { label: SLOT_LABELS.breakfast, slot: 'breakfast', meal: getMealById(dayPlan?.breakfast) },
    { label: SLOT_LABELS.lunch,     slot: 'lunch',     meal: getMealById(dayPlan?.lunch) },
    { label: SLOT_LABELS.dinner,    slot: 'dinner',    meal: getMealById(dayPlan?.dinner) },
  ];

  function toggleGrocery(id: string) {
    setGroceries((prev) => prev.map((g) => g.id === id ? { ...g, checked: !g.checked } : g));
  }

  function applySwap(mealId: string) {
    if (!swapTarget) return;
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

  const swapSuggestions = swapTarget ? getSuggestions(profile, 3) : [];

  const checkedCount = groceries.filter((g) => g.checked).length;
  const categories = Object.entries(CATEGORY_META).sort((a, b) => a[1].order - b[1].order);

  return (
    <div className="main-content min-h-screen bg-cream-bg">
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

            {SLOTS.map(({ label, slot, meal }) => (
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
                        onClick={() => setSwapTarget({ dateKey: selectedKey, slot })}
                        className="text-xs text-ink-60 border border-sand rounded-lg px-2.5 py-1 hover:bg-sand transition-colors"
                      >
                        Swap
                      </button>
                      <button className="text-xs text-moss bg-moss/10 rounded-lg px-2.5 py-1 font-medium">Done ✓</button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => navigate(`/log?mealType=${slot}`)}
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
            <button className="p-2 rounded-xl bg-sand text-ink-60">
              <Share2 size={15} />
            </button>
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
                        <span className="text-xs text-ink-40">{item.amount}</span>
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

          <div className="relative bg-cream-bg rounded-t-3xl px-4 pt-4 pb-safe-or-6 z-10">
            {/* Handle */}
            <div className="w-10 h-1 bg-sand rounded-full mx-auto mb-4" />

            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold text-plum-dark">Swap {SLOT_LABELS[swapTarget.slot]}</h2>
                <p className="text-xs text-ink-60 mt-0.5">Top suggestions for you</p>
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
                    <p className="text-sm font-medium text-plum-dark truncate">{suggestion.name}</p>
                    <p className="text-xs text-ink-40 mt-0.5">
                      {suggestion.nutrition.calories} kcal · {suggestion.nutrition.protein_g}g P
                    </p>
                    {suggestion.closedGaps.length > 0 && (
                      <p className="text-xs text-sage-primary mt-0.5">
                        Covers: {suggestion.closedGaps.slice(0, 2).join(', ')}
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

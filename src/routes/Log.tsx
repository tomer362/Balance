import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Search, Plus, Check, ChevronRight, X, Minus, Barcode, Layers } from 'lucide-react';
import { useAppStore, selectActiveProfile } from '../store/appStore';
import type { LoggedMeal, MealItem, NutritionData } from '../store/appStore';
import { mealDatabase } from '../data/mealDatabase';
import { ingredientDatabase, searchIngredients, scaleIngredient } from '../data/ingredientDatabase';
import type { Ingredient } from '../data/ingredientDatabase';
import { searchFoodIsrael } from '../lib/openFoodFacts';
import { scoreFood } from '../lib/scoring';
import { getCurrentPhase } from '../lib/cyclePhase';
import ScoreBadge from '../components/ScoreBadge';
import BottomSheet from '../components/BottomSheet';

type TabKey = 'meals' | 'ingredients' | 'build';

// ─── helpers ────────────────────────────────────────────────────────────────

function autoMealType(): LoggedMeal['meal_type'] {
  const h = new Date().getHours();
  if (h < 10) return 'breakfast';
  if (h < 14) return 'lunch';
  if (h < 17) return 'snack';
  return 'dinner';
}

function sumNutr(items: Array<{ nutrition: NutritionData; serving_g: number }>): NutritionData {
  return items.reduce<NutritionData>(
    (acc, { nutrition, serving_g }) => {
      const s = serving_g / 100;
      return {
        calories: acc.calories + Math.round(nutrition.calories * s),
        protein_g: acc.protein_g + nutrition.protein_g * s,
        carbs_g: acc.carbs_g + nutrition.carbs_g * s,
        fiber_g: acc.fiber_g + nutrition.fiber_g * s,
        sugar_g: acc.sugar_g + nutrition.sugar_g * s,
        fat_g: acc.fat_g + nutrition.fat_g * s,
        saturated_fat_g: acc.saturated_fat_g + nutrition.saturated_fat_g * s,
        sodium_mg: acc.sodium_mg + nutrition.sodium_mg * s,
        omega3_g: (acc.omega3_g ?? 0) + ((nutrition.omega3_g ?? 0) * s),
      };
    },
    { calories: 0, protein_g: 0, carbs_g: 0, fiber_g: 0, sugar_g: 0, fat_g: 0, saturated_fat_g: 0, sodium_mg: 0, omega3_g: 0 }
  );
}

function roundNutr(n: NutritionData): NutritionData {
  return {
    ...n,
    protein_g: Math.round(n.protein_g * 10) / 10,
    carbs_g: Math.round(n.carbs_g * 10) / 10,
    fiber_g: Math.round(n.fiber_g * 10) / 10,
    sugar_g: Math.round(n.sugar_g * 10) / 10,
    fat_g: Math.round(n.fat_g * 10) / 10,
    saturated_fat_g: Math.round(n.saturated_fat_g * 10) / 10,
    omega3_g: n.omega3_g !== undefined ? Math.round(n.omega3_g * 100) / 100 : undefined,
  };
}

// ─── serving picker component ────────────────────────────────────────────────

interface ServingPickerProps {
  defaultG: number;
  defaultLabel: string;
  onConfirm: (g: number) => void;
  onCancel: () => void;
}

function ServingPicker({ defaultG, defaultLabel, onConfirm, onCancel }: ServingPickerProps) {
  const [gText, setGText] = useState(String(defaultG));
  const g = Math.max(1, Number(gText) || defaultG);

  return (
    <BottomSheet onClose={onCancel}>
      <div className="p-6 pb-safe space-y-4" data-testid="serving-picker">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-semibold text-plum-dark">Serving size</h3>
          <button onClick={onCancel} className="tap-target flex items-center justify-center">
            <X size={20} className="text-ink-40" />
          </button>
        </div>

        <p className="text-xs text-ink-40">Default: {defaultLabel}</p>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setGText(String(Math.max(1, g - 10)))}
            className="tap-target w-11 h-11 rounded-full bg-sand flex items-center justify-center"
            data-testid="serving-minus"
          >
            <Minus size={18} className="text-plum-dark" />
          </button>
          <div className="flex-1 flex items-center gap-2 bg-cream-card border border-sand rounded-xl px-3 py-2.5">
            <input
              type="number"
              inputMode="decimal"
              value={gText}
              onChange={(e) => setGText(e.target.value)}
              className="flex-1 bg-transparent text-center text-lg font-semibold text-plum-dark focus:outline-none"
              data-testid="serving-input"
            />
            <span className="text-sm text-ink-40">g</span>
          </div>
          <button
            onClick={() => setGText(String(g + 10))}
            className="tap-target w-11 h-11 rounded-full bg-sand flex items-center justify-center"
            data-testid="serving-plus"
          >
            <Plus size={18} className="text-plum-dark" />
          </button>
        </div>

        {/* quick presets */}
        <div className="flex gap-2 flex-wrap">
          {[50, 100, 150, 200, 250, 300].map((preset) => (
            <button
              key={preset}
              onClick={() => setGText(String(preset))}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                g === preset ? 'bg-sage-deep text-white' : 'bg-sand text-ink-60'
              }`}
            >
              {preset} g
            </button>
          ))}
        </div>

        <button
          onClick={() => onConfirm(g)}
          className="w-full bg-sage-deep text-white py-3.5 rounded-2xl font-semibold"
          data-testid="serving-confirm"
        >
          Add to log
        </button>
      </div>
    </BottomSheet>
  );
}

// ─── main component ──────────────────────────────────────────────────────────

interface BuildItem {
  ingredient: Ingredient;
  serving_g: number;
}

export default function Log() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') ?? '';

  const profile = useAppStore(selectActiveProfile);
  const logMeal = useAppStore((s) => s.logMeal);

  const [activeTab, setActiveTab] = useState<TabKey>('ingredients');
  const [query, setQuery] = useState(initialQuery);

  // Meal-tab state
  const [loggedMealId, setLoggedMealId] = useState<string | null>(null);

  // Ingredient-tab state
  const [ingResults, setIngResults] = useState<Ingredient[]>([]);
  const [offResults, setOffResults] = useState<Array<{ id: string; name: string; nutrition: NutritionData }>>([]);
  const [offLoading, setOffLoading] = useState(false);
  const [pendingIngredient, setPendingIngredient] = useState<Ingredient | null>(null);
  const [pendingOff, setPendingOff] = useState<{ id: string; name: string; nutrition: NutritionData } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Build-a-meal state
  const [buildItems, setBuildItems] = useState<BuildItem[]>([]);
  const [buildMealName, setBuildMealName] = useState('');
  const [buildPendingIngredient, setBuildPendingIngredient] = useState<Ingredient | null>(null);

  const phaseInfo = profile?.mode === 'pcos' ? getCurrentPhase(profile!) : null;

  // ── search effects ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (activeTab !== 'ingredients' || query.length < 2) {
      setIngResults([]);
      setOffResults([]);
      return;
    }
    // Local search is instant
    setIngResults(searchIngredients(query));

    // OFF search is debounced
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setOffLoading(true);
      const results = await searchFoodIsrael(query);
      setOffResults(results);
      setOffLoading(false);
    }, 700);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, activeTab]);

  // ── actions ────────────────────────────────────────────────────────────────
  const logIngredient = useCallback(
    (ingredient: Ingredient, servingG: number) => {
      if (!profile) return;
      const scaled = scaleIngredient(ingredient, servingG);
      const nutrition: NutritionData = {
        calories: scaled.calories,
        protein_g: scaled.protein_g,
        carbs_g: scaled.carbs_g,
        fiber_g: scaled.fiber_g,
        sugar_g: scaled.sugar_g,
        fat_g: scaled.fat_g,
        saturated_fat_g: scaled.saturated_fat_g,
        sodium_mg: scaled.sodium_mg,
        omega3_g: scaled.omega3_g,
      };
      const score = scoreFood(nutrition, servingG, profile.mode, phaseInfo?.phase);
      const logged: LoggedMeal = {
        id: `log-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        timestamp: new Date().toISOString(),
        meal_type: autoMealType(),
        food_id: ingredient.id,
        name: `${ingredient.name} (${servingG} g)`,
        serving_g: servingG,
        nutrition,
        score,
        cyclePhase: phaseInfo?.phase,
      };
      logMeal(profile.id, logged);
      setPendingIngredient(null);
    },
    [profile, logMeal, phaseInfo]
  );

  const logOff = useCallback(
    (item: { id: string; name: string; nutrition: NutritionData }, servingG: number) => {
      if (!profile) return;
      const s = servingG / 100;
      const nutrition: NutritionData = {
        calories: Math.round(item.nutrition.calories * s),
        protein_g: Math.round(item.nutrition.protein_g * s * 10) / 10,
        carbs_g: Math.round(item.nutrition.carbs_g * s * 10) / 10,
        fiber_g: Math.round(item.nutrition.fiber_g * s * 10) / 10,
        sugar_g: Math.round(item.nutrition.sugar_g * s * 10) / 10,
        fat_g: Math.round(item.nutrition.fat_g * s * 10) / 10,
        saturated_fat_g: Math.round(item.nutrition.saturated_fat_g * s * 10) / 10,
        sodium_mg: Math.round(item.nutrition.sodium_mg * s),
      };
      const score = scoreFood(nutrition, servingG, profile.mode, phaseInfo?.phase);
      const logged: LoggedMeal = {
        id: `log-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        timestamp: new Date().toISOString(),
        meal_type: autoMealType(),
        food_id: item.id,
        name: `${item.name} (${servingG} g)`,
        serving_g: servingG,
        nutrition,
        score,
        cyclePhase: phaseInfo?.phase,
      };
      logMeal(profile.id, logged);
      setPendingOff(null);
    },
    [profile, logMeal, phaseInfo]
  );

  const quickLogMeal = useCallback(
    (meal: MealItem) => {
      if (!profile) return;
      const score = scoreFood(meal.nutrition, 300, profile.mode, phaseInfo?.phase);
      const logged: LoggedMeal = {
        id: `log-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        timestamp: new Date().toISOString(),
        meal_type: autoMealType(),
        name: meal.name,
        serving_g: 300,
        nutrition: meal.nutrition,
        score,
        cyclePhase: phaseInfo?.phase,
      };
      logMeal(profile.id, logged);
      setLoggedMealId(meal.id);
      setTimeout(() => setLoggedMealId(null), 1500);
    },
    [profile, logMeal, phaseInfo]
  );

  const logBuildMeal = useCallback(() => {
    if (!profile || buildItems.length === 0) return;
    const totalG = buildItems.reduce((s, i) => s + i.serving_g, 0);
    const nutritionPer100 = buildItems.map((bi) => ({
      nutrition: {
        calories: bi.ingredient.calories,
        protein_g: bi.ingredient.protein_g,
        carbs_g: bi.ingredient.carbs_g,
        fiber_g: bi.ingredient.fiber_g,
        sugar_g: bi.ingredient.sugar_g,
        fat_g: bi.ingredient.fat_g,
        saturated_fat_g: bi.ingredient.saturated_fat_g,
        sodium_mg: bi.ingredient.sodium_mg,
        omega3_g: bi.ingredient.omega3_g,
      },
      serving_g: bi.serving_g,
    }));
    const nutrition = roundNutr(sumNutr(nutritionPer100));
    const score = scoreFood(nutrition, totalG, profile.mode, phaseInfo?.phase);
    const logged: LoggedMeal = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      timestamp: new Date().toISOString(),
      meal_type: autoMealType(),
      name: buildMealName.trim() || 'Custom Meal',
      serving_g: totalG,
      nutrition,
      score,
      cyclePhase: phaseInfo?.phase,
    };
    logMeal(profile.id, logged);
    setBuildItems([]);
    setBuildMealName('');
    navigate(-1);
  }, [profile, logMeal, phaseInfo, buildItems, buildMealName, navigate]);

  if (!profile) return null;

  const mealFiltered = query.length > 1
    ? mealDatabase.filter(
        (m) =>
          m.name.toLowerCase().includes(query.toLowerCase()) ||
          m.tags.some((t) => t.includes(query.toLowerCase()))
      )
    : [];

  const favorites = mealDatabase
    .filter((m) => (profile.mode === 'pcos' ? m.pcos_score >= 8.5 : (m.bulk_score ?? 0) >= 8.5))
    .sort((a, b) =>
      profile.mode === 'pcos' ? b.pcos_score - a.pcos_score : (b.bulk_score ?? 0) - (a.bulk_score ?? 0)
    )
    .slice(0, 6);

  const recent = profile.foodLog
    .slice(-8)
    .reverse()
    .filter((m, i, arr) => arr.findIndex((x) => x.name === m.name) === i)
    .slice(0, 4);

  // Build-a-meal totals preview
  const buildTotals = buildItems.length > 0
    ? roundNutr(sumNutr(buildItems.map((bi) => ({
        nutrition: {
          calories: bi.ingredient.calories,
          protein_g: bi.ingredient.protein_g,
          carbs_g: bi.ingredient.carbs_g,
          fiber_g: bi.ingredient.fiber_g,
          sugar_g: bi.ingredient.sugar_g,
          fat_g: bi.ingredient.fat_g,
          saturated_fat_g: bi.ingredient.saturated_fat_g,
          sodium_mg: bi.ingredient.sodium_mg,
          omega3_g: bi.ingredient.omega3_g,
        },
        serving_g: bi.serving_g,
      }))))
    : null;

  return (
    <div className="main-content min-h-screen bg-cream-bg flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-cream-bg px-4 pt-4 pb-3">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => navigate(-1)} className="tap-target flex items-center justify-center rounded-full hover:bg-sand transition-colors">
            <ArrowLeft size={20} className="text-plum-dark" />
          </button>
          <div className="flex-1 flex items-center gap-2 bg-cream-card border border-sand rounded-2xl px-3 py-2.5">
            <Search size={16} className="text-ink-40 flex-shrink-0" />
            <input
              autoFocus={!!initialQuery}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={activeTab === 'meals' ? 'Search meals…' : 'Search ingredients…'}
              className="flex-1 bg-transparent text-sm text-plum-dark placeholder-ink-40 focus:outline-none"
            />
            {query.length > 0 && (
              <button onClick={() => setQuery('')} className="tap-target flex items-center justify-center">
                <X size={14} className="text-ink-40" />
              </button>
            )}
          </div>
          <button
            onClick={() => navigate('/scan')}
            className="tap-target flex items-center justify-center w-10 h-10 rounded-2xl bg-cream-card border border-sand"
          >
            <Barcode size={18} className="text-plum-dark" />
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 bg-sand/50 rounded-xl p-1">
          {([
            { key: 'ingredients', label: 'Ingredients' },
            { key: 'meals', label: 'Meals' },
            { key: 'build', label: 'Build meal' },
          ] as const).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                activeTab === tab.key
                  ? 'bg-cream-bg text-plum-dark shadow-sm'
                  : 'text-ink-40'
              }`}
            >
              {tab.key === 'build' && buildItems.length > 0 ? `Build (${buildItems.length})` : tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 px-4 pb-6 space-y-5 overflow-y-auto">

        {/* ── INGREDIENTS TAB ─────────────────────────────────────────────── */}
        {activeTab === 'ingredients' && (
          <>
            {query.length >= 2 ? (
              <>
                {/* Local results */}
                {ingResults.length > 0 && (
                  <section>
                    <h2 className="text-xs font-semibold text-ink-40 uppercase tracking-wide mb-2">
                      Ingredients ({ingResults.length})
                    </h2>
                    <div className="space-y-2">
                      {ingResults.map((ing) => (
                        <IngredientRow
                          key={ing.id}
                          ingredient={ing}
                          mode={profile.mode}
                          onAdd={() => setPendingIngredient(ing)}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {/* OFF Israel results */}
                {(offLoading || offResults.length > 0) && (
                  <section>
                    <h2 className="text-xs font-semibold text-ink-40 uppercase tracking-wide mb-2">
                      Israeli products {offLoading ? '…' : `(${offResults.length})`}
                    </h2>
                    {!offLoading && (
                      <div className="space-y-2">
                        {offResults.map((item) => (
                          <OFFRow
                            key={item.id}
                            item={item}
                            onAdd={() => setPendingOff(item)}
                          />
                        ))}
                      </div>
                    )}
                  </section>
                )}

                {ingResults.length === 0 && offResults.length === 0 && !offLoading && (
                  <p className="text-sm text-ink-40 text-center py-8">No ingredients found for "{query}"</p>
                )}
              </>
            ) : (
              <>
                {/* Recent */}
                {recent.length > 0 && (
                  <section>
                    <h2 className="text-xs font-semibold text-ink-40 uppercase tracking-wide mb-2">Recent</h2>
                    <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                      {recent.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => setQuery(m.name.replace(/ \(\d+ g\)$/, ''))}
                          className="flex-shrink-0 bg-cream-card border border-sand rounded-xl px-3 py-2 text-xs font-medium text-ink-60 whitespace-nowrap"
                        >
                          {m.name.replace(/ \(\d+ g\)$/, '').split(' ').slice(0, 3).join(' ')}
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                {/* Browse by category */}
                <section>
                  <h2 className="text-xs font-semibold text-ink-40 uppercase tracking-wide mb-2">
                    {profile.mode === 'pcos' ? 'PCOS-friendly staples' : 'Bulk staples'}
                  </h2>
                  <div className="space-y-2">
                    {ingredientDatabase
                      .filter((i) => profile.mode === 'pcos' ? i.pcos_score >= 9.0 : i.bulk_score >= 9.0)
                      .sort((a, b) =>
                        profile.mode === 'pcos' ? b.pcos_score - a.pcos_score : b.bulk_score - a.bulk_score
                      )
                      .slice(0, 8)
                      .map((ing) => (
                        <IngredientRow
                          key={ing.id}
                          ingredient={ing}
                          mode={profile.mode}
                          onAdd={() => setPendingIngredient(ing)}
                        />
                      ))}
                  </div>
                </section>
              </>
            )}
          </>
        )}

        {/* ── MEALS TAB ───────────────────────────────────────────────────── */}
        {activeTab === 'meals' && (
          <>
            {query.length > 1 ? (
              <section>
                <h2 className="text-xs font-semibold text-ink-40 uppercase tracking-wide mb-2">
                  Results {mealFiltered.length > 0 ? `(${mealFiltered.length})` : '— no matches'}
                </h2>
                <div className="space-y-2">
                  {mealFiltered.map((meal) => (
                    <MealRow
                      key={meal.id}
                      meal={meal}
                      profile={profile}
                      onLog={quickLogMeal}
                      loggedId={loggedMealId}
                    />
                  ))}
                </div>
              </section>
            ) : (
              <>
                {recent.length > 0 && (
                  <section>
                    <h2 className="text-xs font-semibold text-ink-40 uppercase tracking-wide mb-2">Recent</h2>
                    <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                      {recent.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => setQuery(m.name)}
                          className="flex-shrink-0 bg-cream-card border border-sand rounded-xl px-3 py-2 text-xs font-medium text-ink-60 whitespace-nowrap"
                        >
                          {m.name.split(' ').slice(0, 3).join(' ')}
                        </button>
                      ))}
                    </div>
                  </section>
                )}
                <section>
                  <h2 className="text-xs font-semibold text-ink-40 uppercase tracking-wide mb-2">
                    {profile.mode === 'pcos' ? 'PCOS Favourites' : 'Bulk Favourites'}
                  </h2>
                  <div className="space-y-2">
                    {favorites.map((meal) => (
                      <MealRow
                        key={meal.id}
                        meal={meal}
                        profile={profile}
                        onLog={quickLogMeal}
                        loggedId={loggedMealId}
                      />
                    ))}
                  </div>
                </section>
              </>
            )}
          </>
        )}

        {/* ── BUILD A MEAL TAB ────────────────────────────────────────────── */}
        {activeTab === 'build' && (
          <>
            {/* Ingredient search for build */}
            {query.length >= 2 && (
              <section>
                <h2 className="text-xs font-semibold text-ink-40 uppercase tracking-wide mb-2">
                  Add to meal
                </h2>
                <div className="space-y-2">
                  {searchIngredients(query).map((ing) => (
                    <IngredientRow
                      key={ing.id}
                      ingredient={ing}
                      mode={profile.mode}
                      onAdd={() => setBuildPendingIngredient(ing)}
                      actionLabel="Add"
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Items in build */}
            {buildItems.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-ink-40 uppercase tracking-wide mb-2">
                  In this meal ({buildItems.length} ingredient{buildItems.length !== 1 ? 's' : ''})
                </h2>
                <div className="space-y-2">
                  {buildItems.map((bi, idx) => (
                    <div
                      key={`${bi.ingredient.id}-${idx}`}
                      className="bg-cream-card border border-sand rounded-xl px-4 py-3 flex items-center gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-plum-dark truncate">{bi.ingredient.name}</p>
                        <p className="text-xs text-ink-40">{bi.serving_g} g · {Math.round(bi.ingredient.calories * bi.serving_g / 100)} kcal</p>
                      </div>
                      <button
                        onClick={() => setBuildItems((prev) => prev.filter((_, i) => i !== idx))}
                        className="tap-target flex items-center justify-center"
                      >
                        <X size={16} className="text-ink-40" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Totals preview */}
            {buildTotals && (
              <div className="bg-cream-card border border-sage-primary/30 rounded-2xl p-4">
                <p className="text-xs font-semibold text-ink-40 uppercase tracking-wide mb-2">Meal totals</p>
                <div className="grid grid-cols-4 gap-2 text-center">
                  {[
                    { label: 'kcal', val: buildTotals.calories },
                    { label: 'Protein', val: `${buildTotals.protein_g}g` },
                    { label: 'Carbs', val: `${buildTotals.carbs_g}g` },
                    { label: 'Fat', val: `${buildTotals.fat_g}g` },
                  ].map(({ label, val }) => (
                    <div key={label}>
                      <p className="text-sm font-bold text-plum-dark">{val}</p>
                      <p className="text-[10px] text-ink-40">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Meal name + log button */}
            {buildItems.length > 0 && (
              <div className="space-y-3">
                <input
                  type="text"
                  value={buildMealName}
                  onChange={(e) => setBuildMealName(e.target.value)}
                  placeholder="Name this meal (optional)"
                  className="w-full px-4 py-3 rounded-2xl border border-sand bg-cream-card text-plum-dark placeholder-ink-40 focus:outline-none focus:border-sage-primary"
                />
                <button
                  onClick={logBuildMeal}
                  className="w-full bg-sage-deep text-white py-4 rounded-2xl font-semibold flex items-center justify-center gap-2"
                >
                  <Layers size={18} />
                  Log meal ({buildItems.length} ingredient{buildItems.length !== 1 ? 's' : ''})
                </button>
              </div>
            )}

            {buildItems.length === 0 && query.length < 2 && (
              <div className="text-center py-12">
                <Layers size={36} className="mx-auto text-ink-40 mb-3" />
                <p className="text-sm font-medium text-ink-60 mb-1">Build a custom meal</p>
                <p className="text-xs text-ink-40">Search for ingredients above to add them one by one</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Serving picker for ingredient tab */}
      {pendingIngredient && (
        <ServingPicker
          defaultG={pendingIngredient.common_serving_g}
          defaultLabel={pendingIngredient.common_serving_label}
          onConfirm={(g) => logIngredient(pendingIngredient, g)}
          onCancel={() => setPendingIngredient(null)}
        />
      )}

      {/* Serving picker for OFF item */}
      {pendingOff && (
        <ServingPicker
          defaultG={100}
          defaultLabel="100 g"
          onConfirm={(g) => logOff(pendingOff, g)}
          onCancel={() => setPendingOff(null)}
        />
      )}

      {/* Serving picker for build-a-meal */}
      {buildPendingIngredient && (
        <ServingPicker
          defaultG={buildPendingIngredient.common_serving_g}
          defaultLabel={buildPendingIngredient.common_serving_label}
          onConfirm={(g) => {
            setBuildItems((prev) => [...prev, { ingredient: buildPendingIngredient, serving_g: g }]);
            setBuildPendingIngredient(null);
            setQuery('');
          }}
          onCancel={() => setBuildPendingIngredient(null)}
        />
      )}
    </div>
  );
}

// ─── sub-components ──────────────────────────────────────────────────────────

function IngredientRow({
  ingredient,
  mode,
  onAdd,
  actionLabel = '+',
}: {
  ingredient: Ingredient;
  mode: 'pcos' | 'bulk' | 'maintain';
  onAdd: () => void;
  actionLabel?: string;
}) {
  const score = mode === 'pcos' ? ingredient.pcos_score : ingredient.bulk_score;

  return (
    <div className="bg-cream-card border border-sand rounded-2xl p-3.5 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-plum-dark">{ingredient.name}</span>
          {ingredient.nameHe && (
            <span className="text-xs text-ink-40">{ingredient.nameHe}</span>
          )}
          <ScoreBadge score={score} size="sm" />
        </div>
        <div className="text-xs text-ink-40 mt-0.5 flex gap-2 flex-wrap">
          <span>{ingredient.calories} kcal/100g</span>
          <span>·</span>
          <span>{ingredient.protein_g}g P</span>
          <span>·</span>
          <span>{ingredient.carbs_g}g C</span>
          <span>·</span>
          <span>{ingredient.fat_g}g F</span>
        </div>
        {ingredient.tags.length > 0 && (
          <div className="flex gap-1 mt-1 flex-wrap">
            {ingredient.tags.slice(0, 3).map((t) => (
              <span key={t} className="text-[10px] bg-sand text-ink-60 rounded-full px-2 py-0.5">{t}</span>
            ))}
          </div>
        )}
      </div>
      <button
        onClick={onAdd}
        className="tap-target w-10 h-10 rounded-full bg-coral-accent text-white flex items-center justify-center flex-shrink-0 active:scale-95 transition-transform"
      >
        {actionLabel === '+' ? <Plus size={18} /> : <ChevronRight size={16} />}
      </button>
    </div>
  );
}

function OFFRow({
  item,
  onAdd,
}: {
  item: { id: string; name: string; nutrition: NutritionData };
  onAdd: () => void;
}) {
  return (
    <div className="bg-cream-card border border-sand rounded-2xl p-3.5 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-plum-dark truncate">{item.name}</p>
        <div className="text-xs text-ink-40 mt-0.5 flex gap-2">
          <span>{item.nutrition.calories} kcal/100g</span>
          <span>·</span>
          <span>{item.nutrition.protein_g}g P</span>
          <span>·</span>
          <span>{item.nutrition.carbs_g}g C</span>
        </div>
      </div>
      <button
        onClick={onAdd}
        className="tap-target w-10 h-10 rounded-full bg-coral-accent text-white flex items-center justify-center flex-shrink-0 active:scale-95 transition-transform"
      >
        <Plus size={18} />
      </button>
    </div>
  );
}

function MealRow({
  meal,
  profile,
  onLog,
  loggedId,
}: {
  meal: MealItem;
  profile: NonNullable<ReturnType<typeof selectActiveProfile>>;
  onLog: (m: MealItem) => void;
  loggedId: string | null;
}) {
  const score = profile.mode === 'pcos' ? meal.pcos_score : (meal.bulk_score ?? meal.pcos_score);
  const isLogged = loggedId === meal.id;

  return (
    <div className="bg-cream-card border border-sand rounded-2xl p-3.5 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-plum-dark">{meal.name}</span>
          <ScoreBadge score={score} size="sm" />
        </div>
        <div className="text-xs text-ink-40 mt-0.5 flex gap-2">
          <span>{meal.nutrition.calories} kcal</span>
          <span>·</span>
          <span>{meal.nutrition.protein_g}g P</span>
          <span>·</span>
          <span>{meal.prep_time_min} min</span>
        </div>
        {meal.gap_coverage.length > 0 && (
          <div className="flex gap-1 mt-1 flex-wrap">
            {meal.gap_coverage.map((g) => (
              <span key={g} className="text-[10px] bg-sand text-ink-60 rounded-full px-2 py-0.5">{g}</span>
            ))}
          </div>
        )}
      </div>
      <button
        onClick={() => onLog(meal)}
        className={`tap-target w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
          isLogged ? 'bg-moss text-white scale-95' : 'bg-coral-accent text-white active:scale-95'
        }`}
      >
        {isLogged ? <Check size={18} /> : <Plus size={18} />}
      </button>
    </div>
  );
}
